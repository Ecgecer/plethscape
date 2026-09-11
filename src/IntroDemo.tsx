import { useEffect, useRef, useState } from 'react';

const captions = [
  ['Meet your pulse.', 'Explore the body behind the signal.'],
  ['At the wrist · Green', 'A closer look at the resting pulse.'],
  ['At the wrist · Infrared', 'Different light. A different contour.'],
  ['Now start running.', 'Movement changes the signal.'],
  ['At the finger · Green', 'A ring sees another perspective.'],
  ['One body. Many perspectives.', 'Explore it from every angle.'],
];
export default function IntroDemo({ ready, replay, onStep, onFinish, onCancel }: {
  ready: boolean; replay: number; onStep: (step: number) => void; onFinish: () => void; onCancel: () => void;
}) {
  const [step, setStep] = useState<number | null>(null);
  const [staticIntro, setStaticIntro] = useState(false);
  const callbacks = useRef({ onStep, onFinish, onCancel });
  callbacks.current = { onStep, onFinish, onCancel };
  const interacted = useRef(false);
  const isReady = useRef(ready);
  isReady.current = ready;
  const started = useRef(false);
  const lastReplay = useRef(replay);
  const stopRef = useRef<(settle: boolean) => void>(() => {});
  useEffect(() => {
    const cancel = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.intro-demo')) return;
      if (!isReady.current && !(event.target instanceof Element && event.target.closest("button, select, input, a"))) return;
      interacted.current = true;
      stopRef.current(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key !== 'Tab') cancel(event); };
    document.addEventListener('pointerdown', cancel, true);
    document.addEventListener('wheel', cancel, { capture: true, passive: true });
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', cancel, true); document.removeEventListener('wheel', cancel, true); document.removeEventListener('keydown', key, true); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const manual = replay !== lastReplay.current;
    lastReplay.current = replay;
    if (started.current && !manual) return;
    if (!manual) {
      const params = new URLSearchParams(location.search);
      const sharedExperiment = ['site', 'age', 'wavelength', 'activity', 'state'].some(key => params.has(key));
      if (interacted.current || sharedExperiment) return;
    }
    started.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let active = true;
    const stop = (settle: boolean) => {
      if (!active) return;
      active = false;
      timers.forEach(clearTimeout);
      setStep(null); setStaticIntro(false);
      if (settle) callbacks.current.onFinish();
      else callbacks.current.onCancel();
    };
    stopRef.current = stop;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStaticIntro(true);
    } else {
      setStep(0); callbacks.current.onStep(0);
      [1200, 2800, 4200, 5700, 7200].forEach((delay, index) => timers.push(setTimeout(() => {
        setStep(index + 1); callbacks.current.onStep(index + 1);
      }, delay)));
      timers.push(setTimeout(() => stop(true), 10800));
    }
    const visibility = () => { if (document.hidden) stop(true); };
    document.addEventListener('visibilitychange', visibility);
    return () => { timers.forEach(clearTimeout); document.removeEventListener('visibilitychange', visibility); stopRef.current = () => {}; };
  }, [ready, replay]);
  if (step === null && !staticIntro) return null;
  return <aside className="intro-demo" aria-label="Introduction demo">
    <div className="intro-demo-top"><span>ILLUSTRATIVE SIMULATION</span><button onClick={() => stopRef.current(true)}>{staticIntro ? 'Explore' : 'Skip demo'} <span aria-hidden="true">×</span></button></div>
    <div aria-live="polite" aria-atomic="true"><strong>{staticIntro ? 'One heartbeat. Many ways to see it.' : captions[step!][0]}</strong><p className={staticIntro ? "" : "intro-demo-description"}>{staticIntro ? 'Choose a wearable, change the light, and explore how movement affects the signal.' : captions[step!][1]}</p></div>
    {!staticIntro && <div className="intro-demo-progress" aria-hidden="true">{captions.map((_, index) => <i key={index} className={index <= step! ? 'complete' : ''} />)}</div>}
  </aside>;
}
