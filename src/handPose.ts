import * as THREE from "three";

// A presentation pose: pronate both forearms gradually, with rigid hands.
// The same transform is applied to every tissue, vessel route and attachment.
const pivots = [
  new THREE.Vector3(-0.532, 1.935, 0.018),
  new THREE.Vector3(0.532, 1.935, 0.018),
];
const axes = [
  new THREE.Vector3(0.2, 0.946, -0.26).normalize(),
  new THREE.Vector3(-0.2, 0.946, -0.26).normalize(),
];
const rotation = new THREE.Quaternion();
const relative = new THREE.Vector3();
const tangent = new THREE.Vector3();
const twistStart = -0.015;
const twistEnd = 0.26;

export function handRotation(point: THREE.Vector3, target: THREE.Quaternion) {
  target.identity();
  // Follow the source air gap: it narrows beside the elbow, while the pelvis
  // is wider below. A constant cutoff either splits the elbow or grabs hips.
  const gap = THREE.MathUtils.lerp(
    0.41,
    0.33,
    THREE.MathUtils.smoothstep(point.y, 2.0, 2.3),
  );
  if (Math.abs(point.x) < gap || point.y > 2.5 || point.y < 1.25) return target;
  const side = point.x < 0 ? 0 : 1;
  const along = relative.subVectors(point, pivots[side]).dot(axes[side]);
  // End below the elbow: rotating the elbow's bony landmarks produced a
  // corkscrew fold. Keep those landmarks and the upper arm in their source pose.
  const weight = 1 - THREE.MathUtils.smoothstep(along, twistStart, twistEnd);
  return target.setFromAxisAngle(
    axes[side],
    (side ? -1 : 1) * Math.PI * weight,
  );
}

export function poseHand(point: THREE.Vector3, normal?: THREE.Vector3) {
  handRotation(point, rotation);
  if (rotation.w === 1) return point;
  const side = point.x < 0 ? 0 : 1;
  relative.subVectors(point, pivots[side]);
  const along = relative.dot(axes[side]);
  relative.applyQuaternion(rotation);
  if (normal) {
    normal.applyQuaternion(rotation);
    // Inverse-transpose of the twist deformation, including its transition.
    const span = twistEnd - twistStart;
    const t = THREE.MathUtils.clamp((along - twistStart) / span, 0, 1);
    const derivative = ((side ? 1 : -1) * Math.PI * 6 * t * (1 - t)) / span;
    tangent.crossVectors(axes[side], relative);
    normal
      .addScaledVector(axes[side], -derivative * normal.dot(tangent))
      .normalize();
  }
  return point.copy(relative).add(pivots[side]);
}
