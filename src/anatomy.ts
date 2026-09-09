import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createHeart } from "./heart";
import { createLungs } from "./lungs";
import { createMuscles } from "./muscles";
import { createSkeleton } from "./skeleton";

type Point = [number, number, number];
type Activity = "rest" | "walk" | "run";
export type Anatomy = {
  group: THREE.Group;
  heart: THREE.Group;
  layers: Record<
    | "body"
    | "arteries"
    | "veins"
    | "nerves"
    | "skeleton"
    | "lungs"
    | "flow"
    | "muscles",
    THREE.Group
  >;
  sites: Record<string, THREE.Vector3>;
  animate: (
    time: number,
    heartRate: number,
    activity: Activity,
    respiratoryRate?: number,
  ) => void;
  setPresentation: (mode: "atlas" | "xray") => void;
  dispose: () => void;
};

// Original illustrative geometry. The vessel/nerve routes deliberately simplify
// clinical anatomy; their purpose is spatial teaching, not anatomical diagnosis.
const motionGLSL = /* glsl */ `
uniform float anatomyTime;
uniform float anatomyMotion;
uniform float anatomyCadence;
vec3 rotateSagittal(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}
vec3 anatomicalMotion(vec3 p) {
  float side = p.x < 0.0 ? -1.0 : 1.0;
  float step = sin(anatomyTime * anatomyCadence) * side;
  if (p.y < 1.79 && abs(p.x) < 0.43) {
    float weight = 1.0 - smoothstep(1.57, 1.79, p.y);
    if (p.y < 0.96) {
      vec3 knee = vec3(side * 0.223, 0.96, 0.03);
      float bend = max(0.0, -step) * anatomyMotion * 1.3;
      p = knee + rotateSagittal(p-knee, -bend);
    }
    vec3 hip = vec3(side * 0.215, 1.72, 0.0);
    p = mix(p, hip + rotateSagittal(p-hip, step * anatomyMotion), weight);
  } else if (abs(p.x) > 0.39 && p.y > 1.25 && p.y < 2.88) {
    float weight = smoothstep(0.39, 0.53, abs(p.x));
    vec3 shoulder = vec3(side * 0.42, 2.81, 0.0);
    p = mix(p, shoulder + rotateSagittal(p-shoulder, -step * anatomyMotion * 0.7), weight);
  }
  return p;
}
`;

function vessel(
  points: Point[],
  radius: number,
  taper = 0.6,
  segments?: number,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  const steps = segments ?? Math.max(9, Math.ceil(curve.getLength() * 36));
  const radial = radius > 0.012 ? 10 : radius > 0.004 ? 7 : 5;
  const frames = curve.computeFrenetFrames(steps, false);
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const center = curve.getPointAt(t);
    const r = radius * THREE.MathUtils.lerp(1, taper, t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = center
        .clone()
        .addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r);
      vertices.push(p.x, p.y, p.z);
      if (i < steps && j < radial) {
        const v = i * (radial + 1) + j;
        indices.push(
          v,
          v + 1,
          v + radial + 1,
          v + 1,
          v + radial + 2,
          v + radial + 1,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ellipsoid(
  center: Point,
  scale: Point,
  rotation = 0,
  detail = 24,
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, detail, Math.max(12, detail - 8));
  geo.scale(...scale);
  geo.rotateZ(rotation);
  geo.translate(...center);
  return geo;
}

function merge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = geometries.map((g) => {
    g.deleteAttribute("uv");
    g.deleteAttribute("uv1");
    g.deleteAttribute("color");
    g.deleteAttribute("tangent");
    const copy = g.index ? g.toNonIndexed() : g;
    return copy;
  });
  const merged = mergeGeometries(normalized, false)!;
  for (const geo of new Set([...geometries, ...normalized])) geo.dispose();
  merged.computeBoundingSphere();
  return merged;
}

function mirrored(
  points: Point[],
  sign: number,
  zOffset = 0,
  xOffset = 0,
): Point[] {
  return points.map(([x, y, z]) => [sign * (x + xOffset), y, z + zOffset]);
}

/** Adds deliberately irregular fine branches inside a limb's silhouette. */
function peripheralBranches(
  out: THREE.BufferGeometry[],
  points: Point[],
  width: number,
  radius: number,
  count: number,
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const extent = width * (0.82 + Math.sin(i * 2.47) * 0.18) * (1 - t * 0.2);
    for (const side of [-1, 1]) {
      const q = p
        .clone()
        .addScaledVector(normal, side * extent * 0.55)
        .addScaledVector(tangent, 0.035);
      const r = p
        .clone()
        .addScaledVector(normal, side * extent)
        .addScaledVector(tangent, 0.075 + 0.04 * Math.sin(i));
      q.z += 0.012;
      r.z += 0.021;
      const end = r.clone().addScaledVector(tangent, 0.055);
      out.push(
        vessel(
          [p.toArray(), q.toArray(), r.toArray(), end.toArray()] as Point[],
          radius,
          0.14,
          9,
        ),
      );
      if (i % 2 === 0) {
        const fork = q
          .clone()
          .addScaledVector(tangent, -0.055)
          .addScaledVector(normal, side * extent * 0.4);
        out.push(
          vessel(
            [
              q.toArray(),
              fork.toArray(),
              fork.clone().addScaledVector(tangent, -0.04).toArray(),
            ] as Point[],
            radius * 0.55,
            0.12,
            6,
          ),
        );
      }
    }
  }
}

