# Wavelength teaching model

Previously the waveform was wavelength-neutral; Green 530 nm only controlled the tissue illustration. Green 530 nm is now the default waveform baseline; Red 660 nm and Infrared 940 nm modify the same site model. All three are schematic, not fitted recordings.

## Evidence
- Maeda et al., 2011, 11 participants, jumping and arm swinging: green PPG pulse intervals correlated better with ECG than infrared across studied sites. https://pubmed.ncbi.nlm.nih.gov/20703691/
- Zhang et al., 2019, wrist motion-artifact reduction uses infrared as a motion reference for green. https://pmc.ncbi.nlm.nih.gov/articles/PMC6387309/
- Sirkiä et al., CinC 2020: multi-wavelength fingertip recordings show small contour/timing differences and describe wavelength-dependent sampling depth. The demonstration used 515/640/880 nm, not this UI's exact LEDs. https://www.cinc.org/archives/2020/pdf/CinC2020-179.pdf
- Depth-dependent sensor experiment used 530/660/940 nm (plus blue). https://pubmed.ncbi.nlm.nih.gov/31835543/

## Deliberate assumptions
Longer-wavelength profiles modestly broaden the pulse, alter its reflected component and gain. These directions, numerical coefficients and extrapolations to seven sites are illustrative choices, not established universal wavelength signatures. No change to central heart rate, respiratory timing or arterial transit delay is inferred from wavelength.

Activity uses the existing shared gait clock and site-specific swing, impact and contact loss. Red and infrared increase baseline displacement, coupling loss and irregular high-frequency disturbance. Infrared is strongest in this scenario; red is an illustrative intermediate, not a validated ranking. Green can also be severely corrupted. Real outcomes depend on sensor geometry, contact, skin, wavelength, LED power and signal processing.

Relative penetration bars and 3D light paths represent overlapping sampling volumes, not millimeters, distinct vascular layers, or direct carotid measurement. Longer penetration does not mean better signal. No SpO2 calculation, clinical accuracy or device performance prediction is implied.

Single beat and captured pulse show clean morphology; live stream includes noise. Saved references retain their wavelength. Coefficients are deterministic for reproducible comparisons. Presentation sex does not change optics or physiology.
