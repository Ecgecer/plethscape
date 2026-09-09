import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowRight,
  ArrowCounterClockwise,
  Check,
  Heart,
  Sparkle,
} from "@phosphor-icons/react";
import {
  DEFAULT_PHYSIOLOGY,
  SITES,
  getInsight,
  type Physiology,
  type SiteId,
} from "./simulation";

export type ExperienceMode = "explore" | "experiment" | "understand";
export const PULSE_JOURNEY_SECONDS = 8;
type Baseline = { physiology: Physiology; site: SiteId };
interface Props {
  active?: boolean;
  ready: boolean;
  mode: ExperienceMode;
  site: SiteId;
  visited: SiteId[];
  physiology: Physiology;
  baseline: Baseline | null;
  clock: RefObject<{ time: number; running: boolean }>;
  pulseStart: number | null;
  onPulse: () => void;
  onMode: (mode: ExperienceMode) => void;
  onSite: (site: SiteId) => void;
  onPrepare: (physiology: Physiology, baseline?: Baseline) => void;
  onWhy: () => void;
}
const chapters = [
  {
    title: "It begins with a beat.",
    body: "The heart ejects blood. Arteries expand with the pressure pulse.",
  },
  {
    title: "The pulse travels.",
    body: "Watch the amber highlight move along the arm’s arterial pathways.",
  },
  {
    title: "Light finds the rhythm.",
    body: "At the wrist, a sensor detects changing blood volume in the tissue.",
  },
  {
    title: "One heartbeat. Many perspectives.",
    body: "Choose another anatomical site. Compare its pulse shape and arrival with the wrist.",
  },
];
export default function ExperienceGuide(p: Props) {
  const [phase, setPhase] = useState(-1);
  const [challenge, setChallenge] = useState(0);
  const [ageStep, setAgeStep] = useState(0);
  const [rateTried, setRateTried] = useState(false);
  const [complete, setComplete] = useState(false);
  const progress = useRef<HTMLSpanElement>(null);
  const hasFollowed = useRef(false);
  useEffect(() => {
    if (p.active === false) return;
    let frame = 0,
      previous = -2;
    const tick = () => {
      const elapsed =
        p.pulseStart === null
          ? -1
          : Math.max(0, p.clock.current.time - p.pulseStart);
      if (elapsed >= 0) hasFollowed.current = true;
      const next =
        elapsed < 0
          ? hasFollowed.current
            ? 3
            : -1
          : elapsed < 2
            ? 0
            : elapsed < 6
              ? 1
              : elapsed < PULSE_JOURNEY_SECONDS
                ? 2
                : 3;
      if (next !== previous) {
        previous = next;
        setPhase(next);
      }
      if (progress.current)
        progress.current.style.transform = `scaleX(${Math.max(0, Math.min(1, elapsed / PULSE_JOURNEY_SECONDS))})`;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [p.pulseStart, p.clock, p.active]);
  const insight = getInsight(p.physiology, p.site);
  const stops: SiteId[] = ["finger", "wrist", "ear"];
  const found = stops.filter((s) => p.visited.includes(s)).length;
  const nextSite = stops.find((s) => !p.visited.includes(s));
  const ageComparison = Boolean(
    p.baseline &&
    p.site === "finger" &&
    p.baseline.site === "finger" &&
    p.baseline.physiology.age === 25 &&
    p.physiology.age === 70 &&
    (
      [
        "heartRate",
        "respiratoryRate",
        "stiffness",
        "perfusion",
        "noise",
        "activity",
      ] as const
    ).every((k) => p.baseline!.physiology[k] === p.physiology[k]),
  );
  const prepareYoung = () => {
    const young = { ...DEFAULT_PHYSIOLOGY, age: 25, heartRate: 72, noise: 0 };
    p.onSite("finger");
    p.onPrepare(young, { site: "finger", physiology: young });
    setAgeStep(1);
  };
  return (
    <section
      className="experience-guide"
      aria-label={
        p.mode === "explore"
          ? "Pulse journey"
          : p.mode === "experiment"
            ? "One experiment at a time"
            : "Understand the signal"
      }
    >
      {p.mode === "explore" ? (
        <>
          <span className="experience-eyebrow">
            <Sparkle size={15} /> START WITH A SITE
          </span>
          <div
            className="journey-stations"
            aria-label="Heart to arteries to sensor"
          >
            {["Heart", "Arteries", "Sensor"].map((label, i) => (
              <span key={label} className={phase >= i ? "reached" : ""}>
                <i>
                  {i === 0 ? (
                    <Heart size={17} />
                  ) : i === 1 ? (
                    <span className="artery-glyph" />
                  ) : (
                    <span className="sensor-glyph" />
                  )}
                </i>
                {label}
                {i < 2 && <ArrowRight size={13} />}
              </span>
            ))}
          </div>
          <div className="journey-copy" aria-live="polite">
            <h2>
              {phase < 0 ? "Why does location matter?" : chapters[phase].title}
            </h2>
            <p>
              {phase < 0
                ? "Follow a pulse to the wrist, then choose another site. Local vessels and tissue change the signal’s shape, strength and arrival time."
                : chapters[phase].body}
            </p>
          </div>
          {phase >= 0 && (
            <div className="journey-progress">
              <span ref={progress} />
            </div>
          )}
          {phase < 0 ? (
            <button
              className="experience-primary"
              disabled={!p.ready}
              onClick={p.onPulse}
            >
              {p.ready ? "Follow a pulse" : "Preparing the body…"}{" "}
              <ArrowRight size={18} />
            </button>
          ) : phase < 3 ? (
            <span className="journey-caption">
              Slowed illustration ·{" "}
              {p.clock.current.running
                ? "follow the amber light"
                : "paused with the simulation"}
            </span>
          ) : (
            <div className="journey-next">
              <button
                className="experience-primary"
                onClick={() => p.onMode("experiment")}
              >
                Try a small experiment <ArrowRight size={17} />
              </button>
              <button
                className="experience-replay"
                onClick={p.onPulse}
                aria-label="Replay pulse journey"
              >
                <ArrowCounterClockwise size={17} />
              </button>
            </div>
          )}
          <div className="discovery-count">
            <span>
              {p.visited.length}
              <small> / 7</small>
            </span>{" "}
            sensing sites discovered{" "}
            <button
              aria-label="Why do sensing sites have different shapes?"
              onClick={p.onWhy}
            >
              Why?
            </button>
          </div>
        </>
      ) : p.mode === "experiment" ? (
        <>
          <span className="experience-eyebrow">
            <Sparkle size={15} />{" "}
            {complete
              ? "THREE DISCOVERIES MADE"
              : `EXPERIMENT ${challenge + 1} OF 3`}
          </span>
          <div className="challenge-track" aria-label="Experiment progress">
            {["Place", "Age", "Rhythm"].map((s, i) => (
              <button
                key={s}
                aria-label={`Experiment: ${s}`}
                aria-pressed={!complete && challenge === i}
                onClick={() => {
                  setChallenge(i);
                  setComplete(false);
                }}
              >
                <span>
                  {complete || i < challenge ? <Check size={12} /> : i + 1}
                </span>
                {s}
              </button>
            ))}
          </div>
          <h2>
            {complete
              ? "You’re finding the patterns."
              : [
                  "Same heart. Different place.",
                  "Let the signal grow older.",
                  "Turn up the rhythm.",
                ][challenge]}
          </h2>
          <p>
            {complete
              ? "Keep exploring your own combinations. Every change has a story."
              : challenge === 0
                ? "Visit the ring, wristband and earring. Watch the shape change, even at the same heart rate."
                : challenge === 1
                  ? "Save a young signal, then change only age. Compare the second rise in the waveform."
                  : "Try 120 bpm. Watch how many beats fit into the same five seconds."}
          </p>
          {complete ? (
            <button
              className="experience-primary"
              onClick={() => p.onMode("explore")}
            >
              Back to exploring <ArrowRight size={17} />
            </button>
          ) : challenge === 0 ? (
            <>
              <span className="experiment-evidence">
                {found} of 3 sites found
              </span>
              <button
                className="experience-primary"
                onClick={() =>
                  nextSite ? p.onSite(nextSite) : setChallenge(1)
                }
              >
                {nextSite
                  ? `Discover ${SITES.find((s) => s.id === nextSite)!.name.toLowerCase()}`
                  : "Next: a change in age"}
                <ArrowRight size={17} />
              </button>
            </>
          ) : challenge === 1 ? (
            <>
              <button
                className="experience-primary"
                onClick={
                  ageStep === 0
                    ? prepareYoung
                    : () => {
                        if (p.baseline) {
                          p.onSite("finger");
                          p.onPrepare({ ...p.baseline.physiology, age: 70 });
                          setAgeStep(2);
                        } else prepareYoung();
                      }
                }
              >
                {ageStep === 0
                  ? "Save age 25"
                  : ageStep === 1
                    ? "Now try age 70"
                    : "Restore the age comparison"}
                <ArrowRight size={17} />
              </button>
              {ageStep > 0 && !p.baseline && (
                <p className="experiment-evidence">
                  The saved trace was removed. Save a young signal again.
                </p>
              )}
              {ageStep === 2 && (
                <div className="experiment-result">
                  <p>
                    {ageComparison
                      ? "The young trace stays behind as a reference. Notice how the reflected rise blends into the peak."
                      : "Other settings changed. Restore the comparison to isolate age."}
                  </p>
                  <button
                    disabled={!ageComparison}
                    onClick={() => setChallenge(2)}
                  >
                    Next: change the rhythm <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                className="experience-primary"
                onClick={() => {
                  p.onPrepare({ ...p.physiology, heartRate: 120 });
                  setRateTried(true);
                }}
              >
                Try 120 bpm <ArrowRight size={17} />
              </button>
              {rateTried && (
                <div className="experiment-result">
                  <p>
                    A cycle now lasts {(60 / p.physiology.heartRate).toFixed(2)}{" "}
                    seconds. Faster beats fit closer together.
                  </p>
                  <button onClick={() => setComplete(true)}>
                    Finish discoveries <Check size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          {!complete && (
            <button className="experience-why" onClick={p.onWhy}>
              Why does this happen? <ArrowRight size={15} />
            </button>
          )}
        </>
      ) : (
        <>
          <span className="experience-eyebrow">A CLOSER LOOK</span>
          <h2>{insight.title}</h2>
          <p>{insight.body}</p>
          <button
            className="experience-why"
            onClick={() => p.onMode("experiment")}
          >
            Back to experimenting <ArrowRight size={17} />
          </button>
        </>
      )}
    </section>
  );
}
