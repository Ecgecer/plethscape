import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Original procedural pulmonary anatomy. All surfaces, airways and tissue maps
 * are constructed in code. This is an anatomical illustration, not segmentation
 * of a patient or an alveolar/ventilation solver.
 * Reference for lobes/fissures and cardiac notch:
 * https://openstax.org/books/anatomy-and-physiology-2e/pages/22-2-the-lungs
 * Coordinate convention: anterior +z; anatomical left is viewer-right (+x).
 */
type P = [number, number, number];
type Side = -1 | 1;
type Vertex = { p: THREE.Vector3; n: THREE.Vector3; uv: THREE.Vector2; c: THREE.Color };
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const gauss = (x: number, center: number, width: number) => Math.exp(-(((x - center) / width) ** 2));

function profile(t: number): number {
  // Broad basal contour, tapered superior third, softly rounded apex.
  if (t >= .90) return .43 * Math.sqrt(Math.max(0, (1 - t) / .10));
  const points = [[0, .90], [.08, .98], [.28, 1], [.50, .94], [.73, .74], [.90, .43], [1, 0]];
  let i = 0;
  while (i < points.length - 2 && t > points[i + 1][0]) i++;
  const a = points[i], b = points[i + 1];
  const f = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 2)];
  const m0 = (b[1] - prev[1]) / (b[0] - prev[0]);
  const m1 = (next[1] - a[1]) / (next[0] - a[0]);
  const f2 = f * f, f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * a[1] + (f3 - 2 * f2 + f) * m0 * (b[0] - a[0])
    + (-2 * f3 + 3 * f2) * b[1] + (f3 - f2) * m1 * (b[0] - a[0]);
}

function envelope(side: Side, t: number, theta: number, inset = 1): THREE.Vector3 {
  const right = side < 0;
  const c = Math.cos(theta), s = Math.sin(theta);
  const r = profile(t) * inset;
  const center = .182 - .032 * t;
  // A D-shaped axial section gives the mediastinal surface a flatter profile.
  const lateral = c >= 0 ? c * (right ? .140 : .130) : -Math.pow(-c, .60) * (right ? .111 : .103);
  let x = center + lateral * r;
  let y = (right ? -.272 : -.289) + (right ? .579 : .604) * t;
  let z = -.026 + s * (s >= 0 ? .145 : .151) * r;
  // Costal base slopes posteriorly; apex leans slightly posteriorly.
  y += -.013 * Math.max(0, -s) * (1 - t) ** 4;
  z -= .007 * t * t;
  if (!right) {
    const medial = Math.max(0, -c) ** .75;
    const anterior = Math.max(0, s) ** .65;
    const notch = medial * anterior * gauss(y, -.007, .115);
    x += .080 * notch;
    z -= .030 * notch;
    // The small tongue of upper-lobe tissue inferior to the cardiac notch.
    const lingula = medial * anterior * gauss(y, -.151, .045);
    x -= .023 * lingula;
    z += .015 * lingula;
  }
  // Pleural geometry stays smooth. Surface granularity belongs in a tiny bump
  // map, not a field of oversized bubbles representing individual alveoli.
  return new THREE.Vector3(side * x, y, z);
}

