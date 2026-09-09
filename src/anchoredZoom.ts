import * as THREE from "three";

export type Viewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type ScreenPoint = { x: number; y: number };
export interface ZoomAnchor {
  point: THREE.Vector3;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  forward: THREE.Vector3;
  depth: number;
  surface: boolean;
}

function pointerRay(
  camera: THREE.PerspectiveCamera,
  cursor: ScreenPoint,
  rect: Viewport,
) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((cursor.x - rect.left) / rect.width) * 2 - 1,
      1 - ((cursor.y - rect.top) / rect.height) * 2,
    ),
    camera,
  );
  return ray;
}

/** Pick once per gesture, using client coordinates and the visible surface's depth. */
export function captureZoomAnchor(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  cursor: ScreenPoint,
  rect: Viewport,
  objects: THREE.Object3D[],
): ZoomAnchor {
  camera.updateMatrixWorld();
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const ray = pointerRay(camera, cursor, rect);
  const meshes: THREE.Object3D[] = [];
  for (const root of objects)
    root.traverseVisible((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
  const hit = ray.intersectObjects(meshes, false)[0];
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    forward,
    target,
  );
  const point =
    hit?.point.clone() ??
    ray.ray.intersectPlane(plane, new THREE.Vector3()) ??
    target.clone();
  return {
    point,
    position: camera.position.clone(),
    rotation: camera.quaternion.clone(),
    forward,
    depth: Math.max(0.16, point.clone().sub(camera.position).dot(forward)),
    surface: Boolean(hit),
  };
}

/** Absolute gesture transform: scale about the picked point, then translate so
 * that point follows the current midpoint. No repeated depth estimates or drift. */
export function applyAnchoredZoom(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  anchor: ZoomAnchor,
  cursor: ScreenPoint,
  rect: Viewport,
  scale: number,
  minDepth = 0.16,
  maxDepth = 8.5,
) {
  const depth = THREE.MathUtils.clamp(anchor.depth * scale, minDepth, maxDepth);
  camera.quaternion.copy(anchor.rotation);
  camera.position
    .copy(anchor.position)
    .sub(anchor.point)
    .multiplyScalar(depth / anchor.depth)
    .add(anchor.point);
  camera.updateMatrixWorld();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    anchor.forward,
    anchor.point,
  );
  const underCursor = pointerRay(camera, cursor, rect).ray.intersectPlane(
    plane,
    new THREE.Vector3(),
  );
  if (underCursor) camera.position.add(anchor.point).sub(underCursor);
  target.copy(camera.position).addScaledVector(anchor.forward, depth);
  camera.updateMatrixWorld();
}
