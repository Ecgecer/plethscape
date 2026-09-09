import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { captureZoomAnchor, applyAnchoredZoom } from "../src/anchoredZoom.ts";

test("surface anchor stays under the moving pinch midpoint at every zoom level and scroll offset", () => {
  for (const top of [0, -460, 215])
    for (const angle of [0, 0.8, 2.7]) {
      const camera = new THREE.PerspectiveCamera(37, 390 / 600, 0.05, 40);
      camera.position.set(Math.sin(angle) * 6, 1.8, Math.cos(angle) * 6);
      const target = new THREE.Vector3(0, 1.8, 0);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 24, 16),
        new THREE.MeshBasicMaterial(),
      );
      body.position.set(0, 2.8, 0);
      body.updateMatrixWorld();
      const projected = body.position.clone().project(camera);
      const rect = { left: 16, top, width: 390, height: 600 };
      const cursor = {
        x: 16 + (projected.x + 1) * 195,
        y: top + (1 - projected.y) * 300,
      };
      const anchor = captureZoomAnchor(camera, target, cursor, rect, [body]);
      assert(anchor.surface);
      for (const scale of [1, 0.8, 0.3, 0.04, 1.4, 8]) {
        const midpoint = { x: cursor.x - 31, y: cursor.y + 42 };
        applyAnchoredZoom(camera, target, anchor, midpoint, rect, scale);
        const screen = anchor.point.clone().project(camera);
        assert(Math.abs(16 + (screen.x + 1) * 195 - midpoint.x) < 1e-6);
        assert(Math.abs(top + (1 - screen.y) * 300 - midpoint.y) < 1e-6);
        assert(camera.position.distanceTo(target) >= 0.16 - 1e-6);
        assert(camera.position.distanceTo(target) <= 8.5 + 1e-6);
        assert(camera.quaternion.angleTo(anchor.rotation) < 1e-6);
      }
      body.geometry.dispose();
      body.material.dispose();
    }
});

test("empty-space fallback and reversing a pinch do not jump or accumulate drift", () => {
  const camera = new THREE.PerspectiveCamera(37, 1, 0.05, 40);
  camera.position.set(0, 0, 6);
  camera.updateMatrixWorld();
  const target = new THREE.Vector3();
  const rect = { left: 20, top: -300, width: 600, height: 600 };
  const cursor = { x: 470, y: 50 };
  const anchor = captureZoomAnchor(camera, target, cursor, rect, []);
  assert(!anchor.surface);
  for (let i = 0; i < 100; i++)
    applyAnchoredZoom(
      camera,
      target,
      anchor,
      { x: cursor.x + i, y: cursor.y + i },
      rect,
      0.25,
    );
  applyAnchoredZoom(camera, target, anchor, cursor, rect, 1);
  assert(camera.position.distanceTo(anchor.position) < 1e-9);
  assert(target.length() < 1e-9);
});
