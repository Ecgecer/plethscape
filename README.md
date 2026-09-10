# Plethscape

A standalone, interactive 3D physiology lab built with React, TypeScript, Three.js and Vite. Select an anatomical sensing site, change the virtual subject, and watch the synthetic PPG respond.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

```sh
npm run build       # TypeScript validation and production output in dist/
npm run preview     # Serve the production build
npm test            # Signal-model invariants and morphology tests
npm run test:e2e    # Browser interaction and layout checks; starts/reuses the dev server
```

## Explore

- Start in **Workspace** at the wristband. **Wearable location** and native physiology sliders sit on the left, anatomy in the center, and the largest panel contains a live PPG stream plus a labeled representative beat. Desktop panels scroll independently so controls do not displace the signal.
- **Learn** opens a lesson picker. **Start guided tour** closes it and places a compact five-step card beside the waveform: follow, location, age, rate and breathing. Controls remain interactive, relevant controls are outlined, and each comparison has a saved reference. Back, Next, Exit and optional explanations keep the tour flexible.
- **View options** contains anatomy layer controls and model sources. Site selection stays in the main workspace.
- Tap a physical wearable or use the **Wearable location** selector to select its live simulated signal and gently frame the surrounding anatomy. The wrist is framed on first load. Nearby source-vessel flow trails brighten and the selected halo follows the heartbeat. An amber halo, selected equipment button and compact sensor card confirm the active site. Choose **Inspect device** explicitly for a close-up. The ring, textile-covered wristband, black huggie earring, amber temple capsule, neck patch, bicep band and black toe band are built entirely with custom geometry and procedural materials. Orbit each close-up; **Full body** returns to the atlas. Attachments follow the same arm motion as the anatomy. **Optical side** isolates the device and reveals its underside; **On body** restores the fitted view.
- Orbit and zoom detailed reference anatomy presented without reproductive structures; select sites on the body or in the site list.
- Pinch or scroll over any body region to zoom toward it. Two-finger drag or right-drag pans the view; Reset camera returns to the full body.
- Toggle the body, muscles, arteries, blood-flow trails, veins, available nervous structures, breathing lungs and skeleton independently. The presentation uses one orange anatomical view; open or close the chest cutaway.
- Compare finger, wrist, ear, temple, neck/carotid reference, upper arm and toe.
- Drag the age, mean heart-rate, stiffness and breathing-rate sliders; arrow keys adjust by one and Home/End go to the bounds. Movement presets remain beside the sliders. **Advanced Settings** contains perfusion and rhythm examples.
- Adjust arterial stiffness, peripheral perfusion and breathing rate, then switch between the scrolling stream and a labeled representative cardiac cycle. Breathing rate drives lung/chest motion and respiratory sinus arrhythmia, as well as pulse-height and baseline modulation. The clean single-beat view excludes these variations for controlled morphology comparisons.
- Watch a changing live heart-rate readout beside the breathing phase and last completed beat interval. The HR control sets the mean; slower breathing strengthens the illustrative coupling. Heart animation and delayed PPG signals use one shared variable heartbeat clock.
- Choose **Save reference** to retain a comparison while changing the current subject or site. Single-beat comparisons are normalized by cardiac phase.
- Pause the shared simulation clock. The heart, gait and stream stop together, while controls remain usable.
- Use **Heart & lungs** to inspect the beating heart and expanding lungs close up. Reset the camera to return to the whole body.
- Use **Heart detail** to isolate the beating heart and coronary vessels, with nearby great vessels shown faintly for context. **Full body** returns to the orange anatomical view. The head uses softer lighting and conceals skull, teeth and eye structures.
- The single charcoal-and-amber presentation follows the supplied SensorBio color reference; internal tissue colors retain their educational meaning.
- Choose Rest, Walk or Run to set activity, an example heart rate and an example breathing rate. Both rates remain adjustable afterward. Expand the motion lab for wrist acceleration and sensor noise. Activity changes ease between custom idle, walking and running poses while preserving stride phase. Walking includes a planted stance and toe-off; running adds a higher recovery stride, bent elbows and a forward lean.
- Open the five-step guided tour and the source/methodology panel.

## Model and assets

