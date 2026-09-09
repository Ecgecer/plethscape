import test from "node:test";
import assert from "node:assert/strict";
import {
  captureBeat,
  getDisplayHeartRate,
  sampleCapturedBeat,
  siteDelay,
  getCardiacState,
  DEFAULT_PHYSIOLOGY,
  SITES,
} from "../src/simulation";
import type { Rhythm } from "../src/rhythm";

test("captured event boundaries match the shared heart phase, including irregular and negative history", () => {
  for (const rhythm of [
    "sinus",
    "afib",
    "pac",
    "pvc",
    "bigeminy",
    "trigeminy",
  ] as Rhythm[])
    for (const t of [-3, 0, 8, 100]) {
      const p = { ...DEFAULT_PHYSIOLOGY, rhythm };
      const c = captureBeat(t, p),
        state = getCardiacState(t, p);
      assert.ok(c.start <= t + 1e-8 && c.end > t - 1e-8);
      assert.equal(c.index, Math.floor(state.cycles));
      assert.ok(
        Math.abs((t - c.start) / (c.end - c.start) - state.phase) < 1e-8,
      );
    }
});
test("onset alignment subtracts only transit and preserves each pulse amplitude", () => {
  const p = { ...DEFAULT_PHYSIOLOGY, rhythm: "afib" as Rhythm };
  const c = captureBeat(8, p);
  for (const site of SITES)
    for (let i = 0; i <= 100; i++) {
      const t = c.start + (i / 100) * (c.end - c.start),
        delay = siteDelay(p, site.id);
      assert.ok(
        Math.abs(
          sampleCapturedBeat(t + delay, p, site.id, c) -
            sampleCapturedBeat(t, p, site.id, c, true),
        ) < 1e-10,
      );
    }
});
test("captured traces omit neighboring pulses and retain perfusion and site differences", () => {
  const p = { ...DEFAULT_PHYSIOLOGY };
  const c = captureBeat(8, p);
  for (const site of SITES) {
    const delay = siteDelay(p, site.id);
    assert.equal(sampleCapturedBeat(c.start + delay - 0.01, p, site.id, c), 0);
    assert.equal(sampleCapturedBeat(c.end + delay + 0.01, p, site.id, c), 0);
  }
  const t = c.start + 0.15;
  const finger = sampleCapturedBeat(t, p, "finger", c, true),
    wrist = sampleCapturedBeat(t, p, "wrist", c, true);
  assert.ok(finger > wrist);
  assert.ok(
    sampleCapturedBeat(t, { ...p, perfusion: 10 }, "finger", c, true) <
      finger * 0.5,
  );
});

test("readout averages completed intervals, stays fixed within a beat, and leaves cardiac timing untouched", () => {
  for (const rhythm of [
    "sinus",
    "afib",
    "pvc",
    "pac",
    "bigeminy",
    "trigeminy",
  ] as Rhythm[]) {
    const p = { ...DEFAULT_PHYSIOLOGY, rhythm };
    const c = captureBeat(8, p),
      previous = captureBeat(c.start - 1e-5, p),
      before = captureBeat(previous.start - 1e-5, p);
    const raw = getCardiacState(8, p);
    assert.equal(getDisplayHeartRate(8, p), 120 / (c.start - before.start));
    assert.equal(
      getDisplayHeartRate(c.start + 0.01, p),
      getDisplayHeartRate(c.end - 0.01, p),
    );
    assert.deepEqual(getCardiacState(8, p), raw);
  }
});
test("capturing non-finite history uses the finite simulation origin", () => {
  assert.deepEqual(
    captureBeat(NaN, DEFAULT_PHYSIOLOGY),
    captureBeat(0, DEFAULT_PHYSIOLOGY),
  );
});
