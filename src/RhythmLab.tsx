import { getRhythm, isVentricular, RHYTHMS, type Rhythm } from "./rhythm";
import type { Physiology } from "./simulation";

type Props = {
  physiology: Physiology;
  onSelect: (rhythm: Rhythm) => void;
  onDeficit: (value: boolean) => void;
  onCompare: () => void;
};
export default function RhythmLab({
  physiology,
  onSelect,
  onDeficit,
  onCompare,
}: Props) {
  const rhythm = getRhythm(physiology.rhythm),
    info = RHYTHMS[rhythm];
  return (
    <details className="rhythm-lab">
      <summary>
        <span>Rhythm & conditions</span>
        <small>{info.short}</small>
      </summary>
      <p className="rhythm-intro">
        Change the rhythm. Watch how the pulse responds.
      </p>
      <div
        className="rhythm-options"
        role="group"
        aria-label="Simulated rhythm"
      >
        {(Object.keys(RHYTHMS) as Rhythm[]).map((id) => (
          <button
            key={id}
            aria-pressed={rhythm === id}
            onClick={() => onSelect(id)}
          >
            <b>{RHYTHMS[id].short}</b>
            <span>
              {id === "sinus"
                ? "Reference rhythm"
                : id === "afib"
                  ? "Irregularly irregular"
                  : id === "pac"
                    ? "Atrial ectopic beats"
                    : id === "pvc"
                      ? "Ventricular ectopic beats"
                      : id === "bigeminy"
                        ? "Every second beat"
                        : "Every third beat"}
            </span>
          </button>
        ))}
      </div>
      <div className="rhythm-explanation" aria-live="polite" aria-atomic="true">
        <h3>{info.name}</h3>
        <p className="rhythm-watch">{info.watch}</p>
        <p>{info.explanation}</p>
        {rhythm !== "sinus" && (
          <p className="rhythm-model-note">
            Teaching example ·{" "}
            {rhythm === "pac" || rhythm === "pvc"
              ? "one premature beat in each six-beat sequence. "
              : ""}
            The rate control sets the mean ventricular rate; watch multiple
            beats in the 10-second live window.
          </p>
        )}
      </div>
      {isVentricular(rhythm) && (
        <div className="deficit-control">
          <label>
            <input
              type="checkbox"
              checked={!!physiology.pulseDeficit}
              onChange={(e) => onDeficit(e.target.checked)}
            />
            <span>Show a weak peripheral pulse</span>
          </label>
          <p>
            The heart still contracts, but the premature optical pulse becomes
            faint. A wearable may undercount these beats: a{" "}
            <a
              href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8441208/"
              target="_blank"
              rel="noreferrer"
            >
              pulse deficit
            </a>
            .
          </p>
        </div>
      )}
      {rhythm !== "sinus" && (
        <button className="rhythm-compare" onClick={onCompare}>
          Compare with sinus rhythm
        </button>
      )}
      <details className="rhythm-science">
        <summary>What can PPG tell us?</summary>
        <p>
          PPG records a peripheral blood-volume pulse, not electrical
          activation. Ectopic beats and motion can resemble AFib. These presets
          are examples, not diagnostic signatures; ECG is needed to confirm a
          rhythm and distinguish PACs from PVCs.
        </p>
        <p>
          <a href={info.source} target="_blank" rel="noreferrer">
            Research behind this pattern ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/35463751/"
            target="_blank"
            rel="noreferrer"
          >
            PPG and ECG comparison study ↗
          </a>
        </p>
        <p>
          Single beat remains a clean reference contour. Use Live stream to
          study irregular intervals and pulse-to-pulse changes.
        </p>
      </details>
    </details>
  );
}
