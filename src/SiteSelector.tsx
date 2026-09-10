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

function WearableGlyph({ site }: { site: SiteId }) {
  const shapes: Record<SiteId, React.ReactNode> = {
    wrist: (
      <>
        <path d="M10 8V4.5h8V8m-8 12v3.5h8V20" />
        <rect
          x="7.5"
          y="7.5"
          width="13"
          height="13"
          rx="4"
          fill="currentColor"
          fillOpacity=".1"
        />
        <path d="M11 14h2l1-2 1.5 4 1-2H18" strokeWidth="1.2" />
      </>
    ),
    finger: (
      <>
        <ellipse
          cx="14"
          cy="14"
          rx="8"
          ry="9"
          transform="rotate(-25 14 14)"
          fill="currentColor"
          fillOpacity=".1"
        />
        <ellipse cx="14" cy="14" rx="5" ry="6" transform="rotate(-25 14 14)" />
        <path d="M8 8.5l2 1.5m8 8 2 1" opacity=".5" />
      </>
    ),
    ear: (
      <>
        <path d="M9 6v9.5a5.5 5.5 0 0 0 11 0V7" />
        <path d="M12 6v9.5a2.5 2.5 0 0 0 5 0V7" opacity=".45" />
        <circle cx="9" cy="5.5" r="1.5" fill="currentColor" />
        <path d="M17 7h3" />
      </>
    ),
    forehead: (
      <g transform="rotate(35 14 14)">
        <rect
          x="8.5"
          y="4"
          width="11"
          height="20"
          rx="5.5"
          fill="currentColor"
          fillOpacity=".1"
        />
        <rect x="11" y="7" width="6" height="14" rx="3" opacity=".45" />
        <circle cx="14" cy="14" r="1.5" fill="currentColor" stroke="none" />
      </g>
    ),
    carotid: (
      <>
        <rect
          x="6"
          y="4"
          width="16"
          height="20"
          rx="7"
          strokeDasharray="2 2"
          opacity=".45"
        />
        <rect
          x="9"
          y="7"
          width="10"
          height="14"
          rx="4"
          fill="currentColor"
          fillOpacity=".1"
        />
        <circle cx="14" cy="14" r="2" />
      </>
    ),
    upperarm: (
      <>
        <rect
          x="3"
          y="8"
          width="22"
          height="12"
          rx="5"
          fill="currentColor"
          fillOpacity=".08"
        />
        <rect
          x="10"
          y="6"
          width="8"
          height="16"
          rx="3"
          fill="currentColor"
          fillOpacity=".12"
        />
        <path d="M6 12v4m16-4v4" opacity=".5" />
        <circle cx="14" cy="14" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
    toe: (
      <>
        <ellipse
          cx="14"
          cy="15"
          rx="10"
          ry="6.5"
          fill="currentColor"
          fillOpacity=".1"
        />
        <ellipse cx="14" cy="15" rx="6.5" ry="3.5" />
        <rect
          x="11"
          y="6.5"
          width="6"
          height="5"
          rx="2"
          fill="currentColor"
          fillOpacity=".25"
        />
      </>
    ),
  };
  return (
    <svg
      className="wearable-glyph"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {shapes[site]}
    </svg>
  );
}

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
              <WearableGlyph site={row.id} />
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
