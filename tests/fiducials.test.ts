import test from "node:test";
import assert from "node:assert/strict";
import { analyzePulse } from "../src/fiducials";
import { DEFAULT_PHYSIOLOGY, sampleBeat } from "../src/simulation";

test("a simple triangular pulse has an onset, peak and offset without invented late features", () => {
  const samples = Array.from({ length: 1001 }, (_, i) =>
    i <= 250 ? i / 250 : (1000 - i) / 750,
  );
  const result = analyzePulse(samples);
  assert.deepEqual(
    result.points.map((p) => p.id),
    ["on", "u", "sp", "off"],
  );
  assert.ok(Math.abs(result.crestPhase! - 0.25) < 0.005);
  assert.ok(Math.abs(result.width50Phase! - 0.5) < 0.005);
});

test("a resolved two-crest pulse labels the intervening notch and later peak in order", () => {
  const knots = [
    [0, 0],
    [0.2, 1],
    [0.4, 0.2],
    [0.55, 0.5],
    [1, 0],
  ];
  const samples = Array.from({ length: 1025 }, (_, i) => {
    const x = i / 1024;
    const end = knots.findIndex((k) => k[0] >= x);
    if (end <= 0) return 0;
    const [a, b] = [knots[end - 1], knots[end]];
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  });
  const points = analyzePulse(samples).points;
  assert.deepEqual(
    points.map((p) => p.id),
    ["on", "u", "sp", "dn", "dp", "off"],
  );
  assert.ok(Math.abs(points.find((p) => p.id === "dn")!.phase - 0.4) < 0.005);
  assert.ok(Math.abs(points.find((p) => p.id === "dp")!.phase - 0.55) < 0.005);
});

test("flat and invalid signals do not produce fiducials", () => {
  for (const samples of [
    [],
    [1, 2],
    Array(100).fill(1),
    [...Array(100).fill(0), NaN],
  ])
    assert.equal(analyzePulse(samples).points.length, 0);
});

test("modeled young and older pulses use visible extrema, not fixed notch positions", () => {
  for (const age of [25, 80]) {
    const values = Float32Array.from({ length: 1025 }, (_, i) =>
      sampleBeat(i / 1024, { ...DEFAULT_PHYSIOLOGY, age }, "finger"),
    );
    const { points } = analyzePulse(values);
    assert.equal(points[0].phase, 0);
    assert.equal(points.at(-1)!.phase, 1);
    for (let i = 1; i < points.length; i++)
      assert.ok(points[i].phase > points[i - 1].phase);
    const notch = points.find((p) => p.id === "dn");
    if (notch)
      assert.ok(
        values[notch.index] < points.find((p) => p.id === "dp")!.amplitude,
      );
  }
});

test("a merged older contour has no notch or diastolic marker", () => {
  const p = { ...DEFAULT_PHYSIOLOGY, age: 80, stiffness: 95 };
  const result = analyzePulse(
    Float32Array.from({ length: 1025 }, (_, i) =>
      sampleBeat(i / 1024, p, "finger"),
    ),
  );
  assert.equal(
    result.points.some((point) => point.id === "dn" || point.id === "dp"),
    false,
  );
});