The active viewer uses **BodyParts3D 4.0** geometry for the body, muscles, skeleton, heart, arterial and venous trees, and available nervous structures. It replaces the earlier handmade anatomy. The user-supplied [Human Atlas](https://github.com/ashemag/human-atlas) project informed the source selection and system classification. A reproducible conversion pipeline retains source identifiers and provenance in the model manifest.

The distributed Draco model is **9.50 MB**, with **2,086,188 triangles** across **26 tissue/organ meshes**, derived from 2,081 selected BodyParts3D source parts plus HRA lungs. External ears are retained from FJ2811 so the earring fits the source earlobe. Rebuild with `npm run model:build` (Python 3, Blender on PATH, and installed npm dependencies). Source downloads are hash-verified and cached in the ignored `scripts/bodyparts3d-source/` directory. The earlier procedural-model files are inactive prototypes.

The selected BodyParts3D package supplies pulmonary vessels and airways but no lung outer surfaces. Those come from **Human Reference Atlas Lung Male v1.4**, registered into the BodyParts3D coordinate frame. They are separate source individuals, assembled for spatial education. Both datasets are CC BY 4.0; retain [the distributed attribution](public/ATTRIBUTION.md). Exact sources, coverage limits and adaptations are in [ANATOMY-SOURCES.md](docs/ANATOMY-SOURCES.md).

`src/bodyparts.ts` supplies custom materials, chest cutaway, cardiac contraction, breathing, and route-based blood-flow cues. `src/locomotion.ts` and `src/locomotionRig.ts` provide authored in-place gait tracks and a 21-joint Three.js skeleton with GPU skinning. Forearm rotation uses dual-quaternion blending to preserve thickness through pronation, with matching CPU picking. Leg inverse kinematics preserves limb lengths; connected skeletal components move rigidly. Wearables, flow trails and body picking share the same transforms. Heartbeat and breathing remain independent layers on the shared simulation clock. Pulmonary arteries are blue and pulmonary veins red in the educational oxygenation color convention, while remaining in their correct vessel layers. Anatomy assets are served locally with the application; no third-party model service is contacted at runtime.

`src/tissueMaterials.ts` adds dielectric tissue finishes, subtle nonperiodic surface variation, roughness variation and filtered microsurface normals. Cardiac normals follow the squeeze and twist animation. Heart detail suppresses unrelated anatomy and flow trails. These are rendering adaptations, not measured tissue optical properties.

`src/wearables.ts` builds the Oura-inspired ring, SensorBio-reference woven band, and conceptual sensor earring. The wristband follows the supplied front, loop and optical-side images: one continuous black textile cuff over a curved housing, a fitted perimeter frame, an edge button, recessed inserts, a metal plate and two gold contacts. They are illustrative device designs, with no hardware connection or commercial signal-processing algorithms. The ring, bands and neck patch illustrate optical sensing concepts; the huggie uses discreet earlobe contacts. The neck waveform remains an illustrative reference, not a measurement of deep carotid flow. Wearable poses are fitted to the source anatomy, with CPU transforms matching the GPU gait. Device meshes are batched by material, and picking tests only these small meshes.

Heart contraction, lung volume and gait are illustrative. Soft, tapering light trails follow selected source vessel routes at an illustrative speed, distinct from arterial pulse-wave propagation. A separate subtle vessel glow follows the heartbeat. The waveform engine is an analytical teaching model, not a reproduction of the PWDB cardiovascular solver or a calibrated optical simulation. The app uses no patient data or downloaded PWDB waveforms. Source anatomical detail does not validate the physiological simulation.

Read [the scientific model notes](docs/SCIENCE.md) for equations, source attribution, site assumptions and limitations. A future data-backed mode should use actual attributed PWDB traces with their physiological plausibility flags, and validate optical/noise behavior against real PPG recordings.

## Performance and accessibility

- Anatomy is batched by tissue and organ; a single static ribbon mesh animates blood-flow trails on the GPU to keep draw calls and per-frame CPU work low. The reference model loads asynchronously with progress and a retry state.
- Capped WebGL pixel ratio (1.65) and canvas pixel ratio (2); waveform drawing is capped at 30 fps.
- Animation uses refs and GPU deformation rather than React frame-by-frame state updates. Rendering suspends when the document is hidden or the 3D view is offscreen.
- Observer, RAF, controls, materials and GPU-resource cleanup on unmount.
- Locally bundled fonts and model; lazy-loaded Three.js view.
- Fresnel surface glow, restrained bloom and 2× render-target antialiasing preserve a clear outline without recoloring the organs.
- Responsive desktop/tablet/mobile layout, keyboard-accessible sites and controls, focus-trapped native dialogs, and an accessible signal lab if WebGL is unavailable.

Frame rate depends on the browser and GPU; a desktop rendering measurement is not a cross-device benchmark. Tissue colors are educational; this model is not a patient-specific or clinically validated digital twin.

Earlier verification on 2026-09-08 (before the seven-device expansion): 15 Node tests and 17 browser tests passed, with no browser console errors. This includes physical mesh picking, optical-side isolation, the complete guided expedition, pause/resume, waveform controls and responsive layouts. A local Chrome sample of the full anatomy with the detailed wearables at 1440×1100 / DPR 1 measured a 24.63 ms mean frame interval and 50 ms 95th percentile. Layouts were checked at 360, 390, 680 and 820 pixels; physical mobile GPU performance was not measured. Rendering measurements are local observations, not a device-wide performance guarantee.

The neutral presentation skin is generated with `scripts/build_neutral_skin.py` from BodyParts3D FJ2810. It preserves the original arm and hand pose with palms forward and removes external reproductive contours. The previous artificial forearm twist has been removed from the skin, tissues, flow routes, and device attachments. `scripts/verify_neutral_skin.py` checks the reconstructed arm surfaces against the original source. The generated `public/models/neutral-skin.glb` replaces the reference skin at runtime; the original source GLB and metadata remain unchanged.

Earlier verification (seven devices, orange anatomical presentation, revised skin, facial treatment and luminous flow trails): build passed, 18 Node tests passed, and all 19 browser tests passed. Browser checks include physical picking for all seven devices, off-center zoom, two-finger pinch/pan and the mobile learning flow. The source-arm comparison passed for over 26,000 surface vertices (99th percentile deviation below 0.0017 scene units). No browser errors were observed. Earlier frame-time measurements above predate this visual pass.

Latest verification (surface-anchored zoom): build passed, 25 Node tests passed and all 24 browser tests passed. Pinch tests track the actual forehead and wrist screen positions after scrolling a phone viewport, including simultaneous panning; trackpad tests verify cursor anchoring and reversal. The suite also retains mean-rate, respiratory coupling, pulse-amplitude, display-clipping, pause/resume and all-device selection checks. Responsive checks cover 360, 390, 820 and 1440 pixels. These are software consistency checks, not clinical validation or fitting to individual recordings; see the simulation notes for measured model outputs.

## Deployment

Plethscape deploys to Vercel as a static Vite application using Node.js 22, `npm ci`, and `npm run build`. The output directory is `dist`. No server credentials or environment variables are required. Runtime anatomy assets and their attribution ship with the site. Downloaded model source archives, screenshots, local caches, and build output stay out of Git.

The default visual hierarchy emphasizes the heart, lungs and circulation with richer colors. Thoracic foreground vessels are softened, while coronary vessels remain distinct. A localized medial lung reveal with an antialiased edge exposes the heart without changing source geometry; solid outer lung surfaces preserve the breathing silhouette. This is an illustrative presentation treatment, not missing lung tissue. Bones, cartilage, nerves and surrounding muscles are subdued translucent context. Chest motion is deliberately amplified for teaching visibility and does not represent calibrated respiratory volume. The single temple sensor is fitted to the side of the head; the bicep housing is reduced independently of the cuff circumference.

The temple sensor and neck patch conform to the loaded skin rather than a fixed oval or plane (`src/surfaceFit.ts`). Fitting uses local triangle slices once at load time; the contact regression test uses curved synthetic surfaces. The head writes an occluding depth surface so far-side devices do not show through it. Facial pigment is shaded on the skin, replacing the former protruding lip tube. The larger black huggie and seven amber discovery halos improve discoverability. Halos respect depth, pause, and reduced-motion preferences, brighten on hover/selection, and soften during device inspection. They are interface cues, not emitted light or simulated optical transport.

Interface text uses scalable rem sizes, with prominent values, supporting labels, and larger native slider handles. Narrow screens reflow to controls, signal and anatomy, with a horizontal wearable selector. Flow uses a nearest-surface stencil mask to keep luminous trails beneath opaque wearable surfaces without hiding the trails inside vessel lumens. The featureless pelvic envelope is boolean-unioned into the source skin after correcting face normals, avoiding a separate internal filler surface.

The workspace follows “choose location → change physiology → observe PPG.” A contextual explanation describes the last changed parameter, and reference overlays retain fixed amplitude scales. Guided education is secondary to direct exploration. The pulse journey is an illustrative pressure-pulse story, not tracking a blood cell or reproducing calibrated transit time. Anatomy loading finishes independently of offscreen render suspension, including when the body begins below the fold on mobile.

Pinch and wheel zoom capture a body-surface point once per gesture. That point remains beneath the touch midpoint or cursor as the camera moves; two-finger translation pans at the same depth. Client coordinates keep the interaction correct after page scrolling. Zoom has near/far limits, uses a view-plane fallback over empty space, and preserves ordinary device taps and orbit gestures. Surface depth comes from reference meshes; shader-only organ deformation is not a separate collision surface.


Single-beat **Labels** opens an interactive fiducial guide: select on, u, sp, dn, dp, or off for the full name and explanation. Only resolved notch/diastolic peaks receive markers. Expand **Pulse timing & shape** for crest time, duration, half-amplitude width, and amplitude. Definitions and teaching-model limits are documented in [SCIENCE.md](docs/SCIENCE.md).


In **Advanced Settings → Rhythm & conditions**, choose AFib, PACs, PVCs, ventricular bigeminy or trigeminy. The shared heartbeat clock drives the anatomy and each site's 10-second PPG stream. Compare with sinus rhythm or enable the weak peripheral pulse example for ventricular ectopy. The single-beat view stays a reference contour; rhythm effects require multiple beats. Research, parameter choices and limitations are in [SCIENCE.md](docs/SCIENCE.md).


## Inside the signal

The **Wearable location** selector starts at the wristband. Site names lead, with
wearable types underneath. Selecting a site updates both the large live trace
and representative beat. **Save reference** retains an overlay while changing
location or physiology. Signals are simulated examples, not measured recordings.

Open **Compare locations** beside **Save reference** in the PPG panel to capture one heartbeat and immediately see
synchronized site traces beside the anatomy. **Light & tissue** on the selected
device card opens the optical cutaway instead. Scrub time, replay at 0.2× / 0.5× / 1×,
or jump to a resolved pulse landmark. **Inside sensor** displays a custom-coded
3D light/tissue cutaway; **Whole body** shares the same replay time. Compare up to
four site traces using arrival timing or aligned pulse feet without normalizing
away amplitude differences. **Back to live** resumes exploration.

Green/red/infrared controls illustrate relative light sampling depth. An expandable
research note explains why real wavelength-dependent pulse shapes cannot be reduced
to three universal templates. The synthetic PPG is not recalibrated by these controls.

The live HR readout now shows a whole-number two-beat average, refreshed once per
second; the physiological clock remains unsmoothed. A taller main chart, a 2.5-second
close view, and **See beat-to-beat changes** make the actual differences in recent
pulse heights and durations easier to inspect. The default sinus stream is still
five seconds; irregular-rhythm examples default to ten seconds.

Verification for the site selector and signal studio: production build passed,
45 simulation/unit tests passed, and all 34 browser cases passed across the full
run and targeted rerun after fixing the inspection-panel overlap. This includes
shared replay time, fiducial jumps, site alignment, mobile layout, recent-pulse
comparison, and the existing anatomy/gesture/rhythm/export regressions. Desktop
and phone-size Chrome views were visually checked with no reported browser errors.
These checks establish software behavior, not clinical validation.

The temple capsule replaces the headband and retains the existing illustrative head-site pulse parameters. The stable internal `forehead` key remains for saved-state and data compatibility; visible controls identify the site as **Temple**. Its waveform is not a calibrated temple recording.

### Choosing a PPG location

Learn opens a featured four-step lesson about signal quality, movement, everyday fit, and Sensor Bio’s wrist design rationale. The examples open a matched resting wrist/finger comparison, walking wrist PPG with acceleration, and resting wrist exploration. Progress remains available when Learn is reopened. Study findings stay scoped to their sensors and conditions; the lesson provides no device leaderboard, invented comfort scores, or claims of validated Sensor Bio superiority. Fingertip/forehead findings are explicitly distinguished from ring/temple devices.

## ChatPPG integration

The app is published at `https://chatppg.com/plethscape` from the ChatPPG repository. Its build uses Vite base `/plethscape/`; all model assets follow that base. Inter and Space Grotesk are bundled locally. The static landing guide and JSON-LD are available without JavaScript. On mobile the body and signal come first; Adjust physiology opens the settings drawer.
