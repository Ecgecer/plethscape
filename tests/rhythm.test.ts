import test from "node:test";
import assert from "node:assert/strict";
import {
  rhythmContext,
  rhythmBeatTime,
  getRhythm,
  type Rhythm,
} from "../src/rhythm";
import {
  DEFAULT_PHYSIOLOGY,
  getMetrics,
  getCardiacState,
  samplePPG,
  sampleBeat,
  SITES,
  PPG_DISPLAY_RANGE,
} from "../src/simulation";
const rhythms: Rhythm[] = ["afib", "pac", "pvc", "bigeminy", "trigeminy"];
const cycle = 60 / 72;
const context = (i: number, r: Rhythm) =>
  rhythmContext(rhythmBeatTime(i, cycle, r) + 1e-7, cycle, r);

test("PVC short and long intervals compensate; conducted PACs reset earlier", () => {
  for (const r of ["pac", "pvc"] as Rhythm[]) {
    const early = context(5, r),
      after = context(6, r),
      regular = context(3, r);
    assert.equal(early.kind, "premature");
    assert.equal(after.kind, "recovery");
    assert.ok(early.previousInterval < regular.previousInterval * 0.7);
    const pair = early.previousInterval + after.previousInterval;
    if (r === "pvc")
      assert.ok(Math.abs(pair - 2 * regular.previousInterval) < 1e-9);
    else assert.ok(pair < 1.8 * regular.previousInterval);
    assert.ok(early.gain < regular.gain);
    assert.ok(after.gain > regular.gain);
  }
});

test("bigeminy and trigeminy retain their repeating ectopic structure", () => {
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => context(i, "bigeminy").kind),
    ["recovery", "premature", "recovery", "premature", "recovery", "premature"],
  );
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => context(i, "trigeminy").kind),
    ["recovery", "regular", "premature", "recovery", "regular", "premature"],
  );
});

test("AF intervals are irregular, reproducible, bounded and preserve the selected long-term mean", () => {
  const intervals = Array.from(
    { length: 4096 },
    (_, i) => context(i, "afib").previousInterval,
  );
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const cv =
    Math.sqrt(
      intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length,
    ) / mean;
  assert.ok(Math.abs(mean - cycle) < 1e-9);
  assert.ok(cv > 0.25 && cv < 0.5);
  assert.ok(Math.min(...intervals) > cycle * 0.35);
  assert.ok(Math.max(...intervals) < cycle * 2);
  assert.ok(new Set(intervals.map((v) => v.toFixed(3))).size > 100);
  assert.deepEqual(context(987, "afib"), context(987, "afib"));
});

test("event lookup works before zero, through sequence boundaries and at varied heart rates", () => {
  for (const rhythm of rhythms)
    for (const hr of [40, 72, 180])
      for (const index of [-4097, -6, -1, 0, 5, 4095, 4096, 8200]) {
        const c = 60 / hr,
          start = rhythmBeatTime(index, c, rhythm),
          end = rhythmBeatTime(index + 1, c, rhythm);
        const beat = rhythmContext((start + end) / 2, c, rhythm);
        assert.equal(beat.index, index);
        assert.ok(end > start);
        assert.ok(beat.previousInterval > 0);
        const p = { ...DEFAULT_PHYSIOLOGY, rhythm, heartRate: hr };
        assert.ok(
          Math.abs(getCardiacState((start + end) / 2, p).phase - 0.5) < 1e-8,
        );
      }
});

test("weak-pulse example changes optical amplitude without removing or retiming the heartbeat", () => {
  const p = {
    ...DEFAULT_PHYSIOLOGY,
    rhythm: "pvc" as Rhythm,
    noise: 0,
    pulseDeficit: false,
  };
  const start = rhythmBeatTime(5, cycle, "pvc");
  const state = getCardiacState(start + 0.12, p);
  let amplitude = 0,
    weak = 0;
  for (
    let t = start + getMetrics(p, "finger").transitMs / 1000 + 0.04;
    t < start + getMetrics(p, "finger").transitMs / 1000 + 0.4;
    t += 0.002
  ) {
    amplitude = Math.max(amplitude, samplePPG(t, p, "finger"));
    weak = Math.max(weak, samplePPG(t, { ...p, pulseDeficit: true }, "finger"));
  }
  assert.ok(weak < amplitude * 0.3);
  const weakState = getCardiacState(start + 0.12, { ...p, pulseDeficit: true });
  assert.equal(weakState.cycles, state.cycles);
  assert.equal(weakState.heartRate, state.heartRate);
  p.pulseDeficit = true;
  assert.equal(
    samplePPG(start + 0.4, p, "finger"),
    samplePPG(start + 0.4, { ...p }, "finger"),
  );
});

test("condition streams stay finite and on scale across sites and control extremes", () => {
  for (const rhythm of rhythms)
    for (const heartRate of [40, 180])
      for (const site of SITES) {
        const p = {
          ...DEFAULT_PHYSIOLOGY,
          rhythm,
          heartRate,
          perfusion: 100,
          age: 25,
          noise: 100,
        };
        for (let i = 0; i < 1250; i++) {
          const y = samplePPG(i / 125, p, site.id);
          assert.ok(Number.isFinite(y));
          assert.ok(
            y >= PPG_DISPLAY_RANGE.min && y <= PPG_DISPLAY_RANGE.max,
            `${rhythm} ${site.id} ${heartRate}: ${y}`,
          );
        }
      }
});

test("single-beat reference and old settings remain compatible; AF timing is independent of breathing", () => {
  for (const rhythm of rhythms)
    assert.equal(
      sampleBeat(0.25, { ...DEFAULT_PHYSIOLOGY, rhythm }, "finger"),
      sampleBeat(0.25, DEFAULT_PHYSIOLOGY, "finger"),
    );
  assert.equal(getRhythm(undefined), "sinus");
  assert.equal(getRhythm("unknown"), "sinus");
  const p = { ...DEFAULT_PHYSIOLOGY, rhythm: "afib" as Rhythm };
  assert.equal(
    getCardiacState(8, p).cycles,
    getCardiacState(8, { ...p, respiratoryRate: 6 }).cycles,
  );
  assert.notEqual(
    getCardiacState(8, p).breathPhase,
    getCardiacState(8, { ...p, respiratoryRate: 6 }).breathPhase,
  );
});

test("each sensing site receives the same ectopic events after its propagation delay", () => {
  for (const rhythm of ["afib", "pac", "pvc"] as Rhythm[]) {
    const p = { ...DEFAULT_PHYSIOLOGY, rhythm, noise: 0 };
    for (const site of SITES) {
      const delay = getMetrics(p, site.id).transitMs / 1000;
      for (let index = 0; index < 15; index++) {
        const start = rhythmBeatTime(index, cycle, rhythm);
        let best = -Infinity,
          peakAfterArrival = 0;
        for (let dt = 0.04; dt < 0.25; dt += 0.002) {
          const y = samplePPG(start + delay + dt, p, site.id);
          if (y > best) {
            best = y;
            peakAfterArrival = dt;
          }
        }
        assert.ok(
          peakAfterArrival > 0.08 && peakAfterArrival < 0.22,
          `${rhythm} ${site.id} beat ${index}: ${peakAfterArrival}`,
        );
      }
    }
  }
});
