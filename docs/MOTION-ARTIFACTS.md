# Motion artifacts in Plethscape

The live trace now combines the physiological pulse with cadence-linked baseline displacement, foot-strike transients, slow coupling drift, and intermittent attenuation of the optical pulse. All terms share the body's gait clock, blend during activity transitions, and are deterministic for pause/replay. Walking is visibly affected; running has stronger distortion. Single-beat morphology remains a clean educational reference.

Location profiles illustrate different mechanical coupling: wrist/finger arm swing, upper-arm strap movement, earring/head bounce, neck patch movement, and toe impact/contact pressure. These coefficients are illustrative design choices, not fitted measurements or a universal ranking. Actual results depend on attachment, subject, activity, wavelength, and processing. The displayed heart rate is the simulated physiological rate, not an estimate extracted from a corrupted optical signal.

## Primary research

- Maeda et al. (2011), [Comparison of Measurement Sites and Light Sources in Photoplethysmography during Walking](https://doi.org/10.11239/jsmbe.49.132): simultaneous upper-arm, wrist and finger measurements in 11 participants walking at 4 km/h; green and infrared responded differently, and upper-arm green had less pulse-rate error than peripheral sites in this protocol. This does not establish a universal site ranking.
- Lee et al. (2011), [Artifacts in wearable photoplethysmographs during daily life motions](https://www.sciencedirect.com/science/article/pii/S0010482511002393): periodic walking/running movement overlaps pulse frequencies; finger and arm movement introduce distinct artifacts.
- [Reflectance forehead pulse oximetry: effects of contact pressure during walking](https://pubmed.ncbi.nlm.nih.gov/17946185/): attachment pressure changes PPG amplitude; increased amplitude does not necessarily improve signal-to-noise ratio.
- Zhang et al., [TROIKA](https://arxiv.org/abs/1409.5181): wrist PPG during intensive exercise can contain very strong movement artifacts; signal processing is essential to recovering heart rate.

The simulator does not currently parameterize wavelength, device fit or a proprietary artifact-removal algorithm. No diagnostic or product-performance conclusions should be drawn from the teaching profiles.
