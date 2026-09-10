import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { groupLungContext } from "../src/lungEmphasis";

const positions = [
  0.16, 2.7, 0.2, 0.18, 2.7, 0.2, 0.17, 2.8, 0.2, 0, 2.7, 0.2, 0.02, 2.7, 0.2,
  0.01, 2.8, 0.2, 0.5, 1.8, 0.1, 0.52, 1.8, 0.1, 0.51, 1.9, 0.1,
];
test("thoracic presentation groups preserve all source triangles, winding and attributes", () => {
  const g = new THREE.BufferGeometry();
  const attribute = new THREE.Float32BufferAttribute(positions, 3);
  g.setAttribute("position", attribute);
  g.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(groupLungContext(g), true);
  assert.equal(g.getAttribute("position"), attribute);
  const triangles = Array.from({ length: 3 }, (_, i) =>
    Array.from(g.index!.array.slice(i * 3, i * 3 + 3)).join(","),
  ).sort();
  assert.deepEqual(triangles, ["0,1,2", "3,4,5", "6,7,8"]);
  assert.deepEqual(g.groups, [
    { start: 0, count: 3, materialIndex: 0 },
    { start: 3, count: 6, materialIndex: 1 },
  ]);
  assert.deepEqual(Array.from(g.index!.array.slice(3)), [0, 1, 2, 3, 4, 5]);
  g.dispose();
});
test("non-indexed meshes work and geometry outside the thoracic region stays untouched", () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions.slice(18), 3),
  );
  assert.equal(groupLungContext(g), false);
  assert.equal(g.index, null);
  const lung = new THREE.BufferGeometry();
  lung.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions.slice(0, 9), 3),
  );
  assert.equal(groupLungContext(lung), true);
  assert.deepEqual(Array.from(lung.index!.array), [0, 1, 2]);
  assert.deepEqual(lung.groups, [{ start: 0, count: 3, materialIndex: 1 }]);
  g.dispose();
  lung.dispose();
});
