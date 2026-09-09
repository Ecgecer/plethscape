import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
type P = [number, number, number];

/** Hand-constructed bony landmarks with cortical shafts, articulations, curved
 * flattened ribs and pelvic plates. Educational proportions, not CT segmentation. */
export function createSkeleton() {
  const group = new THREE.Group();
  group.name = "Anatomical skeletal landmarks";
  const bone: THREE.BufferGeometry[] = [],
    cartilage: THREE.BufferGeometry[] = [];
  const v = (p: P) => new THREE.Vector3(...p);
  const m = (p: P, s: number): P => [p[0] * s, p[1], p[2]];
  function ball(p: P, r: P, out = bone) {
    const g = new THREE.SphereGeometry(1, 20, 14);
    g.scale(...r);
    g.translate(...p);
    out.push(g);
  }
  function tube(points: P[], radius: number, flatten = 1, out = bone) {
    const curve = new THREE.CatmullRomCurve3(points.map(v));
    const N = Math.max(10, Math.ceil(curve.getLength() * 70)),
      R = 10,
      F = curve.computeFrenetFrames(N, false);
    const pos: number[] = [],
      idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        c = curve.getPointAt(t);
      const r = radius * (0.87 + 0.13 * Math.sin(Math.PI * t));
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2;
        const q = c
          .clone()
          .addScaledVector(F.normals[i], Math.cos(a) * r)
          .addScaledVector(F.binormals[i], Math.sin(a) * r * flatten);
        pos.push(q.x, q.y, q.z);
        if (i < N && j < R) {
          const k = i * (R + 1) + j;
          idx.push(k, k + 1, k + R + 1, k + 1, k + R + 2, k + R + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    bone === out ? bone.push(g) : out.push(g);
  }
  function plate(points: P[], depth: number) {
    const c = points
      .reduce((a, p) => a.add(v(p)), new THREE.Vector3())
      .multiplyScalar(1 / points.length);
    const pos: number[] = [],
      idx: number[] = [];
    for (const dz of [-depth, depth]) {
      pos.push(c.x, c.y, c.z + dz);
      for (const p of points) pos.push(p[0], p[1], p[2] + dz);
    }
    const n = points.length;
    for (let i = 0; i < n; i++) {
      idx.push(
        0,
        1 + i,
        1 + ((i + 1) % n),
        n + 1,
        n + 2 + ((i + 1) % n),
        n + 2 + i,
      );
      const a = i + 1,
        b = 1 + ((i + 1) % n);
      idx.push(a, b, a + n + 1, b, b + n + 1, a + n + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    bone.push(g);
  }
  // Manubrium and sternum body: flat bone, never a cylindrical rod.
  plate(
    [
      [-0.045, 2.865, 0.186],
      [0.044, 2.865, 0.186],
      [0.025, 2.759, 0.22],
      [-0.025, 2.759, 0.22],
    ],
    0.008,
  );
  plate(
    [
      [-0.022, 2.767, 0.221],
      [0.022, 2.767, 0.221],
      [0.016, 2.492, 0.217],
      [0, 2.452, 0.206],
      [-0.016, 2.492, 0.217],
    ],
    0.006,
  );
  for (const s of [-1, 1]) {
    tube(
      [
        [0.014, 2.857, 0.173],
        [0.13, 2.888, 0.145],
        [0.261, 2.879, 0.08],
        [0.401, 2.818, 0.021],
      ].map((p) => m(p as P, s)),
      0.014,
      0.79,
    );
    ball(m([0.407, 2.805, 0.016], s), [0.028, 0.027, 0.026]);
    // Scapular blade follows the posterior curvature; spine and acromion rise.
    plate(
      [
        [0.077, 2.839, -0.153],
        [0.316, 2.824, -0.13],
        [0.36, 2.748, -0.08],
        [0.238, 2.496, -0.162],
        [0.124, 2.637, -0.2],
      ].map((p) => m(p as P, s)),
      0.006,
    );
    tube(
      [
        [0.09, 2.762, -0.185],
        [0.21, 2.781, -0.19],
        [0.338, 2.787, -0.122],
        [0.398, 2.808, -0.016],
      ].map((p) => m(p as P, s)),
      0.012,
      0.65,
    );
    for (let i = 0; i < 12; i++) {
      const y = 2.852 - i * 0.047;
      const spread = 0.185 + 0.147 * Math.sin(((i + 1) / 14) * Math.PI);
      const forward = 0.13 + 0.077 * Math.sin(((i + 1) / 14) * Math.PI);
      const base: P[] = [
        [0.032, y, -0.157],
        [0.132, y - 0.004, -0.189],
        [spread * 0.84, y - 0.04, -0.16],
        [spread, y - 0.093, -0.054],
        [spread * 0.97, y - 0.134, 0.078],
        [spread * 0.68, y - 0.154, forward],
      ];
      if (i < 10)
        base.push([
          i < 7 ? 0.052 : 0.073 + (i - 7) * 0.013,
          y - 0.163,
          forward + 0.012,
        ]);
      tube(
        base.map((p) => m(p, s)),
        0.0068 - i * 0.00013,
        1.8,
      );
      if (i < 7)
        tube(
          [
            [0.052, y - 0.163, forward + 0.012],
            [0.026, y - 0.143, 0.211],
            [0.021, y - 0.133, 0.217],
          ].map((p) => m(p as P, s)),
          0.006,
          1.65,
          cartilage,
        );
      if (i >= 7 && i < 10)
        tube(
          [
            [0.073 + (i - 7) * 0.013, y - 0.163, forward + 0.012],
            [0.074, y - 0.12, 0.207],
            [0.034, 2.479, 0.214],
          ].map((p) => m(p as P, s)),
          0.0051,
          1.5,
          cartilage,
        );
    }
    // Humeral head and trochlea with a bowed diaphysis.
    ball(m([0.417, 2.79, 0.004], s), [0.049, 0.046, 0.044]);
    tube(
      [
        [0.424, 2.776, 0.001],
        [0.495, 2.626, -0.003],
        [0.605, 2.436, -0.004],
        [0.703, 2.279, 0.006],
      ].map((p) => m(p as P, s)),
      0.019,
      0.82,
    );
    ball(m([0.699, 2.282, 0.007], s), [0.028, 0.028, 0.029]);
    ball(m([0.724, 2.277, -0.008], s), [0.018, 0.023, 0.022]);
    tube(
      [
        [0.719, 2.294, -0.028],
        [0.744, 2.207, -0.022],
        [0.829, 1.995, 0.004],
        [0.908, 1.785, 0.025],
      ].map((p) => m(p as P, s)),
      0.0105,
      0.74,
    );
    tube(
      [
        [0.688, 2.275, 0.025],
        [0.749, 2.142, 0.04],
        [0.84, 1.971, 0.049],
        [0.894, 1.795, 0.047],
      ].map((p) => m(p as P, s)),
      0.0108,
      0.83,
    );
    ball(m([0.9, 1.793, 0.035], s), [0.025, 0.02, 0.016]);
    for (let i = 0; i < 4; i++) {
      const x = 0.879 + i * 0.029;
      const end = 1.43 + (i === 0 ? 0.022 : i === 3 ? 0.065 : 0);
      tube(
        [
          [0.902, 1.773, 0.034],
          [x, 1.652, 0.043],
          [x + 0.006, 1.586, 0.047],
        ].map((p) => m(p as P, s)),
        0.0058,
        0.8,
      );
      const y1 = 1.585,
        y2 = (1.585 + end) * 0.5;
      tube(
        [
          [x + 0.006, y1, 0.047],
          [x + 0.007, y2, 0.049],
          [x + 0.01, end, 0.053],
        ].map((p) => m(p as P, s)),
        0.0046,
        0.8,
      );
      ball(m([x + 0.008, y2, 0.049], s), [0.007, 0.009, 0.006]);
    }
    tube(
      [
        [0.889, 1.716, 0.045],
        [0.855, 1.643, 0.063],
        [0.816, 1.566, 0.084],
      ].map((p) => m(p as P, s)),
      0.0063,
      0.88,
    );
    // Iliac wing and ischiopubic arch preserve an open obturator region.
    plate(
      [
        [0.035, 1.929, -0.123],
        [0.141, 1.991, -0.102],
        [0.271, 1.948, -0.075],
        [0.298, 1.844, -0.017],
        [0.25, 1.76, 0.009],
        [0.139, 1.811, -0.063],
      ].map((p) => m(p as P, s)),
      0.009,
    );
    tube(
      [
        [0.146, 1.824, -0.046],
        [0.116, 1.725, -0.018],
        [0.134, 1.652, 0.059],
        [0.066, 1.653, 0.112],
        [0.023, 1.717, 0.117],
      ].map((p) => m(p as P, s)),
      0.017,
      0.7,
    );
    tube(
      [
        [0.023, 1.717, 0.117],
        [0.134, 1.747, 0.078],
        [0.182, 1.787, -0.004],
      ].map((p) => m(p as P, s)),
      0.017,
      0.8,
    );
    ball(m([0.17, 1.762, -0.015], s), [0.038, 0.035, 0.04]);
    // Femoral neck angle, greater trochanter and two distal condyles.
    tube(
      [
        [0.17, 1.762, -0.015],
        [0.245, 1.705, -0.022],
        [0.237, 1.389, -0.022],
        [0.218, 0.987, 0.018],
      ].map((p) => m(p as P, s)),
      0.026,
      0.86,
    );
    ball(m([0.26, 1.72, -0.028], s), [0.029, 0.044, 0.029]);
    ball(m([0.201, 0.974, 0.009], s), [0.024, 0.03, 0.033]);
    ball(m([0.241, 0.974, 0.009], s), [0.024, 0.03, 0.033]);
    ball(m([0.22, 0.956, 0.061], s), [0.023, 0.025, 0.012]);
    tube(
      [
        [0.224, 0.937, 0.02],
        [0.218, 0.721, 0.017],
        [0.207, 0.434, 0.018],
        [0.207, 0.191, 0.016],
      ].map((p) => m(p as P, s)),
      0.0175,
      0.66,
    );
    ball(m([0.222, 0.932, 0.017], s), [0.042, 0.018, 0.029]);
    tube(
      [
        [0.273, 0.917, 0.002],
        [0.262, 0.64, -0.014],
        [0.245, 0.348, -0.003],
        [0.247, 0.175, 0.006],
      ].map((p) => m(p as P, s)),
      0.0083,
      0.85,
    );
    ball(m([0.209, 0.186, 0.025], s), [0.027, 0.026, 0.023]);
    ball(m([0.216, 0.079, -0.047], s), [0.038, 0.031, 0.046]);
    for (let i = 0; i < 5; i++) {
      const x = 0.154 + i * 0.027,
        z = 0.333 - i * 0.016;
      tube(
        [
          [0.211, 0.132, 0.091],
          [x, 0.102, 0.221],
          [x, 0.072, z],
        ].map((p) => m(p as P, s)),
        i === 0 ? 0.008 : 0.0055,
        0.85,
      );
      ball(m([x, 0.072, z], s), [0.009, 0.008, 0.011]);
    }
  }
  for (let i = 0; i < 24; i++) {
    const y = 3.05 - i * 0.0479,
      z = -0.102 - Math.sin((i / 24) * Math.PI) * 0.072;
    const r = i < 7 ? 0.022 : 0.026 + ((i - 7) / 17) * 0.017;
    ball([0, y, z], [r, 0.019, r * 0.78]);
    ball([0, y - 0.023, z], [r * 0.93, 0.0048, r * 0.69], cartilage);
    tube(
      [
        [-r * 0.8, y, z - 0.008],
        [-r * 1.05, y, z - 0.035],
        [0, y - 0.014, z - 0.065],
        [r * 1.05, y, z - 0.035],
        [r * 0.8, y, z - 0.008],
      ],
      0.006,
    );
    tube(
      [
        [0, y - 0.01, z - 0.05],
        [0, y - 0.031, z - 0.093],
      ],
      0.006,
      0.52,
    );
    for (const s of [-1, 1])
      tube(
        [
          [s * r * 0.65, y, z - 0.017],
          [s * (r + 0.032), y - 0.013, z - 0.04],
        ],
        0.006,
        0.65,
      );
  }
  const materials = [
    new THREE.MeshStandardMaterial({
      name: "Cortical bone",
      color: "#c7bda6",
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
    new THREE.MeshStandardMaterial({
      name: "Costal cartilage",
      color: "#bac8b8",
      roughness: 0.76,
      transparent: true,
      opacity: 0.21,
      depthWrite: false,
    }),
  ];
  const geometries = [bone, cartilage].map((parts) => {
    parts.forEach((g) => g.deleteAttribute("uv"));
    const g = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return g;
  });
  geometries.forEach((g, i) => {
    const mesh = new THREE.Mesh(g, materials[i]);
    mesh.renderOrder = 1;
    group.add(mesh);
  });
  return {
    group,
    materials,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
