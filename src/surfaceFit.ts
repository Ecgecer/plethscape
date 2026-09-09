import * as THREE from "three";

/** A small head/neck-only view of the skin for load-time fitting and occlusion. */
export function upperSkinGeometry(source: THREE.BufferGeometry, minimumY = 3) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes))
    geometry.setAttribute(name, attribute);
  const p = source.getAttribute("position"),
    index = source.getIndex();
  const indices: number[] = [];
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const a = index ? index.getX(i) : i,
      b = index ? index.getX(i + 1) : i + 1,
      c = index ? index.getX(i + 2) : i + 2;
    if (Math.max(p.getY(a), p.getY(b), p.getY(c)) > minimumY)
      indices.push(a, b, c);
  }
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function fitWearablesToSkin(
  skin: THREE.Mesh,
  forehead: THREE.Group,
  neck: THREE.Group,
  headOrigin: THREE.Vector3,
) {
  const ray = new THREE.Raycaster(),
    radial = new THREE.Vector3(),
    origin = new THREE.Vector3();
  // Horizontal triangle bins keep fitting local: each ray visits a narrow
  // slice, not every triangle in the head and neck. Discard these CPU-only
  // meshes when fitting finishes.
  const bins = new Map<number, number[]>(),
    slices = new Map<string, THREE.Mesh>();
  const skinPositions = skin.geometry.getAttribute("position"),
    skinIndices = skin.geometry.getIndex()!;
  const step = 0.025;
  for (let i = 0; i < skinIndices.count; i += 3) {
    const a = skinIndices.getX(i),
      b = skinIndices.getX(i + 1),
      c = skinIndices.getX(i + 2);
    const low = Math.floor(
      Math.min(
        skinPositions.getY(a),
        skinPositions.getY(b),
        skinPositions.getY(c),
      ) / step,
    );
    const high = Math.floor(
      Math.max(
        skinPositions.getY(a),
        skinPositions.getY(b),
        skinPositions.getY(c),
      ) / step,
    );
    for (let row = low; row <= high; row++) {
      const list = bins.get(row) ?? [];
      list.push(a, b, c);
      bins.set(row, list);
    }
  }
  const intersect = (height: number, neighbors = 0) => {
    const row = Math.floor(height / step),
      key = `${row}:${neighbors}`;
    let slice = slices.get(key);
    if (!slice) {
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(skin.geometry.attributes))
        geometry.setAttribute(name, attribute);
      const indices = [];
      for (let k = row - neighbors; k <= row + neighbors; k++)
        indices.push(...(bins.get(k) ?? []));
      geometry.setIndex(indices);
      geometry.boundingSphere = skin.geometry.boundingSphere;
      geometry.boundingBox = skin.geometry.boundingBox;
      slice = new THREE.Mesh(geometry, skin.material);
      slice.matrixWorld.copy(skin.matrixWorld);
      slices.set(key, slice);
    }
    return ray.intersectObject(slice, false)[0];
  };
  // Sample the actual skin at three heights. Interpolate the contour rather
  // than raycasting every textile vertex or doing work on animation frames.
  const count = 128,
    heights = [-0.016, 0, 0.016];
  const contours = heights.map((y) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      radial.set(Math.sin(angle), 0, Math.cos(angle));
      origin.copy(headOrigin).addScaledVector(radial, 0.6);
      origin.y += y;
      ray.set(origin, radial.clone().negate());
      const hit = intersect(origin.y);
      if (!hit) throw new Error("Head contour could not be fitted to the skin");
      return Math.hypot(hit.point.x - headOrigin.x, hit.point.z - headOrigin.z);
    }),
  );
  const contourAt = (angle: number, y: number) => {
    const a = ((angle / (Math.PI * 2) + 1) % 1) * count,
      lo = Math.floor(a),
      t = a - lo;
    const h = THREE.MathUtils.clamp((y + 0.016) / 0.016, 0, 2),
      row = Math.min(1, Math.floor(h));
    const radius = (r: number) =>
      THREE.MathUtils.lerp(contours[r][lo], contours[r][(lo + 1) % count], t);
    return THREE.MathUtils.lerp(radius(row), radius(row + 1), h - row);
  };
  forehead.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const p = object.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        r = Math.hypot(x, z),
        angle = Math.atan2(x, z);
      const ellipse =
        1 /
        Math.sqrt(
          Math.pow(Math.sin(angle) / 0.176, 2) +
            Math.pow(Math.cos(angle) / 0.229, 2),
        );
      const fitted = contourAt(angle, p.getY(i)) + 0.0018 + r - ellipse;
      p.setXYZ(i, (x * fitted) / r, p.getY(i), (z * fitted) / r);
    }
    p.needsUpdate = true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  });
  const direction = new THREE.Vector3(0.82, 0, 0.57).normalize();
  const center = new THREE.Vector3(0, 3.065, -0.09);
  ray.set(
    center.clone().addScaledVector(direction, 0.5),
    direction.clone().negate(),
  );
  const hit = intersect(center.y, 1);
  if (!hit) throw new Error("Neck patch could not be fitted to the skin");
  const normal = (hit.normal ?? hit.face!.normal).clone().normalize();
  if (normal.dot(direction) < 0) normal.negate();
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const up = normal.clone().cross(right).normalize();
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, normal),
  );
  const anchor = hit.point.clone();
  const cache = new Map<string, number>();
  neck.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const p = object.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        key = `${x.toFixed(5)},${y.toFixed(5)}`;
      let depth = cache.get(key);
      if (depth === undefined) {
        const base = anchor
          .clone()
          .addScaledVector(right, x)
          .addScaledVector(up, y);
        ray.set(
          base.clone().addScaledVector(normal, 0.12),
          normal.clone().negate(),
        );
        const contact = intersect(base.y, 1);
        if (!contact) throw new Error("Neck patch edge missed the skin");
        depth = contact.point.sub(base).dot(normal);
        cache.set(key, depth);
      }
      p.setXYZ(i, x, y, depth + z + 0.0028);
    }
    p.needsUpdate = true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  });
  slices.forEach((mesh) => mesh.geometry.dispose());
  return { position: anchor, quaternion: orientation };
}
