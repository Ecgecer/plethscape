import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
type HeartModel = {
  group: THREE.Group;
  animate: (phase: number) => void;
  dispose: () => void;
};

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;

// The model is original procedural anatomy, with the subject's left on +X.
// Chamber proportions and surface routes describe the anterior cardiac view.
// No stock mesh, scanned texture, or generated image is used.
function ventricularSurface(t: number, a: number, lift = 0): THREE.Vector3 {
  const s = Math.pow(Math.max(0, Math.sin(Math.PI * t)), .70);
  const xAxis = -.032 + .104 * Math.pow(t, 1.38);
  const rx = .151 * s * (1 - .35 * t);
  const rz = .101 * s * (1 - .18 * t);
  const anterior = Math.max(0, Math.sin(a));
  const rv = Math.exp(-Math.pow((a - 2.16) / .61, 2)) * Math.exp(-Math.pow((t - .35) / .31, 2));
  const lad = 1.50 - .25 * t;
  const sulcus = Math.exp(-Math.pow((a - lad) / .061, 2)) * Math.sin(Math.PI * t);
  const posterior = Math.exp(-Math.pow((a - 4.39) / .085, 2)) * Math.sin(Math.PI * t);
  // Shallow, oblique epicardial fibre undulations; never a faceted ball.
  const fibre = .00042 * Math.sin(a * 37 + t * 66) * Math.sin(Math.PI * t);
  const r = 1 + .013 * Math.sin(a * 3 + t * 8) + .008 * Math.sin(a * 5 - t * 13);
  const x = xAxis + (rx * r + lift + fibre) * Math.cos(a);
  const y = .111 - .308 * t - .006 * Math.cos(a) * s;
  const z = -.011 + .009 * t + (rz * r + lift + fibre) * Math.sin(a)
    + .018 * rv - .0063 * sulcus * anterior + .0038 * posterior;
  return new THREE.Vector3(x, y, z);
}

function ventricularGeometry(): THREE.BufferGeometry {
  const rows = 96, columns = 128;
  const positions: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
  const shade = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= columns; j++) {
      const a = j / columns * TAU;
      const p = ventricularSurface(t, a);
      positions.push(p.x, p.y, p.z);
      uv.push(j / columns, t);
      const vein = Math.exp(-Math.pow((a - (1.50 - .25 * t)) / .10, 2));
      const warmth = .92 + .065 * Math.sin(a * 3 + t * 7) - .09 * vein;
      shade.setRGB(warmth, warmth * (.955 + .025 * Math.sin(t * 11)), warmth * .925);
      colors.push(shade.r, shade.g, shade.b);
      if (i < rows && j < columns) {
        const k = i * (columns + 1) + j;
        indices.push(k, k + 1, k + columns + 1, k + 1, k + columns + 2, k + columns + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function lobedEllipsoid(center: Point, scale: Point, rotation = 0, folds = 0, detail = 36): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, detail, Math.max(8, detail - 8));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const wobble = 1 + .026 * Math.sin(a * 3 + y * 4) + folds * Math.sin(a * 9 + y * 11) * (.3 + .7 * Math.max(0, z));
    p.setXYZ(i, x * scale[0] * wobble, y * scale[1] * wobble, z * scale[2] * wobble);
  }
  g.rotateZ(rotation);
  g.translate(...center);
  g.computeVertexNormals();
  return g;
}

