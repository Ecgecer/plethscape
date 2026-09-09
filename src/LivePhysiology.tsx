import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { getCardiacState, type Physiology } from "./simulation";
import { getRhythm, RHYTHMS } from "./rhythm";

interface Props {
  physiology: Physiology;
  clock: RefObject<{ time: number; running: boolean }>;
  representativeBeat: boolean;
}

export default function LivePhysiology(props: Props) {
  const latest = useRef(props);
  const [state, setState] = useState(() =>
    getCardiacState(props.clock.current.time, props.physiology),
  );
  useLayoutEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    let previousTime = NaN;
    let previousPhysiology: Physiology | null = null;
    const update = () => {
      const { clock, physiology } = latest.current;
      if (
        document.hidden ||
        (clock.current.time === previousTime &&
          physiology === previousPhysiology)
      )
        return;
      previousTime = clock.current.time;
      previousPhysiology = physiology;
      setState(getCardiacState(previousTime, physiology));
    };
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="live-physiology"
      aria-label="Live simulated physiology"
      data-testid="live-physiology"
      data-heart-rate={state.heartRate.toFixed(3)}
      data-interval-ms={state.intervalMs.toFixed(3)}
      data-inhaling={state.inhaling}
      data-rhythm={getRhythm(props.physiology.rhythm)}
      data-beat-kind={state.beatKind}
    >
      <div className="live-rhythm">
        <div>
          <span className="vital-label">
            {getRhythm(props.physiology.rhythm) === "sinus"
              ? "Live heart rate"
              : "Ventricular rate"}
          </span>
          <strong data-testid="live-heart-rate">
            {state.heartRate.toFixed(1)}
            <small>bpm</small>
          </strong>
          <span className="vital-context">
            Mean {props.physiology.heartRate} bpm
          </span>
        </div>
        <div className="breath-vital">
          <span className="vital-label">
            {state.inhaling ? "Breathing in" : "Breathing out"}
          </span>
          <strong>
            {props.physiology.respiratoryRate}
            <small>breaths/min</small>
          </strong>
          <span className="breath-meter" aria-hidden="true">
            <i
              style={{
                transform: `scaleX(${0.08 + state.breathExpansion * 0.92})`,
              }}
            />
          </span>
        </div>
      </div>
      <p className="rhythm-caption">
        {props.representativeBeat ? (
          getRhythm(props.physiology.rhythm) === "sinus" ? (
            "Representative beat · switch to Live stream to see variability."
          ) : (
            "Reference contour only · switch to Live stream to study this rhythm."
          )
        ) : (
          <>
            Last beat interval <b>{Math.round(state.intervalMs)} ms</b> ·
            {getRhythm(props.physiology.rhythm) === "sinus"
              ? "breathing shapes the rhythm"
              : `${RHYTHMS[getRhythm(props.physiology.rhythm)].short} · ${state.beatKind} beat (modeled)`}
          </>
        )}
      </p>
    </div>
  );
}