function lungEnvelope(side: Side): THREE.BufferGeometry {
  const rings = 60, radial = 88;
  const p: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
  const push = (v: THREE.Vector3, u: number, w: number) => {
    p.push(v.x, v.y, v.z); uv.push(u, w);
    const variation = .965 + .020 * Math.sin(v.y * 17 + v.z * 11) + .013 * Math.cos(v.x * 31 - v.y * 9);
    colors.push(variation, variation * .982, variation * .991);
  };
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j <= radial; j++) {
      push(envelope(side, i / rings, j / radial * TAU), j / radial, i / rings);
      if (i < rings && j < radial) {
        const a = i * (radial + 1) + j, b = a + 1, d = a + radial + 1, c = d + 1;
        if (side > 0) indices.push(a, d, b, b, d, c);
        else indices.push(a, b, d, b, c, d);
      }
    }
  }
  // A separate inward dome creates the concave diaphragmatic face. Its broad
  // rim joins the basal surface; it is not a rounded ellipsoid's narrow pole.
  const baseStart = p.length / 3;
  const baseRings = 12;
  for (let i = 0; i <= baseRings; i++) {
    const radius = 1 - i / baseRings;
    for (let j = 0; j <= radial; j++) {
      const theta = j / radial * TAU;
      const rim = envelope(side, 0, theta);
      const center = new THREE.Vector3(side * .178, side < 0 ? -.224 : -.242, -.026);
      const v = center.clone().lerp(rim, radius);
      v.y = mix(center.y, rim.y, radius * radius);
      push(v, j / radial, .02 - i / baseRings * .19);
      if (i < baseRings && j < radial) {
        const a = baseStart + i * (radial + 1) + j, b = a + 1, d = a + radial + 1, c = d + 1;
        if (side > 0) indices.push(a, b, d, b, c, d);
        else indices.push(a, d, b, b, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

/** Clip each smooth triangle at a fissure; interpolation preserves its normals. */
function clipSurface(source: THREE.BufferGeometry, plane: THREE.Plane, keepPositive: boolean): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [];
  const index = source.index;
  const pa = source.getAttribute('position'), na = source.getAttribute('normal'), ua = source.getAttribute('uv'), ca = source.getAttribute('color');
  const read = (i: number): Vertex => ({
    p: new THREE.Vector3().fromBufferAttribute(pa, i), n: new THREE.Vector3().fromBufferAttribute(na, i),
    uv: new THREE.Vector2(ua.getX(i), ua.getY(i)), c: new THREE.Color(ca.getX(i), ca.getY(i), ca.getZ(i)),
  });
  const write = (v: Vertex) => { positions.push(v.p.x, v.p.y, v.p.z); normals.push(v.n.x, v.n.y, v.n.z); uvs.push(v.uv.x, v.uv.y); colors.push(v.c.r, v.c.g, v.c.b); };
  for (let i = 0; i < (index ? index.count : pa.count); i += 3) {
    const input = [0, 1, 2].map(k => read(index ? index.getX(i + k) : i + k));
    const output: Vertex[] = [];
    for (let j = 0; j < 3; j++) {
      const a = input[j], b = input[(j + 1) % 3];
      const da = plane.distanceToPoint(a.p) * (keepPositive ? 1 : -1);
      const db = plane.distanceToPoint(b.p) * (keepPositive ? 1 : -1);
      if (da >= 0) output.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        output.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), uv: a.uv.clone().lerp(b.uv, t), c: a.c.clone().lerp(b.c, t) });
      }
    }
    for (let j = 1; j < output.length - 1; j++) { write(output[0]); write(output[j]); write(output[j + 1]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

function tube(curve: THREE.Curve<THREE.Vector3>, radius: number, endRadius: number, steps = 14, sides = 7): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(steps, false);
  const p: number[] = [], idx: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, center = curve.getPointAt(t), r = mix(radius, endRadius, t);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU;
      const v = center.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r);
      p.push(v.x, v.y, v.z);
      if (i < steps && j < sides) { const q = i * (sides + 1) + j; idx.push(q, q + 1, q + sides + 1, q + 1, q + sides + 2, q + sides + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  parts.forEach(p => p.dispose());
  g.computeBoundingSphere(); return g;
}

function tissueMaps(): { color: THREE.Texture; bump: THREE.Texture } {
  const size = 256;
  const color = new Uint8Array(size * size * 4), bump = new Uint8Array(size * size * 4);
  let seed = 76191;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const grain = random() - .5;
    const mottling = Math.sin(x * .061 + Math.sin(y * .041)) * Math.cos(y * .052 + Math.sin(x * .034));
    const v = grain * 8 + mottling * 4;
    color.set([181 + v, 132 + v * .9, 143 + v, 255], i);
    const h = 129 + grain * 48 + mottling * 15;
    bump.set([h, h, h, 255], i);
  }
  const make = (pixels: Uint8Array): THREE.Texture => {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const data = ctx.createImageData(size, size); data.data.set(pixels); ctx.putImageData(data, 0, 0);
        return new THREE.CanvasTexture(canvas);
      }
    }
    // Also allow geometry tests / offline generation without a browser canvas.
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat); texture.needsUpdate = true; return texture;
  };
  const map = make(color), height = make(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, height]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 5); t.anisotropy = 4; }
  return { color: map, bump: height };
}

