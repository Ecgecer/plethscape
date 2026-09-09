/** Authored locomotion timing shared by the rig and illustrative sensor signals.
 * Cadence is steps/second; a full left-right stride is two steps. */
export type MotionActivity = "rest" | "walk" | "run";
export const STEP_CADENCE = { rest: 0, walk: 1.8, run: 2.65 } as const;
export const BLEND_SECONDS = 0.7;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};
export interface MotionState {
  phase: number;
  cadence: number;
  walk: number;
  run: number;
}
export interface MotionTransition extends MotionState {
  time: number;
  to: MotionActivity;
  previous: MotionActivity;
}
export function sampleMotion(
  time: number,
  activity: MotionActivity,
  history?: readonly MotionTransition[],
): MotionState {
  let event: MotionTransition | undefined;
  for (let i = (history?.length ?? 0) - 1; i >= 0; i--)
    if (history![i].time <= time) {
      event = history![i];
      break;
    }
  if (!event) {
    const initial = history?.[0]?.previous ?? activity;
    return {
      phase: (time * STEP_CADENCE[initial]) / 2,
      cadence: STEP_CADENCE[initial],
      walk: initial === "walk" ? 1 : 0,
      run: initial === "run" ? 1 : 0,
    };
  }
  const dt = Math.max(0, time - event.time),
    u = clamp(dt / BLEND_SECONDS),
    blend = smooth(u);
  // Analytic integral of the eased cadence: no phase reset at mode changes.
  const integral =
    BLEND_SECONDS * (u * u * u - 0.5 * u * u * u * u) +
    Math.max(0, dt - BLEND_SECONDS);
  const target = STEP_CADENCE[event.to];
  return {
    phase:
      event.phase +
      (event.cadence * dt + (target - event.cadence) * integral) / 2,
    cadence: event.cadence + (target - event.cadence) * blend,
    walk: event.walk + ((event.to === "walk" ? 1 : 0) - event.walk) * blend,
    run: event.run + ((event.to === "run" ? 1 : 0) - event.run) * blend,
  };
}
export function transitionMotion(
  time: number,
  previous: MotionActivity,
  to: MotionActivity,
  history?: readonly MotionTransition[],
) {
  if (previous === to) return history;
  const state = sampleMotion(time, previous, history);
  return [
    ...(history ?? []).filter((event) => event.time <= time),
    { ...state, time, to, previous },
  ];
}
/** Periodic cubic Hermite tracks, authored in normalized stride phase. */
export function track(
  phase: number,
  keys: readonly (readonly [number, number])[],
) {
  const p = ((phase % 1) + 1) % 1;
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const a = keys[i],
    b = keys[i + 1],
    dt = b[0] - a[0],
    u = (p - a[0]) / dt;
  const prev =
    i === 0
      ? [keys[keys.length - 2][0] - 1, keys[keys.length - 2][1]]
      : keys[i - 1];
  const next =
    i + 2 === keys.length ? [keys[1][0] + 1, keys[1][1]] : keys[i + 2];
  const m0 = (b[1] - prev[1]) / (b[0] - prev[0]),
    m1 = (next[1] - a[1]) / (next[0] - a[0]);
  return (
    (2 * u * u * u - 3 * u * u + 1) * a[1] +
    (u * u * u - 2 * u * u + u) * dt * m0 +
    (-2 * u * u * u + 3 * u * u) * b[1] +
    (u * u * u - u * u) * dt * m1
  );
}
const walkZ = [
  [0, 0.28],
  [0.16, 0.17],
  [0.4, -0.1],
  [0.62, -0.32],
  [0.78, -0.12],
  [0.93, 0.22],
  [1, 0.28],
] as const;
const walkY = [
  [0, 0],
  [0.5, 0],
  [0.62, 0.035],
  [0.78, 0.14],
  [0.92, 0.06],
  [1, 0],
] as const;
const walkPitch = [
  [0, -0.16],
  [0.15, 0],
  [0.42, 0],
  [0.62, 0.32],
  [0.78, -0.08],
  [0.94, -0.16],
  [1, -0.16],
] as const;
const runZ = [
  [0, 0.42],
  [0.18, 0.12],
  [0.37, -0.48],
  [0.55, -0.4],
  [0.75, 0.15],
  [0.9, 0.46],
  [1, 0.42],
] as const;
const runY = [
  [0, 0],
  [0.2, 0],
  [0.37, 0.1],
  [0.52, 0.58],
  [0.7, 0.43],
  [0.88, 0.13],
  [1, 0],
] as const;
const runPitch = [
  [0, -0.08],
  [0.16, 0],
  [0.37, 0.45],
  [0.55, 0.58],
  [0.78, -0.05],
  [0.92, -0.12],
  [1, -0.08],
] as const;
export function footTrack(phase: number, motion: MotionState) {
  return {
    z: track(phase, walkZ) * motion.walk + track(phase, runZ) * motion.run,
    lift:
      Math.max(0, track(phase, walkY)) * motion.walk +
      Math.max(0, track(phase, runY)) * motion.run,
    pitch:
      track(phase, walkPitch) * motion.walk +
      track(phase, runPitch) * motion.run,
  };
}
export function movementSignal(
  time: number,
  activity: MotionActivity,
  history?: readonly MotionTransition[],
) {
  const m = sampleMotion(time, activity, history),
    a = TAU * m.phase,
    amount = 0.48 * m.walk + m.run;
  const impact = Math.pow(Math.max(0, Math.cos(2 * a)), 12);
  return { m, a, amount, impact };
}
