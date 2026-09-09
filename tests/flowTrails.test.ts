import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { buildFlowGeometry } from "../src/flowTrails.ts";

test("flow ribbons remain on a directed centerline and never connect separate routes", () => {
  const geometry = buildFlowGeometry([
    { points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)] },
    { points: [new THREE.Vector3(3, 0, 0), new THREE.Vector3(3, 1, 0)] },
  ]);
  const p = geometry.getAttribute("position"),
    ribbon = geometry.getAttribute("ribbon");
  const indices = geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const x = p.getX(indices.getX(i));
    assert.equal(p.getX(indices.getX(i + 1)), x);
    assert.equal(p.getX(indices.getX(i + 2)), x);
  }
  for (let i = 0; i < p.count; i++) {
    assert.equal(p.getZ(i), 0);
    assert.equal(ribbon.getY(i), p.getY(i));
  }
  geometry.dispose();
});

test("all source routes produce a small finite static mesh, including repeated-point inputs", () => {
  const metadata = JSON.parse(
    readFileSync(
      new URL(
        "../public/models/bodyparts-atlas-metadata.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const routes = metadata.flowPaths.map(
    (route: { points: [number, number, number][] }) => ({
      ...route,
      points: route.points.map((p) => new THREE.Vector3(...p)),
    }),
  );
  routes.push({
    points: [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0),
    ],
  });
  const geometry = buildFlowGeometry(routes);
  for (const attribute of Object.values(geometry.attributes))
    assert(Array.from(attribute.array).every(Number.isFinite));
  assert(geometry.index!.count > 0);
  assert(
    geometry.index!.count / 3 < 12000,
    "Flow should stay far below the anatomy's triangle budget",
  );
  geometry.dispose();
});

test("the slowed story advances only along the ordered left-arm arterial segments", () => {
  const ids = ["FJ3413", "FJ3411", "FJ3479", "FJ2219", "FJ2242", "FJ2966"];
  let previous = -1;
  for (const id of ids) {
    const geometry = buildFlowGeometry([
      { id, points: [new THREE.Vector3(), new THREE.Vector3(0, 0.1, 0)] },
    ]);
    const journey = geometry.getAttribute("journeyPosition");
    assert.equal(journey.count, geometry.getAttribute("position").count);
    if (id === "FJ2966")
      assert(
        Array.from(journey.array).every((v) => v < 0),
        "Pulmonary flow must not be part of the wrist story",
      );
    else {
      assert(journey.getX(0) >= previous - 1e-6);
      for (let i = 1; i < journey.count; i++)
        assert(journey.getX(i) >= journey.getX(i - 1));
      previous = journey.getX(journey.count - 1);
      assert(previous < 1);
    }
    geometry.dispose();
  }
});
