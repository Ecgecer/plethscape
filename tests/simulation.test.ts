import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PHYSIOLOGY, SITES, getMetrics, sampleAccelerometer, sampleBeat, samplePPG } from '../src/simulation.ts';
import type { Physiology } from '../src/simulation.ts';

test('all supported sites and control extremes produce finite, continuous beats', () => {
  for (const site of SITES) for (const age of [25, 75]) for (const heartRate of [40, 72, 180]) {
    const p = { ...DEFAULT_PHYSIOLOGY, age, heartRate };
    const wave = Array.from({ length: 1001 }, (_, i) => sampleBeat(i / 1000, p, site.id));
    assert(wave.every(v => Number.isFinite(v) && v >= 0 && v < 1.6));
    assert.equal(wave[0], 0);
    assert.equal(wave[1000], 0);
    assert(Math.max(...wave) > 0.5);
    assert(Math.max(...wave.slice(1).map((v, i) => Math.abs(v - wave[i]))) < 0.045);
    for (const t of [-20.25, -0.001, 0, 0.001, 13.42]) assert(Number.isFinite(samplePPG(t, p, site.id)));
  }
});

test('young finger has a real diastolic rebound that merges with increased stiffness', () => {
  const young = getMetrics({ ...DEFAULT_PHYSIOLOGY, age: 25, stiffness: 20 }, 'finger');
  const old = getMetrics({ ...DEFAULT_PHYSIOLOGY, age: 75, stiffness: 70 }, 'finger');
  assert(young.notchProminence >= 5, `Expected a visible young notch: ${young.notchProminence}`);
  assert(old.notchProminence < young.notchProminence);
  assert(old.transitMs < young.transitMs);
});

test('distal pulse arrives later and perfusion changes amplitude without changing its timing', () => {
  const p = { ...DEFAULT_PHYSIOLOGY };
  assert(getMetrics(p, 'carotid').transitMs < getMetrics(p, 'wrist').transitMs);
  assert(getMetrics(p, 'wrist').transitMs < getMetrics(p, 'finger').transitMs);
  assert(getMetrics(p, 'finger').transitMs < getMetrics(p, 'toe').transitMs);
  const low = { ...p, perfusion: 10 };
  const high = { ...p, perfusion: 95 };
  assert(sampleBeat(0.2, high, 'finger') > sampleBeat(0.2, low, 'finger') * 2);
  assert.equal(getMetrics(low, 'finger').transitMs, getMetrics(high, 'finger').transitMs);
});

test('deterministic streaming supports negative history and reacts to state mutation', () => {
  const p = { ...DEFAULT_PHYSIOLOGY };
  assert.equal(samplePPG(-2.42, p, 'finger'), samplePPG(-2.42, p, 'finger'));
  const initial = getMetrics(p, 'finger').transitMs;
  p.age = 75;
  assert(getMetrics(p, 'finger').transitMs < initial);
  for (let i = -100; i < 100; i++) {
    const t = i * 0.037;
    assert(Math.abs(samplePPG(t + 0.00001, p, 'finger') - samplePPG(t, p, 'finger')) < 0.005);
  }
});

test('acceleration contains gravity at rest and greater motion while running', () => {
  const rms = (activity: 'rest' | 'walk' | 'run') => Math.sqrt(Array.from({ length: 500 }, (_, i) => {
    const a = sampleAccelerometer(i / 50, { ...DEFAULT_PHYSIOLOGY, activity });
    return a.x ** 2 + a.y ** 2 + (a.z - 1) ** 2;
  }).reduce((a, b) => a + b) / 500);
  assert(rms('rest') < 0.02);
  assert(rms('walk') > rms('rest') * 10);
  assert(rms('run') > rms('walk') * 2);
});

test('breathing changes stream modulation while preserving clean beat morphology', () => {
  const slow = { ...DEFAULT_PHYSIOLOGY, respiratoryRate: 6, noise: 0 };
  const fast = { ...slow, respiratoryRate: 36 };
  let difference = 0;
  for (let i = 0; i < 500; i++) {
    const phase = i / 500;
    assert.equal(sampleBeat(phase, slow, 'finger'), sampleBeat(phase, fast, 'finger'));
    const a = samplePPG(i / 50, slow, 'finger');
    const b = samplePPG(i / 50, fast, 'finger');
    assert(Number.isFinite(a) && Number.isFinite(b));
    difference += Math.abs(a - b);
  }
  assert(difference / 500 > 0.01);
  assert.deepEqual(getMetrics(slow, 'finger'), getMetrics(fast, 'finger'));
  const before = samplePPG(1.23, slow, 'finger');
  slow.respiratoryRate = 36;
  assert.notEqual(samplePPG(1.23, slow, 'finger'), before);
  assert.equal(samplePPG(1.23, slow, 'finger'), samplePPG(1.23, fast, 'finger'));
});

