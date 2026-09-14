import { useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, BookOpen, WaveSine } from '@phosphor-icons/react';
import Waveform from './Waveform';
import { DEFAULT_PHYSIOLOGY, type Activity, type SiteId } from './simulation';
import type { Wavelength } from './optics';
import learningReference from './learningReference.html?raw';
import { SiteChoiceLesson } from './SiteChoiceLesson';

export type LearnTopic = 'pulse' | 'locations' | 'wavelengths' | 'motion';
const topics: { id: LearnTopic; title: string; description: string; question: string; explanation: string; experiment: string }[] = [
  { id: 'pulse', title: 'Read a heartbeat', description: 'Explore the rise, peak and later features of a pulse.', question: 'What can the shape tell us?', explanation: 'PPG uses light to sense changes in blood volume in tissue. The upstroke leads to the systolic peak; later features reflect interacting forward and reflected waves. A notch may be subtle or absent in real recordings.', experiment: 'Open a clean single beat. Compare the initial upstroke with the later rise, then change age to see how the simulated contour changes.' },
  { id: 'locations', title: 'Choose a wearable location', description: 'Compare signal quality with everyday wearability.', question: 'Why does the same heartbeat look different?', explanation: 'Local vessels, tissue and sensor contact shape the optical signal. A useful location balances signal quality, movement, comfort and sustained wear. There is no universal best site for every task.', experiment: 'Compare a resting finger reference with the wrist while keeping the physiology matched.' },
  { id: 'wavelengths', title: 'Explore light and depth', description: 'See what green, red and infrared reveal.', question: 'How does the light change the signal?', explanation: 'Green generally samples shallower tissue. Red and infrared sample deeper, overlapping regions. Greater penetration does not guarantee a larger pulse or more useful information: tissue, contact, sensor geometry and processing also matter.', experiment: 'At the resting wrist, switch between green, red and infrared. Compare the contour as well as its height. These differences are illustrative, not measured device performance.' },
  { id: 'motion', title: 'Understand movement', description: 'Find the heartbeat beneath motion artifacts.', question: 'What happens when you start walking?', explanation: 'Movement can change sensor contact and introduce baseline shifts, impact spikes and temporary signal loss. This simulation gives red and infrared stronger motion artifacts than green as a teaching scenario, not a universal ranking.', experiment: 'Start walking at the wrist and compare the PPG with acceleration. Switch wavelengths, then try running to see how motion can obscure the pulse.' },
];

