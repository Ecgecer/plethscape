import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  captureZoomAnchor,
  applyAnchoredZoom,
  type ScreenPoint,
  type ZoomAnchor,
} from "./anchoredZoom";

export function installBodyGestures(
  element: HTMLElement,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  objects: () => THREE.Object3D[],
  onStart: () => void,
  onChange: () => void,
) {
  const touches = new Map<number, ScreenPoint>();
  let pinch: { anchor: ZoomAnchor; spread: number } | null = null;
  let wheel: {
    anchor: ZoomAnchor;
    scale: number;
    cursor: ScreenPoint;
    until: number;
  } | null = null;
  let blockedTouch = false;
  let suppressClickUntil = 0;
  let restore: { rotate: boolean; pan: boolean; zoom: boolean } | null = null;

  function clearMomentum() {
    const position = camera.position.clone(),
      rotation = camera.quaternion.clone(),
      target = controls.target.clone();
    const damping = controls.enableDamping,
      rotating = controls.autoRotate;
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.update();
    camera.position.copy(position);
    camera.quaternion.copy(rotation);
    controls.target.copy(target);
    camera.updateMatrixWorld();
    controls.enableDamping = damping;
    controls.autoRotate = rotating;
  }
  function capture(cursor: ScreenPoint) {
    onStart();
    clearMomentum();
    const anchor = captureZoomAnchor(
      camera,
      controls.target,
      cursor,
      element.getBoundingClientRect(),
      objects(),
    );
    element.dataset.zoomAnchorSource = anchor.surface
      ? "surface"
      : "view-plane";
    element.dataset.zoomAnchorWorld = anchor.point.toArray().join(",");
    return anchor;
  }
  function apply(anchor: ZoomAnchor, cursor: ScreenPoint, scale: number) {
    applyAnchoredZoom(
      camera,
      controls.target,
      anchor,
      cursor,
      element.getBoundingClientRect(),
      scale,
      0.16,
      controls.maxDistance,
    );
    const projected = anchor.point.clone().project(camera),
      rect = element.getBoundingClientRect();
    element.dataset.zoomAnchorScreen = [
      rect.left + ((projected.x + 1) * rect.width) / 2,
      rect.top + ((1 - projected.y) * rect.height) / 2,
    ].join(",");
    onChange();
  }
  function midpoint() {
    const [a, b] = [...touches.values()];
    return {
      cursor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      spread: Math.max(4, Math.hypot(a.x - b.x, a.y - b.y)),
    };
  }
  const down = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    wheel = null;
    if (touches.size === 2) {
      const { cursor, spread } = midpoint();
      restore ??= {
        rotate: controls.enableRotate,
        pan: controls.enablePan,
        zoom: controls.enableZoom,
      };
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = false;
      blockedTouch = true;
      pinch = { anchor: capture(cursor), spread };
      suppressClickUntil = performance.now() + 500;
    }
    if (touches.size > 2) pinch = null;
  };
  const move = (event: PointerEvent) => {
    const before = touches.get(event.pointerId);
    if (!before) return;
    if (Math.hypot(event.clientX - before.x, event.clientY - before.y) > 3)
      suppressClickUntil = performance.now() + 500;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && touches.size >= 2) {
      event.preventDefault();
      const { cursor, spread } = midpoint();
      apply(pinch.anchor, cursor, pinch.spread / spread);
      suppressClickUntil = performance.now() + 500;
    }
  };
  const up = (event: PointerEvent) => {
    if (!touches.delete(event.pointerId)) return;
    if (touches.size < 2) pinch = null;
    if (touches.size === 2 && !pinch) {
      const { cursor, spread } = midpoint();
      pinch = { anchor: capture(cursor), spread };
    }
    // Lifting one finger must not turn the remainder of a pinch into an orbit.
    if (touches.size === 0) {
      if (restore) {
        controls.enableRotate = restore.rotate;
        controls.enablePan = restore.pan;
        controls.enableZoom = restore.zoom;
        restore = null;
      }
      blockedTouch = false;
    }
  };
  const onWheel = (event: WheelEvent) => {
    if (blockedTouch) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const cursor = { x: event.clientX, y: event.clientY },
      now = performance.now();
    if (
      !wheel ||
      now > wheel.until ||
      Math.hypot(cursor.x - wheel.cursor.x, cursor.y - wheel.cursor.y) > 18
    )
      wheel = { anchor: capture(cursor), scale: 1, cursor, until: now + 250 };
    const units =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? element.clientHeight
          : 1;
    // macOS trackpad pinches arrive as small ctrl+wheel deltas.
    const delta = THREE.MathUtils.clamp(event.deltaY * units, -180, 180);
    wheel.scale *= Math.exp(delta * (event.ctrlKey ? 0.008 : 0.002));
    wheel.scale = THREE.MathUtils.clamp(
      wheel.scale,
      0.16 / wheel.anchor.depth,
      controls.maxDistance / wheel.anchor.depth,
    );
    wheel.until = now + 250;
    apply(wheel.anchor, cursor, wheel.scale);
  };
  const click = (event: MouseEvent) => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  element.addEventListener("pointerdown", down, true);
  element.ownerDocument.addEventListener("pointermove", move, {
    capture: true,
    passive: false,
  });
  element.ownerDocument.addEventListener("pointerup", up, true);
  element.ownerDocument.addEventListener("pointercancel", up, true);
  element.addEventListener("wheel", onWheel, { capture: true, passive: false });
  element.addEventListener("click", click, true);
  return {
    get active() {
      return blockedTouch || Boolean(wheel && performance.now() < wheel.until);
    },
    dispose() {
      element.removeEventListener("pointerdown", down, true);
      element.ownerDocument.removeEventListener("pointermove", move, true);
      element.ownerDocument.removeEventListener("pointerup", up, true);
      element.ownerDocument.removeEventListener("pointercancel", up, true);
      element.removeEventListener("wheel", onWheel, true);
      element.removeEventListener("click", click, true);
    },
  };
}
