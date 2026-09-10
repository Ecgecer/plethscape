import { useMemo, useState } from "react";
import { sampleBeat, type Physiology, type SiteId } from "./simulation";
import { OPTICAL_BANDS, type Wavelength } from "./optics";

const bands: Wavelength[] = ["green", "red", "infrared"];
export default function WavelengthComparison({
  physiology,
  site,
}: {
  physiology: Physiology;
  site: SiteId;
}) {
  const [normalized, setNormalized] = useState(false);
  const curves = useMemo(
    () =>
      bands.map((wavelength) => {
        const values = Array.from({ length: 301 }, (_, i) =>
          sampleBeat(i / 300, { ...physiology, wavelength }, site),
        );
        const peak = Math.max(...values);
        const scale = normalized ? peak : 1.8;
        return {
          wavelength,
          path: values
            .map(
              (value, i) =>
                `${i ? "L" : "M"}${32 + i * 1.12},${174 - (value / scale) * 142}`,
            )
            .join(" "),
        };
      }),
    [physiology, site, normalized],
  );
  return (
    <details className="wavelength-comparison">
      <summary>Compare green, red and infrared</summary>
      <p>
        Different wavelengths reveal complementary information from overlapping
        tissue depths. Deeper penetration does not automatically mean a larger
        or more informative pulse.
      </p>
      <div
        className="wavelength-scale"
        role="group"
        aria-label="Wavelength comparison scale"
      >
        <button aria-pressed={!normalized} onClick={() => setNormalized(false)}>
          Amplitude
        </button>
        <button aria-pressed={normalized} onClick={() => setNormalized(true)}>
          Normalized shape
        </button>
      </div>
      <svg
        viewBox="0 0 390 205"
        role="img"
        aria-label={`Three simulated ${site} pulse contours on ${normalized ? "a normalized zero to one" : "a shared zero to 1.8 arbitrary-unit"} scale. Green, red and infrared are overlaid.`}
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <path
              d={`M32 ${174 - v * 142}H368`}
              stroke="#bca184"
              strokeOpacity=".15"
            />
            <text x="5" y={178 - v * 142} fill="#bcad9b" fontSize="10">
              {normalized ? v : (v * 1.8).toFixed(1)}
            </text>
          </g>
        ))}
        {curves.map(({ wavelength, path }, i) => (
          <path
            key={wavelength}
            d={path}
            fill="none"
            stroke={`#${OPTICAL_BANDS[wavelength].color.toString(16)}`}
            strokeWidth="2"
            strokeDasharray={i === 1 ? "6 3" : i === 2 ? "2 3" : undefined}
          />
        ))}
        <text x="32" y="196" fill="#bcad9b" fontSize="10">
          Pulse onset
        </text>
        <text x="368" y="196" textAnchor="end" fill="#bcad9b" fontSize="10">
          One cardiac cycle
        </text>
      </svg>
      <p className="comparison-caption">
        {normalized
          ? "Each pulse is scaled to the same peak height so you can compare its upstroke, notch and secondary peak."
          : "All traces share one amplitude scale. Heights are illustrative arbitrary units, not measured sensor output."}{" "}
        Clean beats are shown here; walking and running artifacts remain in the
        live stream.
      </p>
      <div className="wavelength-depth-key">
        {bands.map((w) => (
          <div key={w}>
            <span style={{ color: `#${OPTICAL_BANDS[w].color.toString(16)}` }}>
              {OPTICAL_BANDS[w].name} · {OPTICAL_BANDS[w].nm}
            </span>
            <span className="depth-track">
              <i
                style={{
                  width: `${(OPTICAL_BANDS[w].depth / 1.65) * 100}%`,
                  background: `#${OPTICAL_BANDS[w].color.toString(16)}`,
                }}
              />
            </span>
          </div>
        ))}
      </div>
      <p>
        Bars illustrate relative sampling depth, not millimeters or isolated
        tissue layers. These contours are teaching examples, not universal
        wavelength signatures.
      </p>
      <a
        href="https://www.cinc.org/archives/2020/pdf/CinC2020-179.pdf"
        target="_blank"
        rel="noreferrer"
      >
        Read the multi-wavelength pulse study ↗
      </a>
    </details>
  );
}
