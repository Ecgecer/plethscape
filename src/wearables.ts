import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";

import { WEARABLE_SITES, type WearableSite as DeviceSite } from "./devices";

// All dimensions use the atlas scene scale (2.122 scene units per metre).
// +Y is the finger / wrist sleeve axis; +Z faces outward from the body.
// The earring attaches at its origin and hangs in the -Y direction.
function roundedProfile(
  width: number,
  height: number,
  radius: number,
  segments = 5,
): THREE.Vector2[] {
  const result: THREE.Vector2[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const a = (corner * Math.PI) / 2;
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
    const cy = (corner < 2 ? 1 : -1) * (height / 2 - radius);
    for (let i = 0; i <= segments; i++) {
      const angle = a + ((i / segments) * Math.PI) / 2;
      result.push(
        new THREE.Vector2(
          cx + Math.cos(angle) * radius,
          cy + Math.sin(angle) * radius,
        ),
      );
    }
  }
  result.push(result[0].clone());
  return result;
}

function roundedShape(
  width: number,
  height: number,
  radius: number,
): THREE.Shape {
  return new THREE.Shape(
    roundedProfile(width, height, Math.min(radius, width / 2, height / 2), 20),
  );
}

function roundedSolid(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel = 0.0006,
) {
  const geometry = new THREE.ExtrudeGeometry(
    roundedShape(
      width - 2 * bevel,
      height - 2 * bevel,
      Math.max(0.0001, radius - bevel),
    ),
    {
      depth: depth - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 8,
    },
  );
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
}

const podBend = (x: number) => -0.017 * (x / 0.047) ** 2;

// A continuous cuff rises over the curved enclosure on the anterior half.
// Its back half retains the measured wrist ellipse. No separate textile patch.
function cuffPoint(angle: number) {
  const x = 0.068 * Math.cos(angle);
  let z = 0.058 * Math.sin(angle);
  if (z > 0) {
    const fade = THREE.MathUtils.smootherstep(Math.abs(x), 0.0475, 0.065);
    z = THREE.MathUtils.lerp(0.0794 + podBend(x), z, fade);
  }
  return new THREE.Vector2(x, z);
}

function cuffNormal(angle: number) {
  const before = cuffPoint(angle - 0.0001),
    after = cuffPoint(angle + 0.0001);
  return new THREE.Vector2(after.y - before.y, before.x - after.x).normalize();
}

function continuousStrap(
  width = 0.043,
  thickness = 0.0018,
  start = 0,
  end = Math.PI * 2,
  lift = 0,
) {
  const profile = roundedProfile(thickness, width, thickness * 0.4, 4);
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rings = Math.ceil((192 * (end - start)) / (Math.PI * 2)),
    count = profile.length;
  const centerline = Array.from({ length: rings + 1 }, (_, i) =>
    cuffPoint(start + (i / rings) * (end - start)),
  );
  const distances = [0];
  for (let i = 1; i <= rings; i++)
    distances.push(
      distances[i - 1] + centerline[i].distanceTo(centerline[i - 1]),
    );
  for (let i = 0; i <= rings; i++) {
    const angle = start + (i / rings) * (end - start);
    const center = centerline[i],
      normal = cuffNormal(angle);
    for (const point of profile) {
      const offset = point.x + thickness / 2 + lift;
      positions.push(
        center.x + normal.x * offset,
        point.y,
        center.y + normal.y * offset,
      );
      uvs.push(distances[i] / 0.443, point.y / width + 0.5);
    }
    if (i === rings) continue;
    for (let j = 0; j < count - 1; j++) {
      const a = i * count + j,
        b = a + count;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function cuffEdgeStitch(side: number) {
  const points = Array.from({ length: 1152 }, (_, i) => {
    const angle = (i / 1152) * Math.PI * 2;
    const point = cuffPoint(angle),
      normal = cuffNormal(angle);
    const stitch = angle * 192;
    const lift = 0.00135 + Math.sin(stitch) * 0.00055;
    return new THREE.Vector3(
      point.x + normal.x * lift,
      side * (0.0206 + Math.cos(stitch) * 0.00065),
      point.y + normal.y * lift,
    );
  });
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points, true),
    1152,
    0.00028,
    4,
    true,
  );
}

// Tessellation happens before bending, so large cap triangles cannot bridge
// across the concave underside. Transform the normals with the same bend.
function bendToPod(
  original: THREE.BufferGeometry,
  centerZ: number,
  centerX = 0,
) {
  const geometry = new TessellateModifier(0.005, 8).modify(original);
  original.dispose();
  const positions = geometry.getAttribute("position"),
    normals = geometry.getAttribute("normal");
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + centerX;
    positions.setXYZ(
      i,
      x,
      positions.getY(i),
      positions.getZ(i) + centerZ + podBend(x),
    );
    const derivative = (-0.034 * x) / (0.047 * 0.047);
    normal
      .set(
        normals.getX(i) - derivative * normals.getZ(i),
        normals.getY(i),
        normals.getZ(i),
      )
      .normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return geometry;
}

function curvedOutline(
  width: number,
  height: number,
  radius: number,
  z: number,
  tubeRadius: number,
  x = 0,
) {
  const outline = new THREE.CatmullRomCurve3(
    roundedProfile(width, height, radius, 16)
      .slice(0, -1)
      .map((p) => new THREE.Vector3(p.x + x, p.y, 0)),
    true,
  );
  // Sample the straight portions before bending them; otherwise the long
  // top and bottom frame rails would cut through the curved textile face.
  const points = outline
    .getSpacedPoints(192)
    .slice(0, -1)
    .map((p) => new THREE.Vector3(p.x, p.y, z + podBend(p.x)));
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points, true),
    144,
    tubeRadius,
    8,
    true,
  );
}

