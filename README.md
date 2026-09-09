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

- Start in **Play** for three discovery challenges: find signals with the ring, band and earring; predict how the older contour changes; then explore faster beat timing. **Sites** and **Layers** keep the exploration tools beside the model.
- Tap a physical wearable or use the **Gear** dock to inspect it and select its live simulated signal. The ring, textile-covered wristband, gold huggie earring, slim forehead band, neck patch, bicep band and black toe band are built entirely with custom geometry and procedural materials. Orbit each close-up; **Full body** returns to the atlas. Attachments follow the same arm motion as the anatomy. **Optical side** isolates the device and reveals its underside; **On body** restores the fitted view.
- Orbit and zoom detailed reference anatomy presented without reproductive structures; select sites on the body or in the site list.
- Pinch or scroll over any body region to zoom toward it. Two-finger drag or right-drag pans the view; Reset camera returns to the full body.
- Toggle the body, muscles, arteries, blood-flow trails, veins, available nervous structures, breathing lungs and skeleton independently. The presentation uses one orange anatomical view; open or close the chest cutaway.
- Compare finger, wrist, ear, forehead, neck/carotid reference, upper arm and toe.
- Drag the age and heart-rate dials vertically or horizontally. Arrow keys adjust by one, Shift + arrow by five; Home/End go to the bounds.
- Adjust arterial stiffness, peripheral perfusion and breathing rate, then switch between the scrolling stream and a labeled cardiac cycle. Breathing rate changes the lungs, chest, rib cage and diaphragm together, as well as respiratory modulation in the live PPG; the clean single-beat view excludes those artifacts.
- Freeze a baseline to retain a comparison while changing the current subject or site. Single-beat comparisons are normalized by cardiac phase.
- Pause the shared simulation clock. The heart, gait and stream stop together, while controls remain usable.
- Use **Heart & lungs** to inspect the beating heart and expanding lungs close up. Reset the camera to return to the whole body.
- Use **Heart detail** to isolate the beating heart and coronary vessels, with nearby great vessels shown faintly for context. **Full body** returns to the orange anatomical view. The head uses softer lighting and conceals skull, teeth and eye structures.
- Choose **Amber** or **Blue** outline glow. The charcoal and amber interface follows the supplied SensorBio color reference; internal tissue colors retain their educational meaning.
- Choose Rest, Walk or Run to set activity, an example heart rate and an example breathing rate. Both rates remain adjustable afterward. Expand the motion lab for wrist acceleration and sensor noise.
- Export 10 seconds of synthetic PPG and three-axis wrist acceleration at 125 Hz, with physiological settings and provenance in the CSV.
- Open four guided experiments and the source/methodology panel.

## Model and assets

The active viewer uses **BodyParts3D 4.0** geometry for the body, muscles, skeleton, heart, arterial and venous trees, and available nervous structures. It replaces the earlier handmade anatomy. The user-supplied [Human Atlas](https://github.com/ashemag/human-atlas) project informed the source selection and system classification. A reproducible conversion pipeline retains source identifiers and provenance in the model manifest.

The distributed Draco model is **9.50 MB**, with **2,086,188 triangles** across **26 tissue/organ meshes**, derived from 2,081 selected BodyParts3D source parts plus HRA lungs. External ears are retained from FJ2811 so the earring fits the source earlobe. Rebuild with `npm run model:build` (Python 3, Blender on PATH, and installed npm dependencies). Source downloads are hash-verified and cached in the ignored `scripts/bodyparts3d-source/` directory. The earlier procedural-model files are inactive prototypes.

The selected BodyParts3D package supplies pulmonary vessels and airways but no lung outer surfaces. Those come from **Human Reference Atlas Lung Male v1.4**, registered into the BodyParts3D coordinate frame. They are separate source individuals, assembled for spatial education. Both datasets are CC BY 4.0; retain [the distributed attribution](public/ATTRIBUTION.md). Exact sources, coverage limits and adaptations are in [ANATOMY-SOURCES.md](docs/ANATOMY-SOURCES.md).

`src/bodyparts.ts` supplies custom materials, chest cutaway, cardiac contraction, breathing, gait, and route-based blood-flow cues. Pulmonary arteries are blue and pulmonary veins red in the educational oxygenation color convention, while remaining in their correct vessel layers. Anatomy assets are served locally with the application; no third-party model service is contacted at runtime.

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

Latest verification (seven devices, orange anatomical presentation, revised skin, facial treatment and luminous flow trails): build passed, 17 Node tests passed, and all 19 browser tests passed. Browser checks include physical picking for all seven devices, off-center zoom, two-finger pinch/pan and the mobile learning flow. The source-arm comparison passed for over 26,000 surface vertices (99th percentile deviation below 0.0017 scene units). No browser errors were observed. Earlier frame-time measurements above predate this visual pass.

## Deployment

Plethscape deploys to Vercel as a static Vite application using Node.js 22, `npm ci`, and `npm run build`. The output directory is `dist`. No server credentials or environment variables are required. Runtime anatomy assets and their attribution ship with the site. Downloaded model source archives, screenshots, local caches, and build output stay out of Git.

The default visual hierarchy emphasizes the heart, lungs and circulation with richer colors. Bones, cartilage, nerves and surrounding muscles are subdued translucent context. Chest motion is deliberately amplified for teaching visibility and does not represent calibrated respiratory volume. The forehead cuff is fitted to the full head cross-section; the bicep housing is reduced independently of the cuff circumference.
