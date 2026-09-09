import { SiteChoiceLesson } from "./SiteChoiceLesson";
import { transitionMotion } from "./locomotion";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode, SetStateAction } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle,
  Circle,
  Drop,
  Fingerprint,
  Footprints,
  Info,
  Lightbulb,
  LinkSimple,
  Pause,
  PersonSimple,
  PersonSimpleRun,
  PersonSimpleWalk,
  Play,
  SlidersHorizontal,
  Stack,
  WaveSine,
  X,
} from "@phosphor-icons/react";
import Waveform from "./Waveform";
import SiteSelector from "./SiteSelector";
import RhythmLab from "./RhythmLab";
import { getRhythm, RHYTHMS, type Rhythm } from "./rhythm";
import FiducialGuide from "./FiducialGuide";
import type { FiducialId } from "./fiducials";
import RecentBeats from "./RecentBeats";
import LivePhysiology from "./LivePhysiology";
import ExperienceGuide, { type ExperienceMode } from "./ExperienceGuide";
import {
  captureBeat,
  siteDelay,
  DEFAULT_PHYSIOLOGY,
  SITES,
  getMetrics,
} from "./simulation";
import type { CapturedBeat, Activity, Physiology, SiteId } from "./simulation";
import type { Layers } from "./AnatomyViewer";
import { DEVICES, isWearableSite } from "./devices";

import type { Wavelength } from "./optics";
const SensorCutaway = lazy(() => import("./SensorCutaway"));
const SignalStudio = lazy(() => import("./SignalStudio"));
const AnatomyViewer = lazy(() => import("./AnatomyViewer"));
const INITIAL_LAYERS: Layers = {
  body: true,
  arteries: true,
  veins: true,
  nerves: true,
  skeleton: true,
  lungs: true,
  flow: true,
  muscles: true,
};
type Baseline = { physiology: Physiology; site: SiteId };
type Dialog = "learn" | "sources" | "guide" | null;