export function createLungs(): { group: THREE.Group; animate: (timeSec: number, respiratoryRate: number) => void; dispose: () => void } {
  const group = new THREE.Group(); group.name = 'Lungs · original lobar anatomy'; group.position.set(0, 2.58, -.012);
  group.userData = { organ: 'lungs', procedural: true, source: 'Original parametric anatomy; OpenStax gross anatomical references' };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const maps = tissueMaps();
  const add = (parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, order: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.renderOrder = order;
    mesh.userData = { organ: 'lungs', anatomyPart: material.userData.anatomyPart };
    parent.add(mesh); geometries.add(geometry); materials.add(material); return mesh;
  };
  const tissue = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: maps.color, bumpMap: maps.bump, bumpScale: .00042,
    vertexColors: true, roughness: .70, metalness: 0, clearcoat: .13, clearcoatRoughness: .5,
    transparent: true, opacity: .36, depthWrite: false, side: THREE.DoubleSide,
  });
  tissue.name = 'Pulmonary tissue · muted mauve';
  tissue.userData = { anatomyPart: 'lung-tissue', restOpacity: .36, xrayOpacity: .29, textbookOpacity: .91 };
  const airway = new THREE.MeshStandardMaterial({ color: '#d9b9a4', roughness: .60, metalness: 0, emissive: '#775f52', emissiveIntensity: .045 });
  airway.name = 'Bronchial mucosa'; airway.userData = { anatomyPart: 'lung-airway', restOpacity: 1 };
  const cartilage = new THREE.MeshStandardMaterial({ color: '#e5d4bd', roughness: .64, metalness: 0 });
  cartilage.name = 'Tracheal cartilage'; cartilage.userData = { anatomyPart: 'lung-cartilage', restOpacity: 1 };
  const fissure = new THREE.MeshStandardMaterial({ color: '#654a53', roughness: .86, transparent: true, opacity: .50, depthWrite: false });
  fissure.name = 'Pleural fissure recess'; fissure.userData = { anatomyPart: 'lung-fissure', restOpacity: .50 };

  const moving: Array<{ group: THREE.Group; side: Side }> = [];
  for (const side of [-1, 1] as Side[]) {
    const half = new THREE.Group(); half.name = side < 0 ? 'Right lung · three lobes' : 'Left lung · two lobes'; group.add(half); moving.push({ group: half, side });
    const source = lungEnvelope(side);
    const oblique = new THREE.Plane(new THREE.Vector3(0, 1, side < 0 ? 1.05 : 1.10).normalize(), (side < 0 ? .025 : .035) / Math.sqrt(1 + (side < 0 ? 1.05 : 1.10) ** 2));
    const horizontal = new THREE.Plane(new THREE.Vector3(0, 1, -.07).normalize(), -.020 / Math.sqrt(1.0049));
    const lower = clipSurface(source, oblique, false);
    lower.translate(0, -.001, -.0009);
    add(half, side < 0 ? 'Right inferior lobe' : 'Left inferior lobe', lower, tissue, 4);
    const upper = clipSurface(source, oblique, true);
    if (side < 0) {
      const superior = clipSurface(upper, horizontal, true); superior.translate(0, .0010, 0);
      const middle = clipSurface(upper, horizontal, false); middle.translate(0, -.0004, .0011);
      add(half, 'Right superior lobe', superior, tissue, 4); add(half, 'Right middle lobe', middle, tissue, 4); upper.dispose();
    } else { upper.translate(0, .0007, .0008); add(half, 'Left superior lobe with cardiac notch and lingula', upper, tissue, 4); }
    source.dispose();

    // Trace fissures directly on the parametric pleura. Horizontal fissure is
    // clipped where it meets the oblique fissure, so it never crosses the back.
    for (const [index, plane] of (side < 0 ? [oblique, horizontal] : [oblique]).entries()) {
      const paths: THREE.Vector3[][] = []; let path: THREE.Vector3[] = [];
      for (let j = 0; j <= 176; j++) {
        const theta = j / 176 * TAU;
        let lo = 0, hi = 1;
        for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (plane.distanceToPoint(envelope(side, mid, theta)) > 0) hi = mid; else lo = mid; }
        const p = envelope(side, (lo + hi) / 2, theta, 1.001);
        if (index === 1 && oblique.distanceToPoint(p) < -.001) { if (path.length > 2) paths.push(path); path = []; }
        else path.push(p);
      }
      if (path.length > 2) paths.push(path);
      for (const points of paths) add(half, index ? 'Right horizontal fissure' : 'Oblique pleural fissure', tube(new THREE.CatmullRomCurve3(points), .00095, .00095, Math.max(20, points.length), 5), fissure, 5);
    }

    const branchParts: THREE.BufferGeometry[] = [];
    const main = new THREE.Vector3(side * (side < 0 ? .103 : .127), .105, -.034);
    const carina = new THREE.Vector3(0, .204, -.033);
    const mainCurve = new THREE.CubicBezierCurve3(carina, new THREE.Vector3(side * .025, .168, -.036), main.clone().add(new THREE.Vector3(-side * .026, .020, 0)), main);
    branchParts.push(tube(mainCurve, side < 0 ? .0135 : .0125, .0105, 22, 10));
    const direction = main.clone().sub(carina).normalize();

    const branch = (a: THREE.Vector3, b: THREE.Vector3, initialDirection: THREE.Vector3, radius: number, endRadius: number) => {
      const length = a.distanceTo(b), d = b.clone().sub(a).normalize();
      const departure = initialDirection.clone().lerp(d, .65).normalize();
      const c = new THREE.CubicBezierCurve3(a, a.clone().addScaledVector(departure, length * .32), b.clone().addScaledVector(d, -length * .27), b);
      branchParts.push(tube(c, radius, endRadius, radius > .005 ? 14 : 8, radius > .005 ? 8 : 6));
      return c.getTangent(1).normalize();
    };
    const keepInside = (p: THREE.Vector3) => {
      const t = clamp((p.y - (side < 0 ? -.272 : -.289)) / (side < 0 ? .579 : .604), .09, .90);
      p.y = (side < 0 ? -.272 : -.289) + t * (side < 0 ? .579 : .604);
      const center = new THREE.Vector3(side * (.182 - .032 * t), p.y, -.026);
      const dx = side * (p.x - center.x), dz = p.z - center.z;
      const theta = Math.atan2(dz / .145, dx / (dx >= 0 ? .136 : .107));
      const edge = envelope(side, t, theta, .78);
      const direction = p.clone().sub(center);
      const max = edge.distanceTo(center);
      return center.addScaledVector(direction.normalize(), Math.min(p.distanceTo(center), max));
    };
    const twigs = (start: THREE.Vector3, end: THREE.Vector3, incoming: THREE.Vector3, radius: number, depth: number, seed: number) => {
      const tangent = branch(start, end, incoming, radius, radius * .73);
      if (!depth) return;
      const normal = new THREE.Vector3(Math.cos(seed * 1.7), .35 * Math.sin(seed), Math.sin(seed * 1.7));
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      for (const sign of [-1, 1]) {
        const distance = depth === 3 ? .033 : depth === 2 ? .021 : .013;
        const target = keepInside(end.clone().addScaledVector(tangent, distance).addScaledVector(normal, sign * distance * .61));
        if (target.distanceTo(end) > .003) twigs(end, target, tangent, radius * .65, depth - 1, seed + sign * 1.8 + .7);
      }
    };
    // Lobes receive distinct secondary bronchi. Their segmental branches follow
    // territories before tapering into small smooth bronchioles.
    const territories: Array<{ hilum: P; ends: P[] }> = side < 0 ? [
      { hilum: [-.140, .140, -.028], ends: [[-.161, .230, -.025], [-.215, .186, -.084], [-.219, .133, .064]] },
      { hilum: [-.159, .021, .014], ends: [[-.247, -.036, .085], [-.127, -.071, .080]] },
      { hilum: [-.155, -.007, -.048], ends: [[-.218, .043, -.091], [-.239, -.179, -.083], [-.264, -.171, -.004], [-.216, -.194, .061], [-.137, -.165, -.014]] },
    ] : [
      { hilum: [.163, .121, -.028], ends: [[.177, .226, -.047], [.236, .147, .047], [.240, -.087, .071], [.248, -.136, .051]] },
      { hilum: [.170, -.004, -.061], ends: [[.233, .048, -.093], [.237, -.182, -.076], [.271, -.178, -.009], [.218, -.206, .040], [.150, -.182, -.034]] },
    ];
    for (const [lobeIndex, territory] of territories.entries()) {
      const hilum = new THREE.Vector3(...territory.hilum);
      const lobarDirection = branch(main, hilum, direction, .0080, .0060);
      for (const [segment, destination] of territory.ends.entries()) {
        twigs(hilum, keepInside(new THREE.Vector3(...destination)), lobarDirection, .0038, 3, 3 + segment * 2.31 + lobeIndex * 5.3 + side);
      }
    }
    add(half, side < 0 ? 'Right lobar and segmental bronchial tree' : 'Left lobar and segmental bronchial tree', join(branchParts), airway, 3);
  }

  const trachea = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .447, -.022), new THREE.Vector3(0, .355, -.026), new THREE.Vector3(0, .270, -.031), new THREE.Vector3(0, .202, -.033)]);
  add(group, 'Trachea and carina', tube(trachea, .0173, .0161, 36, 14), airway, 3);
  const rings: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const t = .035 + i / 14 * .92, center = trachea.getPointAt(t);
    const points: THREE.Vector3[] = [];
    for (let j = 0; j <= 30; j++) { const a = -Math.PI / 3 + j / 30 * Math.PI * 5 / 3; points.push(center.clone().add(new THREE.Vector3(Math.cos(a) * .0181, 0, Math.sin(a) * .0181))); }
    rings.push(tube(new THREE.CatmullRomCurve3(points), .0017, .0017, 30, 6));
  }
  add(group, 'Fourteen C-shaped cartilage rings · posterior membranous gap', join(rings), cartilage, 4);

  let disposed = false;
  return {
    group,
    animate(timeSec: number, respiratoryRate: number) {
      const rate = clamp(Number.isFinite(respiratoryRate) ? respiratoryRate : 16, 6, 36);
      const phase = ((timeSec * rate / 60) % 1 + 1) % 1;
      // Inspiration occupies less of a quiet respiratory cycle than expiration.
      const breath = phase < .42 ? .5 - .5 * Math.cos(phase / .42 * Math.PI) : .5 + .5 * Math.cos((phase - .42) / .58 * Math.PI);
      for (const item of moving) {
        item.group.scale.set(1 + breath * .025, 1 + breath * .030, 1 + breath * .066);
        item.group.position.set(item.side * breath * .003, -breath * .008, breath * .001);
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); maps.color.dispose(); maps.bump.dispose(); group.removeFromParent();
    },
  };
}
