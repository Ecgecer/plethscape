import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { SITES } from "../src/simulation.ts";

type Point = [number, number, number];
type Group = {
  name: string;
  layer: string;
  sourceIds?: string[];
  bounds: [Point, Point];
  circuit?: string;
  oxygenation?: string;
  motionRegion?: string;
};
type Route = { id: string; points: Point[]; radius: number; kind: string };
type Metadata = {
  source: { name: string; sha256: string };
  transform: { scale: number };
  groups: Group[];
  sites: Record<string, { position: Point; sourceIds: string[] }>;
  flowPaths: Route[];
  asset: { bytes: number };
};

const modelUrl = new URL(
  "../public/models/bodyparts-atlas.glb",
  import.meta.url,
);
const metadata = JSON.parse(
  readFileSync(
    new URL("../public/models/bodyparts-atlas-metadata.json", import.meta.url),
    "utf8",
  ),
) as Metadata;
const groups = new Map(metadata.groups.map((group) => [group.name, group]));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `FJ${from + i}`);
const isPoint = (point: unknown): point is Point =>
  Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function group(name: string): Group {
  const found = groups.get(name);
  assert(found, `Missing anatomical group: ${name}`);
  return found;
}

function assertPointInBody(point: Point, label: string, margin = 0.06) {
  assert(isPoint(point), `${label} must have finite XYZ coordinates`);
  const [min, max] = group("body").bounds;
  for (let axis = 0; axis < 3; axis++) {
    assert(
      point[axis] >= min[axis] - margin && point[axis] <= max[axis] + margin,
      `${label} lies outside the common body coordinate frame on axis ${axis}`,
    );
  }
}

test("packaged anatomy and metadata describe the same source-derived GLB", () => {
  assert.equal(metadata.source.name, "BodyParts3D 4.0");
  assert.match(metadata.source.sha256, /^[a-f\d]{64}$/);
  assert.equal(statSync(modelUrl).size, metadata.asset.bytes);
  const header = readFileSync(modelUrl).subarray(0, 12);
  assert.equal(header.toString("ascii", 0, 4), "glTF");
  assert.equal(header.readUInt32LE(4), 2);
  assert.equal(header.readUInt32LE(8), metadata.asset.bytes);
});

test("pulmonary vessel identity is distinct from its oxygenation color convention", () => {
  const arteries = group("pulmonary_arteries");
  const veins = group("pulmonary_veins");
  assert.equal(arteries.layer, "arteries");
  assert.equal(veins.layer, "veins");
  assert.equal(arteries.circuit, "pulmonary");
  assert.equal(veins.circuit, "pulmonary");
  assert.equal(arteries.oxygenation, "low");
  assert.equal(veins.oxygenation, "high");
  assert.deepEqual(
    new Set(arteries.sourceIds),
    new Set(["FJ2041", "FJ2044", ...range(2881, 2924), ...range(2966, 3019)]),
  );
  assert.deepEqual(
    new Set(veins.sourceIds),
    new Set([...range(2925, 2965), ...range(3020, 3070)]),
  );
  assert.equal(group("systemic_arteries").oxygenation, "high");
  assert.equal(group("systemic_veins").oxygenation, "low");
  // Bronchial arteries nourish lung tissue through the systemic circuit.
  assert(group("systemic_arteries").sourceIds?.includes("FJ3418"));
});

test("cardiac walls and vessels retain their anatomy without cerebral ventricles or cavity fillers", () => {
  const cardiacIds = new Set(
    metadata.groups
      .filter((item) => item.layer === "heart")
      .flatMap((item) => item.sourceIds ?? []),
  );
  for (const id of [
    "FJ2428",
    "FJ2438",
    "FJ2439",
    "FJ2418",
    "FJ2419",
    "FJ2429",
    "FJ2430",
    "FJ2437",
  ]) {
    assert(
      cardiacIds.has(id),
      `Missing cardiac wall or papillary muscle ${id}`,
    );
  }
  for (const id of ["FJ1730", "FJ1731", "FJ1752", "FJ1767", "FJ1814"]) {
    assert(
      !cardiacIds.has(id),
      `Cerebral ventricular structure ${id} must not be myocardium`,
    );
    assert(
      group("brain").sourceIds?.includes(id),
      `Cerebral ventricular structure ${id} must remain in brain anatomy`,
    );
  }
  for (const id of ["FJ2422", "FJ2423", "FJ2424", "FJ2425"]) {
    assert(
      !cardiacIds.has(id),
      `Cavity volume ${id} must not fill the default external heart view`,
    );
  }
  for (const [name, layer, oxygenation] of [
    ["coronary_arteries", "arteries", "high"],
    ["coronary_veins", "veins", "low"],
  ]) {
    const vessels = group(name);
    assert.equal(vessels.layer, layer);
    assert.equal(vessels.oxygenation, oxygenation);
    assert.equal(vessels.motionRegion, "heart");
    for (const id of vessels.sourceIds ?? [])
      assert(!cardiacIds.has(id), `${id} must remain vascular tissue`);
  }
  assert(
    group("coronary_veins").sourceIds?.includes("FJ2655"),
    "Coronary sinus remains in venous anatomy",
  );
});

