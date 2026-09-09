import { getRhythm, RHYTHMS, rhythmContext, type Rhythm } from "./rhythm";
/**
 * A deliberately schematic teaching model, not fitted PWDB records or clinical data.
 * PPG is a local optical blood-volume signal. It is not pressure, blood flow, or ECG.
 * See docs/SCIENCE.md for assumptions, provenance, and parameter definitions.
 */
export type SiteId =
  "finger" | "wrist" | "ear" | "forehead" | "carotid" | "upperarm" | "toe";
export type Activity = "rest" | "walk" | "run";

export interface Physiology {
  rhythm?: Rhythm;
  pulseDeficit?: boolean;
  age: number;
  heartRate: number;
  /** Breathing rate in breaths/min, bounded to 6–36 in the teaching model. */
  respiratoryRate: number;
  /** Independent vascular stiffness adjustment, 0–100; age also affects stiffness. */
  stiffness: number;
  /** Relative sensor-site perfusion, 0–100, not a calibrated perfusion index. */
  perfusion: number;
  /** Synthetic sensor noise amplitude, 0–100. */
  noise: number;
  activity: Activity;
}

export interface AnatomicalSite {
  id: SiteId;
  name: string;
  shortName: string;
  location: string;
  description: string;
  /** Illustrative delay from cardiac ejection, excluding ECG pre-ejection time. */
  delayMs: number;
  mode: "reflectance" | "transmission" | "reference";
}

export const DEFAULT_PHYSIOLOGY: Physiology = {
  rhythm: "sinus",
  pulseDeficit: false,
  age: 32,
  heartRate: 72,
  respiratoryRate: 16,
  stiffness: 35,
  perfusion: 72,
  noise: 9,
  activity: "rest",
};

/** Fixed optical plot limits preserve relative amplitudes across controls. */
export const PPG_DISPLAY_RANGE = { min: -0.5, max: 1.7 } as const;

export const SITES: AnatomicalSite[] = [
  {
    id: "finger",
    name: "Index finger",
    shortName: "Finger",
    location: "Digital vascular bed",
    description:
      "A smart ring reads reflected light from the finger’s local vascular bed. This teaching model illustrates pulse shape; it does not reproduce a commercial ring’s data or algorithms.",
    delayMs: 195,
    mode: "reflectance",
  },
  {
    id: "wrist",
    name: "Top of wrist",
    shortName: "Wrist",
    location: "Dorsal wrist microvasculature",
    description:
      "Reflectance PPG samples superficial blood-volume changes at the wrist. Its signal is especially sensitive to contact and arm movement.",
    delayMs: 155,
    mode: "reflectance",
  },
  {
    id: "ear",
    name: "Earlobe",
    shortName: "Ear",
    location: "Auricular vascular bed",
    description:
      "A transmission sensing site with an earlier pulse arrival than the finger in this schematic anatomy. PWDB uses a temporal-artery approximation for the ear.",
    delayMs: 80,
    mode: "transmission",
  },
  {
    id: "forehead",
    name: "Forehead",
    shortName: "Forehead",
    location: "Forehead microvasculature",
    description:
      "An illustrative reflectance site. Sensor geometry and skin circulation influence its optical waveform; this site is an extension beyond the supplied PWDB sites.",
    delayMs: 85,
    mode: "reflectance",
  },
  {
    id: "carotid",
    name: "Carotid / neck",
    shortName: "Carotid",
    location: "Carotid region · model reference",
    description:
      "A proximal pulse-volume reference for learning propagation. Neck optical measurements exist in research, but this trace is not a direct measurement of carotid pressure or flow.",
    delayMs: 45,
    mode: "reference",
  },
  {
    id: "upperarm",
    name: "Upper arm",
    shortName: "Upper arm",
    location: "Brachial / arm microvasculature",
    description:
      "Reflectance PPG at the upper arm is represented by a broader local pulse contour and a shorter propagation path than the wrist.",
    delayMs: 115,
    mode: "reflectance",
  },
  {
    id: "toe",
    name: "Great toe",
    shortName: "Toe",
    location: "Distal foot vascular bed",
    description:
      "A distal reflectance band with a longer illustrative arrival delay. The toe model extends beyond PWDB’s anterior-tibial ankle site.",
    delayMs: 285,
    mode: "reflectance",
  },
];

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const safe = (v: number, fallback: number) =>
  Number.isFinite(v) ? v : fallback;
