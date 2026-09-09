import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  Footprints,
  Watch,
  CheckCircle,
} from "@phosphor-icons/react";

const steps = ["Signal", "Movement", "Everyday fit", "Why the wrist"];
export function SiteChoiceLesson({
  onBack,
  onTry,
}: {
  onBack: () => void;
  onTry: (action: "compare" | "move" | "wrist") => void;
}) {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [routine, setRoutine] = useState("Daily life");
  const tryIt = (action: "compare" | "move" | "wrist") => {
    setTried((previous) => [...new Set([...previous, action])]);
    onTry(action);
  };
  return (
    <section
      className="site-choice-lesson"
      aria-label="Choosing a PPG location"
    >
      <button className="site-lesson-back" onClick={onBack}>
        <ArrowLeft size={18} /> All learning
      </button>
      <p className="site-lesson-kicker">THE RIGHT SIGNAL FOR YOUR ROUTINE</p>
      <h3>Where should you measure your pulse?</h3>
      <p className="site-lesson-intro">
        A clear signal matters. So does a device you can comfortably keep
        wearing.
      </p>
      <nav className="site-lesson-steps" aria-label="Location lesson steps">
        {steps.map((label, index) => (
          <button
            key={label}
            aria-current={index === step ? "step" : undefined}
            onClick={() => setStep(index)}
          >
            <span>0{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="site-lesson-content" aria-live="polite">
        {step === 0 && (
          <>
            <Fingerprint size={32} weight="duotone" />
            <h4>Best for seeing what?</h4>
            <p>
              A strong pulse, an accurate heart-rate estimate, and a detailed
              waveform are different goals. A device can estimate heart rate
              without preserving every small contour feature.
            </p>
            <details className="site-evidence">
              <summary>What research found</summary>
              <p>
                In a controlled six-site study, the finger produced the most
                consistently analyzable waveform features. That result describes
                the study’s sensors and conditions—not a universal ranking of
                wearables.
              </p>
              <a
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6412091/"
                target="_blank"
                rel="noreferrer"
              >
                Read the six-site study ↗
              </a>
            </details>
            <button
              className="site-lesson-try"
              onClick={() => tryIt("compare")}
            >
              Compare wrist + finger at rest <ArrowRight size={18} />
            </button>
            <p className="site-lesson-caption">
              Opens the live chart with a finger reference and matched resting
              settings. Traces are synthetic; they do not establish which device
              is more accurate.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <Footprints size={32} weight="duotone" />
            <h4>The person moves. The measurement changes.</h4>
            <p>
              Motion and changing skin contact can distort the optical signal.
              Location alone cannot predict performance: the sensor, its fit,
              and its processing also matter.
            </p>
            <details className="site-evidence">
              <summary>Useful signal is contextual</summary>
              <p>
                A 24-hour wrist study found higher signal quality at night than
                during the day. That supports studying when a signal is usable,
                rather than assuming the same quality all day.
              </p>
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/31100748/"
                target="_blank"
                rel="noreferrer"
              >
                Read the ambulatory wrist study ↗
              </a>
            </details>
            <button className="site-lesson-try" onClick={() => tryIt("move")}>
              Try walking at the wrist <ArrowRight size={18} />
            </button>
            <p className="site-lesson-caption">
              Opens live wrist PPG and acceleration. This teaching preset also
              changes heart and breathing rates; it is not an isolated motion
              experiment or a Sensor Bio performance test.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <Watch size={32} weight="duotone" />
            <h4>Think beyond one minute.</h4>
            <p>
              Which format fits the time you want to measure? Select a routine
              to consider its practical tradeoffs.
            </p>
            <div
              className="site-routines"
              role="group"
              aria-label="Monitoring routine"
            >
              {["Daily life", "Sleep", "Exercise"].map((value) => (
                <button
                  key={value}
                  aria-pressed={routine === value}
                  onClick={() => setRoutine(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="site-routine-note">
              {routine === "Daily life"
                ? "Consider typing, hand washing, work rules, charging, and whether you will keep the device on."
                : routine === "Sleep"
                  ? "Consider overnight comfort, pressure against bedding, fit changes, and charging before bed."
                  : "Consider grip, sweat, impacts, changing contact, and whether the device has been validated for your activity."}
            </p>
            <dl className="site-format-list">
              <div>
                <dt>Wrist band</dt>
                <dd>
                  A familiar format. Consider strap fit, wrist movement, skin
                  comfort, and charging.
                </dd>
              </div>
              <div>
                <dt>Ring</dt>
                <dd>
                  A compact alternative. Consider finger sizing, swelling, grip,
                  and personal preference.
                </dd>
              </div>
              <div>
                <dt>Ear or skin sensor</dt>
                <dd>
                  Consider attachment, adhesives or accessories, visibility, and
                  comfort at that site.
                </dd>
              </div>
            </dl>
            <p className="site-lesson-caption">
              These are design considerations, not measured comfort scores. A
              fingertip clip is not a ring; a forehead sensor is not a temple
              sensor.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <Watch size={32} weight="duotone" />
            <h4>Why Sensor Bio focuses on the wrist</h4>
            <p>
              Our approach prioritizes a familiar wearable format for repeated
              measurements throughout everyday life.
            </p>
            <blockquote>
              Useful physiological information. A device people want to keep
              wearing.
            </blockquote>
            <p>
              The wrist can provide useful PPG signals. Fit, optical design, and
              signal processing help determine their quality. Balancing that
              information with everyday wearability is our design goal.
            </p>
            <div className="site-evidence">
              <b>A design choice, with evidence still to earn</b>
              <p>
                “Best for long-term use” requires comparative wear-time,
                comfort, and signal-quality data. This simulation does not
                establish Sensor Bio accuracy or superiority.
              </p>
            </div>
            <button className="site-lesson-try" onClick={() => tryIt("wrist")}>
              Explore the wrist at rest <ArrowRight size={18} />
            </button>
          </>
        )}
      </div>
      {tried.length > 0 && (
        <p className="site-lesson-progress">
          <CheckCircle size={18} /> {tried.length} of 3 hands-on examples opened
        </p>
      )}
      <div className="site-lesson-navigation">
        <button disabled={step === 0} onClick={() => setStep(step - 1)}>
          Previous
        </button>
        <span>{step + 1} / 4</span>
        <button onClick={() => (step < 3 ? setStep(step + 1) : onBack())}>
          {step < 3 ? "Next" : "Finish"} <ArrowRight size={16} />
        </button>
      </div>
      <p className="site-lesson-caption">
        Examples return you to the workspace. Reopen Learn to continue here.
      </p>
    </section>
  );
}