test("all anatomy bounds and sensing sites share one finite, correctly scaled body coordinate frame", () => {
  assert(
    Number.isFinite(metadata.transform.scale) &&
      metadata.transform.scale > 2 &&
      metadata.transform.scale < 2.2,
  );
  const [bodyMin, bodyMax] = group("body").bounds;
  assert(Math.abs(bodyMin[1]) < 0.0001);
  assert(
    Math.abs(bodyMax[1] - 3.65) < 0.001,
    "Skin height must match the single 3.65-unit normalization",
  );
  const retainedIds = new Set<string>();
  assert(
    group("face_details").sourceIds?.includes("FJ2811"),
    "External ears must remain in the rendered skin layer",
  );
  assert.deepEqual(
    metadata.sites.ear.sourceIds,
    ["FJ2811"],
    "The ear sensor must use the external ear rather than the smooth head skin",
  );
  for (const item of metadata.groups) {
    assert(
      isPoint(item.bounds[0]) && isPoint(item.bounds[1]),
      `${item.name} has invalid bounds`,
    );
    for (let axis = 0; axis < 3; axis++)
      assert(
        item.bounds[0][axis] < item.bounds[1][axis],
        `${item.name} has collapsed or inverted bounds`,
      );
    for (const id of item.sourceIds ?? []) {
      assert(
        !retainedIds.has(id),
        `${id} is duplicated between anatomy layers`,
      );
      retainedIds.add(id);
    }
  }
  assert.deepEqual(
    new Set(Object.keys(metadata.sites)),
    new Set(SITES.map((site) => site.id)),
  );
  for (const [name, site] of Object.entries(metadata.sites)) {
    assertPointInBody(site.position, `Sensing site ${name}`);
    assert(
      site.sourceIds.length > 0,
      `${name} must retain its source landmark identity`,
    );
    for (const id of site.sourceIds)
      assert(
        retainedIds.has(id),
        `${name} references unavailable structure ${id}`,
      );
  }
  const y = (name: string) => metadata.sites[name].position[1];
  assert(y("forehead") > y("ear") && y("ear") > y("carotid"));
  assert(y("carotid") > y("upperarm") && y("upperarm") > y("wrist"));
  assert(y("wrist") > y("finger") && y("finger") > y("toe"));
  assert(y("forehead") > 3.3 && y("toe") < 0.18);
});

test("the 18 selected source routes move downstream from anatomically correct proximal ends", () => {
  const expected = new Map<string, [axis: number, sign: number]>([
    ["FJ3413", [1, 1]],
    ["FJ3411", [2, -1]],
    ["FJ1931", [1, -1]],
    ["FJ1932", [1, -1]],
    ["FJ3483", [1, 1]],
    ["FJ3564", [1, 1]],
    ["FJ3479", [0, 1]],
    ["FJ3579", [0, -1]],
    ["FJ2219", [1, -1]],
    ["FJ2271", [1, -1]],
    ["FJ2242", [1, -1]],
    ["FJ2294", [1, -1]],
    ["FJ2074", [1, -1]],
    ["FJ2143", [1, -1]],
    ["FJ2065", [1, -1]],
    ["FJ2087", [1, -1]],
    ["FJ3464", [1, -1]],
    ["FJ2966", [1, 1]],
  ]);
  assert.equal(metadata.flowPaths.length, expected.size);
  assert.deepEqual(
    new Set(metadata.flowPaths.map((route) => route.id)),
    new Set(expected.keys()),
  );
  const routes = new Map(metadata.flowPaths.map((route) => [route.id, route]));
  for (const route of metadata.flowPaths) {
    assert(
      route.points.length >= 8,
      `${route.id} needs a sampled source route`,
    );
    assert(
      Number.isFinite(route.radius) && route.radius > 0 && route.radius < 0.05,
    );
    for (const point of route.points)
      assertPointInBody(point, `Flow route ${route.id}`);
    const [axis, sign] = expected.get(route.id)!;
    const first = route.points[0],
      last = route.points.at(-1)!;
    assert(
      (last[axis] - first[axis]) * sign > 0.02,
      `${route.id} travels against the expected anatomical direction`,
    );
    assert.equal(
      route.kind,
      route.id === "FJ2966" ? "pulmonary-arterial" : "arterial",
    );
    let length = 0;
    for (let i = 1; i < route.points.length; i++) {
      const step = distance(route.points[i - 1], route.points[i]);
      assert(
        step < 0.12,
        `${route.id} contains an implausible gap in its source route`,
      );
      length += step;
    }
    assert(length > 0.025, `${route.id} is a degenerate path`);
  }
  const scale = metadata.transform.scale;
  const first = (id: string) =>
    routes.get(id)!.points[0].map((value) => value / scale) as Point;
  const last = (id: string) =>
    routes
      .get(id)!
      .points.at(-1)!
      .map((value) => value / scale) as Point;
  assert(
    first("FJ3413")[1] < 1.335 && last("FJ3413")[1] > 1.35,
    "Ascending aorta begins at the aortic valve",
  );
  assert(
    first("FJ3411")[2] > 0.015 && last("FJ3411")[2] < -0.02,
    "Arch proceeds from ascending aorta toward posterior descending aorta",
  );
  assert(
    first("FJ1931")[1] > 1.35 && last("FJ1931")[1] < 1.23,
    "Thoracic aorta must start at the arch, not near the middle of the heart",
  );
  assert(
    first("FJ1932")[1] > 1.2 && last("FJ1932")[1] < 1.06,
    "Abdominal aorta continues inferiorly from thoracic aorta",
  );
});

test("genital vascular branches are omitted while major leg circulation remains", () => {
  const ids = new Set(
    metadata.groups.flatMap((group) => group.sourceIds ?? []),
  );
  for (const id of [
    "FJ3496",
    "FJ3497",
    "FJ3532",
    "FJ3592",
    "FJ3593",
    "FJ3617",
    "FJ2056",
    "FJ2208",
    "FJ3426",
    "FJ3525",
    "FJ3533",
    "FJ3610",
    "FJ3618",
    "FJ3637",
  ])
    assert(!ids.has(id), `Genital vessel ${id} must not be displayed`);
  for (const id of ["FJ2074", "FJ2143"])
    assert(ids.has(id), "Main femoral arteries remain");
});
