import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  sampleMotion,
  transitionMotion,
  footTrack,
  BLEND_SECONDS,
} from "../src/locomotion";
import {
  createLocomotionRig,
  bindRigGeometry,
  DEVICE_JOINTS,
  solveLeg,
} from "../src/locomotionRig";
import {
  samplePPG,
  sampleAccelerometer,
  DEFAULT_PHYSIOLOGY,
} from "../src/simulation";

test("activity changes preserve phase and cadence, including interrupted transitions and past replay", () => {
  let history = transitionMotion(10, "rest", "walk");
  assert.deepEqual(sampleMotion(9, "walk", history), sampleMotion(9, "rest"));
  const boundary = sampleMotion(10, "walk", history);
  assert.equal(boundary.phase, 0);
  assert.equal(boundary.cadence, 0);
  const prior = sampleMotion(10.3, "walk", history);
  history = transitionMotion(10.3, "walk", "run", history);
  assert.deepEqual(sampleMotion(10.3, "run", history), prior);
  assert.equal(sampleMotion(11.1, "run", history).cadence, 2.65);
  for (let t = 10; t < 12; t += 0.01) {
    const a = sampleMotion(t, "run", history),
      b = sampleMotion(t + 0.0001, "run", history);
    assert.ok(b.phase >= a.phase);
    assert.ok(Math.abs(b.phase - a.phase) < 0.00014);
  }
  const frozen = sampleMotion(11.4, "run", history);
  history = transitionMotion(11.4, "run", "rest", history);
  assert.deepEqual(sampleMotion(11.4, "rest", history), frozen);
  const stopped = sampleMotion(11.4 + BLEND_SECONDS, "rest", history);
  assert.equal(stopped.cadence, 0);
  assert.equal(stopped.run, 0);
  assert.ok(
    Math.abs(sampleMotion(20, "rest", history).phase - stopped.phase) < 1e-12,
  );
});
test("authored strides keep stance low, include swing clearance and close smoothly", () => {
  for (const activity of ["walk", "run"] as const) {
    const m = sampleMotion(0, activity);
    assert.equal(footTrack(0, m).lift, 0);
    assert.equal(footTrack(0.15, m).lift, 0);
    let maximum = 0;
    for (let i = 0; i < 100; i++)
      maximum = Math.max(maximum, footTrack(i / 100, m).lift);
    assert.ok(maximum > (activity === "walk" ? 0.1 : 0.5));
    for (const key of ["z", "lift", "pitch"] as const)
      assert.ok(
        Math.abs(footTrack(0.999999, m)[key] - footTrack(0.000001, m)[key]) <
          0.0001,
      );
  }
});
test("inverse kinematics reaches reachable ankle targets without changing segment lengths", () => {
  for (const [down, forward] of [
    [1.55, 0.3],
    [1.15, -0.4],
    [1.68, 0],
  ]) {
    const { hip, knee } = solveLeg(down, forward);
    const y =
        0.94 * Math.cos(hip) + Math.hypot(0.8, 0.01) * Math.cos(hip + knee),
      z = -0.94 * Math.sin(hip) - Math.hypot(0.8, 0.01) * Math.sin(hip + knee);
    assert.ok(Math.abs(y - down) < 1e-6);
    assert.ok(Math.abs(z - forward) < 1e-6);
    assert.ok(knee >= 0 && knee < Math.PI);
  }
});
test("rig preserves segment lengths and pauses deterministically across every authored pose", () => {
  const rig = createLocomotionRig();
  const lengths = rig.bones.map((b) => b.position.length());
  for (const activity of ["rest", "walk", "run"] as const)
    for (let i = 0; i < 30; i++) {
      rig.pose(i / 30, activity);
      rig.bones.forEach((b, j) => {
        assert.ok(b.matrixWorld.elements.every(Number.isFinite));
        if (j > 0) assert.ok(Math.abs(b.position.length() - lengths[j]) < 1e-9);
      });
      const snapshot = rig.matrices.map((m) => m.toArray());
      rig.pose(i / 30, activity);
      assert.deepEqual(
        rig.matrices.map((m) => m.toArray()),
        snapshot,
      );
    }
  rig.dispose();
});
test("weights do not tether forearms to the pelvis and rigid connected bones keep one transform", () => {
  const g = new THREE.BoxGeometry(0.045, 0.18, 0.045).translate(0.5, 2.0, 0.02);
  bindRigGeometry(g);
  const ids = g.getAttribute("atlasJointIndex"),
    w = g.getAttribute("atlasJointWeight");
  for (let i = 0; i < ids.count; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      sum += w.getComponent(i, j);
      if (w.getComponent(i, j) > 0)
        assert.ok([5, 6, 7, 19].includes(ids.getComponent(i, j)));
    }
    assert.ok(Math.abs(sum - 1) < 1e-6);
  }
  const b = new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(0.19, 1.1, 0);
  bindRigGeometry(b, true);
  const bw = b.getAttribute("atlasJointWeight");
  for (let i = 0; i < bw.count; i++) assert.equal(bw.getX(i), 1);
});
test("wearables and marker points share the same rigid joint transform", () => {
  const rig = createLocomotionRig(),
    o = new THREE.Object3D(),
    base = new THREE.Vector3(0.532, 1.935, 0.018),
    q = new THREE.Quaternion();
  for (let t = 0; t < 1; t += 0.1) {
    rig.pose(t, "run");
    rig.attach(o, base, q, DEVICE_JOINTS.wrist);
    assert.ok(
      o.position.distanceTo(
        rig.transformPoint(
          base.clone(),
          new THREE.Vector3(),
          DEVICE_JOINTS.wrist,
        ),
      ) < 1e-9,
    );
  }
  rig.dispose();
});
test("PPG motion and accelerometer histories remain unchanged before an activity transition", () => {
  const p = { ...DEFAULT_PHYSIOLOGY },
    h = transitionMotion(10, "rest", "run");
  const next = { ...p, activity: "run" as const, motionHistory: h };
  // Compare only motion acceleration; activity also intentionally changes vascular variability.
  assert.deepEqual(sampleAccelerometer(9, p), sampleAccelerometer(9, next));
  for (let t = 10; t < 12; t += 0.05) {
    const a = sampleAccelerometer(t, next);
    assert.ok(Object.values(a).every(Number.isFinite));
    assert.ok(Number.isFinite(samplePPG(t, next, "wrist")));
  }
});