export function createAnatomy(): Anatomy {
  const group = new THREE.Group();
  group.name = "Plethscape · original anatomical study";
  const layers = {
    body: new THREE.Group(),
    arteries: new THREE.Group(),
    veins: new THREE.Group(),
    nerves: new THREE.Group(),
    skeleton: new THREE.Group(),
    lungs: new THREE.Group(),
    flow: new THREE.Group(),
    muscles: new THREE.Group(),
  };
  for (const [name, layer] of Object.entries(layers)) {
    layer.name = name;
    group.add(layer);
  }
  const heartModel = createHeart();
  const heart = heartModel.group;
  heart.name = "Beating heart";
  heart.position.set(0.102, 2.605, 0.133);
  layers.arteries.add(heart);
  let disposed = false;
  const materialSet = new Set<THREE.Material>();
  const geometrySet = new Set<THREE.BufferGeometry>();
  const motion = {
    anatomyTime: { value: 0 },
    anatomyMotion: { value: 0 },
    anatomyCadence: { value: 5.5 },
  };

  function material(
    color: THREE.ColorRepresentation,
    opacity = 1,
    emissiveIntensity = 0,
  ): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.61,
      metalness: 0.035,
      emissive: color,
      emissiveIntensity,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, motion);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${motionGLSL}`)
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed = anatomicalMotion(transformed);",
        );
    };
    mat.customProgramCacheKey = () => "plethscape-motion-v1";
    materialSet.add(mat);
    return mat;
  }
  function mesh(
    out: THREE.Group,
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    order = 0,
  ): THREE.Mesh {
    const geo = parts.length === 1 ? parts[0] : merge(parts);
    geometrySet.add(geo);
    const obj = new THREE.Mesh(geo, mat);
    obj.renderOrder = order;
    out.add(obj);
    return obj;
  }

  const arteryMaterial = material("#ba4332", 1, 0.32);
  const fineArteryMaterial = material("#ce6447", 0.9, 0.36);
  const veinMaterial = material("#41798a", 0.63, 0.13);
  const nerveMaterial = material("#bc934e", 0.9, 0.23);
  const fineNerveMaterial = material("#a89365", 0.5, 0.06);

  const surfaceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...motion,
      surfaceColor: { value: new THREE.Color("#afa995") },
      surfaceDensity: { value: 0.13 },
    },
    vertexShader: /* glsl */ `
      ${motionGLSL}
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vSurface;
      void main() {
        vec3 p = anatomicalMotion(position);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vSurface=position;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 surfaceColor;
      uniform float surfaceDensity;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vSurface;
      void main() {
        vec3 n = normalize(vNormal);
        float facing = abs(dot(n, normalize(vView)));
        float rim = pow(1.0 - facing, 2.8);
        float light = 0.29 + max(dot(n, normalize(vec3(-0.65, 0.48, 0.85))), 0.0) * 0.71;
        float pore=sin(vSurface.x*413.0+sin(vSurface.z*178.0))*sin(vSurface.y*593.0)*.012;
        float atlas=step(0.07,surfaceDensity);
        float head=smoothstep(3.08,3.25,vSurface.y);
        float hand=smoothstep(0.84,0.91,abs(vSurface.x))*(1.0-smoothstep(1.74,1.88,vSurface.y));
        float foot=1.0-smoothstep(0.12,0.24,vSurface.y);
        float limb=max(smoothstep(0.40,0.56,abs(vSurface.x)),1.0-smoothstep(1.68,1.90,vSurface.y));
        float anatomyOpacity=atlas*(head*0.56+hand*0.24+foot*0.18+limb*0.06);
        gl_FragColor = vec4(surfaceColor * (light + rim * 0.35 + pore), clamp(surfaceDensity + rim * 0.30 + anatomyOpacity,0.0,.94));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  materialSet.add(surfaceMaterial);

  // An immediate lightweight fallback is replaced by the original Blender mesh.
  const fallbackParts: THREE.BufferGeometry[] = [
    ellipsoid([0, 2.38, 0], [0.345, 0.54, 0.214]),
    ellipsoid([0, 1.85, 0], [0.321, 0.31, 0.2]),
    ellipsoid([0, 3.05, -0.02], [0.105, 0.19, 0.11]),
    ellipsoid([0, 3.4, 0], [0.183, 0.25, 0.19]),
  ];
  for (const s of [-1, 1]) {
    fallbackParts.push(
      vessel(
        mirrored(
          [
            [0.39, 2.8, 0],
            [0.55, 2.59, 0.01],
            [0.71, 2.29, 0.02],
            [0.8, 2.02, 0.03],
            [0.89, 1.78, 0.03],
          ],
          s,
        ),
        0.125,
        0.38,
      ),
      ellipsoid([s * 0.932, 1.63, 0.033], [0.081, 0.15, 0.044], s * 0.2),
      vessel(
        mirrored(
          [
            [0.2, 1.73, 0],
            [0.23, 1.42, 0.01],
            [0.225, 0.95, 0.03],
            [0.217, 0.65, -0.02],
            [0.21, 0.2, 0],
          ],
          s,
        ),
        0.151,
        0.34,
      ),
      ellipsoid([s * 0.21, 0.075, 0.14], [0.082, 0.073, 0.205]),
    );
  }
  const fallback = mesh(layers.body, fallbackParts, surfaceMaterial, 5);
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
    "/models/neutral-anatomy.meshopt.glb",
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      const pieces: THREE.BufferGeometry[] = [];
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          // Dequantize before applying the glTF node's world transform. Writing
          // world positions back into normalized integer attributes would clamp
          // the body and destroy its proportions.
          const decoded = o.geometry.clone();
          for (const name of ["position", "normal"]) {
            const attr = decoded.getAttribute(name);
            if (attr) {
              const values = new Float32Array(attr.count * 3);
              for (let i = 0; i < attr.count; i++) {
                values[i * 3] = attr.getX(i);
                values[i * 3 + 1] = attr.getY(i);
                values[i * 3 + 2] = attr.getZ(i);
              }
              decoded.setAttribute(
                name,
                new THREE.Float32BufferAttribute(values, 3),
              );
            }
          }
          pieces.push(decoded.applyMatrix4(o.matrixWorld));
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mat of mats) mat.dispose();
        }
      });
      if (pieces.length) {
        const shell = mesh(layers.body, pieces, surfaceMaterial, 5);
        shell.name = "Seamless neutral body surface";
        layers.body.remove(fallback);
        group.userData.bodyLoaded = true;
        fallback.geometry.dispose();
        geometrySet.delete(fallback.geometry);
      }
    },
    undefined,
    () => {
      /* The procedural fallback remains fully usable offline. */
    },
  );

  const lungModel = createLungs();
  layers.lungs.add(lungModel.group);

  const arteries: THREE.BufferGeometry[] = [];
  const capillaries: THREE.BufferGeometry[] = [];
  const veins: THREE.BufferGeometry[] = [];
  const nerves: THREE.BufferGeometry[] = [];
  const fineNerves: THREE.BufferGeometry[] = [];

  // Aortic arch, descending aorta, iliac bifurcation and the vena cava.
  const aorta: Point[] = [
    [0.045, 2.7, 0.11],
    [0.025, 2.84, 0.1],
    [0.085, 2.9, 0.045],
    [0.151, 2.84, -0.025],
    [0.13, 2.67, -0.065],
    [0.08, 2.47, -0.073],
    [0.025, 2.21, -0.035],
    [0.005, 1.9, -0.022],
  ];
  arteries.push(vessel(aorta, 0.028, 0.72));
  veins.push(
    vessel(
      [
        [-0.045, 1.9, -0.003],
        [-0.044, 2.15, -0.005],
        [-0.046, 2.4, -0.03],
        [-0.045, 2.61, 0.015],
        [-0.028, 2.72, 0.067],
      ],
      0.024,
      0.94,
    ),
  );
  veins.push(
    vessel(
      [
        [-0.028, 2.69, 0.069],
        [-0.078, 2.8, 0.021],
        [-0.069, 2.96, -0.005],
      ],
      0.021,
      0.76,
    ),
  );

  const arm: Point[] = [
    [0.37, 2.8, 0.045],
    [0.49, 2.66, 0.045],
    [0.587, 2.47, 0.05],
    [0.699, 2.27, 0.055],
    [0.76, 2.11, 0.064],
    [0.833, 1.935, 0.07],
    [0.888, 1.778, 0.075],
  ];
  const leg: Point[] = [
    [0.08, 1.9, -0.018],
    [0.19, 1.74, 0.075],
    [0.211, 1.54, 0.124],
    [0.215, 1.26, 0.116],
    [0.223, 0.96, 0.09],
    [0.2, 0.735, 0.069],
    [0.196, 0.49, 0.052],
    [0.211, 0.2, 0.038],
  ];
  const nerveArm: Point[] = [
    [0.075, 2.96, -0.078],
    [0.245, 2.86, -0.06],
    [0.42, 2.73, 0.012],
    [0.558, 2.5, 0.022],
    [0.693, 2.265, 0.025],
    [0.78, 2.04, 0.035],
    [0.9, 1.75, 0.053],
  ];
  const nerveLeg: Point[] = [
    [0.025, 1.98, -0.105],
    [0.143, 1.79, -0.103],
    [0.234, 1.57, -0.11],
    [0.255, 1.28, -0.083],
    [0.244, 0.97, -0.032],
    [0.23, 0.745, -0.084],
    [0.211, 0.46, -0.05],
    [0.211, 0.17, 0.01],
  ];

  // A blood tracer shows downstream material transport, NOT a pressure pulse.
  // Display speed and cell size are deliberately exaggerated for legibility;
  // neither encodes measured blood velocity or the speed of a PPG pressure wave.
  // All routes share the actual principal artery centerlines above/below.
  type FlowRoute = {
    points: THREE.Vector3[];
    length: number;
    width: number;
    speed: number;
  };
  const flowRoutes: FlowRoute[] = [];
  function flowRoute(points: Point[], width: number, speed = 1) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const length = curve.getLength();
    flowRoutes.push({
      points: curve.getSpacedPoints(Math.max(32, Math.ceil(length * 95))),
      length,
      width,
      speed,
    });
  }
  flowRoute(aorta, 0.025, 1);
  for (const s of [-1, 1]) {
    flowRoute(
      mirrored(
        [
          [0.06, 2.89, 0.027],
          [0.077, 3.02, 0.053],
          [0.088, 3.15, 0.052],
          [0.118, 3.26, 0.052],
          [0.137, 3.39, 0.052],
          [0.12, 3.51, 0.088],
        ],
        s,
      ),
      0.01,
      0.79,
    );
    flowRoute(
      mirrored(
        [
          [0.055, 2.875, 0.03],
          [0.16, 2.88, 0.022],
          [0.275, 2.855, 0.025],
          ...arm,
        ],
        s,
      ),
      0.012,
      0.9,
    );
    flowRoute(
      mirrored(
        [
          ...leg,
          [0.194, 0.12, 0.15],
          [0.22, 0.088, 0.245],
          [0.17, 0.073, 0.33],
        ],
        s,
      ),
      0.014,
      0.86,
    );
    flowRoute(
      mirrored(
        [
          [0.888, 1.778, 0.075],
          [0.923, 1.697, 0.078],
          [0.983, 1.645, 0.076],
        ],
        s,
      ),
      0.0057,
      0.53,
    );
    for (const [offset, length] of [
      [-0.052, 0.172],
      [-0.015, 0.206],
      [0.025, 0.192],
      [0.061, 0.15],
    ]) {
      const x = 0.928 + offset;
      flowRoute(
        mirrored(
          [
            [0.925, 1.66, 0.075],
            [x, 1.596, 0.075],
            [x + 0.008, 1.595 - length * 0.55, 0.079],
            [x + 0.008, 1.605 - length, 0.078],
          ],
          s,
        ),
        0.0033,
        0.34,
      );
    }
  }
  const flowParticles: { route: FlowRoute; offset: number }[] = [];
  for (const [index, route] of flowRoutes.entries()) {
    const count = Math.max(
      2,
      Math.ceil(route.length / (route.width < 0.006 ? 0.075 : 0.145)),
    );
    for (let i = 0; i < count; i++)
      flowParticles.push({ route, offset: (i / count + index * 0.137) % 1 });
  }
  const cellGeometry = new THREE.SphereGeometry(1, 8, 6);
  cellGeometry.setAttribute(
    "tracerRadius",
    new THREE.InstancedBufferAttribute(
      new Float32Array(flowParticles.map((p) => p.route.width)),
      1,
    ),
  );
  const cellMaterial = new THREE.MeshStandardMaterial({
    color: "#a52016",
    emissive: "#e33720",
    emissiveIntensity: 0.18,
    roughness: 0.37,
    metalness: 0.08,
    depthWrite: false,
    depthTest: true,
  });
  cellMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, motion);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${motionGLSL}\nattribute float tracerRadius;`,
      )
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
        vec4 mvPosition = vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition.xyz = anatomicalMotion(mvPosition.xyz);
        // Present each illustrative cell on the visible vessel surface. This
        // keeps tracers legible with ordinary depth testing, so the heart can
        // correctly occlude blood moving in the descending aorta behind it.
        vec3 routeCenter = anatomicalMotion(instanceMatrix[3].xyz);
        vec3 routeDirection = normalize(anatomicalMotion(instanceMatrix[3].xyz + normalize(instanceMatrix[1].xyz)*0.02) - routeCenter);
        vec3 cameraDirection = normalize(transpose(mat3(modelMatrix)) * (cameraPosition - (modelMatrix*vec4(routeCenter,1.0)).xyz));
        vec3 radialDirection = normalize(cameraDirection - routeDirection*dot(cameraDirection,routeDirection));
        mvPosition.xyz += radialDirection * tracerRadius * 0.86;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `,
      );
  };
  cellMaterial.customProgramCacheKey = () => "plethscape-flow-v1";
  const bloodCells = new THREE.InstancedMesh(
    cellGeometry,
    cellMaterial,
    flowParticles.length,
  );
  bloodCells.name = "Illustrative downstream blood tracers";
  bloodCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bloodCells.frustumCulled = false;
  bloodCells.renderOrder = 4;
  layers.flow.add(bloodCells);
  geometrySet.add(cellGeometry);
  materialSet.add(cellMaterial);
  const cellTransform = new THREE.Object3D();
  const cellTangent = new THREE.Vector3();
  const cellUp = new THREE.Vector3(0, 1, 0);
  let flowTravel = 0;
  let previousFlowTime: number | null = null;

  for (const s of [-1, 1]) {
    arteries.push(
      vessel(
        mirrored(
          [
            [0.055, 2.875, 0.03],
            [0.16, 2.88, 0.022],
            [0.275, 2.855, 0.025],
            [0.37, 2.8, 0.045],
          ],
          s,
        ),
        0.018,
        0.74,
      ),
    );
    arteries.push(vessel(mirrored(arm, s), 0.014, 0.4));
    arteries.push(
      vessel(
        mirrored(
          [
            [0.699, 2.27, 0.055],
            [0.748, 2.1, 0.085],
            [0.795, 1.93, 0.082],
            [0.85, 1.77, 0.077],
            [0.88, 1.66, 0.077],
            [0.946, 1.615, 0.077],
            [0.994, 1.64, 0.068],
          ],
          s,
        ),
        0.008,
        0.42,
      ),
    );
    peripheralBranches(capillaries, mirrored(arm, s), 0.067, 0.0034, 13);
    arteries.push(vessel(mirrored(leg, s), 0.018, 0.31));
    arteries.push(
      vessel(
        mirrored(
          [
            [0.211, 1.64, 0.104],
            [0.286, 1.47, 0.044],
            [0.304, 1.3, 0.013],
            [0.274, 1.1, 0.014],
          ],
          s,
        ),
        0.009,
        0.22,
      ),
    );
    arteries.push(
      vessel(
        mirrored(
          [
            [0.223, 0.96, 0.09],
            [0.248, 0.79, 0.098],
            [0.25, 0.6, 0.081],
            [0.238, 0.4, 0.062],
            [0.23, 0.19, 0.055],
            [0.22, 0.1, 0.193],
            [0.17, 0.073, 0.33],
          ],
          s,
        ),
        0.008,
        0.36,
      ),
    );
    peripheralBranches(
      capillaries,
      mirrored(leg.slice(1), s),
      0.085,
      0.0037,
      17,
    );
    capillaries.push(
      vessel(
        mirrored(
          [
            [0.211, 0.2, 0.038],
            [0.194, 0.12, 0.15],
            [0.22, 0.088, 0.245],
            [0.28, 0.08, 0.282],
          ],
          s,
        ),
        0.004,
        0.35,
      ),
    );

    // Carotids and external branches through the neutral head and face.
    arteries.push(
      vessel(
        mirrored(
          [
            [0.06, 2.89, 0.027],
            [0.077, 3.02, 0.053],
            [0.088, 3.15, 0.052],
            [0.118, 3.26, 0.052],
            [0.137, 3.39, 0.052],
            [0.12, 3.51, 0.088],
          ],
          s,
        ),
        0.012,
        0.36,
      ),
    );
    capillaries.push(
      vessel(
        mirrored(
          [
            [0.102, 3.23, 0.07],
            [0.128, 3.28, 0.113],
            [0.148, 3.35, 0.132],
            [0.143, 3.45, 0.139],
            [0.084, 3.545, 0.133],
            [0.04, 3.59, 0.073],
          ],
          s,
        ),
        0.0049,
        0.24,
      ),
    );
    capillaries.push(
      vessel(
        mirrored(
          [
            [0.125, 3.285, 0.1],
            [0.09, 3.275, 0.172],
            [0.073, 3.335, 0.191],
            [0.04, 3.393, 0.17],
          ],
          s,
        ),
        0.0041,
        0.17,
      ),
    );
    capillaries.push(
      vessel(
        mirrored(
          [
            [0.135, 3.365, 0.055],
            [0.177, 3.355, 0.026],
            [0.19, 3.38, 0.014],
          ],
          s,
        ),
        0.0047,
        0.31,
      ),
    );
    for (let b = 0; b < 5; b++) {
      capillaries.push(
        vessel(
          mirrored(
            [
              [0.132, 3.36 + b * 0.027, 0.1],
              [0.114 - b * 0.008, 3.393 + b * 0.025, 0.155],
              [0.079 - b * 0.01, 3.405 + b * 0.028, 0.167],
            ],
            s,
          ),
          0.0024,
          0.12,
        ),
      );
    }

    // Hand arterial arc and five individually routed digits.
    arteries.push(
      vessel(
        mirrored(
          [
            [0.888, 1.778, 0.075],
            [0.923, 1.697, 0.078],
            [0.983, 1.645, 0.076],
          ],
          s,
        ),
        0.0062,
        0.55,
      ),
    );
    for (const [offset, length] of [
      [-0.052, 0.172],
      [-0.015, 0.206],
      [0.025, 0.192],
      [0.061, 0.15],
    ]) {
      const x = 0.928 + offset;
      capillaries.push(
        vessel(
          mirrored(
            [
              [0.925, 1.66, 0.075],
              [x, 1.596, 0.075],
              [x + 0.008, 1.595 - length * 0.55, 0.079],
              [x + 0.008, 1.605 - length, 0.078],
            ],
            s,
          ),
          0.0031,
          0.38,
        ),
      );
      fineNerves.push(
        vessel(
          mirrored(
            [
              [0.91, 1.717, 0.057],
              [x - 0.007, 1.6, 0.058],
              [x + 0.001, 1.59 - length * 0.7, 0.065],
              [x + 0.007, 1.598 - length, 0.071],
            ],
            s,
          ),
          0.0025,
          0.37,
        ),
      );
    }
    capillaries.push(
      vessel(
        mirrored(
          [
            [0.889, 1.697, 0.073],
            [0.851, 1.646, 0.077],
            [0.819, 1.565, 0.105],
          ],
          s,
        ),
        0.0035,
        0.29,
      ),
    );
    fineNerves.push(
      vessel(
        mirrored(
          [
            [0.88, 1.736, 0.061],
            [0.837, 1.666, 0.065],
            [0.811, 1.563, 0.096],
          ],
          s,
        ),
        0.0027,
        0.25,
      ),
    );

    // Deep and superficial venous return, offset from adjacent arteries.
    veins.push(
      vessel(
        mirrored(
          [
            [0.06, 2.94, -0.025],
            [0.2, 2.85, -0.025],
            [0.37, 2.79, -0.008],
            [0.5, 2.64, 0.01],
            [0.615, 2.44, 0.013],
            [0.725, 2.24, 0.03],
            [0.816, 2.01, 0.021],
            [0.927, 1.77, 0.027],
            [0.965, 1.64, 0.04],
          ],
          s,
        ),
        0.012,
        0.39,
      ),
    );
    veins.push(
      vessel(
        mirrored(
          [
            [0.95, 1.65, 0.04],
            [0.886, 1.91, 0.055],
            [0.803, 2.15, 0.047],
            [0.7, 2.34, 0.044],
            [0.6, 2.56, 0.052],
            [0.46, 2.79, 0.08],
            [0.27, 2.87, 0.015],
          ],
          s,
        ),
        0.006,
        0.88,
      ),
    );
    veins.push(vessel(mirrored(leg, s, 0.021, 0.031), 0.011, 0.39));
    veins.push(
      vessel(
        mirrored(
          [
            [0.2, 0.12, 0.183],
            [0.157, 0.3, 0.047],
            [0.144, 0.61, 0.06],
            [0.157, 0.94, 0.058],
            [0.14, 1.24, 0.101],
            [0.13, 1.51, 0.126],
            [0.18, 1.76, 0.105],
          ],
          s,
        ),
        0.0062,
        0.9,
      ),
    );
    veins.push(
      vessel(
        mirrored(
          [
            [0.082, 2.92, -0.026],
            [0.114, 3.075, 0.005],
            [0.139, 3.23, 0.017],
            [0.163, 3.38, -0.023],
          ],
          s,
        ),
        0.01,
        0.45,
      ),
    );

    // Renal and visceral trees remain within the translucent abdomen.
    for (let i = 0; i < 3; i++) {
      const y = 2.4 - i * 0.15;
      capillaries.push(
        vessel(
          mirrored(
            [
              [0.02, y, -0.032],
              [0.1, y - 0.015, 0.021],
              [0.19, y - 0.026, 0.078],
              [0.248, y - 0.085, 0.061],
            ],
            s,
          ),
          0.008 - i * 0.0015,
          0.25,
        ),
      );
      for (let j = 0; j < 3; j++)
        capillaries.push(
          vessel(
            mirrored(
              [
                [0.12 + j * 0.035, y - 0.02, 0.04 + j * 0.014],
                [0.16 + j * 0.03, y - 0.08, 0.1],
                [0.165 + j * 0.031, y - 0.15, 0.115],
              ],
              s,
            ),
            0.003,
            0.13,
          ),
        );
    }

    // Cervical/brachial plexus, median/ulnar/radial nerves and sciatic routes.
    nerves.push(vessel(mirrored(nerveArm, s), 0.009, 0.42));
    nerves.push(vessel(mirrored(nerveLeg, s), 0.009, 0.36));
    nerves.push(
      vessel(
        mirrored(
          [
            [0.69, 2.28, 0.025],
            [0.718, 2.08, 0.012],
            [0.808, 1.865, 0.02],
            [0.882, 1.687, 0.044],
          ],
          s,
        ),
        0.005,
        0.46,
      ),
    );
    nerves.push(
      vessel(
        mirrored(
          [
            [0.24, 0.965, -0.032],
            [0.272, 0.75, 0.013],
            [0.255, 0.51, 0.025],
            [0.23, 0.21, 0.027],
            [0.216, 0.106, 0.215],
          ],
          s,
        ),
        0.0053,
        0.42,
      ),
    );
    peripheralBranches(
      fineNerves,
      mirrored(nerveArm.slice(2), s, 0.033),
      0.065,
      0.0028,
      13,
    );
    peripheralBranches(
      fineNerves,
      mirrored(nerveLeg.slice(2), s, 0.11),
      0.081,
      0.0028,
      16,
    );
    for (let i = 0; i < 5; i++) {
      nerves.push(
        vessel(
          mirrored(
            [
              [0.008, 3.01 - i * 0.031, -0.104],
              [0.105, 2.973 - i * 0.02, -0.04],
              [0.21, 2.865 - i * 0.02, -0.027],
              [0.335, 2.8 - i * 0.014, -0.004],
            ],
            s,
          ),
          0.0043,
          0.45,
        ),
      );
    }
    for (let i = 0; i < 11; i++) {
      const y = 2.77 - i * 0.075;
      const width = 0.28 + Math.sin((i / 10) * Math.PI) * 0.037;
      fineNerves.push(
        vessel(
          mirrored(
            [
              [0.008, y, -0.125],
              [0.1, y - 0.026, -0.17],
              [width * 0.88, y - 0.057, -0.104],
              [width, y - 0.083, 0.022],
              [width * 0.7, y - 0.101, 0.145],
              [0.066, y - 0.11, 0.194],
            ],
            s,
          ),
          0.0033,
          0.31,
        ),
      );
      fineNerves.push(
        vessel(
          mirrored(
            [
              [width, y - 0.08, 0.018],
              [width * 0.9, y - 0.148, 0.08],
              [width * 0.77, y - 0.184, 0.131],
            ],
            s,
          ),
          0.002,
          0.18,
        ),
      );
    }
    fineNerves.push(
      vessel(
        mirrored(
          [
            [0.043, 3.235, -0.054],
            [0.123, 3.286, 0.052],
            [0.15, 3.367, 0.133],
            [0.095, 3.468, 0.165],
            [0.049, 3.525, 0.149],
          ],
          s,
        ),
        0.0036,
        0.3,
      ),
    );
    fineNerves.push(
      vessel(
        mirrored(
          [
            [0.117, 3.302, 0.06],
            [0.098, 3.271, 0.154],
            [0.045, 3.257, 0.182],
          ],
          s,
        ),
        0.003,
        0.25,
      ),
    );
    fineNerves.push(
      vessel(
        mirrored(
          [
            [0.133, 3.325, 0.089],
            [0.1, 3.331, 0.166],
            [0.045, 3.362, 0.185],
          ],
          s,
        ),
        0.0028,
        0.23,
      ),
    );
    for (let i = 0; i < 5; i++) {
      fineNerves.push(
        vessel(
          mirrored(
            [
              [0.211, 0.17, 0.012],
              [0.18 + i * 0.025, 0.092, 0.198],
              [0.153 + i * 0.031, 0.07, 0.329 - i * 0.013],
            ],
            s,
          ),
          0.0026,
          0.18,
        ),
      );
    }
  }

  // Cord and fine spinal roots.
  nerves.push(
    vessel(
      [
        [0, 3.3, -0.108],
        [0, 3.09, -0.11],
        [0, 2.85, -0.142],
        [0, 2.52, -0.169],
        [0, 2.18, -0.127],
        [0, 1.94, -0.111],
      ],
      0.011,
      0.46,
    ),
  );
  for (let i = 0; i < 8; i++) {
    const s = i % 2 ? 1 : -1;
    fineNerves.push(
      vessel(
        [
          [0, 2.1, -0.117],
          [s * 0.015, 1.98, -0.124],
          [s * (0.02 + i * 0.006), 1.78, -0.091],
        ],
        0.0023,
        0.2,
      ),
    );
  }

  // A folded cortical surface, with asymmetric hemispheres and a distinct
  // cerebellum. Fold relief is procedural, not scan-derived gyral anatomy.
  const brainMaterial = material("#a99887", 0.68, 0.012);
  brainMaterial.roughness = 0.86;
  brainMaterial.metalness = 0;
  const brainParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const cortex = new THREE.SphereGeometry(1, 84, 64);
    const a = cortex.getAttribute("position");
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i),
        y = a.getY(i),
        z = a.getZ(i);
      const theta = Math.atan2(z, x),
        phi = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
      const fold1 = Math.sin(
        theta * 12.5 +
          Math.sin(phi * 5.0) * 2.5 +
          Math.sin(theta * 4.0 + phi * 2.0),
      );
      const fold2 = Math.sin(phi * 14.0 + Math.sin(theta * 4.0) * 2.1);
      const folds = Math.pow(Math.abs(fold1 * 0.72 + fold2 * 0.28), 0.42);
      const radius = 0.956 + folds * 0.06;
      const medial = x * side < 0 ? 0.81 : 1;
      a.setXYZ(
        i,
        side * 0.071 + x * 0.091 * radius * medial,
        3.425 + y * 0.15 * radius,
        -0.024 + z * 0.147 * radius,
      );
    }
    cortex.computeVertexNormals();
    brainParts.push(cortex);
  }
  const cerebellum = ellipsoid(
    [0, 3.293, -0.102],
    [0.102, 0.063, 0.087],
    0,
    52,
  );
  const cerebellar = cerebellum.getAttribute("position");
  for (let i = 0; i < cerebellar.count; i++) {
    const y = cerebellar.getY(i);
    cerebellar.setZ(i, cerebellar.getZ(i) + Math.sin(y * 680) * 0.0014);
  }
  cerebellum.computeVertexNormals();
  brainParts.push(cerebellum);
  mesh(layers.nerves, brainParts, brainMaterial, 2);

  const skeletonModel = createSkeleton();
  const muscleModel = createMuscles();
  layers.skeleton.add(skeletonModel.group);
  layers.muscles.add(muscleModel.group);
  for (const mat of [...skeletonModel.materials, ...muscleModel.materials]) {
    const extend = mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      extend(shader, renderer);
      Object.assign(shader.uniforms, motion);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${motionGLSL}`)
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed=anatomicalMotion(transformed);",
        );
    };
    mat.customProgramCacheKey = () => `anatomical-tissue-v3-${mat.name}`;
  }

  mesh(layers.arteries, arteries, arteryMaterial);
  mesh(layers.arteries, capillaries, fineArteryMaterial);
  mesh(layers.veins, veins, veinMaterial);
  mesh(layers.nerves, nerves, nerveMaterial);
  mesh(layers.nerves, fineNerves, fineNerveMaterial);

  const baseSites: Record<string, THREE.Vector3> = {
    finger: new THREE.Vector3(0.884, 1.439, 0.092),
    wrist: new THREE.Vector3(0.887, 1.792, 0.102),
    ear: new THREE.Vector3(0.201, 3.355, 0.028),
    forehead: new THREE.Vector3(0, 3.48, 0.188),
    carotid: new THREE.Vector3(0.091, 3.085, 0.112),
    upperarm: new THREE.Vector3(0.578, 2.494, 0.149),
    toe: new THREE.Vector3(0.155, 0.086, 0.345),
  };
  const sites = Object.fromEntries(
    Object.entries(baseSites).map(([key, p]) => [key, p.clone()]),
  );
  const rotateX = (p: THREE.Vector3, pivot: THREE.Vector3, a: number) =>
    p
      .sub(pivot)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), a)
      .add(pivot);

  function animate(
    time: number,
    heartRate: number,
    activity: Activity,
    respiratoryRate = 16,
  ) {
    motion.anatomyTime.value = time;
    const target = activity === "run" ? 0.47 : activity === "walk" ? 0.25 : 0;
    motion.anatomyMotion.value = THREE.MathUtils.lerp(
      motion.anatomyMotion.value,
      target,
      0.055,
    );
    motion.anatomyCadence.value = activity === "run" ? 8.8 : 5.5;
    const phase = ((((time * heartRate) / 60) % 1) + 1) % 1;
    const contraction = Math.exp(-Math.pow((phase - 0.16) / 0.115, 2));
    heartModel.animate(phase);
    arteryMaterial.emissiveIntensity = 0.035 + contraction * 0.05;
    lungModel.animate(time, respiratoryRate);

    const elapsed =
      previousFlowTime === null
        ? 0
        : THREE.MathUtils.clamp(time - previousFlowTime, 0, 0.06);
    if (previousFlowTime !== null && time < previousFlowTime) flowTravel = 0;
    previousFlowTime = time;
    flowTravel +=
      elapsed *
      0.35 *
      Math.sqrt(THREE.MathUtils.clamp(heartRate, 30, 220) / 72) *
      (0.82 + contraction * 0.48);
    for (let i = 0; i < flowParticles.length; i++) {
      const { route, offset } = flowParticles[i];
      const progress = (offset + (flowTravel * route.speed) / route.length) % 1;
      const cursor = progress * (route.points.length - 1);
      const index = Math.min(route.points.length - 2, Math.floor(cursor));
      cellTransform.position
        .copy(route.points[index])
        .lerp(route.points[index + 1], cursor - index);
      cellTangent
        .subVectors(route.points[index + 1], route.points[index])
        .normalize();
      cellTransform.quaternion.setFromUnitVectors(cellUp, cellTangent);
      const size = route.width * 0.58;
      cellTransform.scale.set(size, size * 1.9, size * 0.57);
      cellTransform.updateMatrix();
      bloodCells.setMatrixAt(i, cellTransform.matrix);
    }
    bloodCells.instanceMatrix.needsUpdate = true;
    group.position.y =
      activity === "rest"
        ? Math.sin(time * 1.12) * 0.003
        : Math.abs(Math.sin(time * motion.anatomyCadence.value)) * 0.025;
    for (const [key, base] of Object.entries(baseSites)) {
      const p = sites[key].copy(base);
      const s = p.x < 0 ? -1 : 1;
      const step = Math.sin(time * motion.anatomyCadence.value) * s;
      const amount = motion.anatomyMotion.value;
      if (p.y < 1.79 && Math.abs(p.x) < 0.43) {
        if (p.y < 0.96)
          rotateX(
            p,
            new THREE.Vector3(s * 0.223, 0.96, 0.03),
            -Math.max(0, -step) * amount * 1.3,
          );
        rotateX(p, new THREE.Vector3(s * 0.215, 1.72, 0), step * amount);
      } else if (Math.abs(p.x) > 0.39 && p.y > 1.25 && p.y < 2.88) {
        rotateX(p, new THREE.Vector3(s * 0.42, 2.81, 0), -step * amount * 0.7);
      }
    }
  }

  function setPresentation(mode: "atlas" | "xray") {
    const atlas = mode === "atlas";
    surfaceMaterial.uniforms.surfaceDensity.value = atlas ? 0.14 : 0.032;
    surfaceMaterial.uniforms.surfaceColor.value.set(
      atlas ? "#b8ae9b" : "#83aaa1",
    );
    muscleModel.materials[0].opacity = atlas ? 0.23 : 0.065;
    skeletonModel.materials[0].opacity = atlas ? 0.27 : 0.12;
    skeletonModel.materials[1].opacity = atlas ? 0.23 : 0.1;
    brainMaterial.opacity = atlas ? 0.71 : 0.29;
    lungModel.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat.userData.anatomyPart === "lung-tissue")
            mat.opacity = atlas ? 0.45 : 0.22;
        }
      }
    });
  }
  setPresentation("atlas");
  function dispose() {
    disposed = true;
    heartModel.dispose();
    lungModel.dispose();
    skeletonModel.dispose();
    muscleModel.dispose();
    geometrySet.forEach((g) => g.dispose());
    materialSet.forEach((m) => m.dispose());
    group.clear();
  }
  return { group, heart, layers, sites, animate, setPresentation, dispose };
}