export default function LearnPage({ ready, onTry, onSources, onLocationTry, onStartTour }: {
  ready: boolean; onTry: (topic: LearnTopic, settings: { band: Wavelength; age: number; activity: Activity; site: SiteId }) => void; onSources: () => void;
  onLocationTry: (action: 'move' | 'compare' | 'wrist') => void;
  onStartTour: () => void;
}) {
  const [chapter, setChapter] = useState<LearnTopic | 'overview' | 'science'>('overview');
  const previewClock = useRef({ time: 12, running: false });
  const [band, setBand] = useState<Wavelength>('green');
  const [activity, setActivity] = useState<Activity>('walk');
  const [age, setAge] = useState(25);
  const [previewSite, setPreviewSite] = useState<SiteId>('wrist');
  const [changed, setChanged] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const select = (next: typeof chapter) => {
    setChapter(next);
    setChanged(false);
    requestAnimationFrame(() => { titleRef.current?.focus(); titleRef.current?.scrollIntoView({ block: 'start' }); });
  };
  const topic = topics.find(item => item.id === chapter);
  const feedback = chapter === 'pulse'
    ? age === 25 ? 'At age 25, look for the later rise after the main peak. Try age 75 and compare how distinct that feature remains.' : `At age ${age}, this model brings the reflected component earlier, so later features blend with the main pulse. This illustrates an age-related trend; it cannot tell you a real person’s age.`
    : chapter === 'locations'
      ? previewSite === 'finger' ? 'You are viewing the finger. Compare its contour with the wrist while age, heart rate and light stay fixed. A different shape alone does not establish better device accuracy.' : previewSite === 'ear' ? 'You are viewing the ear. Local tissue and the pulse’s travel path differ from the wrist. This single-beat view emphasizes contour, rather than comparing absolute arrival times.' : 'You are viewing the wrist. It offers practical everyday wearability. Compare the finger and ear to see how this model represents site-dependent contours.'
      : chapter === 'wavelengths'
        ? band === 'green' ? 'Green is the shallow-sampling reference here. Switch to red or infrared and compare the main peak and later rise on the same amplitude scale.' : `${band === 'red' ? 'Red' : 'Infrared'} represents deeper, overlapping tissue sampling than green. The simulation changes both gain and pulse contour. Deeper sampling does not automatically mean a larger pulse or more useful information.`
        : activity === 'rest' ? 'At rest, the pulse is easier to distinguish. Try walking next while keeping the wavelength fixed, so you can see the effect of movement.' : `${activity === 'run' ? 'Running' : 'Walking'} adds contact and gait artifacts and increases the preset heart rate. ${band === 'infrared' ? 'Infrared has the strongest motion coupling in this teaching model.' : band === 'red' ? 'Red has stronger motion coupling than green in this teaching model.' : 'Green has the least motion coupling in this teaching model, but it is not immune to motion.'} This is an illustrative scenario, not a ranking that holds for every device.`;
  return <div className="learn-layout">
    <label className="learn-mobile-chapters">Chapter
      <select value={chapter} onChange={event => select(event.target.value as typeof chapter)}>
        {[{ id: 'overview', title: 'Start here' }, ...topics, { id: 'science', title: 'The science' }].map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
    <nav className="learn-navigation" aria-label="Learning chapters">
      <span className="learn-eyebrow">YOUR FIELD GUIDE</span>
      {[{ id: 'overview', title: 'Start here' }, ...topics, { id: 'science', title: 'The science' }].map(item =>
        <button key={item.id} aria-current={chapter === item.id ? 'page' : undefined} onClick={() => select(item.id as typeof chapter)}>{item.title}<ArrowRight size={16} /></button>)}
    </nav>
    <div className="learn-content">
      <header className="learn-heading">
        <span className="learn-eyebrow">PLETHSCAPE / LEARN</span>
        <h2 ref={titleRef} tabIndex={-1}>{chapter === 'overview' ? 'Get to know the signal.' : chapter === 'science' ? 'The science behind the pulse.' : topic?.title}</h2>
        <p>{chapter === 'overview' ? 'A heartbeat is only the beginning. Explore how your body, light and movement shape what a wearable sees.' : chapter === 'science' ? 'Understand the physiology, explore the assumptions, and follow the evidence.' : topic?.description}</p>
      </header>
      {topic && <p className="learn-objective"><strong>What you’ll learn</strong> {topic.description}</p>}
      {chapter === 'overview' ? <>
        <button className="learn-primary" disabled={!ready} onClick={onStartTour}>{ready ? 'Start guided tour' : 'Preparing the body…'} <ArrowRight size={18} /></button>
        <div className="learn-topic-grid">{topics.map((item, index) => <button className="learn-topic-card" key={item.id} onClick={() => select(item.id)}>
          <span className="learn-eyebrow">LESSON 0{index + 1}</span><WaveSine size={42} weight="thin" aria-hidden="true" />
          <h3>{item.title}</h3><p>{item.description}</p><span className="learn-card-link">Open lesson <ArrowRight size={18} /></span>
        </button>)}</div>
        <button className="learn-science-link" onClick={() => select('science')}><BookOpen size={24}/><span><strong>Go deeper into the science</strong><span>Model assumptions, references and reading from SensorBio.</span></span><ArrowRight size={20}/></button>
      </> : chapter === 'science' ? <>
        <nav className="learn-science-contents" aria-label="Science contents">
          <strong>In this guide</strong>
          {['What is a PPG signal?', 'Why compare wearable locations?', 'Which location gives the best PPG?', 'How do green, red and infrared PPG differ?', 'Read the shape of a pulse', 'Is this real patient data?'].map(title => <button key={title} onClick={() => {
            const heading = Array.from(document.querySelectorAll<HTMLElement>('.learn-science h3')).find(element => element.textContent === title);
            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'instant' }); }
          }}>{title}</button>)}
        </nav>
        <div className="learn-science" dangerouslySetInnerHTML={{ __html: learningReference }} />
        <button className="learn-primary" onClick={onSources}>View model & sources <ArrowRight size={18}/></button>
      </> : topic && <>
        <div className="learn-lesson-grid">
          <figure className={`learn-illustration learn-illustration-${topic.id}`}>
            <div className="learn-wave-preview"><Waveform
              clock={previewClock}
              physiology={{ ...DEFAULT_PHYSIOLOGY, age: chapter === 'pulse' ? age : 32, wavelength: chapter === 'motion' || chapter === 'wavelengths' ? band : 'green', activity: chapter === 'motion' ? activity : 'rest', heartRate: chapter === 'motion' && activity !== 'rest' ? activity === 'run' ? 130 : 98 : 72 }}
              site={chapter === 'locations' ? previewSite : 'wrist'}
              mode={chapter === 'motion' ? 'stream' : 'beat'}
              compare={chapter === 'locations' ? { physiology: { ...DEFAULT_PHYSIOLOGY, age: 32, heartRate: 72, wavelength: 'green' }, site: 'finger' } : undefined}
              annotate={chapter === 'pulse'}
            /></div>
            <div className="learn-preview-controls" role="group" aria-label="Lesson experiment">
              {(chapter === 'wavelengths' || chapter === 'motion') && (['green', 'red', 'infrared'] as const).map(value => <button key={value} aria-pressed={band === value} onClick={() => { setBand(value); setChanged(true); }}>{value === 'infrared' ? 'Infrared' : value === 'red' ? 'Red' : 'Green'}</button>)}
              {chapter === 'motion' && (['rest', 'walk', 'run'] as const).map(value => <button key={value} aria-pressed={activity === value} onClick={() => { setActivity(value); setChanged(true); }}>{value === 'rest' ? 'Rest' : value === 'walk' ? 'Walking' : 'Running'}</button>)}
              {chapter === 'pulse' && [25, 50, 75].map(value => <button key={value} aria-pressed={age === value} onClick={() => { setAge(value); setChanged(true); }}>Age {value}</button>)}
              {chapter === 'locations' && (['wrist', 'finger', 'ear'] as const).map(value => <button key={value} aria-pressed={previewSite === value} onClick={() => { setPreviewSite(value); setChanged(true); }}>{value === 'wrist' ? 'Wrist' : value === 'finger' ? 'Finger' : 'Ear'}</button>)}
            </div>
            <figcaption>{chapter === 'locations' && <>Purple trace: resting finger reference.<br/></>}Interactive simulation · {chapter === 'motion' ? 'A frozen five-second sample' : 'A single beat on a shared amplitude scale'}<br/>These lesson controls do not change your Workspace.</figcaption>
            <div className="learn-feedback" role="status" aria-live="polite" aria-atomic="true"><strong>{changed ? 'What changed and why' : 'What to look for'}</strong><p>{feedback}</p></div>
          </figure>
          <div className="learn-explanation"><h3>{topic.question}</h3><p>{topic.explanation}</p><h3>Explore one change at a time</h3><p>{topic.experiment}</p><button className="learn-primary" disabled={!ready} onClick={() => onTry(topic.id, { band: chapter === 'motion' || chapter === 'wavelengths' ? band : 'green', age, activity, site: previewSite })}>Try in Workspace <ArrowRight size={18}/></button>{!ready && <p className="learn-note">The interactive anatomy is still loading. You can keep reading.</p>}</div>
        </div>
        {chapter === 'locations' && <SiteChoiceLesson onBack={() => select('overview')} onTry={onLocationTry}/>}
        <div className="learn-lesson-footer"><button onClick={() => select('overview')}><ArrowLeft size={16}/> All lessons</button><button onClick={() => select('science')}>Explore the science <ArrowRight size={16}/></button></div>
      </>}
    </div>
  </div>;
}
