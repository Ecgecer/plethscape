import { useEffect, useId, useState } from "react";
import { DEFAULT_PHYSIOLOGY, type Physiology, type SiteId } from "./simulation";
import "./discovery.css";

export interface DiscoveryQuestProps {
  site: SiteId;
  physiology: Physiology;
  baseline: { physiology: Physiology; site: SiteId } | null;
  onPrepare: (physiology: Partial<Physiology>) => void;
  onCapture: () => void;
  onSite: (site: SiteId) => void;
}

const STOPS: { id: SiteId; label: string; location: string }[] = [
  { id: "finger", label: "Smart ring", location: "Index finger" },
  { id: "wrist", label: "Sensor band", location: "Inner wrist" },
  { id: "ear", label: "Sensor earring", location: "Earlobe" },
];
const YOUNG: Physiology = { ...DEFAULT_PHYSIOLOGY, age: 25, noise: 0 };
const CONTEXT_KEYS = [
  "heartRate",
  "respiratoryRate",
  "stiffness",
  "perfusion",
  "noise",
  "activity",
] as const;
const sameContext = (a: Physiology, b: Physiology) =>
  CONTEXT_KEYS.every((key) => a[key] === b[key]);

function Check({ done }: { done: boolean }) {
  return (
    <span className={`dq-check${done ? " is-done" : ""}`} aria-hidden="true">
      {done && (
        <svg viewBox="0 0 12 12" width="10" height="10">
          <path
            d="m2 6 2.5 2.5L10 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/** Local learning state only. Physiology and the visible comparison stay parent-owned. */
export default function DiscoveryQuest({
  site,
  physiology,
  baseline,
  onPrepare,
  onCapture,
  onSite,
}: DiscoveryQuestProps) {
  const id = useId();
  const [guided, setGuided] = useState(true);
  const [started, setStarted] = useState(false);
  const [mission, setMission] = useState(0);
  const [visited, setVisited] = useState<SiteId[]>([]);
  const [agePrediction, setAgePrediction] = useState<
    "earlier" | "later" | null
  >(null);
  const [ratePrediction, setRatePrediction] = useState<
    "shorter" | "taller" | null
  >(null);
  const [captureRequested, setCaptureRequested] = useState(false);
  const [captured, setCaptured] = useState<Physiology | null>(null);
  const [ageObserved, setAgeObserved] = useState(false);
  const [rateObserved, setRateObserved] = useState(false);

  useEffect(() => {
    if (
      !guided ||
      !started ||
      mission !== 0 ||
      !STOPS.some((stop) => stop.id === site)
    )
      return;
    setVisited((current) =>
      current.includes(site) ? current : [...current, site],
    );
  }, [site, guided, started, mission]);

  useEffect(() => {
    if (
      !captureRequested ||
      !baseline ||
      baseline.site !== "finger" ||
      baseline.physiology.age > 30
    )
      return;
    if (!sameContext(baseline.physiology, YOUNG)) return;
    setCaptured({ ...baseline.physiology });
    setCaptureRequested(false);
  }, [baseline, captureRequested]);

  const youngReady =
    site === "finger" && physiology.age <= 30 && sameContext(physiology, YOUNG);
  const baselineVisible = Boolean(
    captured &&
    baseline &&
    baseline.site === "finger" &&
    baseline.physiology.age === captured.age &&
    sameContext(baseline.physiology, captured),
  );
  const oldReady = Boolean(
    captured &&
    baselineVisible &&
    site === "finger" &&
    physiology.age >= 65 &&
    sameContext(physiology, captured),
  );
  const rateReady = site === "finger" && physiology.heartRate >= 120;
  const ageComplete = oldReady && ageObserved && agePrediction === "earlier";
  const rateComplete =
    rateReady && rateObserved && ratePrediction === "shorter";
  const completed = mission === 3;

  const prepareYoung = () => {
    setCaptured(null);
    setCaptureRequested(false);
    setAgeObserved(false);
    onSite("finger");
    onPrepare({ ...YOUNG });
  };
  const restart = () => {
    setMission(0);
    setVisited([]);
    setAgePrediction(null);
    setRatePrediction(null);
    setCaptured(null);
    setCaptureRequested(false);
    setAgeObserved(false);
    setRateObserved(false);
    setStarted(false);
  };
  const toRhythm = () => {
    setMission(2);
    onSite("finger");
    onPrepare({ ...(captured ?? YOUNG), heartRate: 72 });
  };

  return (
    <section
      className="discovery-quest"
      aria-label="Waveform discovery expedition"
    >
      <div className="dq-header">
        <div className="dq-brand">
          <svg
            className="dq-compass"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
          <span>
            <b>Follow your curiosity</b>
            <small>THREE EXPERIMENTS · YOUR OWN PACE</small>
          </span>
        </div>
        <div className="dq-mode" role="group" aria-label="Exploration mode">
          <button
            type="button"
            aria-pressed={guided}
            onClick={() => setGuided(true)}
          >
            Guided play
          </button>
          <button
            type="button"
            aria-pressed={!guided}
            onClick={() => setGuided(false)}
          >
            Free explore
          </button>
        </div>
      </div>

      {!guided ? (
        <div className="dq-free">
          <p>
            Follow any signal. The sites, dials, and comparisons are yours to
            explore.
          </p>
          <span>
            {started
              ? "Your expedition progress is saved for this visit."
              : "Guided play is here whenever you want a starting point."}
          </span>
        </div>
      ) : !started ? (
        <div className="dq-intro">
          <div>
            <h2>One body. A few surprising discoveries.</h2>
            <p>
              Visit three sensing sites, predict an age-related change, then
              turn up the rhythm.
            </p>
          </div>
          <button
            className="dq-primary"
            type="button"
            onClick={() => setStarted(true)}
          >
            Start expedition <span aria-hidden="true">↗</span>
          </button>
        </div>
      ) : (
        <>
          <ol className="dq-progress" aria-label="Expedition progress">
            {["Find the signal", "Trace a reflection", "Change the rhythm"].map(
              (label, index) => (
                <li
                  key={label}
                  className={`${index < mission ? "is-complete" : ""} ${index === mission ? "is-current" : ""}`}
                  aria-current={index === mission ? "step" : undefined}
                >
                  <span aria-hidden="true">
                    {index < mission ? "✓" : `0${index + 1}`}
                  </span>
                  <b>{label}</b>
                  <span className="dq-sr-only">
                    {index < mission
                      ? ", complete"
                      : index === mission
                        ? ", current"
                        : ", upcoming"}
                  </span>
                </li>
              ),
            )}
          </ol>

          {completed ? (
            <div className="dq-finish">
              <div>
                <span className="dq-eyebrow">EXPEDITION COMPLETE · 3 / 3</span>
                <h2>You can read more of the story.</h2>
                <p>
                  Site shapes the signal. Reflection reshapes the contour. Heart
                  rate changes its timing. Try a new combination and explain
                  what you notice.
                </p>
              </div>
              <div className="dq-actions">
                <button
                  type="button"
                  className="dq-primary"
                  onClick={() => setGuided(false)}
                >
                  Keep exploring <span aria-hidden="true">↗</span>
                </button>
                <button
                  type="button"
                  className="dq-text-button"
                  onClick={restart}
                >
                  Restart expedition
                </button>
              </div>
            </div>
          ) : (
            <div className="dq-content">
              <div className="dq-objective">
                <span className="dq-eyebrow">
                  EXPERIMENT 0{mission + 1} / 03
                </span>
                <h2>
                  {
                    [
                      "The same heartbeat, somewhere new.",
                      "Where does the second rise go?",
                      "A faster rhythm. A shorter cycle.",
                    ][mission]
                  }
                </h2>
                <p>
                  {
                    [
                      "Choose each site here or on the body. Watch the contour and modeled arrival delay change while heart rate stays the same.",
                      "Keep the site and other settings fixed. Save a young reference, then compare it with an older setting. Single beat + Labels makes the contour easier to study.",
                      "Raise heart rate to 120 bpm or more. In Live stream, look for more beats inside the same five-second window.",
                    ][mission]
                  }
                </p>
                {mission === 0 && (
                  <div className="dq-site-stops" aria-label="Sites to discover">
                    {STOPS.map((stop) => (
                      <button
                        type="button"
                        key={stop.id}
                        aria-pressed={site === stop.id}
                        onClick={() => {
                          onSite(stop.id);
                          setVisited((current) =>
                            current.includes(stop.id)
                              ? current
                              : [...current, stop.id],
                          );
                        }}
                      >
                        <Check done={visited.includes(stop.id)} />
                        <span className="dq-stop-label">
                          <b>{stop.label}</b>
                          <small>{stop.location}</small>
                        </span>
                        <span className="dq-sr-only">
                          {visited.includes(stop.id)
                            ? ", visited"
                            : ", not yet visited"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {mission === 0 && (
                  <p className="dq-status" role="status">
                    {visited.length} of 3 sites discovered
                    {visited.length === 3
                      ? " · Ready for the next experiment."
                      : ". Take a moment with each trace."}
                  </p>
                )}
                {mission === 0 && (
                  <button
                    type="button"
                    className="dq-primary"
                    disabled={visited.length < 3}
                    onClick={() => setMission(1)}
                  >
                    Explore reflection <span aria-hidden="true">→</span>
                  </button>
                )}
                {mission === 1 && (
                  <ul
                    className="dq-checklist"
                    aria-label="Reflection experiment checklist"
                  >
                    <li>
                      <Check done={Boolean(captured)} />
                      <span>Capture a finger baseline at age 25–30.</span>
                    </li>
                    <li>
                      <Check done={oldReady} />
                      <span>
                        Compare at age 65+ with the other settings fixed.
                      </span>
                    </li>
                    <li>
                      <Check
                        done={ageObserved && agePrediction === "earlier"}
                      />
                      <span>Explain the change in the second rise.</span>
                    </li>
                  </ul>
                )}
                {mission === 2 && (
                  <div className="dq-cycle-readout">
                    <span>ONE CARDIAC CYCLE</span>
                    <strong>
                      {(60 / physiology.heartRate).toFixed(2)} <small>s</small>
                    </strong>
                    <span>60 ÷ {Math.round(physiology.heartRate)} bpm</span>
                  </div>
                )}
              </div>

              {mission > 0 && (
                <div className="dq-experiment">
                  <fieldset className="dq-prediction">
                    <legend>
                      {mission === 1
                        ? "Predict the older contour"
                        : "Predict the faster stream"}
                    </legend>
                    {(mission === 1
                      ? [
                          {
                            value: "earlier",
                            label: "Earlier reflection; a less distinct notch.",
                          },
                          {
                            value: "later",
                            label: "Later reflection; a deeper notch.",
                          },
                        ]
                      : [
                          {
                            value: "shorter",
                            label: "Shorter cycles; beats closer together.",
                          },
                          {
                            value: "taller",
                            label: "The same timing; only taller peaks.",
                          },
                        ]
                    ).map((choice) => (
                      <label key={choice.value} className="dq-choice">
                        <input
                          type="radio"
                          name={`${id}-${mission}`}
                          value={choice.value}
                          checked={
                            (mission === 1 ? agePrediction : ratePrediction) ===
                            choice.value
                          }
                          onChange={() =>
                            mission === 1
                              ? setAgePrediction(
                                  choice.value as "earlier" | "later",
                                )
                              : setRatePrediction(
                                  choice.value as "shorter" | "taller",
                                )
                          }
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </fieldset>

                  {mission === 1 ? (
                    <>
                      <div className="dq-actions dq-experiment-actions">
                        <button
                          type="button"
                          className="dq-secondary"
                          onClick={prepareYoung}
                        >
                          1. Prepare age 25
                        </button>
                        <button
                          type="button"
                          className="dq-secondary"
                          disabled={!youngReady}
                          onClick={() => {
                            setCaptureRequested(true);
                            onCapture();
                          }}
                        >
                          2. Capture baseline
                        </button>
                        <button
                          type="button"
                          className="dq-secondary"
                          disabled={!captured || !baselineVisible}
                          onClick={() => {
                            onSite("finger");
                            onPrepare({ ...captured!, age: 70 });
                            setAgeObserved(false);
                          }}
                        >
                          3. Try age 70
                        </button>
                      </div>
                      {captured && !baselineVisible && (
                        <p className="dq-status" role="status">
                          Restore the young comparison: prepare age 25 and
                          capture it again.
                        </p>
                      )}
                      <label
                        className={`dq-observed${!oldReady ? " is-unavailable" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={ageObserved && oldReady}
                          disabled={!oldReady}
                          onChange={(event) =>
                            setAgeObserved(event.target.checked)
                          }
                        />
                        <span>
                          I compared the current contour with the saved
                          baseline.
                        </span>
                      </label>
                      <div className="dq-feedback" role="status">
                        {ageObserved && agePrediction ? (
                          <p>
                            {agePrediction === "earlier"
                              ? "You found the relationship. "
                              : "Look at the timing of the reflected rise, then revise your prediction. "}
                            This schematic model brings reflection earlier and
                            blends the notch as age rises. Real PPG varies; this
                            is not a universal patient prediction.
                          </p>
                        ) : (
                          <p>
                            Make a prediction, run the comparison, then check
                            what you observed.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="dq-primary"
                        disabled={!ageComplete}
                        onClick={toRhythm}
                      >
                        Explore rhythm <span aria-hidden="true">→</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="dq-actions dq-experiment-actions">
                        <button
                          type="button"
                          className="dq-secondary"
                          onClick={() => {
                            onSite("finger");
                            onPrepare({
                              ...(captured ?? YOUNG),
                              heartRate: 120,
                            });
                            setRateObserved(false);
                          }}
                        >
                          Try 120 bpm
                        </button>
                        <span className="dq-status">
                          Or use the heart-rate dial.
                        </span>
                      </div>
                      <label
                        className={`dq-observed${!rateReady ? " is-unavailable" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={rateObserved && rateReady}
                          disabled={!rateReady}
                          onChange={(event) =>
                            setRateObserved(event.target.checked)
                          }
                        />
                        <span>I compared the timing at 120 bpm or more.</span>
                      </label>
                      <div className="dq-feedback" role="status">
                        {rateObserved && ratePrediction ? (
                          <p>
                            {ratePrediction === "shorter"
                              ? "Exactly: the period shrinks. "
                              : "Revisit the spacing, then revise your prediction. "}
                            A cycle lasts 60 ÷ heart rate seconds: 0.83 s at 72
                            bpm and 0.50 s at 120 bpm. Faster beats mainly
                            shorten the diastolic interval in this model;
                            amplitude alone does not tell you heart rate.
                          </p>
                        ) : (
                          <p>
                            Use Live stream to compare beat spacing. The readout
                            shows cycle duration even when Single beat is
                            selected.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="dq-primary"
                        disabled={!rateComplete}
                        onClick={() => setMission(3)}
                      >
                        Complete expedition <span aria-hidden="true">✓</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="dq-footnote">
            A schematic teaching model. Explore relationships, not clinical
            predictions.
          </div>
        </>
      )}
    </section>
  );
}