test("heel and forefoot clear the display floor across complete walk and run strides", () => {
  const rig = createLocomotionRig();
  for (const activity of ["walk", "run"] as const) {
    for (let i = 0; i < 200; i++) {
      rig.pose(i / 100, activity);
      for (const side of [-1, 1]) {
        for (const z of [-0.185, 0.175]) {
          const p = rig.transformPoint(
            new THREE.Vector3(side * 0.19, -0.03, z),
          );
          assert.ok(
            p.y >= -0.035,
            `${activity}: sole below floor at ${i / 100}: ${p.y}`,
          );
        }
      }
    }
  }
  rig.dispose();
});

test("changing activity after seeking replaces future transitions", () => {
  let history = transitionMotion(10, "rest", "walk");
  history = transitionMotion(20, "walk", "run", history);
  history = transitionMotion(15, "run", "rest", history);
  assert.equal(history?.length, 2);
  assert.equal(sampleMotion(25, "rest", history).cadence, 0);
});

test("walking and running keep both palms inward throughout the stride", () => {
  const rig = createLocomotionRig();
  for (const activity of ["walk", "run"] as const) {
    for (let i = 0; i < 160; i++) {
      rig.pose(i / 80, activity);
      for (const [joint, inward] of [
        [7, -1],
        [10, 1],
      ]) {
        const palm = new THREE.Vector3(0, 0, 1).transformDirection(
          rig.matrices[joint],
        );
        assert.ok(inward * palm.x > 0.9, `${activity}: palm must face inward`);
        assert.ok(palm.y < 0.15, `${activity}: palm must not face upward`);
      }
    }
  }
  rig.pose(0, "rest");
  for (const joint of [7, 10]) {
    const palm = new THREE.Vector3(0, 0, 1).transformDirection(
      rig.matrices[joint],
    );
    assert.ok(palm.z > 0.99, "rest preserves the source hand pose");
  }
  rig.dispose();
});

test("forearm rotation preserves thickness instead of collapsing the skin between joints", () => {
  const rig = createLocomotionRig();
  for (const activity of ["walk", "run"] as const)
    for (let t = 0; t < 1.5; t += 0.05) {
      rig.pose(t, activity);
      for (const side of [-1, 1])
        for (const y of [2.03, 2.1, 2.17]) {
          const left = new THREE.Vector3(side * 0.515 - 0.025, y, -0.006);
          const right = new THREE.Vector3(side * 0.515 + 0.025, y, -0.006);
          const a = rig.transformPoint(left.clone()),
            b = rig.transformPoint(right.clone());
          assert.ok(
            Math.abs(a.distanceTo(b) - 0.05) < 1e-6,
            "forearm diameter is preserved",
          );
          const geo = new THREE.BufferGeometry().setFromPoints([left, right]);
          bindRigGeometry(geo);
          assert.ok(
            rig.transformVertex(geo, 0, left.clone()).distanceTo(a) < 1e-6,
            "picking matches the skin transform",
          );
          geo.dispose();
        }
    }
  rig.dispose();
});
