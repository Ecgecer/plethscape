import { useEffect, useMemo, useRef } from "react";
import {
  SITES,
  sampleBeat,
  siteDelay,
  type Physiology,
  type SiteId,
} from "./simulation";
import { DEVICES } from "./devices";

const order: SiteId[] = [
  "wrist",
  "finger",
  "ear",
  "forehead",
  "carotid",
  "upperarm",
  "toe",
];
const names: Record<SiteId, string> = {
  wrist: "Wrist",
  finger: "Finger",
  ear: "Earlobe",
  forehead: "Temple",
  carotid: "Neck",
  upperarm: "Upper arm",
  toe: "Big toe",
};
const wearables: Record<SiteId, string> = {
  wrist: "Wristband",
  finger: "Smart ring",
  ear: "Earring",
  forehead: "Sensor patch",
  carotid: "Sensor patch",
  upperarm: "Bicep band",
  toe: "Toe band",
};

export default function SiteSelector(p: {
  layout?: "panel" | "overlay";
  physiology: Physiology;
  site: SiteId;
  ready: boolean;
  onSelect: (site: SiteId) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => {
    const duration = 60 / p.physiology.heartRate;
    const span =
      duration + Math.max(...SITES.map((s) => siteDelay(p.physiology, s.id)));
    return order.map((id) => {
      const delay = siteDelay(p.physiology, id);
      const path = Array.from({ length: 81 }, (_, i) => {
        const value = sampleBeat(
          ((i / 80) * span - delay) / duration,
          p.physiology,
          id,
        );
        return `${i ? "L" : "M"}${i},${(28 - (value / 1.7) * 24).toFixed(2)}`;
      }).join(" ");
      return { id, delay, path };
    });
  }, [p.physiology]);
  useEffect(() => {
    const element = list.current,
      active = element?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (element && active && element.scrollWidth > element.clientWidth) {
      element.scrollTo({
        left:
          active.offsetLeft -
          element.offsetLeft -
          (element.clientWidth - active.offsetWidth) / 2,
        behavior: "instant",
      });
    }
  }, [p.site]);
  return (
    <div
      className={
        p.layout === "panel"
          ? "site-selector location-selector"
          : "wearable-dock site-selector"
      }
      role="group"
      aria-label="Wearable location"
    >
      <div className="site-selector-heading">
        <span>EXPLORE THE SIGNAL</span>
        <h3>
          Wearable location<span>07</span>
        </h3>
      </div>
      <div className="site-selector-list" ref={list}>
        {rows.map((row) => (
          <button
            key={row.id}
            disabled={!p.ready}
            aria-label={`Select ${DEVICES[row.id].name}`}
            aria-describedby={`site-preview-${row.id}`}
            aria-pressed={p.site === row.id}
            onClick={() => p.onSelect(row.id)}
          >
            <span className="site-selector-icon" aria-hidden="true">
              <i className={`device-icon device-icon-${row.id}`} />
            </span>
            <span className="site-selector-name">
              <strong>{names[row.id]}</strong>
              <small>{wearables[row.id]}</small>
            </span>
            <span className="site-selector-preview" aria-hidden="true">
              <svg viewBox="0 0 80 32">
                <path d="M0 28H80" className="site-preview-axis" />
                <path d={row.path} />
              </svg>
              <small>+{Math.round(row.delay * 1000)} ms</small>
            </span>
            <span className="sr-only" id={`site-preview-${row.id}`}>
              {names[row.id]}. Representative pulse preview,{" "}
              {Math.round(row.delay * 1000)} milliseconds modeled transit.{" "}
              {row.id === "carotid"
                ? "Neck pulse reference."
                : "Simulated PPG."}
            </span>
          </button>
        ))}
      </div>
      <p className="site-selector-note">
        Shared scales · simulated pulses<span>Swipe to explore →</span>
      </p>
    </div>
  );
}