function RangeControl({
  label,
  value,
  onChange,
  minLabel,
  maxLabel,
  description,
  min = 0,
  max = 100,
  unit = "%",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  minLabel: string;
  maxLabel: string;
  description: string;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <label className="range-control">
      <div>
        <span>
          {label}
          <span className="info-tip" title={description}>
            <Info size={13} />
          </span>
        </span>
        <output>
          {Math.round(value)}
          <small>{unit}</small>
        </output>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range-value": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
      <span className="range-labels">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </span>
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
  open = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
  open?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      className={`modal ${wide ? "wide" : ""} ${drawer ? "learning-drawer" : ""}`}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export default function App() {
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [physiology, setPhysiologyState] = useState<Physiology>({
    ...DEFAULT_PHYSIOLOGY,
    age: 32,
    heartRate: 72,
  });
  const [streamWindow, setStreamWindow] = useState<number | null>(null);
  const [captured, setCaptured] = useState<CapturedBeat | null>(null);
  const [studioView, setStudioView] = useState<"sensor" | "body">("sensor");
  const [wavelength, setWavelength] = useState<Wavelength>("green");
  const [opticalStage, setOpticalStage] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.2);
  const playback = useRef<{ start: number; end: number; speed: number } | null>(
    null,
  );
  const studioTrigger = useRef<HTMLButtonElement>(null);
  const [inspectRequest, setInspectRequest] = useState<{
    site: SiteId;
    nonce: number;
  } | null>(null);
  const [site, setSite] = useState<SiteId>("wrist");
  const [layers, setLayers] = useState<Layers>(INITIAL_LAYERS);
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<"stream" | "beat">("stream");
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [siteLessonOpen, setSiteLessonOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [changeNote, setChangeNote] = useState(
    "Choose a location or move a slider. The pulse responds immediately.",
  );
  const [lesson, setLesson] = useState<number | null>(null);
  const [motionExpanded, setMotionExpanded] = useState(false);
  const [annotate, setAnnotate] = useState(true);
  const [selectedFiducial, setSelectedFiducial] = useState<FiducialId>("sp");
  const [experience, setExperience] = useState<ExperienceMode>("explore");
  const [toolsOpen, setToolsOpen] = useState(false);
  const viewOptionsTrigger = useRef<HTMLButtonElement>(null);
  const closeTools = () => {
    setToolsOpen(false);
    viewOptionsTrigger.current?.focus();
  };
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolsOpen(false);
        viewOptionsTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolsOpen]);
  const [visited, setVisited] = useState<SiteId[]>([]);
  const [anatomyReady, setAnatomyReady] = useState(false);
  const [pulseStart, setPulseStart] = useState<number | null>(null);
  const clock = useRef({ time: 8, running: true });
  const setPhysiology = (update: SetStateAction<Physiology>) => {
    const time = clock.current.time;
    setPhysiologyState((previous) => {
      const next = typeof update === "function" ? update(previous) : update;
      return {
        ...next,
        motionHistory: transitionMotion(
          time,
          previous.activity,
          next.activity,
          previous.motionHistory,
        ),
      };
    });
  };

  const selected = SITES.find((s) => s.id === site)!;
  const metrics = getMetrics(physiology, site);
  // Prominence is a percentage of the clean systolic peak, not a 0–1 score.
  // These descriptors summarize this visualization; they are not clinical cutoffs.
  const notchLabel =
    metrics.notchProminence >= 10
      ? "Distinct"
      : metrics.notchProminence >= 2
        ? "Subtle"
        : "Reduced";
  const update = (key: keyof Physiology, value: number | Activity) => {
    const notes: Partial<Record<keyof Physiology, string>> = {
      age: "Age changes the reflected component and notch in this teaching model. Compare with a saved reference.",
      heartRate:
        "Heart rate changes the spacing between pulses. Breathing adds gentle variation around the mean.",
      respiratoryRate:
        "Breathing changes pulse spacing, height and baseline in the live sinus stream.",
      stiffness:
        "Stiffness changes reflection timing and how the later rise blends with the main peak.",
      perfusion:
        "Perfusion changes pulse amplitude. The chart keeps the same vertical scale.",
      noise: "Sensor noise adds small disturbances to the live signal.",
    };
    setChangeNote(notes[key] ?? "The simulation has updated.");
    setPhysiology((p) => ({ ...p, [key]: value }));
  };
  const chooseSite = (id: SiteId) => {
    setChangeNote(
      `${SITES.find((s) => s.id === id)?.name}: compare this site’s pulse shape and modeled arrival time with a saved reference.`,
    );
    setSite(id);
    setVisited((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setPulseStart(null);
  };
  const selectRhythm = (rhythm: Rhythm) => {
    setPhysiology((p) => ({ ...p, rhythm, pulseDeficit: false }));
    setMode("stream");
    setPulseStart(null);
    setRunning(true);
  };
  const closeStudio = () => {
    setCaptured(null);
    playback.current = null;
    setRunning(true);
    studioTrigger.current?.focus();
  };
  const openStudio = () => {
    const beat = captureBeat(clock.current.time, physiology);
    const end =
      beat.end + Math.max(...SITES.map((s) => siteDelay(physiology, s.id)));
    setCaptured(beat);
    setStudioView("sensor");
    setPlaybackSpeed(0.2);
    playback.current = { start: beat.start, end, speed: 0.2 };
    clock.current.time = beat.start;
    clock.current.running = false;
    setRunning(false);
    setPulseStart(null);
    setToolsOpen(false);
  };
  const seekStudio = (time: number) => {
    clock.current.time = time;
    clock.current.running = false;
    setRunning(false);
  };
  const changeExperience = (next: ExperienceMode) => {
    if (captured) closeStudio();
    setExperience(next);
    if (next !== "explore") setPulseStart(null);
    setToolsOpen(false);
    if (next === "understand")
      setMode(getRhythm(physiology.rhythm) === "sinus" ? "beat" : "stream");
    else if (next === "explore") setMode("stream");
  };
  const followPulse = () => {
    chooseSite("wrist");
    setPhysiology({
      ...DEFAULT_PHYSIOLOGY,
      age: 32,
      heartRate: 72,
      activity: "rest",
    });
    setMode("stream");
    setLayers(INITIAL_LAYERS);
    setRunning(true);
    setPulseStart(clock.current.time);
  };
  const reset = () => {
    setPhysiology({ ...DEFAULT_PHYSIOLOGY, age: 32, heartRate: 72 });
    setSite("wrist");
    setBaseline(null);
    setLesson(null);
    setChangeNote(
      "Reset to the wrist at rest. Choose a location or move a slider to explore.",
    );
    setMode("stream");
    setLayers(INITIAL_LAYERS);
    setMotionExpanded(false);
    setRunning(true);
  };

  useEffect(() => {
    clock.current.running = running;
  }, [running]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 0.08);
      last = now;
      if (clock.current.running && !document.hidden) {
        const replay = playback.current;
        clock.current.time += elapsed * (replay?.speed ?? 1);
        if (replay && clock.current.time > replay.end)
          clock.current.time =
            replay.start +
            ((clock.current.time - replay.start) % (replay.end - replay.start));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  const activity = (value: Activity) => {
    setChangeNote(
      "Movement presets change the mean heart rate and add motion artifacts. You can adjust the rate independently.",
    );
    setPhysiology((p) => ({
      ...p,
      activity: value,
      heartRate: value === "rest" ? 72 : value === "walk" ? 98 : 142,
      respiratoryRate: value === "rest" ? 16 : value === "walk" ? 22 : 30,
    }));
    if (value !== "rest") setMotionExpanded(true);
  };
  const lessons = [
    {
      title: "A pulse is more than a peak",
      tag: "01 · Waveform anatomy",
      body: "Follow the systolic upstroke, dicrotic notch and diastolic wave through a single cardiac cycle.",
      action: () => {
        reset();
        setMode("beat");
        setPhysiology((p) => ({ ...p, age: 25, stiffness: 15, noise: 0 }));
      },
    },
    {
      title: "Watch a pulse grow older",
      tag: "02 · Age & arterial stiffness",
      body: "Compare a young baseline with an older virtual subject. Notice how the later features merge.",
      action: () => {
        const young = {
          ...DEFAULT_PHYSIOLOGY,
          age: 25,
          heartRate: 72,
          stiffness: 20,
          noise: 0,
        };
        setSite("finger");
        setBaseline({ physiology: young, site: "finger" });
        setPhysiology({ ...young, age: 75 });
        setMode("beat");
      },
    },
    {
      title: "Same heart. A different signal.",
      tag: "03 · Sensing location",
      body: "Hold a finger baseline, then compare the wrist. Explore differences in pulse arrival and shape.",
      action: () => {
        const p = { ...DEFAULT_PHYSIOLOGY, age: 32, heartRate: 72 };
        setBaseline({ physiology: p, site: "finger" });
        setPhysiology(p);
        setSite("wrist");
        setMode("stream");
      },
    },
    {
      title: "When movement enters the signal",
      tag: "04 · Motion artifacts",
      body: "Start walking and compare PPG with acceleration. Motion can obscure the cardiac pulse.",
      action: () => {
        const p = { ...DEFAULT_PHYSIOLOGY, age: 32, heartRate: 72 };
        setBaseline({ physiology: p, site: "wrist" });
        setPhysiology({ ...p, heartRate: 98, activity: "walk" });
        setSite("wrist");
        setMode("stream");
        setMotionExpanded(true);
      },
    },
  ];

  const physiologyControls = (
    <fieldset className="physiology-controls" disabled={!!captured}>
      {captured && (
        <p className="capture-control-note">
          Return to live to change physiology.
        </p>
      )}
      <section className="physiology-section">
        <div className="panel-heading">
          <h2>
            <SlidersHorizontal size={16} />
            Change the physiology
          </h2>
          <button className="quiet-button" onClick={reset}>
            Reset
          </button>
        </div>
        <p className="panel-description">
          {getRhythm(physiology.rhythm) === "sinus"
            ? "Set a mean heart rate. Breathing adds a natural rhythm around it."
            : "Set the mean ventricular rate. The selected rhythm controls the short and long intervals around it."}
        </p>
        <RangeControl
          label="Age"
          value={physiology.age}
          min={25}
          max={75}
          unit=" years"
          onChange={(n) => update("age", n)}
          minLabel="25"
          maxLabel="75"
          description="Changes the age-dependent pulse contour in this teaching model."
        />
        <RangeControl
          label="Heart rate"
          value={physiology.heartRate}
          min={40}
          max={180}
          unit=" bpm"
          onChange={(n) => update("heartRate", n)}
          minLabel="40"
          maxLabel="180"
          description="Sets the mean rate; the live stream varies around it."
        />
        <RangeControl
          label="Arterial stiffness"
          value={physiology.stiffness}
          onChange={(n) => update("stiffness", n)}
          minLabel="More compliant"
          maxLabel="Stiffer"
          description="An independent educational stiffness control, in addition to the model's age effect. Higher stiffness brings the reflected component earlier."
        />
        <RangeControl
          label="Breathing rate"
          value={physiology.respiratoryRate}
          min={6}
          max={36}
          unit=" / min"
          onChange={(n) => update("respiratoryRate", n)}
          minLabel="6 · Slower"
          maxLabel="36 · Faster"
          description={
            getRhythm(physiology.rhythm) === "sinus"
              ? "Sets lung motion and breathing-related changes in heart rate, pulse height and baseline. Slower breathing strengthens the rhythm variation in this model. Switch to Live stream to see it."
              : "Sets lung motion and gentle modulation of pulse height and baseline. This rhythm example uses its own ventricular timing, without respiratory sinus arrhythmia."
          }
        />
      </section>
      <section className="activity-panel">
        <div>
          <h3>Movement</h3>
        </div>
        <div
          className="activity-options"
          role="group"
          aria-label="Physical activity"
        >
          <button
            aria-pressed={physiology.activity === "rest"}
            className={physiology.activity === "rest" ? "selected" : ""}
            onClick={() => activity("rest")}
          >
            <PersonSimple size={20} />
            <span>Rest</span>
          </button>
          <button
            aria-pressed={physiology.activity === "walk"}
            className={physiology.activity === "walk" ? "selected" : ""}
            onClick={() => activity("walk")}
          >
            <PersonSimpleWalk size={20} />
            <span>Walk</span>
          </button>
          <button
            aria-pressed={physiology.activity === "run"}
            className={physiology.activity === "run" ? "selected" : ""}
            onClick={() => activity("run")}
          >
            <PersonSimpleRun size={20} />
            <span>Run</span>
          </button>
        </div>
        <button
          className="text-button motion-disclosure"
          aria-expanded={motionExpanded}
          onClick={() => setMotionExpanded((m) => !m)}
        >
          {motionExpanded ? "Hide" : "View"} motion signals
          <ArrowDown size={12} className={motionExpanded ? "flipped" : ""} />
        </button>
      </section>{" "}
      <section className="more-settings" aria-label="Advanced Settings">
        <h3>Advanced Settings</h3>
        <p className="panel-description">Perfusion & rhythms</p>
        <RangeControl
          label="Peripheral perfusion"
          value={physiology.perfusion}
          onChange={(n) => update("perfusion", n)}
          minLabel="Lower"
          maxLabel="Higher"
          description="Scales the modeled pulsatile component. This percentage is a simulation setting, not a measured perfusion index."
        />
        <RhythmLab
          physiology={physiology}
          onSelect={selectRhythm}
          onDeficit={(pulseDeficit) => {
            setPhysiology((p) => ({ ...p, pulseDeficit }));
            setMode("stream");
          }}
          onCompare={() => {
            setBaseline({
              physiology: {
                ...physiology,
                rhythm: "sinus",
                pulseDeficit: false,
              },
              site,
            });
            setMode("stream");
          }}
        />{" "}
      </section>
    </fieldset>
  );
  return (
    <div
      className={`app-shell instrument-shell experience-shell experience-${experience} ${captured ? "studio-open" : ""}`}
      data-experience={experience}
    >
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            reset();
            changeExperience("explore");
          }}
          aria-label="Plethscape home"
        >
          <span className="brand-icon">
            <WaveSine size={26} weight="bold" />
          </span>
          <span>
            PLETH<span className="brand-light">SCAPE</span>
            <small>HUMAN PHYSIOLOGY, EXPLORED.</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className="nav-item active"
            aria-current="page"
            onClick={() => {
              if (captured) closeStudio();
              setDialog(null);
            }}
          >
            Workspace
          </button>
          <button className="nav-item" onClick={() => setDialog("guide")}>
            <BookOpen size={18} /> Learn
          </button>
        </nav>
        <div className="header-actions">
          <span className="simulation-badge">
            <span /> SIMULATION
          </span>
        </div>
      </header>

      <main>
        <div className="workspace-heading">
          <div>
            <span className="workspace-kicker">
              ONE BODY · SEVEN SENSING SITES
            </span>
            <h1>
              {captured
                ? "One heartbeat. Every perspective."
                : "One heartbeat. Different places. Different signals."}
            </h1>
            <p>Choose a wearable location and explore what shapes its pulse.</p>
          </div>
          <div className="workspace-tools">
            <button
              ref={studioTrigger}
              className="studio-launch"
              aria-expanded={!!captured}
              disabled={!anatomyReady}
              onClick={
                captured
                  ? closeStudio
                  : () => {
                      openStudio();
                      setStudioView("body");
                    }
              }
            >
              {captured ? "← Back to live" : "Compare sites ↗"}
            </button>
            <button
              ref={viewOptionsTrigger}
              hidden={!!captured}
              className="view-options-button"
              aria-expanded={toolsOpen}
              aria-controls="view-options"
              onClick={() => setToolsOpen((v) => !v)}
            >
              <Stack size={17} /> View options
            </button>
          </div>
        </div>
        <div className="mobile-adjust-bar">
          <label className="mobile-site-picker">
            Wearable location
            <select
              value={site}
              onChange={(e) => chooseSite(e.target.value as SiteId)}
            >
              {SITES.filter((s) => isWearableSite(s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setMobileControlsOpen(true)}
            aria-haspopup="dialog"
          >
            Adjust physiology
          </button>
        </div>
        {mobileControlsOpen && (
          <Modal
            title="Adjust physiology"
            drawer
            onClose={() => setMobileControlsOpen(false)}
          >
            {physiologyControls}
            <button
              className="button primary"
              onClick={() => setMobileControlsOpen(false)}
            >
              See the signal →
            </button>
          </Modal>
        )}
        <div className="lab-workspace">
          <aside
            className="control-rail"
            aria-label="Wearable location and physiology"
          >
            <SiteSelector
              physiology={physiology}
              site={site}
              ready
              onSelect={chooseSite}
              layout="panel"
            />
            {isWearableSite(site) && (
              <section
                className="selected-site-panel"
                aria-label="Selected wearable"
              >
                <div>
                  <strong>{SITES.find((s) => s.id === site)?.name}</strong>
                  <span>
                    {DEVICES[site].name} ·{" "}
                    {running ? "Simulated PPG" : "Paused"}
                  </span>
                </div>
                <div className="selected-device-actions">
                  <button
                    disabled={!anatomyReady}
                    onClick={() =>
                      setInspectRequest({ site, nonce: Date.now() })
                    }
                    aria-label="Inspect device"
                  >
                    Inspect device <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    disabled={!anatomyReady}
                    onClick={openStudio}
                    aria-label="Light and tissue"
                  >
                    Light & tissue <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </section>
            )}
            <div className="desktop-physiology">{physiologyControls}</div>
          </aside>

          <aside
            className="left-panel view-options-panel"
            id="view-options"
            hidden={!toolsOpen}
            aria-label="View options"
          >
            <div className="view-options-heading">
              <strong>Make it your view</strong>
              <button aria-label="Close view options" onClick={closeTools}>
                <X size={18} />
              </button>
            </div>
            <div className="layer-section">
              <div className="panel-heading">
                <h2>
                  <Stack size={16} />
                  Anatomy layers
                </h2>
              </div>
              {(
                [
                  { id: "body", name: "Body outline", color: "body" },
                  { id: "muscles", name: "Muscle anatomy", color: "muscles" },
                  {
                    id: "arteries",
                    name: "Arterial system",
                    color: "arteries",
                  },
                  { id: "flow", name: "Blood flow tracers", color: "flow" },
                  { id: "veins", name: "Venous system", color: "veins" },
                  { id: "nerves", name: "Nervous system", color: "nerves" },
                  { id: "lungs", name: "Breathing lungs", color: "lungs" },
                  {
                    id: "skeleton",
                    name: "Skeleton",
                    color: "skeleton",
                  },
                ] as const
              ).map((l) => (
                <button
                  key={l.id}
                  className="layer-control"
                  role="switch"
                  aria-checked={layers[l.id]}
                  aria-label={l.name}
                  onClick={() => setLayers((p) => ({ ...p, [l.id]: !p[l.id] }))}
                >
                  <span>
                    <i className={`layer-dot ${l.color}`} />
                    {l.name}
                  </span>
                  <span className={`toggle ${layers[l.id] ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
              ))}
            </div>
            <div className="sidebar-note">
              <Info size={15} />
              <p>
                PPG sees blood-volume changes.
                <br />
                Nerves shows the available source structures.
              </p>
            </div>
            <button className="model-link" onClick={() => setDialog("sources")}>
              How this model works
              <ArrowUpRight size={14} />
            </button>
          </aside>

          <section className="body-panel" aria-label="Interactive anatomy">
            <Suspense
              fallback={
                <div className="scene-loading">
                  <span className="loader" />
                  Loading the 3D explorer
                </div>
              }
            >
              <AnatomyViewer
                hideSelector
                hideSiteCard
                inspectRequest={inspectRequest}
                active={!captured || studioView === "body"}
                inspection={!!captured}
                onSensor={openStudio}
                physiology={physiology}
                site={site}
                onSite={chooseSite}
                layers={layers}
                clock={clock}
                running={running}
                onReady={() => setAnatomyReady(true)}
                pulseStart={experience === "explore" ? pulseStart : null}
              />
            </Suspense>
            {captured && studioView === "sensor" && (
              <Suspense
                fallback={
                  <div className="studio-loading">
                    Preparing the optical view…
                  </div>
                }
              >
                <SensorCutaway
                  clock={clock}
                  physiology={physiology}
                  site={site}
                  captured={captured}
                  wavelength={wavelength}
                  stage={opticalStage}
                />
              </Suspense>
            )}
            {captured && (
              <div
                className="studio-view-switch"
                role="group"
                aria-label="Inspection view"
              >
                <button
                  aria-pressed={studioView === "sensor"}
                  onClick={() => setStudioView("sensor")}
                >
                  Inside sensor
                </button>
                <button
                  aria-pressed={studioView === "body"}
                  onClick={() => setStudioView("body")}
                >
                  Whole body
                </button>
              </div>
            )}
            <div className="body-status">
              <span>
                <i className={`status-dot ${running ? "live" : ""}`} />
                {running ? "SIMULATION RUNNING" : "SIMULATION PAUSED"}
              </span>
              <span>
                {captured && studioView === "sensor"
                  ? "ILLUSTRATIVE TISSUE · NOT TO SCALE"
                  : "BODYPARTS3D · REFERENCE ANATOMY"}
              </span>
            </div>
          </section>

          {captured && (
            <Suspense
              fallback={
                <aside className="signal-panel">Preparing the heartbeat…</aside>
              }
            >
              <SignalStudio
                clock={clock}
                physiology={physiology}
                site={site}
                captured={captured}
                end={playback.current!.end}
                running={running}
                speed={playbackSpeed}
                view={studioView}
                wavelength={wavelength}
                stage={opticalStage}
                onSeek={seekStudio}
                onPlay={() => setRunning((v) => !v)}
                onSpeed={(speed) => {
                  setPlaybackSpeed(speed);
                  if (playback.current) playback.current.speed = speed;
                }}
                onSite={chooseSite}
                onView={setStudioView}
                onWavelength={setWavelength}
                onStage={setOpticalStage}
                onClose={closeStudio}
              />
            </Suspense>
          )}
          <aside className="signal-panel" hidden={!!captured}>
            <section className="signal-section">
              <div className="signal-header">
                <div>
                  <span className="section-overline">
                    PHOTOPLETHYSMOGRAPHY · SIMULATED
                  </span>
                  <h2>
                    Your signal{" "}
                    <span className="signal-title-separator">/</span>{" "}
                    {selected.name}
                    <span className="signal-site-dot" />
                  </h2>
                </div>
                <button
                  className={`play-button ${!running ? "paused" : ""}`}
                  onClick={() => setRunning((p) => !p)}
                  aria-label={
                    running ? "Pause simulation" : "Resume simulation"
                  }
                  title={running ? "Pause simulation" : "Resume simulation"}
                >
                  {running ? (
                    <Pause size={16} weight="fill" />
                  ) : (
                    <Play size={16} weight="fill" />
                  )}
                </button>
              </div>
              <div className="signal-meta">
                <span>
                  <span className="mini-lime-dot" />
                  {selected.mode === "reference"
                    ? "Modeled neck pulse reference"
                    : selected.mode === "transmission"
                      ? "Transmissive optical site"
                      : "Reflective optical site"}
                </span>
                <span>125 Hz export</span>
              </div>
              {getRhythm(physiology.rhythm) !== "sinus" && (
                <div className="rhythm-active-badge">
                  {RHYTHMS[getRhythm(physiology.rhythm)].name} · simulated
                </div>
              )}
              <button
                className={`baseline-button ${baseline ? "enabled" : ""}`}
                aria-label={baseline ? undefined : "Save reference"}
                onClick={() =>
                  setBaseline((b) =>
                    b ? null : { physiology: { ...physiology }, site },
                  )
                }
              >
                <span>
                  {baseline ? <CheckCircle size={16} /> : <Stack size={16} />}
                  <span>
                    {baseline
                      ? `Comparing: ${SITES.find((s) => s.id === baseline.site)?.name} · ${baseline.physiology.age}y · ${baseline.physiology.heartRate} bpm · ${RHYTHMS[getRhythm(baseline.physiology.rhythm)].short}`
                      : "Save reference"}
                  </span>
                </span>
                {baseline ? <X size={13} /> : <PlusSmall />}
              </button>
              <div className="signal-chart">
                <Waveform
                  physiology={physiology}
                  site={site}
                  clock={clock}
                  compare={baseline}
                  mode={mode}
                  annotate={annotate}
                  selectedFiducial={selectedFiducial}
                  windowSeconds={
                    streamWindow ??
                    (getRhythm(physiology.rhythm) === "sinus" ? 5 : 10)
                  }
                />
              </div>
              <div className="chart-controls">
                <div className="segmented" aria-label="Waveform display mode">
                  <button
                    className={mode === "stream" ? "selected" : ""}
                    onClick={() => setMode("stream")}
                  >
                    Live stream
                  </button>
                  <button
                    className={mode === "beat" ? "selected" : ""}
                    onClick={() => setMode("beat")}
                  >
                    Single beat
                  </button>
                </div>
                {mode === "beat" ? (
                  <button
                    className={`annotation-button ${annotate ? "active" : ""}`}
                    aria-pressed={annotate}
                    onClick={() => setAnnotate((a) => !a)}
                  >
                    Labels
                  </button>
                ) : (
                  <span className="chart-window">
                    {streamWindow ??
                      (getRhythm(physiology.rhythm) === "sinus" ? 5 : 10)}{" "}
                    s window
                  </span>
                )}
              </div>
              {mode === "stream" && (
                <div className="trace-scale-controls">
                  <label htmlFor="trace-time-window">Time window</label>
                  <select
                    id="trace-time-window"
                    value={
                      streamWindow ??
                      (getRhythm(physiology.rhythm) === "sinus" ? 5 : 10)
                    }
                    onChange={(e) => setStreamWindow(Number(e.target.value))}
                  >
                    <option value={2.5}>2.5 s · closer</option>
                    <option value={5}>5 s</option>
                    <option value={10}>10 s · rhythm</option>
                  </select>
                  <span>Fixed amplitude scale</span>
                </div>
              )}
            </section>

            <p className="signal-change-note" role="status">
              <span>What changed</span>
              {changeNote}
            </p>
            {mode === "stream" && (
              <section
                className="representative-panel"
                aria-label="Representative pulse detail"
              >
                <div className="representative-heading">
                  <h3>A closer look at one pulse</h3>
                  <span>Shared amplitude scale</span>
                </div>
                <div className="representative-chart">
                  <Waveform
                    physiology={physiology}
                    site={site}
                    clock={clock}
                    mode="beat"
                    compare={baseline}
                    annotate
                    selectedFiducial={selectedFiducial}
                  />
                </div>
                <details className="pulse-guide">
                  <summary>Understand the landmarks</summary>
                  <FiducialGuide
                    physiology={physiology}
                    site={site}
                    selected={selectedFiducial}
                    onSelect={setSelectedFiducial}
                  />
                </details>
              </section>
            )}

            {mode === "beat" && annotate && (
              <FiducialGuide
                physiology={physiology}
                site={site}
                selected={selectedFiducial}
                onSelect={setSelectedFiducial}
              />
            )}

            <div className="signal-readouts">
              {" "}
              <LivePhysiology
                physiology={physiology}
                clock={clock}
                representativeBeat={mode === "beat"}
              />
              {mode === "stream" && (
                <RecentBeats
                  clock={clock}
                  physiology={physiology}
                  site={site}
                />
              )}
              <div className="signal-metrics">
                <div>
                  <span title="Illustrative travel delay from cardiac ejection to this site. Excludes ECG pre-ejection time; not a calibrated measurement.">
                    Modeled transit <Info size={11} />
                  </span>
                  <strong>
                    {Math.round(metrics.transitMs)}
                    <small>ms</small>
                  </strong>
                </div>
                <div>
                  <span
                    title={`${metrics.notchProminence}% rebound above a local minimum, relative to the clean systolic peak. Descriptors use a teaching scale, not clinical thresholds.`}
                  >
                    Notch prominence
                  </span>
                  <strong className="metric-word">{notchLabel}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {motionExpanded && !captured && (
          <section className="motion-panel">
            <div className="motion-explanation">
              <span className="section-overline">
                MOTION LAB · EXPERIMENTAL
              </span>
              <h2>Movement leaves a fingerprint.</h2>
              <p>
                Compare the synthetic acceleration axes with the PPG above. The
                wrist-mounted sensor model includes gravity and periodic gait
                motion.
              </p>
              <RangeControl
                label="Sensor noise"
                value={physiology.noise}
                onChange={(n) => update("noise", n)}
                minLabel="Cleaner"
                maxLabel="Noisier"
                description="Adds deterministic sensor noise. Gait artifacts also increase when walking or running."
              />
            </div>
            <div className="accel-plot">
              <div className="accel-heading">
                <h3>Simulated wrist acceleration</h3>
                <span>
                  <i className="axis-x" />X <i className="axis-y" />Y{" "}
                  <i className="axis-z" />Z <small>g</small>
                </span>
              </div>
              <div className="accel-canvas">
                <Waveform
                  physiology={physiology}
                  site={site}
                  clock={clock}
                  mode="accelerometer"
                />
              </div>
            </div>
          </section>
        )}

        <footer className="app-footer">
          <span>
            <span className="footer-brand">PLETHSCAPE</span>
            <i />A little curiosity. A deeper understanding.
          </span>
          <button onClick={() => setDialog("sources")}>
            Educational simulation · Inspired by the Pulse Wave Database
            <ArrowUpRight size={12} />
          </button>
        </footer>
      </main>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={18} />
          {toast}
        </div>
      )}
      {
        <Modal
          open={dialog === "guide"}
          drawer
          title={
            siteLessonOpen
              ? "Choosing your PPG location"
              : "Learn through exploration"
          }
          onClose={() => setDialog(null)}
        >
          {siteLessonOpen && (
            <SiteChoiceLesson
              onBack={() => setSiteLessonOpen(false)}
              onTry={(action) => {
                if (captured) closeStudio();
                const resting = {
                  ...DEFAULT_PHYSIOLOGY,
                  age: 32,
                  heartRate: 72,
                };
                setPhysiology(
                  action === "move"
                    ? {
                        ...resting,
                        activity: "walk",
                        heartRate: 98,
                        respiratoryRate: 22,
                      }
                    : resting,
                );
                setBaseline(
                  action === "compare"
                    ? { physiology: resting, site: "finger" }
                    : null,
                );
                chooseSite("wrist");
                setMode("stream");
                setMotionExpanded(action === "move");
                setRunning(true);
                setDialog(null);
                setChangeNote(
                  action === "compare"
                    ? "Wrist and finger, matched resting settings. Simulated contours illustrate differences, not device accuracy."
                    : action === "move"
                      ? "Walking at the wrist. Compare the live PPG with acceleration; this is an illustrative activity preset."
                      : "Explore the wrist at rest. Everyday wearability is a design goal, not a universal signal-quality ranking.",
                );
              }}
            />
          )}
          <div hidden={siteLessonOpen}>
            <button
              className="site-lesson-feature"
              onClick={() => setSiteLessonOpen(true)}
            >
              <span>FEATURED EXPLORATION · 4 SHORT STEPS</span>
              <strong>Where should you measure your pulse?</strong>
              <span>
                Signal quality meets everyday wearability.{" "}
                <ArrowRight size={18} />
              </span>
            </button>
            <div
              className="learning-modes"
              role="group"
              aria-label="Learning mode"
            >
              {(["explore", "experiment", "understand"] as const).map(
                (item) => (
                  <button
                    key={item}
                    aria-pressed={experience === item}
                    onClick={() => changeExperience(item)}
                  >
                    {item === "explore"
                      ? "Follow a pulse"
                      : item === "experiment"
                        ? "Experiments"
                        : "The science"}
                  </button>
                ),
              )}
            </div>
            <ExperienceGuide
              active={dialog === "guide"}
              ready={anatomyReady}
              mode={experience}
              site={site}
              visited={visited}
              physiology={physiology}
              baseline={baseline}
              clock={clock}
              pulseStart={pulseStart}
              onPulse={() => {
                followPulse();
                setDialog(null);
              }}
              onMode={changeExperience}
              onSite={chooseSite}
              onPrepare={(next, saved) => {
                setPhysiology(next);
                if (saved) setBaseline(saved);
                setMode(next.age === 25 || next.age === 70 ? "beat" : "stream");
                if (next.heartRate === 120) setMode("stream");
                setRunning(true);
              }}
              onWhy={() => changeExperience("understand")}
            />{" "}
            <section
              className="understand-panel"
              hidden={experience !== "understand"}
            >
              <details open>
                <summary>What does PPG actually see?</summary>
                <p>
                  Light enters the skin. A detector measures how much returns or
                  passes through. Blood-volume changes with each heartbeat
                  modulate that light, creating the pulse waveform.
                </p>
              </details>
              <details>
                <summary>Why do different sites look different?</summary>
                <p>
                  The pulse travels through branching arteries. Local vessels,
                  tissue and sensor placement shape the optical signal. The
                  timing and contour here are illustrative, not calibrated
                  measurements.
                </p>
              </details>
              <details>
                <summary>What are the peak and second rise?</summary>
                <p>
                  The systolic peak follows the initial upstroke. Later features
                  reflect interacting forward and reflected waves. A dicrotic
                  notch may be subtle or absent in real PPG; it is not a
                  universal landmark.
                </p>
              </details>
              <details>
                <summary>Why does the rhythm change with breathing?</summary>
                <p>
                  In this virtual subject, heart rate rises gently while
                  breathing in and falls while breathing out. This is
                  respiratory sinus arrhythmia. Breathing also changes pulse
                  height and baseline. The live heart, beat spacing and rate
                  display share one clock; the heart-rate control sets the mean.
                  Try slower breathing in Live stream to make the coupling
                  easier to see.
                </p>
                <p>
                  These are illustrative responses, not a calibrated digital
                  twin of a real person.
                </p>
              </details>
              <details>
                <summary>Why does the shape change with age?</summary>
                <p>
                  This teaching model brings the reflected component earlier as
                  age and stiffness rise, blending the later rise. Real people
                  vary, so age cannot be read directly from a single trace.
                </p>
              </details>
              <div className="understand-links">
                <button onClick={() => setDialog("learn")}>
                  <BookOpen size={17} /> Guided lessons
                </button>
                <button onClick={() => setDialog("sources")}>
                  <Info size={17} /> Model & sources
                </button>
              </div>
            </section>
          </div>
        </Modal>
      }
      {dialog === "learn" && (
        <Modal
          title="A closer look at the pulse"
          onClose={() => setDialog(null)}
          wide
        >
          <p className="modal-intro">
            Four small experiments. A new way to see the physiology behind a
            familiar signal.
          </p>
          <div className="lesson-grid">
            {lessons.map((l, i) => (
              <button
                className="lesson-card"
                key={l.title}
                onClick={() => {
                  l.action();
                  setLesson(i);
                  changeExperience("experiment");
                  setDialog(null);
                }}
              >
                <span>{l.tag}</span>
                <div className={`lesson-art lesson-art-${i}`}>
                  <WaveSine size={58 + i * 5} weight="thin" />
                  {i === 1 && <WaveSine size={74} weight="thin" />}
                  {i === 2 && <Fingerprint size={46} weight="thin" />}
                  {i === 3 && <Footprints size={50} weight="thin" />}
                </div>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
                <span className="lesson-action">
                  Explore lesson
                  <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
          <div className="learning-note">
            <Lightbulb size={20} />
            <p>
              Try <b>Single beat</b> to reveal waveform landmarks. Freeze a
              baseline before changing a setting to compare the two shapes.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "sources" && (
        <Modal
          title="The science behind the signal"
          onClose={() => setDialog(null)}
          wide
        >
          <p className="modal-intro">
            Plethscape is an interactive teaching model. Every waveform shown
            here is synthetic, with parameters chosen to illustrate physiology.
          </p>
          <div className="source-overview">
            <div>
              <Drop size={25} />
              <h3>What PPG measures</h3>
              <p>
                Photoplethysmography tracks optical changes associated with
                pulsatile blood volume in tissue. These plots show the pulsatile
                component in arbitrary units; they are not pressure or ECG
                recordings.
              </p>
            </div>
            <div>
              <Brain size={25} />
              <h3>What the anatomy shows</h3>
              <p>
                Source anatomy from BodyParts3D, with distinct muscles, bones,
                vessels, nerves and organs. The chest cutaway exposes the heart
                and lungs. Our code adds materials, contraction, breathing and
                flow cues; these animations are illustrative.
              </p>
            </div>
          </div>
          <h3 className="modal-subhead">
            Built for understanding, with visible assumptions.
          </h3>
          <ul className="model-assumptions">
            <li>
              <Check size={16} />
              <span>
                Arteries carry blood away from the heart; veins return it. Red
                represents oxygen-rich blood and blue represents oxygen-poor
                blood in this display. Pulmonary arteries are blue and pulmonary
                veins red. Blood is never literally blue.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                Age, stiffness and site change a synthetic pulse shape. The
                dicrotic notch may become less distinct as late features merge.
                These relationships vary between people and recordings.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                The neck/carotid view is a modeled pulse reference. It does not
                imply a conventional optical sensor can isolate blood flow in
                the deep carotid artery.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                Age spans 25–75 years, matching PWDB’s age range. Temple and toe
                are illustrative extensions. Sensor wavelengths, contact
                pressure, skin optics and oxygen saturation are not modeled.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                Blood tracers follow selected vessel routes at an illustrative
                speed. Blood-cell motion is different from the faster
                propagation of an arterial pressure pulse. Neither tracer
                velocity nor lung volume is calibrated.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                The breathing slider drives lung and chest expansion, diaphragm
                movement, and modest respiratory variation in the live PPG. The
                clean single-beat view excludes breathing and sensor artifacts.
                Chest motion is amplified for visibility. Walking, running and
                acceleration are procedural demonstrations; physiological
                adaptation and disease are outside the model.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                The app does not load PWDB subject recordings or reproduce its
                cardiovascular solver. Transit values and knob percentages are
                teaching parameters, not calibrated measurements.
              </span>
            </li>
          </ul>
          <div className="sources-list">
            <a
              href="https://www.innerbody.com/image/cardov.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>Cardiovascular anatomy · Innerbody</b>
                <small>
                  Heart, vessels and the systemic and pulmonary circuits
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
            <a
              href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>BodyParts3D · anatomical geometry</b>
                <small>
                  Database Center for Life Science · 4.0 reference anatomy
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
            <a
              href="https://github.com/ashemag/human-atlas"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>Human Atlas · anatomy explorer reference</b>
                <small>
                  The reference for using detailed BodyParts3D structures
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
            <a
              href="https://doi.org/10.48539/HBM532.KLZD.394"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>Human Reference Atlas · lung anatomy</b>
                <small>
                  Kristen Browne & Heidi Schlehlein · Lung Male v1.4, 2024
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
            <a
              href="https://peterhcharlton.github.io/pwdb/pwdb.html"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>Pulse Wave Database</b>
                <small>
                  Charlton et al. · Virtual healthy subjects and simulated pulse
                  waves
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
            <a
              href="https://github.com/peterhcharlton/pwdb/wiki"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>PWDB documentation</b>
                <small>
                  Dataset structure, methodology and example analyses
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
            <a
              href="https://doi.org/10.1152/ajpheart.00218.2019"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>Modeling arterial pulse waves in healthy aging</b>
                <small>
                  Charlton et al. · American Journal of Physiology, 2019
                </small>
              </span>
              <ArrowUpRight size={18} />
            </a>
          </div>
          <a
            className="text-button"
            href="https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00948/full"
            target="_blank"
            rel="noreferrer"
          >
            Respiratory modulation of PPG · Dehkordi et al., 2018
            <ArrowUpRight size={18} />
          </a>
          <p className="source-footnote">
            BodyParts3D, © The Database Center for Life Science licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC Attribution 4.0 International
            </a>
            . Geometry has been selected, optimized and adapted for animation.
            The source represents an adult male reference; this presentation
            omits reproductive anatomy and does not represent all human
            variation. Lung geometry: Kristen Browne and Heidi Schlehlein, Human
            Reference Atlas Lung Male v1.4 (2024), CC BY 4.0. Lungs are
            registered from a separate anatomical reference; their positioning
            and animation are adaptations. The available nerves do not form a
            complete peripheral nerve network.
          </p>
          <p className="source-footnote">
            Designed for education and exploration. Not a diagnostic tool or a
            validated device simulator.
          </p>
        </Modal>
      )}
    </div>
  );
}

function PlusSmall() {
  return <span className="plus-small">+</span>;
}
