/** Landmarks on one clean, onset-to-onset teaching pulse. Not a clinical detector. */
export const FIDUCIALS = {
  on: {
    name: "Pulse onset (foot)",
    description:
      "The start of the pulse upstroke. This local baseline is the reference for pulse timing and amplitude.",
  },
  u: {
    name: "Maximum upslope",
    description:
      "The fastest rise in the pulse. This is the maximum of the first derivative (PPG′), shown here at its corresponding location on the original waveform.",
  },
  sp: {
    name: "Systolic peak",
    description:
      "The main crest after the upstroke, associated with the systolic increase in local blood volume.",
  },
  dn: {
    name: "Dicrotic notch",
    description:
      "A local dip between the systolic and diastolic peaks. Its visibility depends on the pulse contour; peripheral PPG does not directly time aortic valve closure.",
  },
  dp: {
    name: "Diastolic peak",
    description:
      "A later local crest after the notch, shaped by interacting forward and reflected waves. It can merge into a shoulder and may not be separately visible.",
  },
  off: {
    name: "Pulse offset (next foot)",
    description:
      "The end of this pulse and the onset of the next. The onset-to-onset interval defines the pulse duration.",
  },
} as const;
export type FiducialId = keyof typeof FIDUCIALS;
export type Fiducial = {
  id: FiducialId;
  index: number;
  phase: number;
  amplitude: number;
};
export function analyzePulse(samples: ArrayLike<number>) {
  const n = samples.length;
  const points: Fiducial[] = [];
  const empty = {
    points,
    crestPhase: null,
    width50Phase: null,
    amplitude: null,
  };
  if (n < 16 || Array.from(samples).some((v) => !Number.isFinite(v)))
    return empty;
  const smooth = Array.from(samples, (_, i) => {
    let sum = 0,
      count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
      sum += samples[j];
      count++;
    }
    return sum / count;
  });
  let peak = 1;
  for (let i = 2; i < n * 0.56; i++) if (smooth[i] > smooth[peak]) peak = i;
  const amplitude = samples[peak] - samples[0];
  if (amplitude < 0.0001) return empty;
  const add = (id: FiducialId, index: number) =>
    points.push({
      id,
      index,
      phase: index / (n - 1),
      amplitude: samples[index],
    });
  let upslope = 1;
  for (let i = 2; i < peak; i++)
    if (
      smooth[i + 1] - smooth[i - 1] >
      smooth[upslope + 1] - smooth[upslope - 1]
    )
      upslope = i;
  add("on", 0);
  add("u", upslope);
  add("sp", peak);
  const threshold = Math.max(0.006, amplitude * 0.012);
  outer: for (let i = peak + 3; i < n * 0.76; i++) {
    if (smooth[i] > smooth[i - 1] || smooth[i] >= smooth[i + 1]) continue;
    for (let j = i + 3; j < n * 0.9; j++) {
      if (smooth[j] < smooth[j - 1] || smooth[j] <= smooth[j + 1]) continue;
      if (
        smooth[j] - smooth[i] > threshold &&
        smooth[peak] - smooth[i] > threshold
      ) {
        add("dn", i);
        add("dp", j);
        break outer;
      }
    }
  }
  add("off", n - 1);
  const half = samples[0] + amplitude * 0.5;
  const crossings: number[] = [];
  for (let i = 1; i < n; i++) {
    if (
      (samples[i - 1] < half && samples[i] >= half) ||
      (samples[i - 1] >= half && samples[i] < half)
    ) {
      crossings.push(
        (i - 1 + (half - samples[i - 1]) / (samples[i] - samples[i - 1])) /
          (n - 1),
      );
    }
  }
  return {
    points,
    crestPhase: peak / (n - 1),
    width50Phase:
      crossings.length >= 2
        ? crossings[crossings.length - 1] - crossings[0]
        : null,
    amplitude,
  };
}
