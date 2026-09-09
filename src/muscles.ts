import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type P = [number, number, number];

/** Original superficial muscle studies. Forms are constructed along origin-to-
 * insertion curves; they are not a segmented patient or a complete muscle atlas. */
export function createMuscles() {
  const group = new THREE.Group();
  group.name = "Superficial muscular contours";
  const tissue: THREE.BufferGeometry[] = [];
  const fascia: THREE.BufferGeometry[] = [];
  function spindle(points: P[], breadth: number, depth: number, twist = 0) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const N = 24,
      R = 18,
      frames = curve.computeFrenetFrames(N, false);
    const positions: number[] = [],
      uvs: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        p = curve.getPointAt(t),
        bulge = Math.pow(Math.sin(Math.PI * t), 0.62);
      for (let j = 0; j <= R; j++) {
        const angle = (j / R) * Math.PI * 2 + twist * t;
        const r =
          bulge * (1 + 0.025 * Math.sin((j / R) * 48 * Math.PI + t * 7));
        const q = p
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(angle) * breadth * r)
          .addScaledVector(frames.binormals[i], Math.sin(angle) * depth * r);
        positions.push(q.x, q.y, q.z);
        uvs.push(t, j / R);
        if (i < N && j < R) {
          const k = i * (R + 1) + j;
          indices.push(k, k + 1, k + R + 1, k + 1, k + R + 2, k + R + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    tissue.push(g);
  }
  const mirror = (points: P[], s: number) =>
    points.map(([x, y, z]) => [x * s, y, z] as P);
  for (const s of [-1, 1]) {
    // Deltoid, biceps, brachialis and triceps; the insertions are tapered.
    spindle(
      mirror(
        [
          [0.3, 2.88, 0.04],
          [0.448, 2.78, 0.05],
          [0.52, 2.57, 0.043],
        ],
        s,
      ),
      0.099,
      0.078,
    );
    spindle(
      mirror(
        [
          [0.448, 2.724, 0.062],
          [0.566, 2.52, 0.087],
          [0.673, 2.306, 0.069],
        ],
        s,
      ),
      0.056,
      0.069,
      0.1,
    );
    spindle(
      mirror(
        [
          [0.462, 2.714, -0.073],
          [0.56, 2.5, -0.072],
          [0.704, 2.28, -0.027],
        ],
        s,
      ),
      0.07,
      0.058,
    );
    spindle(
      mirror(
        [
          [0.502, 2.59, -0.04],
          [0.62, 2.38, -0.054],
          [0.698, 2.276, 0.009],
        ],
        s,
      ),
      0.037,
      0.041,
    );
    // Forearm extensor/flexor masses fan toward the wrist rather than a capsule.
    spindle(
      mirror(
        [
          [0.673, 2.303, 0.059],
          [0.736, 2.158, 0.08],
          [0.865, 1.813, 0.062],
        ],
        s,
      ),
      0.045,
      0.044,
    );
    spindle(
      mirror(
        [
          [0.703, 2.29, -0.042],
          [0.797, 2.113, -0.029],
          [0.913, 1.825, 0.028],
        ],
        s,
      ),
      0.039,
      0.052,
    );
    spindle(
      mirror(
        [
          [0.712, 2.211, 0.085],
          [0.793, 2.077, 0.084],
          [0.867, 1.834, 0.08],
        ],
        s,
      ),
      0.025,
      0.028,
    );
    // Pectoral fan, serratus and oblique landmarks around the visceral window.
    for (let i = 0; i < 4; i++)
      spindle(
        mirror(
          [
            [0.035, 2.79 - i * 0.054, 0.176],
            [0.204, 2.789 - i * 0.033, 0.193],
            [0.367, 2.781, 0.09],
          ],
          s,
        ),
        0.025,
        0.022,
      );
    for (let i = 0; i < 4; i++)
      spindle(
        mirror(
          [
            [0.292, 2.55 - i * 0.058, 0.114],
            [0.26, 2.5 - i * 0.056, 0.151],
            [0.19, 2.456 - i * 0.052, 0.179],
          ],
          s,
        ),
        0.019,
        0.019,
      );
    spindle(
      mirror(
        [
          [0.298, 2.416, 0.058],
          [0.254, 2.151, 0.132],
          [0.267, 1.918, 0.112],
        ],
        s,
      ),
      0.039,
      0.023,
    );
    for (let i = 0; i < 3; i++)
      spindle(
        mirror(
          [
            [0.081, 2.393 - i * 0.13, 0.192],
            [0.079, 2.339 - i * 0.13, 0.197],
            [0.084, 2.275 - i * 0.13, 0.176],
          ],
          s,
        ),
        0.027,
        0.014,
      );
    // Trapezius and latissimus on the posterior surface.
    spindle(
      mirror(
        [
          [0.037, 3.035, -0.1],
          [0.198, 2.825, -0.148],
          [0.383, 2.8, -0.06],
        ],
        s,
      ),
      0.047,
      0.025,
    );
    spindle(
      mirror(
        [
          [0.032, 2.725, -0.18],
          [0.199, 2.558, -0.185],
          [0.334, 2.605, -0.086],
        ],
        s,
      ),
      0.065,
      0.021,
    );
    spindle(
      mirror(
        [
          [0.04, 2.168, -0.166],
          [0.181, 2.393, -0.167],
          [0.369, 2.667, -0.09],
        ],
        s,
      ),
      0.062,
      0.024,
    );
    // Four anterior thigh masses, slender adductors, posterior hamstrings.
    spindle(
      mirror(
        [
          [0.206, 1.768, 0.093],
          [0.233, 1.402, 0.139],
          [0.219, 1.021, 0.073],
        ],
        s,
      ),
      0.067,
      0.056,
    );
    spindle(
      mirror(
        [
          [0.294, 1.699, 0.047],
          [0.32, 1.378, 0.061],
          [0.256, 1.011, 0.041],
        ],
        s,
      ),
      0.068,
      0.062,
    );
    spindle(
      mirror(
        [
          [0.183, 1.596, 0.093],
          [0.159, 1.25, 0.098],
          [0.202, 1.004, 0.062],
        ],
        s,
      ),
      0.049,
      0.046,
    );
    spindle(
      mirror(
        [
          [0.099, 1.745, 0.045],
          [0.123, 1.46, 0.024],
          [0.167, 1.127, 0.04],
        ],
        s,
      ),
      0.058,
      0.043,
    );
    spindle(
      mirror(
        [
          [0.18, 1.716, -0.097],
          [0.204, 1.39, -0.124],
          [0.214, 1.012, -0.045],
        ],
        s,
      ),
      0.075,
      0.052,
    );
    spindle(
      mirror(
        [
          [0.292, 1.778, 0.089],
          [0.212, 1.444, 0.161],
          [0.16, 1.027, 0.035],
        ],
        s,
      ),
      0.012,
      0.009,
    );
    // Gastrocnemius twins and anterior tibialis, leaving the tibial ridge visible.
    spindle(
      mirror(
        [
          [0.186, 0.955, -0.047],
          [0.158, 0.738, -0.114],
          [0.204, 0.358, -0.059],
        ],
        s,
      ),
      0.05,
      0.053,
    );
    spindle(
      mirror(
        [
          [0.247, 0.95, -0.048],
          [0.273, 0.732, -0.105],
          [0.219, 0.347, -0.059],
        ],
        s,
      ),
      0.054,
      0.049,
    );
    spindle(
      mirror(
        [
          [0.248, 0.928, 0.063],
          [0.263, 0.67, 0.081],
          [0.234, 0.223, 0.049],
        ],
        s,
      ),
      0.036,
      0.033,
    );
    spindle(
      mirror(
        [
          [0.213, 0.44, -0.075],
          [0.215, 0.263, -0.065],
          [0.212, 0.13, -0.07],
        ],
        s,
      ),
      0.012,
      0.013,
    );
  }
  const material = new THREE.MeshStandardMaterial({
    color: "#866455",
    roughness: 0.85,
    metalness: 0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  material.name = "Muscular tissue";
  material.userData.anatomicalTissue = "muscle";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 muscleUV;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nmuscleUV=uv;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 muscleUV;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float fiber=sin(muscleUV.y*490.0+sin(muscleUV.x*14.0)*1.8);
      float fineFiber=sin(muscleUV.y*1230.0+muscleUV.x*12.0);
      float ends=smoothstep(0.12,0.32,muscleUV.x)*(1.0-smoothstep(0.68,0.92,muscleUV.x));
      diffuseColor.rgb*=0.92+fiber*0.07+fineFiber*0.035;
      diffuseColor.rgb=mix(diffuseColor.rgb*1.8,diffuseColor.rgb,ends*.64+.36);`,
      );
  };
  const geometry = mergeGeometries(tissue, false)!;
  tissue.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  group.add(mesh);
  return {
    group,
    materials: [material],
    dispose: () => {
      geometry.dispose();
      material.dispose();
      fascia.forEach((g) => g.dispose());
    },
  };
}
