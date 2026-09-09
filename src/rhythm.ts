/** Deterministic teaching rhythms. Parameters illustrate patterns, not fitted patients. */
export type Rhythm =
  "sinus" | "afib" | "pac" | "pvc" | "bigeminy" | "trigeminy";
export type BeatKind = "regular" | "irregular" | "premature" | "recovery";
export const RHYTHMS: Record<
  Rhythm,
  {
    name: string;
    short: string;
    watch: string;
    explanation: string;
    source: string;
  }
> = {
  sinus: {
    name: "Sinus rhythm",
    short: "Sinus",
    watch: "Gentle breathing-related variation",
    explanation:
      "The reference rhythm keeps the subtle respiratory and beat-to-beat variation of the virtual person. Compare its organized spacing with the other examples.",
    source: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9707923/",
  },
  afib: {
    name: "Atrial fibrillation",
    short: "AFib",
    watch: "Irregular spacing · variable pulse heights",
    explanation:
      "Disorganized atrial activity can produce an irregular ventricular response. This example varies intervals without a repeating short–long pattern; pulse heights also change with filling. Breathing continues, but does not impose a sinus rhythm on these beats.",
    source: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9707923/",
  },
  pac: {
    name: "Premature atrial contractions",
    short: "PACs",
    watch: "Early pulse · shorter-than-full pause",
    explanation:
      "PACs are ectopic beats originating in the atria. This conducted-PAC example has a weaker early pulse and an incomplete compensatory pause. Other PAC patterns exist, and the pulse shape alone cannot establish an atrial origin.",
    source: "https://doi.org/10.3389/fmed.2020.597774",
  },
  pvc: {
    name: "Premature ventricular contractions",
    short: "PVCs",
    watch: "Weak early pulse · long pause · rebound",
    explanation:
      "PVCs originate in the ventricles. This example uses a full compensatory pause: the short and long intervals together span two underlying cycles. Reduced early filling produces a weaker optical pulse; the following pulse is stronger. Not every PVC follows this pattern.",
    source: "https://www.mdpi.com/1424-8220/17/1/158",
  },
  bigeminy: {
    name: "Ventricular bigeminy",
    short: "Bigeminy",
    watch: "A PVC after each regular beat",
    explanation:
      "Bigeminy describes a repeating pattern rather than a separate origin: here a regular beat alternates with a PVC. Look for repeated short–long intervals and alternating pulse heights.",
    source: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9707923/",
  },
  trigeminy: {
    name: "Ventricular trigeminy",
    short: "Trigeminy",
    watch: "Two regular beats, then a PVC",
    explanation:
      "This example repeats two regular beats followed by a PVC. The three-beat structure helps distinguish patterned ectopy from the irregularly irregular AFib example.",
    source: "https://pubmed.ncbi.nlm.nih.gov/33028000/",
  },
};
export function getRhythm(value: unknown): Rhythm {
  return typeof value === "string" && Object.hasOwn(RHYTHMS, value)
    ? (value as Rhythm)
    : "sinus";
}
export function isVentricular(rhythm: Rhythm) {
  return rhythm === "pvc" || rhythm === "bigeminy" || rhythm === "trigeminy";
}
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const mod = (v: number, n: number) => ((v % n) + n) % n;
function noise(index: number, seed: number) {
  let x = Math.imul(index + seed, 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function premature(index: number, rhythm: Rhythm) {
  const period = rhythm === "bigeminy" ? 2 : rhythm === "trigeminy" ? 3 : 6;
  return (
    rhythm !== "afib" && rhythm !== "sinus" && mod(index, period) === period - 1
  );
}
const tables = new Map<Rhythm, { prefix: Float64Array; length: number }>();
function table(rhythm: Rhythm) {
  let result = tables.get(rhythm);
  if (result) return result;
  // 4,096 AF intervals before replay (~57 min at 72 bpm); ectopy is deliberately periodic.
  const length =
    rhythm === "afib"
      ? 4096
      : rhythm === "bigeminy"
        ? 2
        : rhythm === "trigeminy"
          ? 3
          : 6;
  const intervals = Array.from({ length }, (_, i) =>
    rhythm === "afib"
      ? 0.48 + 1.35 * noise(i, 727) ** 1.5
      : premature(i + 1, rhythm)
        ? 0.6
        : premature(i, rhythm)
          ? rhythm === "pac"
            ? 1.05
            : 1.4
          : 1,
  );
  const mean = intervals.reduce((a, b) => a + b, 0) / length;
  const prefix = new Float64Array(length + 1);
  intervals.forEach((v, i) => (prefix[i + 1] = prefix[i] + v / mean));
  prefix[length] = length;
  result = { prefix, length };
  tables.set(rhythm, result);
  return result;
}
export function rhythmBeatTime(index: number, cycle: number, rhythm: Rhythm) {
  const { prefix, length } = table(rhythm);
  const block = Math.floor(index / length),
    local = mod(index, length);
  return (block * length + prefix[local]) * cycle;
}
export function rhythmContext(
  time: number,
  cycle: number,
  rhythm: Rhythm,
  pulseDeficit = false,
) {
  const { prefix, length } = table(rhythm);
  const position = time / cycle,
    block = Math.floor(position / length),
    local = position - block * length;
  let lo = 0,
    hi = length;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (prefix[mid] <= local) lo = mid;
    else hi = mid;
  }
  const index = block * length + lo;
  const start = rhythmBeatTime(index, cycle, rhythm),
    end = rhythmBeatTime(index + 1, cycle, rhythm);
  const previousInterval = start - rhythmBeatTime(index - 1, cycle, rhythm);
  const early = premature(index, rhythm),
    recovery = premature(index - 1, rhythm);
  const kind: BeatKind =
    rhythm === "afib"
      ? "irregular"
      : early
        ? "premature"
        : recovery
          ? "recovery"
          : "regular";
  const gain =
    rhythm === "afib"
      ? clamp(
          0.9 *
            Math.sqrt(previousInterval / cycle) *
            (0.92 + 0.16 * noise(index, 919)),
          0.5,
          1.1,
        )
      : early
        ? pulseDeficit && isVentricular(rhythm)
          ? 0.055
          : rhythm === "pac"
            ? 0.62
            : 0.4
        : recovery
          ? 1.1
          : 1;
  return {
    index,
    start,
    end,
    previousInterval,
    kind,
    gain,
    width: early ? 0.86 : 1,
    reflection: early ? 0.65 : 1,
  };
}