const unit = (v: number) => clamp(v, 0, 1);
const wrap = (v: number) => ((v % 1) + 1) % 1;
const smoothstep = (v: number) => {
  const x = unit(v);
  return x * x * (3 - 2 * x);
};
const gaussian = (t: number, mu: number, sigma: number) =>
  Math.exp(-0.5 * ((t - mu) / sigma) ** 2);

// Stateless, seeded variation: replaying history or exporting a time window must
// reproduce exactly the same virtual person's beats, in any sampling order.
function beatNoise(index: number, seed: number): number {
  let h = (index | 0) ^ seed;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (((h ^ (h >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
}

function smoothNoise(position: number, seed: number): number {
  const index = Math.floor(position);
  const blend = smoothstep(position - index);
  const a = beatNoise(index, seed);
  return a + (beatNoise(index + 1, seed) - a) * blend;
}

function smoothNoiseDerivative(position: number, seed: number): number {
  const index = Math.floor(position);
  const f = position - index;
  return (
    (beatNoise(index + 1, seed) - beatNoise(index, seed)) * 6 * f * (1 - f)
  );
}

function correlatedBeatNoise(index: number, seed: number): number {
  return (
    0.6 * beatNoise(index, seed) +
    0.3 * beatNoise(index - 1, seed) +
    0.1 * beatNoise(index - 2, seed)
  );
}

const SITE_SHAPE: Record<
  SiteId,
  { width: number; reflection: number; gain: number; motion: number }
> = {
  finger: { width: 1, reflection: 1, gain: 1, motion: 0.8 },
  wrist: { width: 1.05, reflection: 0.9, gain: 0.82, motion: 1.25 },
  ear: { width: 0.96, reflection: 0.67, gain: 0.91, motion: 0.45 },
  forehead: { width: 1.1, reflection: 0.56, gain: 0.85, motion: 0.48 },
  carotid: { width: 1.04, reflection: 0.82, gain: 0.98, motion: 0.6 },
  upperarm: { width: 1.13, reflection: 0.76, gain: 0.79, motion: 0.75 },
  toe: { width: 1.1, reflection: 1.02, gain: 0.88, motion: 1.15 },
};

interface Model {
  rhythm: Rhythm;
  pulseDeficit: boolean;
  cycle: number;
  age: number;
  stiffness: number;
  perfusion: number;
  noise: number;
  activity: number;
  cadence: number;
  respiratoryHz: number;
  delay: number;
  peakTime: number;
  reflectionTime: number;
  reflectionWidth: number;
  reflectionAmplitude: number;
  notchTime: number;
  notchWidth: number;
  notchAmplitude: number;
  gain: number;
  motionSensitivity: number;
  rsaBpm: number;
  timingStrength: number;
  lastVariation?: {
    index: number;
    start: number;
    end: number;
    previousInterval: number;
    gain: number;
    width: number;
    reflection: number;
  };
}

// State objects normally persist for many animation frames. Cache derived models
// while also checking field values so callers may safely mutate a state object.
const cache = new WeakMap<
  Physiology,
  {
    values: number[];
    activity: Activity;
    rhythm: Rhythm;
    sites: Partial<Record<SiteId, Model>>;
  }
>();

function model(p: Physiology, siteId: SiteId): Model {
  let entry = cache.get(p);
  if (
    !entry ||
    entry.values[0] !== p.age ||
    entry.values[1] !== p.heartRate ||
    entry.values[2] !== p.stiffness ||
    entry.values[3] !== p.perfusion ||
    entry.values[4] !== p.noise ||
    entry.values[5] !== p.respiratoryRate ||
    entry.values[6] !== Number(!!p.pulseDeficit) ||
    entry.rhythm !== getRhythm(p.rhythm) ||
    entry.activity !== p.activity
  ) {
    entry = {
      values: [
        p.age,
        p.heartRate,
        p.stiffness,
        p.perfusion,
        p.noise,
        p.respiratoryRate,
        Number(!!p.pulseDeficit),
      ],
      activity: p.activity,
      rhythm: getRhythm(p.rhythm),
      sites: {},
    };
    cache.set(p, entry);
  }
  if (entry.sites[siteId]) return entry.sites[siteId]!;

  const age = unit((safe(p.age, 32) - 25) / 50);
  const hr = clamp(safe(p.heartRate, 72), 40, 180);
  const stiffness = clamp(
    0.1 + age * 0.65 + (unit(safe(p.stiffness, 35) / 100) - 0.35) * 0.6,
    0.02,
    0.96,
  );
  const perfusion = unit(safe(p.perfusion, 72) / 100);
  const noise = unit(safe(p.noise, 9) / 100);
  const activity = p.activity === "run" ? 1 : p.activity === "walk" ? 0.48 : 0;
  const site = SITES.find((s) => s.id === siteId) ?? SITES[0];
  const shape = SITE_SHAPE[siteId] ?? SITE_SHAPE.finger;
  const cycle = 60 / hr;
  const respiratoryHz = clamp(safe(p.respiratoryRate, 16), 6, 36) / 60;
  const timingStrength = (1 - age * 0.65) * (1 - activity * 0.75);
  const peakTime = clamp(
    (0.153 - (hr - 72) * 0.00031) * shape.width,
    0.105,
    cycle * 0.34,
  );
  // Reflection merges toward systole as the stiffness control increases. At high
  // rates, preserve a shorter ejection interval and compress mostly the tail.
  const reflectionTime = Math.min(
    peakTime + 0.22 - stiffness * 0.14,
    cycle * 0.73,
  );
  const reflectionWidth = Math.min(
    (0.037 + stiffness * 0.027) * shape.width,
    cycle * 0.115,
  );
  const notchTime = peakTime + (reflectionTime - peakTime) * 0.66;
  const m: Model = {
    rhythm: getRhythm(p.rhythm),
    pulseDeficit: !!p.pulseDeficit,
    cycle,
    age,
    stiffness,
    perfusion,
    noise,
    activity,
    cadence: p.activity === "run" ? 2.65 : p.activity === "walk" ? 1.8 : 0,
    respiratoryHz,
    timingStrength,
    // Illustrative RSA strength, not a normative HRV range. Slow breathing
    // increases coupling; ageing and exertion attenuate it in this model.
    rsaBpm:
      3.4 *
      timingStrength *
      clamp(Math.sqrt(16 / 60 / respiratoryHz), 0.7, 1.6) *
      clamp(Math.sqrt(72 / hr), 0.7, 1.2),
    delay: site.delayMs / (0.88 + stiffness * 0.64) / 1000,
    peakTime,
    reflectionTime,
    reflectionWidth,
    reflectionAmplitude: (0.38 - 0.24 * stiffness) * shape.reflection,
    notchTime,
    notchWidth: Math.min(0.017 + stiffness * 0.01, cycle * 0.065),
    notchAmplitude: 0.075 * (1 - stiffness) ** 1.8 * shape.reflection,
    gain: (0.26 + perfusion * 1.08) * shape.gain,
    motionSensitivity: shape.motion,
  };
  entry.sites[siteId] = m;
  return m;
}

function beat(
  phase: number,
  m: Model,
  width = 1,
  reflectionScale = 1,
  cycle = m.cycle,
): number {
  // Zero endpoints let independent beats tile without an ECG-like reset spike.
  if (phase <= 0 || phase >= 1) return 0;
  const t = (phase * cycle) / width;
  const x = t / m.peakTime;
  // A gamma-shaped forward pulse creates a steep, rounded upstroke and a curved
  // runoff. The delayed broad component is a teaching analogue of reflection.
  const forward = x ** 5 * Math.exp(5 * (1 - x));
  // A much broader low-amplitude term carries the vascular runoff through
  // diastole rather than leaving an unrealistically flat second half-cycle.
  const reservoirX = t / (m.peakTime * 1.5);
  const runoff = reservoirX ** 1.6 * Math.exp(1.6 * (1 - reservoirX));
  const reflected =
    m.reflectionAmplitude *
    reflectionScale *
    gaussian(t, m.reflectionTime, m.reflectionWidth);
  const notch =
    m.notchAmplitude * reflectionScale * gaussian(t, m.notchTime, m.notchWidth);
  const onset = smoothstep(phase / 0.045);
  const end = 1 - smoothstep((phase - 0.79) / 0.21);
  return (
    Math.max(0, 0.92 * forward + 0.14 * runoff + reflected - notch) *
    onset *
    end *
    m.gain
  );
}

// Integrate instantaneous rate analytically. A positive sin(breath phase)
// accelerates the clock during lung inflation; expiration slows it. Bounded
// phase offsets preserve the target long-term rate and monotonic beat order.
function cardiacCycles(t: number, m: Model): number {
  const nominal = t / m.cycle;
  const omega = TAU * m.respiratoryHz;
  return (
    nominal +
    (m.rsaBpm / (60 * omega)) * (1 - Math.cos(omega * t)) +
    m.timingStrength *
      (0.018 * smoothNoise(nominal / 2.3, 137) +
        0.01 * smoothNoise(nominal / 7.7, 419))
  );
}

function cardiacRate(t: number, m: Model): number {
  const nominal = t / m.cycle;
  return (
    60 / m.cycle +
    m.rsaBpm * Math.sin(TAU * m.respiratoryHz * t) +
    (60 / m.cycle) *
      m.timingStrength *
      ((0.018 / 2.3) * smoothNoiseDerivative(nominal / 2.3, 137) +
        (0.01 / 7.7) * smoothNoiseDerivative(nominal / 7.7, 419))
  );
}

function beatTime(index: number, m: Model): number {
  let t = index * m.cycle;
  for (let i = 0; i < 5; i++)
    t -= (cardiacCycles(t, m) - index) / (cardiacRate(t, m) / 60);
  return t;
}

function beatContext(index: number, m: Model) {
  if (m.lastVariation?.index !== index) {
    const start = beatTime(index, m);
    const end = beatTime(index + 1, m);
    const previousInterval = start - beatTime(index - 1, m);
    const respirationAtEjection = Math.sin(TAU * m.respiratoryHz * start);
    m.lastVariation = {
      index,
      start,
      end,
      previousInterval,
      gain:
        (1 + 0.022 * correlatedBeatNoise(index, 271)) *
        (1 - 0.035 * respirationAtEjection) *
        (1 + 0.12 * (previousInterval / m.cycle - 1)),
      width: 1 + 0.012 * correlatedBeatNoise(index, 811),
      reflection: 1 + 0.045 * correlatedBeatNoise(index, 1613),
    };
  }
  return m.lastVariation;
}

/** Shared ventricular timing for animation and delayed PPG. Sinus mode reports
 * the clock derivative; condition modes report the last completed interval rate. */
export function getCardiacState(timeSec: number, p: Physiology) {
  const t = safe(timeSec, 0);
  const m = model(p, "finger");
  const abnormal = m.rhythm !== "sinus";
  const context = abnormal
    ? rhythmContext(t, m.cycle, m.rhythm, m.pulseDeficit)
    : beatContext(Math.floor(cardiacCycles(t, m)), m);
  const cycles = abnormal
    ? context.index + (t - context.start) / (context.end - context.start)
    : cardiacCycles(t, m);
  const breathPhase = wrap(t * m.respiratoryHz);
  return {
    cycles,
    phase: clamp((t - context.start) / (context.end - context.start), 0, 1),
    heartRate: abnormal ? 60 / context.previousInterval : cardiacRate(t, m),
    beatKind: "kind" in context ? context.kind : "regular",
    // Last completed central interval, not 60 divided by a momentary rate.
    intervalMs: context.previousInterval * 1000,
    breathPhase,
    breathExpansion: 0.5 - 0.5 * Math.cos(TAU * breathPhase),
    inhaling: breathPhase < 0.5,
  };
}

/** One clean beat. Phase 0 and 1 are the same foot; gain preserves perfusion. */
export function sampleBeat(
  phase0to1: number,
  p: Physiology,
  siteId: SiteId,
): number {
  if (!Number.isFinite(phase0to1)) return 0;
  return beat(clamp(phase0to1, 0, 1), model(p, siteId));
}

/** Continuous synthetic optical trace. Time may be negative for history buffers. */
export function samplePPG(
  timeSec: number,
  p: Physiology,
  siteId: SiteId,
): number {
  const m = model(p, siteId);
  const t = safe(timeSec, 0);
  const localTime = t - m.delay;
  const respiration = Math.sin(TAU * m.respiratoryHz * localTime);
  const variation =
    m.rhythm === "sinus"
      ? beatContext(Math.floor(cardiacCycles(localTime, m)), m)
      : rhythmContext(localTime, m.cycle, m.rhythm, m.pulseDeficit);
  const duration = variation.end - variation.start;
  const phase = (localTime - variation.start) / duration;
  const vascularDrift = smoothNoise(localTime * 0.075, 2027);
  const clean =
    beat(phase, m, variation.width, variation.reflection, duration) *
    variation.gain *
    (m.rhythm === "sinus" ? 1 : 1 - 0.025 * respiration) *
    (1 + 0.012 * vascularDrift);
  const drift =
    0.014 * respiration +
    0.004 * Math.sin(TAU * 0.047 * t) +
    0.003 * vascularDrift;
  const sensor =
    m.noise *
    (0.042 * Math.sin(TAU * 13.17 * t + 0.4) +
      0.021 * Math.sin(TAU * 23.71 * t + Math.sin(t * 0.83)) +
      0.014 * Math.sin(TAU * 37.31 * t + 1.7));
  const cadencePhase = TAU * m.cadence * t;
  const movement =
    m.activity *
    m.motionSensitivity *
    (0.08 + 0.1 * (1 - m.perfusion)) *
    (Math.sin(cadencePhase + 0.6) +
      0.4 * Math.sin(cadencePhase * 2 + 1.2) +
      0.22 * Math.sin(cadencePhase * 3.13 + Math.sin(t * 0.37)));
  return clean + drift + sensor + movement;
}

/** Synthetic wrist-oriented accelerometer output in g; z includes gravity. */
export function sampleAccelerometer(
  timeSec: number,
  p: Physiology,
): { x: number; y: number; z: number } {
  const t = safe(timeSec, 0);
  const running = p.activity === "run";
  const active = running || p.activity === "walk";
  const cadence = running ? 2.65 : active ? 1.8 : 0;
  const amplitude = running ? 0.68 : active ? 0.27 : 0;
  const a = TAU * cadence * t;
  return {
    x:
      amplitude * (Math.sin(a) + 0.18 * Math.sin(2 * a + 0.6)) +
      0.004 * Math.sin(t * 1.3),
    y: amplitude * 0.68 * Math.sin(a + 1.1) + 0.006 * Math.sin(t * 1.1 + 0.8),
    z:
      1 +
      amplitude * (0.64 * Math.cos(2 * a) + 0.13 * Math.sin(3 * a + 0.4)) +
      0.004 * Math.sin(t * 1.2),
  };
}

/** Model descriptors: all percentages are illustrative, not clinical indexes. */
export function getMetrics(
  p: Physiology,
  siteId: SiteId,
): { transitMs: number; reflectionIndex: number; notchProminence: number } {
  const m = model(p, siteId);
  // Measure an actual post-systolic depression, so a merged shoulder is never
  // advertised as a visible notch. Relative to the maximum of the clean beat.
  let peak = 0;
  let peakIndex = 0;
  const points = new Float64Array(257);
  for (let i = 0; i <= 256; i++) {
    points[i] = beat(i / 256, m);
    if (points[i] > peak) {
      peak = points[i];
      peakIndex = i;
    }
  }
  let prominence = 0;
  for (let i = peakIndex + 2; i < 210; i++) {
    if (points[i] < points[i - 1] && points[i] <= points[i + 1]) {
      let rebound = points[i];
      for (let j = i + 1; j < 224; j++) rebound = Math.max(rebound, points[j]);
      prominence = Math.max(
        prominence,
        (rebound - points[i]) / Math.max(peak, 0.001),
      );
    }
  }
  return {
    transitMs: Math.round(m.delay * 1000),
    reflectionIndex: Math.round(m.reflectionAmplitude * 100),
    notchProminence: Math.round(prominence * 100),
  };
}

export function getInsight(
  p: Physiology,
  siteId: SiteId,
): { title: string; body: string } {
  const rhythm = getRhythm(p.rhythm);
  if (rhythm !== "sinus")
    return {
      title: RHYTHMS[rhythm].name,
      body: `${RHYTHMS[rhythm].watch}. ${RHYTHMS[rhythm].explanation}`,
    };
  if (p.activity !== "rest")
    return {
      title:
        p.activity === "run"
          ? "Movement joins the pulse"
          : "Two rhythms, one sensor",
      body: "Periodic movement adds contact artifacts to the optical trace. Compare its rhythm with acceleration. The heart-rate control remains independent so you can isolate each effect.",
    };
  if (siteId === "carotid")
    return {
      title: "A reference close to the heart",
      body: "This neck trace is a modeled pulse-volume reference with an early arrival. It is not carotid pressure or blood flow. Specialized optical neck recordings are a research technique.",
    };
  if (p.perfusion < 35)
    return {
      title: "Less perfusion, less optical pulse",
      body: "Lower perfusion reduces the pulsatile signal while sensor noise remains. This amplitude is in relative units; it is not oxygen saturation or blood pressure.",
    };
  if (p.age >= 58 || p.stiffness >= 70)
    return {
      title: "The reflected wave arrives earlier",
      body: "In this teaching model, greater stiffness speeds propagation and moves the reflected component toward systole. The dicrotic notch becomes less distinct. Age suggests a tendency, not an individual diagnosis.",
    };
  if (p.heartRate > 105)
    return {
      title: "Diastole has less time",
      body: "A faster heart rate shortens each beat. Here the decay compresses more than the upstroke, so waveform features crowd together. Real exercise also changes vascular tone and stroke volume.",
    };
  return {
    title: "Find the second rise",
    body: "Follow the systolic upstroke, the small dicrotic depression, and the later diastolic rise. Change the site or age to see how pulse propagation and reflection reshape the contour.",
  };
}

export interface CapturedBeat {
  start: number;
  end: number;
  index: number;
}
/** Capture one ventricular event, including negative-time history. */
export function captureBeat(time: number, p: Physiology): CapturedBeat {
  time = safe(time, 0);
  const m = model(p, "finger");
  const c =
    m.rhythm === "sinus"
      ? beatContext(Math.floor(cardiacCycles(time, m)), m)
      : rhythmContext(time, m.cycle, m.rhythm, m.pulseDeficit);
  return { start: c.start, end: c.end, index: c.index };
}
export function siteDelay(p: Physiology, site: SiteId) {
  return model(p, site).delay;
}
/** Isolate this captured optical pulse; omit adjacent beats, drift and sensor noise. */
export function sampleCapturedBeat(
  time: number,
  p: Physiology,
  site: SiteId,
  captured: CapturedBeat,
  aligned = false,
) {
  const m = model(p, site);
  const c =
    m.rhythm === "sinus"
      ? beatContext(captured.index, m)
      : rhythmContext(
          (captured.start + captured.end) / 2,
          m.cycle,
          m.rhythm,
          m.pulseDeficit,
        );
  const duration = captured.end - captured.start;
  const phase = (time - captured.start - (aligned ? 0 : m.delay)) / duration;
  return beat(phase, m, c.width, c.reflection, duration) * c.gain;
}

/** A display-only rate from two completed central intervals. The simulation
 * clock and raw event timings are never smoothed by this readout. */
export function getDisplayHeartRate(time: number, p: Physiology): number {
  const current = captureBeat(time, p);
  const previous = captureBeat(current.start - 1e-5, p);
  const before = captureBeat(previous.start - 1e-5, p);
  return 120 / (current.start - before.start);
}