test('breathing rate clamps at limits and safely defaults for older saved state', () => {
  const p = { ...DEFAULT_PHYSIOLOGY };
  for (const site of SITES) for (const t of [-5.25, 0, 2.78]) {
    assert.equal(samplePPG(t, { ...p, respiratoryRate: -100 }, site.id), samplePPG(t, { ...p, respiratoryRate: 6 }, site.id));
    assert.equal(samplePPG(t, { ...p, respiratoryRate: 100 }, site.id), samplePPG(t, { ...p, respiratoryRate: 36 }, site.id));
    const { respiratoryRate: omitted, ...olderState } = p;
    void omitted;
    assert.equal(samplePPG(t, olderState as Physiology, site.id), samplePPG(t, p, site.id));
    assert(Number.isFinite(samplePPG(t, { ...p, respiratoryRate: NaN }, site.id)));
  }
});

function systolicPeaks(p: Physiology, site: 'finger' | 'wrist', count = 96) {
  const cycle = 60 / p.heartRate;
  const delay = getMetrics(p, site).transitMs / 1000;
  return Array.from({ length: count }, (_, i) => {
    const start = (i - 12) * cycle + delay;
    let time = start;
    let value = -Infinity;
    for (let offset = 0; offset < cycle * 0.55; offset += 0.001) {
      const sample = samplePPG(start + offset, p, site);
      if (sample > value) { value = sample; time = start + offset; }
    }
    return { time, value };
  });
}

test('quiet resting pulses vary gently without drifting from the selected mean rate', () => {
  const p = { ...DEFAULT_PHYSIOLOGY, noise: 0, respiratoryRate: 12 };
  const peaks = systolicPeaks(p, 'finger');
  const intervals = peaks.slice(1).map((peak, i) => peak.time - peaks[i].time);
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const sd = Math.sqrt(intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length);
  assert(Math.abs(60 / mean - p.heartRate) < 0.2, 'The HR knob remains the mean-rate target');
  assert(sd > 0.003 && sd < 0.03, `Timing variation should be subtle, got SD ${sd}s`);
  assert(intervals.every(value => value > mean * 0.94 && value < mean * 1.06));
  const amplitudes = peaks.map(peak => peak.value);
  const amplitudeRange = Math.max(...amplitudes) - Math.min(...amplitudes);
  assert(amplitudeRange > 0.025 && amplitudeRange < 0.16);
  // At 72 bpm / 12 breaths per minute, respiration repeats every six beats.
  // The additional physiological variation must not simply loop with it.
  const repeatDifferences = intervals.slice(6).map((value, i) => value - intervals[i]);
  const repeatRms = Math.sqrt(repeatDifferences.reduce((sum, value) => sum + value ** 2, 0) / repeatDifferences.length);
  assert(repeatRms > 0.002, 'Successive respiratory cycles should not contain identical beats');
});

test('variable history is reproducible across replay, site switches, and sampling order', () => {
  const p = { ...DEFAULT_PHYSIOLOGY, noise: 0 };
  const times = Array.from({ length: 501 }, (_, i) => (i - 250) * 0.073);
  const samples = times.map(t => samplePPG(t, p, 'finger'));
  const cleanBeat = times.map((_, i) => sampleBeat(i / 500, p, 'finger'));
  for (let i = times.length - 1; i >= 0; i--) {
    samplePPG(times[i] + 200, p, 'wrist');
    assert.equal(samplePPG(times[i], p, 'finger'), samples[i]);
    assert.equal(samplePPG(times[i], { ...p }, 'finger'), samples[i]);
    assert.equal(sampleBeat(i / 500, p, 'finger'), cleanBeat[i]);
  }
  for (const site of SITES) for (const heartRate of [40, 180]) {
    const state = { ...p, heartRate };
    for (let i = -2500; i < 2500; i++) {
      const t = i / 125;
      const a = samplePPG(t, state, site.id);
      const b = samplePPG(t + 0.00001, state, site.id);
      assert(Number.isFinite(a) && Number.isFinite(b));
      assert(Math.abs(a - b) < 0.002, 'Beat boundaries and noise interpolation must remain continuous');
    }
  }
});

test('sensing sites share the same irregular rhythm after their propagation delays', () => {
  const p = { ...DEFAULT_PHYSIOLOGY, noise: 0 };
  const intervals = (site: 'finger' | 'wrist') => {
    const peaks = systolicPeaks(p, site, 48);
    return peaks.slice(1).map((peak, i) => peak.time - peaks[i].time);
  };
  const finger = intervals('finger');
  const wrist = intervals('wrist');
  const differenceRms = Math.sqrt(finger.reduce((sum, value, i) => sum + (value - wrist[i]) ** 2, 0) / finger.length);
  assert(differenceRms < 0.002, 'Changing sites must not generate a different virtual heartbeat');
});
