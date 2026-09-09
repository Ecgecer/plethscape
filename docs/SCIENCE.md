# Plethscape: simulation notes

Plethscape is a visual teaching model. Its waveforms are generated analytically;
they are not downloaded PWDB samples, patient measurements, or a validated
cardiovascular solver. The anatomical reference combines BodyParts3D 4.0 with
Human Reference Atlas lung surfaces; anatomical geometry and physiological
simulation have separate provenance.
PPG represents local optical blood-volume changes, not ECG, arterial pressure,
or volumetric blood flow. See [anatomy sources and adaptations](ANATOMY-SOURCES.md).

## Anatomical reference and interpretation

BodyParts3D provides named anatomical surfaces and spatial relationships. Its
original construction used the TARO male MRI reference with subsequent
segmentation and anatomical illustration refinements, as described by
[Mitsuhashi et al.](https://academic.oup.com/nar/article/37/suppl_1/D782/1000752).
The lung parenchyma is separately sourced from Browne and Schlehlein's
[Human Reference Atlas male lung v1.4](https://doi.org/10.48539/HBM532.KLZD.394),
derived from the NLM Visible Human Male. These are different reference sources
registered for a teaching illustration, not organs from one intact patient.
Removing reproductive structures gives this interface a neutral presentation;
it does not make the underlying adult male reference anatomically sex-neutral
or representative of every body.

The source archive already contains reduced polygon meshes. Display colors,
transparency, tissue shading, luminous flow trails, and motion are presentation choices.
Heart contraction, lung expansion, and walking/running are illustrative
animation. They are not finite-element mechanics, measured organ motion, or a
validated ventilation or gait model. More detailed surfaces do not validate
the PPG generator or calibrate its pulse transit times.
Blood-flow trails illustrate downstream material transport; they are not the
speed of an arterial pressure wave or the local optical blood-volume pulse.
This interface does not claim resolved capillary beds, venous-valve mechanics,
or a cardiac electrical-conduction model.

The [BodyParts3D project notes](https://lifesciencedb.jp/bp3d/info/index.html)
describe incomplete coverage, manually constructed or adjusted parts, and
possible concept-mapping errors. A named mesh supports spatial exploration;
it does not establish a complete anatomical account, patient-specific anatomy,
clinical measurement, or suitability for diagnosis or surgical planning.
In particular, the selected 4.0 archive's nerve/ganglion/spinal-cord leaf meshes
cover cranial and central structures; they do not supply a complete limb
peripheral nerve network. Do not describe this layer as all nerves mapped.

## Cardiovascular routes and display conventions

The user's [Innerbody cardiovascular guide](https://www.innerbody.com/image/cardov.html)
informed the requested scope. Its text was checked against the primary publisher's
[OpenStax heart anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy)
and [circulatory pathways](https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways).
The simplified adult circulation taught here is:

`right atrium → right ventricle → pulmonary trunk/arteries → lung capillaries → pulmonary veins → left atrium → left ventricle → aorta/systemic arteries → tissue capillaries → systemic veins → venae cavae → right atrium`

Arteries conduct blood away from the heart; veins return it. Red and blue encode
relative oxygenation as a teaching convention, not literal vessel or blood
color. Pulmonary arteries therefore appear blue in the artery layer, while
pulmonary veins appear red in the vein layer. Coronary arteries arise from the
aorta. Bronchial arteries supplying lung tissue are systemic arteries and
remain red. The coronary sinus empties **directly into the right atrium**; the
Innerbody page's statement that it drains into a vena cava is not used. These
relationships follow the OpenStax sections linked above.

Tapering luminous trails follow 18 selected arterial source-vessel routes: 17 systemic
arteries and the pulmonary trunk. They provide arterial flow cues; they do not
animate complete venous return. Route direction uses named upstream vessels.
The displayed ribbons have illustrative width, speed and spacing. A separate
subtle vessel glow follows the animated heartbeat; neither effect calibrates
pulse-wave speed or transit time. They do not solve pressure gradients, conservation of mass,
branch flow, or oxygen transport. Source-derived centerlines are geometric
approximations. Ribbon paths receive bounded local smoothing for presentation,
with endpoints preserved; this does not reconstruct or validate vessel lumens. The complete circulation above is an explanatory sequence, not
a claim that the displayed mesh contains every connecting capillary or an
unbroken computational vessel graph. The source inventory has no named meshes
for capillary beds, venous valves, chordae tendineae, conduction nodes, or
pericardium. No such structures or physiological mechanisms should be implied
by the animation. No Innerbody or OpenStax illustrations are included as assets.

## Source basis

- [PWDB Zenodo record 3275625](https://zenodo.org/records/3275625), version
  0.2.0, contains simulated pulse waves and cardiovascular variations across
  virtual subjects. It informs morphology and population-level variation; the
  live beat-to-beat variation added here is an independent teaching layer,
  not measured human variability or coefficients fitted to those records.
- [Charlton et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28296645/) studied
  respiratory signals extracted from ECG and PPG in 57 healthy subjects.
  This supports distinguishing respiratory signal modulation from sensor
  artifacts; it does not calibrate this app's chosen variability amplitudes.
- [PWDB overview](https://peterhcharlton.github.io/pwdb/pwdb.html): 4,374 virtual
  subjects, six age groups from 25 to 75, several arterial wave types, and public
  domain dataset licensing. The accompanying publication should be credited when
  using its data. This app currently uses no PWDB data files.
- [PWDB data dictionary](https://github.com/peterhcharlton/pwdb/wiki/pwdb_data.mat):
  PPG is in arbitrary units; pressure has separate fields in mmHg. Radial and
  digital sites correspond to wrist and finger. The superior temporal endpoint
  approximates the ear; anterior tibial corresponds to ankle. Forehead and toe
  in this app are illustrative additions. The data also includes onset times
  and physiological plausibility flags.
- [Charlton et al., 2019](https://doi.org/10.1152/ajpheart.00218.2019): the
  116-segment arterial model includes terminal Windkessels. Its PPG approximation
  integrates inflow minus outflow, then normalizes volume variation to 0–1:
  `V(t) = integral(Qin - Qout) dt`. At nonterminal sites,
  `Qout = (P - Pout) / R`, with `R = (mean(P) - Pout) / mean(Qin)`.
  This is not a light-tissue transport model. The authors state that its PPG
  fidelity needs further investigation. Healthy-ageing simulations do not
  establish individual or disease predictions. Several source parameters used
  male data; a visually gender-neutral avatar does not make those references
  population-neutral.
- [Cunningham et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36580284/): a primary
  study of 169,787 participants supports an association between finger PPG notch
  smoothness, age, and vascular factors. Notch presence is variable and should
  not be taught as a deterministic age threshold or a standalone diagnosis.
- [Djurić et al., 2023](https://doi.org/10.3389/fphys.2023.1191272): experimental
  optical recording above the common carotid used a specialized sensor and
  controlled supine recordings. Neck PPG exists in research; this does not make
  an ordinary reflectance trace a direct measurement of deep carotid flow.

## What the controls do

The period is `T = 60 / HR` seconds. One beat combines a gamma-shaped forward
component, a broad runoff component, a delayed Gaussian reflected component,
and a small negative Gaussian notch. Smooth start/end windows keep the stream continuous. These
component choices and every numerical coefficient are artistic engineering
approximations, not equations fitted to the cited studies.

- Age and the independent stiffness slider increase an internal stiffness
  factor. The modeled reflection moves earlier and merges into the downslope;
  the visible notch becomes smaller. The slider permits students to separate
  chronological age from one vascular property.
- Heart rate changes period and mildly changes upstroke timing. Shorter cycles
  mostly compress the diastolic tail. The interface selects heart-rate presets
  of 72, 98, and 142 bpm for rest, walk, and run. Each remains independently
  adjustable afterward; the underlying activity parameter alone does not
  change heart rate.
- Breathing rate sets respiratory modulation frequency (`rate / 60` Hz),
  bounded to 6–36 breaths/min. Interface activity presets are 16, 22, and 30
  breaths/min, and the breathing slider remains independently adjustable.
  The stream has modest sinusoidal baseline and amplitude modulation plus a
  small illustrative phase modulation. This is not a fitted respiratory sinus
  arrhythmia or autonomic model. Breathing rate leaves the clean single-beat
  morphology unchanged; view the stream to see its effect.
- Site changes relative arrival delay, contour width, reflected amplitude, and
  signal amplitude. Delays are schematic milliseconds from ejection and do not
  include ECG pre-ejection time. Delay decreases as model stiffness increases.
  They are not population reference values or calibrated path measurements.
- Perfusion changes optical pulse amplitude. Noise adds smooth deterministic
  high-frequency components. Small respiratory baseline/amplitude variation is
  always present. None represents a particular device or optical wavelength.
- The live stream also has gentle nonperiodic timing variation, correlated
  beat-to-beat amplitude/width changes, slight variation in the reflected
  component and notch, and slow amplitude/baseline drift. Timing perturbations
  are bounded phase offsets, so the selected HR remains the long-term mean.
  The added amplitude factor is bounded to ±1.8%, contour width to ±1.2%, and
  reflection/notch scaling to ±4.5%, in addition to respiratory modulation and
  slow drift. These are design bounds, not clinical reference ranges.
  Variation persists with sensor noise at zero. It is seeded and deterministic
  in the shared, propagation-delayed signal clock, so pause/replay, CSV export,
  and site comparison reproduce the same virtual beats without random resets.
  The clean single-beat view and its morphology metrics remain unchanged.
- Walking and running add periodic contact artifacts and a separate synthetic
  accelerometer stream in g, with gravity in its z component. The movement is
  not a biomechanical gait model. Noise and motion are rendered after the clean
  morphology to distinguish sensor artifacts from pulse physiology.

`reflectionIndex` is the modeled reflected-component amplitude as a percentage
of the incident component. It is **not** a validated clinical reflection index.
`notchProminence` measures the post-systolic rebound above an actual local
minimum relative to the clean systolic peak. It becomes zero if there is no
visible minimum. Clean beat annotations should likewise be omitted when an
extremum does not exist. `transitMs` is the illustrative delay described above.

Pressure and PPG should always keep different labels and units. The dicrotic
feature in PPG should not be presented as an exact timestamp of aortic valve
closure. Signal morphology also depends on cardiac ejection, vascular tone,
sensor contact, temperature, optical properties, and processing that this
minimal model does not independently reproduce.

## Future data-backed mode

A stronger scientific mode would ship a small, attributed subset of actual
PWDB waves and use its recorded onset times and plausibility flags. Compare
age baselines and selected cardiovascular variations without implying that
an interpolated record is a newly solved physiological state. Real PPG sensor
data would additionally be needed to validate the optical/noise model.

### Displayed wearable concepts

All seven sensing sites now have custom device geometry: finger ring, wrist band, gold huggie earring, thin forehead band, neck patch, bicep band and black great-toe band. The toe band illustrates reflectance rather than a transmission clip; the synthetic timing and waveform model are unchanged. The neck trace remains a model reference, not direct deep-carotid flow sensing. The head hides internal structures and uses simplified eyes and a relaxed mouth for an approachable teaching presentation; those facial additions are illustrative.
