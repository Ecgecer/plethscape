import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { handRotation, poseHand } from "../src/handPose.ts";

test("hand pose leaves the torso and legs untouched and turns both palms posteriorly", () => {
  for (const p of [
    new THREE.Vector3(0.2, 1.8, 0.1),
    new THREE.Vector3(0.36, 1.8, 0.1),
    new THREE.Vector3(0.385, 2.25, -0.06),
    new THREE.Vector3(0.5, 2.7, 0),
  ])
    assert.deepEqual(poseHand(p.clone()), p);
  for (const side of [-1, 1]) {
    const palm = new THREE.Vector3(0, 0, 1).applyQuaternion(
      handRotation(
        new THREE.Vector3(side * 0.54, 1.9, 0),
        new THREE.Quaternion(),
      ),
    );
    assert(palm.z < -0.8);
  }
});

test("the rigid hand pose preserves the ring's fit and attachment orientation", () => {
  const center = new THREE.Vector3(0.629, 1.658, 0.107);
  const offset = new THREE.Vector3(0.015, 0, 0.01);
  const q = handRotation(center, new THREE.Quaternion());
  const expected = poseHand(center.clone()).add(
    offset.clone().applyQuaternion(q),
  );
  assert(poseHand(center.clone().add(offset)).distanceTo(expected) < 1e-10);
});

test("forearm normals remain perpendicular to the deformed surface", () => {
  const point = new THREE.Vector3(0.52, 2.08, -0.025);
  const normal = new THREE.Vector3(1, 0, 0);
  const posed = poseHand(point.clone(), normal);
  for (const direction of [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ]) {
    const tangent = poseHand(point.clone().addScaledVector(direction, 1e-6))
      .sub(posed)
      .normalize();
    assert(Math.abs(normal.dot(tangent)) < 0.0001);
  }
});