function wovenTextures() {
  const size = 256,
    color = new Uint8Array(size * size * 4),
    height = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / 16,
        v = (y + 0.5) / 16;
      // Two-over/two-under twill produces diagonal floats, not checker tiles.
      const warpPhase = (((Math.floor(u) - Math.floor(v)) % 4) + 4) % 4;
      const warpOver = warpPhase < 2;
      const across = (warpOver ? u : v) % 1;
      const along = warpOver ? v : u;
      const crown = Math.pow(Math.sin(across * Math.PI), 0.5);
      const floatPhase = (((along - Math.floor(warpOver ? u : v)) % 2) + 2) % 2;
      const tuck = 0.72 + 0.28 * Math.sin((floatPhase * Math.PI) / 2);
      const fibre =
        0.87 +
        0.13 *
          Math.cos(across * Math.PI * 10 + Math.sin(along * Math.PI) * 0.25);
      const grain =
        Math.sin(x * 17.13 + y * 41.71) * 0.055 +
        Math.sin(x * 8.4 - y * 3.6) * 0.025;
      const relief = THREE.MathUtils.clamp(crown * fibre * tuck + grain, 0, 1);
      const index = (y * size + x) * 4;
      // Black woven nylon with individual graphite highlights.
      color[index] = Math.round(8 + relief * 24);
      color[index + 1] = Math.round(9 + relief * 25);
      color[index + 2] = Math.round(10 + relief * 25);
      color[index + 3] = 255;
      height[index] =
        height[index + 1] =
        height[index + 2] =
          Math.round(70 + relief * 150);
      height[index + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(color, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.DataTexture(height, size, size, THREE.RGBAFormat);
  for (const texture of [map, bump]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 2);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }
  return { map, bump };
}

function brushedTexture() {
  const width = 128,
    height = 256,
    data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const line = Math.sin(y * 17.1) * 0.5 + Math.sin(y * 3.7) * 0.3;
    for (let x = 0; x < width; x++) {
      const value = Math.round(
        192 + line * 30 + Math.sin(x * 0.08 + y * 2.4) * 5,
      );
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Custom product geometry. The caller positions devices and animates their parent transforms. */
export function createWearables(): {
  group: THREE.Group;
  devices: Record<DeviceSite, THREE.Group>;
  setSelected: (site: string) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = "Wearable optical sensors";
  const devices = Object.fromEntries(
    WEARABLE_SITES.map((site) => {
      const device = new THREE.Group();
      device.name = `${site} wearable sensor`;
      device.userData.site = site;
      group.add(device);
      return [site, device];
    }),
  ) as Record<DeviceSite, THREE.Group>;
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const weave = wovenTextures(),
    brushed = brushedTexture();
  const textures = [weave.map, weave.bump, brushed];
  const physical = (parameters: THREE.MeshPhysicalMaterialParameters) => {
    const material = new THREE.MeshPhysicalMaterial({
      roughness: 0.45,
      metalness: 0,
      dithering: true,
      ...parameters,
    });
    materials.add(material);
    return material;
  };
  const titanium = physical({
    color: "#a4a49c",
    metalness: 1,
    roughness: 0.32,
    roughnessMap: brushed,
    clearcoat: 0.12,
    clearcoatRoughness: 0.2,
  });
  const polishedEdge = physical({
    color: "#a9aaa7",
    metalness: 1,
    roughness: 0.19,
  });
  const rubber = physical({ color: "#121715", roughness: 0.75 });
  const housing = physical({
    color: "#0b0d0c",
    roughness: 0.63,
    clearcoat: 0.03,
    clearcoatRoughness: 0.52,
  });
  const face = physical({
    color: "#090b0a",
    roughness: 0.58,
    ior: 1.4,
    specularIntensity: 0.4,
    clearcoat: 0.08,
    clearcoatRoughness: 0.5,
  });
  const button = physical({
    color: "#3d403e",
    metalness: 0.35,
    roughness: 0.4,
  });
  const gold = physical({ color: "#b39a62", metalness: 1, roughness: 0.27 });
  const cloth = physical({
    color: "#ffffff",
    map: weave.map,
    bumpMap: weave.bump,
    bumpScale: 0.00031,
    roughness: 0.91,
    sheen: 0.15,
    sheenColor: "#53575b",
    sheenRoughness: 0.84,
  });
  const thread = physical({ color: "#202326", roughness: 0.88 });
  const ledMaterials = {} as Record<DeviceSite, THREE.MeshPhysicalMaterial>;
  for (const site of WEARABLE_SITES) {
    ledMaterials[site] = physical({
      color: "#8dbe80",
      emissive: "#65bb53",
      emissiveIntensity: 0.25,
      roughness: 0.23,
      clearcoat: 0.4,
    });
  }
  const opticalGlass = physical({
    color: "#0e2022",
    roughness: 0.2,
    metalness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.13,
  });

  function add(
    site: DeviceSite,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    position?: THREE.Vector3,
    rotation?: THREE.Euler,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.site = site;
    if (position) mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    devices[site].add(mesh);
    geometries.add(geometry);
    return mesh;
  }
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // Comfort-fit ring: a rounded rectangular metal section, not a thin torus.
  const ringSection = roundedProfile(0.005, 0.017, 0.0016, 6).map(
    (p) => new THREE.Vector2(p.x + 0.0265, p.y),
  );
  add(
    "finger",
    new THREE.LatheGeometry(ringSection, 96),
    titanium,
    "Brushed titanium comfort band",
  );
  const innerSection = roundedProfile(0.00045, 0.012, 0.0002, 3).map(
    (p) => new THREE.Vector2(p.x + 0.024, p.y),
  );
  add(
    "finger",
    new THREE.LatheGeometry(innerSection, 80),
    rubber,
    "Inner optical liner",
  );
  for (const y of [-0.00835, 0.00835]) {
    const edge = new THREE.TorusGeometry(0.0269, 0.00028, 6, 96);
    add(
      "finger",
      edge,
      polishedEdge,
      "Polished ring edge",
      at(0, y, 0),
      new THREE.Euler(Math.PI / 2, 0, 0),
    );
  }
  for (const angle of [Math.PI * 0.83, Math.PI, Math.PI * 1.17]) {
    const x = Math.sin(angle) * 0.02355,
      z = Math.cos(angle) * 0.02355;
    const lens = add(
      "finger",
      new THREE.SphereGeometry(0.00155, 12, 8),
      opticalGlass,
      "Inner optical window",
      at(x, 0, z),
    );
    lens.scale.set(1, 1.5, 0.43);
    lens.rotation.y = angle;
    const emitter = add(
      "finger",
      new THREE.SphereGeometry(0.0007, 10, 6),
      ledMaterials.finger,
      "Inner green optical emitter",
      at(Math.sin(angle) * 0.02305, 0.0002, Math.cos(angle) * 0.02305),
    );
    emitter.scale.z = 0.45;
    emitter.rotation.y = angle;
  }

  // One uninterrupted black woven cuff runs circumferentially over the pod.
  add("wrist", continuousStrap(), cloth, "Continuous woven wrist cuff");
  for (const side of [-1, 1])
    add("wrist", cuffEdgeStitch(side), thread, "Raised stitched cuff edge");

  // A bent enclosure with real apertures for the inset lens and contacts.
  // Coordinates of the underside follow the reference as seen from -Z:
  // contacts on the left, then pale window, two dark inserts, silver plate.
  const caseShape = roundedShape(0.0922, 0.0522, 0.0086);
  const lensHole = roundedProfile(0.051, 0.035, 0.0095, 20)
    .reverse()
    .map((p) => new THREE.Vector2(p.x - 0.004, p.y));
  const contactHole = roundedProfile(0.012, 0.026, 0.0055, 16)
    .reverse()
    .map((p) => new THREE.Vector2(p.x + 0.034, p.y));
  caseShape.holes.push(new THREE.Path(lensHole), new THREE.Path(contactHole));
  const shell = new THREE.ExtrudeGeometry(caseShape, {
    depth: 0.0152,
    bevelEnabled: true,
    bevelSize: 0.0014,
    bevelThickness: 0.0014,
    bevelSegments: 5,
    steps: 1,
  });
  shell.translate(0, 0, -0.0076);
  add(
    "wrist",
    bendToPod(shell, 0.07),
    housing,
    "Curved low-profile sensor enclosure",
  );
  add(
    "wrist",
    curvedOutline(0.092, 0.0465, 0.0065, 0.0824, 0.0011),
    housing,
    "Continuous rounded front frame",
  );

  // The pill is on the exposed lower side of the case, never on its face.
  add(
    "wrist",
    roundedSolid(0.025, 0.0073, 0.0028, 0.0034, 0.0006),
    housing,
    "Pill button surround",
    at(0, -0.0278, 0.07),
    new THREE.Euler(Math.PI / 2, 0, 0),
  );
  add(
    "wrist",
    roundedSolid(0.021, 0.005, 0.0021, 0.0024, 0.00045),
    button,
    "Side pill button",
    at(0, -0.0292, 0.07),
    new THREE.Euler(Math.PI / 2, 0, 0),
  );

  const lensFinish = physical({
    color: "#030506",
    roughness: 0.16,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const insetFinish = physical({
    color: "#29232a",
    roughness: 0.28,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
  });
  const paleWindow = physical({
    color: "#d7dccd",
    roughness: 0.28,
    clearcoat: 0.4,
  });
  const packageFinish = physical({ color: "#eff1de", roughness: 0.48 });
  const plateFinish = physical({
    color: "#a4aaa8",
    metalness: 0.8,
    roughness: 0.44,
    roughnessMap: brushed,
  });
  const contactGold = physical({
    color: "#d9b563",
    metalness: 0.9,
    roughness: 0.28,
  });
  add(
    "wrist",
    bendToPod(
      roundedSolid(0.0498, 0.0338, 0.0018, 0.0093, 0.00065),
      0.062,
      -0.004,
    ),
    lensFinish,
    "Glossy black recessed lens",
  );
  add(
    "wrist",
    curvedOutline(0.0512, 0.0353, 0.0097, 0.061, 0.00085, -0.004),
    lensFinish,
    "Polished lens perimeter",
  );

  function undersidePart(
    width: number,
    height: number,
    x: number,
    material: THREE.Material,
    name: string,
    radius = 0.0007,
    z = 0.06065,
  ) {
    const geometry = roundedSolid(width, height, 0.00065, radius, 0.0002);
    const positions = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv");
    for (let i = 0; i < positions.count; i++)
      uv.setXY(
        i,
        positions.getX(i) / width + 0.5,
        positions.getY(i) / height + 0.5,
      );
    add("wrist", bendToPod(geometry, z, x), material, name);
  }
  undersidePart(0.0062, 0.0072, 0.011, polishedEdge, "Pale window rim", 0.0008);
  undersidePart(
    0.0053,
    0.0063,
    0.011,
    paleWindow,
    "Pale translucent window",
    0.0006,
    0.06015,
  );
  const packageMesh = add(
    "wrist",
    roundedSolid(0.0021, 0.0033, 0.00035, 0.0003, 0.0001),
    packageFinish,
    "Visible small package inside pale window",
    at(0.0117, -0.0001, 0.05965 + podBend(0.0117)),
  );
  packageMesh.rotation.y = Math.atan((0.034 * 0.0117) / (0.047 * 0.047));
  for (const y of [-0.0012, 0.0012])
    add(
      "wrist",
      new THREE.SphereGeometry(0.00042, 8, 6),
      contactGold,
      "Tiny internal package contact",
      at(0.0095, y, 0.0597 + podBend(0.0095)),
    );
  for (const x of [0.0033, -0.0044]) {
    undersidePart(0.0042, 0.0081, x, button, "Narrow insert rim", 0.0006);
    undersidePart(
      0.00335,
      0.00715,
      x,
      insetFinish,
      "Narrow dark vertical insert",
      0.0004,
      0.0602,
    );
  }
  undersidePart(
    0.0127,
    0.0137,
    -0.0165,
    polishedEdge,
    "Rounded metallic plate rim",
    0.0014,
  );
  undersidePart(
    0.0117,
    0.0127,
    -0.0165,
    plateFinish,
    "Brushed silver plate",
    0.0011,
    0.0602,
  );

  add(
    "wrist",
    bendToPod(
      roundedSolid(0.0107, 0.0245, 0.0017, 0.0051, 0.00065),
      0.0629,
      0.034,
    ),
    rubber,
    "Separate contact recess",
  );
  add(
    "wrist",
    curvedOutline(0.0115, 0.0253, 0.0054, 0.0614, 0.00065, 0.034),
    housing,
    "Contact recess border",
  );
  for (const y of [-0.0054, 0.0054])
    add(
      "wrist",
      new THREE.CylinderGeometry(0.00185, 0.00185, 0.0009, 24),
      contactGold,
      "Gold charging contact",
      at(0.034, y, 0.06165 + podBend(0.034)),
      new THREE.Euler(Math.PI / 2, 0, 0),
    );

  // An overlapping textile tail on the back and a compact keeper complete
  // the closure. They share the same weave and follow the same cuff curve.
  add(
    "wrist",
    continuousStrap(0.0425, 0.0016, Math.PI * 1.3, Math.PI * 1.73, 0.0022),
    cloth,
    "Woven back overlap",
  );
  const keeperAngle = Math.PI * 1.31,
    keeperPoint = cuffPoint(keeperAngle),
    keeperNormal = cuffNormal(keeperAngle);
  const keeperShape = roundedShape(0.008, 0.047, 0.0024);
  keeperShape.holes.push(
    new THREE.Path(roundedProfile(0.0045, 0.043, 0.0018, 10).reverse()),
  );
  const keeper = new THREE.ExtrudeGeometry(keeperShape, {
    depth: 0.009,
    bevelEnabled: true,
    bevelSize: 0.00045,
    bevelThickness: 0.00045,
    bevelSegments: 3,
    steps: 1,
  });
  const keeperPositions = keeper.getAttribute("position"),
    keeperNormals = keeper.getAttribute("normal"),
    keeperUv = keeper.getAttribute("uv");
  const tangent = new THREE.Vector2(-keeperNormal.y, keeperNormal.x);
  for (let i = 0; i < keeperPositions.count; i++) {
    const radial = keeperPositions.getX(i) + 0.0027,
      along = keeperPositions.getZ(i) - 0.0045,
      y = keeperPositions.getY(i);
    keeperPositions.setXYZ(
      i,
      keeperPoint.x + keeperNormal.x * radial + tangent.x * along,
      y,
      keeperPoint.y + keeperNormal.y * radial + tangent.y * along,
    );
    const nx = keeperNormals.getX(i),
      nz = keeperNormals.getZ(i);
    keeperNormals.setXYZ(
      i,
      nx * keeperNormal.x + nz * tangent.x,
      keeperNormals.getY(i),
      nx * keeperNormal.y + nz * tangent.y,
    );
    keeperUv.setXY(i, along / 0.443, y / 0.043 + 0.5);
  }
  add("wrist", keeper, cloth, "Woven keeper around overlapping strap");

  // A conventional gold huggie: an unbroken hoop with discreet inner contacts.
  const hoop = new THREE.TorusGeometry(0.011, 0.0022, 12, 64);
  add("ear", hoop, gold, "Gold huggie hoop", at(0, -0.012, 0));
  add(
    "ear",
    new THREE.SphereGeometry(0.0027, 16, 10),
    gold,
    "Huggie clasp",
    at(0, -0.001, 0),
  );
  add(
    "ear",
    new THREE.SphereGeometry(0.0008, 10, 8),
    ledMaterials.ear,
    "Hidden optical contact",
    at(0, -0.003, -0.0018),
  );

  function softBand(
    site: DeviceSite,
    rx: number,
    rz: number,
    width: number,
    thickness: number,
    finish: THREE.Material,
  ) {
    const profile = roundedProfile(thickness, width, thickness * 0.42, 5).map(
      (p) => new THREE.Vector2(p.x + rx + thickness / 2, p.y),
    );
    const geo = new THREE.LatheGeometry(profile, 96);
    geo.scale(1, 1, rz / rx);
    if (site === "forehead") {
      const uv = geo.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) * 2.4, uv.getY(i) * 0.7);
    }
    add(site, geo, finish, `${site} continuous band`);
  }
  softBand("forehead", 0.176, 0.229, 0.029, 0.002, cloth);
  for (const y of [-0.014, 0.014]) {
    const seam = new THREE.TorusGeometry(0.177, 0.00065, 6, 128);
    seam.rotateX(Math.PI / 2);
    seam.scale(1, 1, 0.229 / 0.176);
    add("forehead", seam, thread, "Fine stitched edge", at(0, y, 0));
  }
  add(
    "forehead",
    roundedSolid(0.036, 0.02, 0.006, 0.006),
    housing,
    "Forehead optical pod",
    at(0, 0, 0.23),
  );
  add(
    "forehead",
    roundedSolid(0.012, 0.008, 0.001, 0.003, 0.0002),
    opticalGlass,
    "Inner forehead optical window",
    at(0, 0, 0.226),
  );

  const patchFinish = physical({ color: "#d9c7af", roughness: 0.85 });
  add(
    "carotid",
    roundedSolid(0.041, 0.056, 0.0025, 0.013, 0.0005),
    patchFinish,
    "Soft rounded adhesive patch",
  );
  add(
    "carotid",
    roundedSolid(0.021, 0.031, 0.005, 0.008),
    housing,
    "Compact neck sensor",
    at(0, 0, 0.0028),
  );
  add(
    "carotid",
    roundedSolid(0.01, 0.018, 0.001, 0.004, 0.0002),
    opticalGlass,
    "Skin-facing neck window",
    at(0, 0, -0.0018),
  );

  // Retain the wrist device's construction and finishes, fitted to a larger cuff.
  for (const object of devices.wrist.children) {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    mesh.updateMatrix();
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const isStrap = /woven|stitched/i.test(mesh.name);
    if (isStrap) {
      geo.scale(1.5, 1.15, 1.9);
    } else {
      // Keep the cuff circumference; shrink the module around its skin-facing
      // center instead of scaling the housing up with the upper arm.
      geo.translate(0, 0, -0.07);
      geo.scale(1.12, 0.95, 1.0);
      geo.translate(0, 0, 0.137);
    }
    add("upperarm", geo, mesh.material, `Bicep ${mesh.name}`);
  }
  softBand("toe", 0.031, 0.027, 0.021, 0.0025, rubber);
  add(
    "toe",
    roundedSolid(0.018, 0.012, 0.002, 0.004),
    housing,
    "Low-profile toe sensor",
    at(0, 0, 0.029),
  );
  add(
    "toe",
    new THREE.SphereGeometry(0.0011, 12, 8),
    ledMaterials.toe,
    "Inner toe emitter",
    at(0, 0, 0.025),
  );

  // Merge static parts by finish per device. Every resulting hit retains its
  // sensing-site identity; device groups remain independently positionable.
  for (const site of WEARABLE_SITES) {
    const device = devices[site];
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const object of [...device.children]) {
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      mesh.updateMatrix();
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      const batch = batches.get(mesh.material) ?? [];
      batch.push(geometry);
      batches.set(mesh.material, batch);
      geometries.delete(mesh.geometry);
      mesh.geometry.dispose();
      device.remove(mesh);
    }
    for (const [material, batch] of batches) {
      const geometry = mergeGeometries(batch, false)!;
      batch.forEach((part) => part.dispose());
      const mesh = add(site, geometry, material, `${site} sensor finish`);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    device.userData.bounds = new THREE.Box3().setFromObject(device);
    device.userData.axis = "+Y sleeve, +Z outward";
  }

  let disposed = false;
  function setSelected(site: string) {
    for (const key of WEARABLE_SITES) {
      const selected = key === site;
      devices[key].userData.selected = selected;
      ledMaterials[key].emissiveIntensity = selected ? 1.25 : 0.2;
    }
  }
  setSelected("finger");
  function dispose() {
    if (disposed) return;
    disposed = true;
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    group.clear();
  }
  return { group, devices, setSelected, dispose };
}