function auricle(points: Point[], width: number, thickness: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const steps = 38, sides = 24;
  const frames = curve.computeFrenetFrames(steps, false);
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPointAt(t);
    const envelope = Math.pow(Math.sin(Math.PI * (.08 + t * .92)), .73) * (1 - .45 * t);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU;
      const fold = 1 + .16 * Math.sin(t * 34 + Math.cos(a) * .7) * Math.pow(Math.sin(Math.PI * t), .5);
      const v = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * width * envelope * fold)
        .addScaledVector(frames.binormals[i], Math.sin(a) * thickness * envelope);
      vertices.push(v.x, v.y, v.z);
      uv.push(j / sides, t);
      if (i < steps && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function tube(points: THREE.Vector3[], radius: number, endRadius = radius * .40, sides = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const steps = Math.max(12, Math.ceil(curve.getLength() * 370));
  const frames = curve.computeFrenetFrames(steps, false);
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPointAt(t);
    const r = mix(radius, endRadius, t) * (1 + .003 * Math.sin(t * 51));
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU;
      const v = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r);
      vertices.push(v.x, v.y, v.z);
      uv.push(j / sides, t);
      if (i < steps && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function surfacePath(startT: number, endT: number, startA: number, endA: number, lift = .0021, bend = 0): THREE.Vector3[] {
  return Array.from({ length: 20 }, (_, i) => {
    const t = i / 19;
    return ventricularSurface(mix(startT, endT, t), mix(startA, endA, t) + Math.sin(t * Math.PI) * bend, lift);
  });
}

// Flattened, scalloped epicardial pads conform to the myocardium. They have
// irregular overlapping outlines rather than reading as separate spherical beads.
function fatPatch(t: number, a: number, dt: number, da: number, seed: number): THREE.BufferGeometry {
  const rings = 6, sides = 20;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const r = i / rings;
    for (let j = 0; j <= sides; j++) {
      const phi = j / sides * TAU;
      const scallop = 1 + .12 * Math.sin(phi * 5 + seed) + .075 * Math.cos(phi * 7 - seed * 2);
      const lift = -.00045 + .0025 * (1 - r * r) * (1 + .10 * Math.sin(phi * 4 + seed));
      const p = ventricularSurface(t + Math.sin(phi) * r * dt * scallop, a + Math.cos(phi) * r * da * scallop, lift);
      positions.push(p.x, p.y, p.z);
      uv.push(j / sides, r);
      if (i < rings && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function merge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const all = geometries.map(g => {
    g.deleteAttribute('color');
    const expanded = g.index ? g.toNonIndexed() : g;
    if (expanded !== g) g.dispose();
    return expanded;
  });
  const merged = mergeGeometries(all, false)!;
  for (const g of all) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** Seeded, periodic, multiscale tissue fields built in code. */
function tissueTexture(): { color: THREE.DataTexture; bump: THREE.DataTexture; roughness: THREE.DataTexture } {
  const size = 512;
  const colorBytes = new Uint8Array(size * size * 4);
  const bumpBytes = new Uint8Array(size * size * 4);
  const roughBytes = new Uint8Array(size * size * 4);
  const noise = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };
  const coherent = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return mix(mix(noise(ix, iy), noise(ix + 1, iy), sx), mix(noise(ix, iy + 1), noise(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const broad = coherent(u * 11, v * 13);
    const medium = coherent(u * 43, v * 53);
    const fine = coherent(u * 161, v * 151);
    const fibre = Math.sin((u * 161 + v * 47 + Math.sin(v * 17) * .8 + medium * .45) * TAU);
    const collagen = Math.pow(Math.max(0, Math.sin((u * 87 + v * 25 + Math.sin(v * 17) * .42 + broad * .12) * TAU)), 14);
    const tonal = (broad - .5) * 25 + (medium - .5) * 10 + fibre * 1.8;
    const i = (y * size + x) * 4;
    colorBytes[i] = clamp(117 + tonal + collagen * 6, 0, 255);
    colorBytes[i + 1] = clamp(48 + tonal * .64 + collagen * 6, 0, 255);
    colorBytes[i + 2] = clamp(41 + tonal * .55 + collagen * 5, 0, 255);
    colorBytes[i + 3] = 255;
    const height = clamp(127 + (medium - .5) * 35 + (fine - .5) * 24 + fibre * 13 + collagen * 6, 0, 255);
    const rough = clamp(205 + (medium - .5) * 28 - collagen * 12, 0, 255);
    for (let c = 0; c < 3; c++) { bumpBytes[i + c] = height; roughBytes[i + c] = rough; }
    bumpBytes[i + 3] = roughBytes[i + 3] = 255;
  }
  const make = (bytes: Uint8Array, srgb = false) => {
    const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return { color: make(colorBytes, true), bump: make(bumpBytes), roughness: make(roughBytes) };
}

export function createHeart(): HeartModel {
  const group = new THREE.Group();
  group.name = 'Anatomical heart · myocardium and coronary circulation';
  const ventricles = new THREE.Group();
  ventricles.name = 'Left and right ventricles';
  const atria = new THREE.Group();
  atria.name = 'Atria and lobed auricular appendages';
  const roots = new THREE.Group();
  roots.name = 'Aortic arch, pulmonary trunk and venae cavae';
  group.add(ventricles, atria, roots);
  const textures = tissueTexture();
  const tissue = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: textures.color, bumpMap: textures.bump, bumpScale: .00042,
    roughnessMap: textures.roughness, roughness: .95, metalness: 0,
    clearcoat: .04, clearcoatRoughness: .76, vertexColors: true,
  });
  const atrialTissue = tissue.clone();
  atrialTissue.vertexColors = false;
  atrialTissue.color.set('#c5aaa0');
  const fat = new THREE.MeshStandardMaterial({ color: '#b99c6e', roughness: .85, metalness: 0, bumpMap: textures.bump, bumpScale: .00034 });
  const coronary = new THREE.MeshPhysicalMaterial({ color: '#913426', roughness: .59, metalness: 0, clearcoat: .06, clearcoatRoughness: .67 });
  const cardiacVein = new THREE.MeshStandardMaterial({ color: '#40516d', roughness: .62, metalness: 0 });
  const arterialWall = new THREE.MeshPhysicalMaterial({ color: '#934c39', roughness: .78, metalness: 0, clearcoat: .03, bumpMap: textures.bump, bumpScale: .00030 });
  const venousWall = new THREE.MeshStandardMaterial({ color: '#5d7085', roughness: .69, metalness: 0, bumpMap: textures.bump, bumpScale: .00028 });
  const intima = new THREE.MeshStandardMaterial({ color: '#c19376', roughness: .73, side: THREE.DoubleSide });
  const lumen = new THREE.MeshStandardMaterial({ color: '#392622', roughness: .98, side: THREE.BackSide });
  const materials = [tissue, atrialTissue, fat, coronary, cardiacVein, arterialWall, venousWall, intima, lumen];
  const add = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  add(ventricles, ventricularGeometry(), tissue, 'Continuous asymmetric ventricular myocardium');
  add(atria, merge([
    lobedEllipsoid([-.093, .101, -.029], [.057, .067, .059], -.14, .022),
    lobedEllipsoid([.017, .123, -.063], [.070, .048, .051], .12, .018),
    auricle([[-.112, .117, .002], [-.101, .15, .029], [-.070, .155, .053], [-.044, .129, .063]], .029, .017),
    auricle([[.064, .124, -.015], [.085, .137, .021], [.075, .157, .045], [.052, .164, .059]], .021, .014),
  ]), atrialTissue, 'Thin-walled atria and folded auricles');

  const arteries: THREE.BufferGeometry[] = [];
  const veins: THREE.BufferGeometry[] = [];
  const fatPads: THREE.BufferGeometry[] = [];
  // Left anterior descending artery lies in the interventricular groove.
  arteries.push(tube(surfacePath(.10, .963, 1.475, 1.259, .0023), .0033, .00078, 12));
  // Left circumflex and right coronary arteries track the AV groove.
  arteries.push(tube(surfacePath(.105, .155, 1.49, -.40, .0027, -.11), .0033, .0018, 12));
  arteries.push(tube(surfacePath(.100, .172, 1.72, 3.93, .0027, .05), .0037, .0015, 12));
  arteries.push(tube(surfacePath(.147, .877, 2.93, 2.39, .0023, .075), .0028, .00051));
  arteries.push(tube(surfacePath(.148, .786, .44, .55, .0022, -.045), .0022, .00045));
  arteries.push(tube(surfacePath(.172, .918, 4.34, 4.59, .0021), .0025, .00060));
  // Diagonal, septal-facing and obtuse-marginal surface branches.
  for (let i = 0; i < 5; i++) {
    const t = .205 + i * .131;
    const a = 1.50 - .25 * t;
    const end = Math.min(.94, t + .22);
    const branch = surfacePath(t, end, a, a - .61 + i * .035, .002, -.025);
    arteries.push(tube(branch, .00195 - i * .00016, .00030, 8));
    arteries.push(tube(surfacePath(t + .037, Math.min(.94, end + .033), a + .04, a + .64 - i * .04, .002, .07), .00154 - i * .00012, .00025, 8));
    if (i < 4) {
      arteries.push(tube(surfacePath(t + .095, end + .08, a - .30, a - .72, .00175), .00083, .00018, 6));
      arteries.push(tube(surfacePath(t + .096, end + .048, a + .32, a + .79, .00175), .00073, .00016, 6));
    }
  }
  // Great cardiac vein parallels the LAD, then joins the coronary sinus.
  veins.push(tube(surfacePath(.922, .127, 1.329, 1.573, .0022), .00094, .0028, 10));
  veins.push(tube(surfacePath(.13, .163, 1.58, -.74, .0024), .0026, .0034, 10));
  veins.push(tube(surfacePath(.167, .188, 3.60, 5.50, .0024), .0032, .0025, 10));
  veins.push(tube(surfacePath(.89, .19, 4.48, 4.22, .0021), .00077, .0023, 10));
  for (let i = 0; i < 4; i++) {
    const t = .235 + .157 * i;
    veins.push(tube(surfacePath(t + .15, t, 1.01 - i * .035, 1.56 - .25 * t, .00195), .00040, .0014, 8));
    veins.push(tube(surfacePath(t + .18, t, 2.31 - i * .085, 1.56 - .25 * t, .0019), .00037, .0011, 8));
  }
  // Epicardial adipose tissue follows coronary grooves instead of random spots.
  for (let i = 0; i < 29; i++) {
    const a = i / 29 * TAU;
    const t = .13 + .013 * Math.sin(a * 3);
    fatPads.push(fatPatch(t, a, .022 + .007 * Math.sin(i * 3.174), .148 + .055 * Math.sin(i * 8.21), i * 3.09));
  }
  for (let i = 0; i < 40; i++) {
    const t = .145 + i / 40 * .73;
    for (const s of [-1, 1]) {
      if ((i + (s === 1 ? 1 : 0)) % 4 === 0) continue;
      const a = 1.50 - .25 * t + s * (.036 + .009 * Math.sin(i * 3.72));
      const r = (.021 + .007 * Math.sin(i * 5.32)) * (1 - t * .38);
      fatPads.push(fatPatch(t, a, r, .039 + .006 * Math.cos(i * 3.117), i * 2.7));
    }
  }
  add(ventricles, merge(fatPads), fat, 'Epicardial adipose tissue in coronary grooves');
  add(ventricles, merge(arteries), coronary, 'LAD, circumflex, RCA and branching coronary arteries');
  add(ventricles, merge(veins), cardiacVein, 'Great cardiac vein, coronary sinus and venous tributaries');

  const greatArteries: THREE.BufferGeometry[] = [];
  const greatVeins: THREE.BufferGeometry[] = [];
  const vesselRims: THREE.BufferGeometry[] = [];
  const vesselLumens: THREE.BufferGeometry[] = [];
  const hollow = (points: Point[], r: number, target: THREE.BufferGeometry[], end = r * .91) => {
    const path = points.map(p => new THREE.Vector3(...p));
    target.push(tube(path, r, end, 24));
    // The open lumens include wall thickness and an actual recessed inner wall.
    const c = new THREE.CatmullRomCurve3(path, false, 'centripetal');
    const inside = Array.from({ length: 9 }, (_, i) => c.getPointAt(.68 + i / 8 * .32));
    vesselLumens.push(tube(inside, mix(r, end, .68) * .72, end * .72, 24));
    const ring = new THREE.RingGeometry(end * .72, end, 32);
    const tangent = c.getTangentAt(1).normalize();
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent));
    ring.translate(...path[path.length - 1].toArray());
    vesselRims.push(ring);
  };
  // Aorta rises behind the pulmonary trunk, arches to the subject's left,
  // and descends posteriorly. Its three superior branch stumps are distinct.
  hollow([[-.034, .084, -.006], [-.028, .162, -.008], [-.007, .223, -.018], [.041, .243, -.036], [.083, .217, -.060], [.084, .139, -.094]], .0235, greatArteries, .021);
  hollow([[-.013, .222, -.018], [-.032, .263, -.023], [-.045, .291, -.027]], .0116, greatArteries, .0090);
  hollow([[.021, .241, -.030], [.019, .273, -.035], [.023, .301, -.040]], .0086, greatArteries, .0073);
  hollow([[.051, .239, -.043], [.069, .267, -.054], [.086, .288, -.061]], .0092, greatArteries, .0082);
  hollow([[-.016, .083, .060], [-.009, .139, .069], [.013, .188, .054], [.054, .204, .007], [.112, .185, -.042]], .023, greatArteries, .0160);
  hollow([[.035, .195, .028], [-.009, .189, -.008], [-.068, .176, -.055], [-.120, .177, -.071]], .016, greatArteries, .0130);
  // Systemic venous roots and four pulmonary venous entries on the back.
  hollow([[-.097, .107, -.023], [-.106, .168, -.031], [-.104, .225, -.040]], .0205, greatVeins, .0190);
  hollow([[-.097, .076, -.034], [-.111, .034, -.052], [-.115, -.011, -.068]], .0210, greatVeins, .0190);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    hollow([[s * .044, .125 - i * .029, -.087], [s * .081, .141 - i * .035, -.102], [s * .112, .147 - i * .036, -.113]], .011, greatArteries, .0092);
  }
  add(roots, merge(greatArteries), arterialWall, 'Aortic arch, pulmonary trunk and pulmonary venous entries');
  add(roots, merge(greatVeins), venousWall, 'Superior and inferior vena cava');
  add(roots, merge(vesselRims), intima, 'Exposed vessel wall thickness');
  add(roots, merge(vesselLumens), lumen, 'Recessed open vessel lumens');

  function animate(phase: number) {
    const p = ((phase % 1) + 1) % 1;
    const systole = Math.exp(-Math.pow((p - .17) / .105, 2));
    const recoil = Math.exp(-Math.pow((p - .43) / .15, 2));
    const atrialKick = Math.exp(-Math.pow((p - .91) / .072, 2));
    // Myocardial shortening and ventricular torsion move the coronary tree with
    // its supporting tissue; the anchored great vessels distend more subtly.
    ventricles.scale.set(1 - .060 * systole + .009 * recoil, 1 - .087 * systole + .012 * recoil, 1 - .067 * systole + .011 * recoil);
    ventricles.rotation.z = .023 * systole;
    ventricles.rotation.y = -.017 * systole;
    atria.scale.set(1 - .025 * atrialKick + .008 * systole, 1 - .038 * atrialKick, 1 - .024 * atrialKick);
    roots.scale.set(1 + .009 * systole, 1, 1 + .013 * systole);
  }
  function dispose() {
    group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    for (const m of materials) m.dispose();
    textures.color.dispose();
    textures.bump.dispose();
    textures.roughness.dispose();
  }
  return { group, animate, dispose };
}
