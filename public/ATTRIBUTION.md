# Plethscape anatomy attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- Data: BodyParts3D release 4.0, `isa_BP3D_4.0_obj_99.zip`.
- Source: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Current license notice: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Terms: https://creativecommons.org/licenses/by/4.0/
- Adaptations: selected structures, a common coordinate transformation, browser optimization, curated system groups, tissue materials, cutaway presentation and illustrative animation.

Lung geometry: Kristen Browne and Heidi Schlehlein (2024), **3D Reference Organ for Lung, Male v1.4**, Human Reference Atlas / HuBMAP, CC BY 4.0.

- DOI: https://doi.org/10.48539/HBM532.KLZD.394
- Source: https://lod.humanatlas.io/ref-organ/lung-male/v1.4/
- Terms: https://creativecommons.org/licenses/by/4.0/
- Adaptations: lobar geometry selected, positioned with BodyParts3D, optimized, shaded and animated. This is a separate Visible Human Male reference, not the same individual as BodyParts3D.

These sources do not endorse Plethscape. Anatomical geometry and simulated physiology have separate provenance. The application supplies synthetic PPG, flow cues, breathing and movement.

Human Atlas (https://github.com/ashemag/human-atlas) supplied the user-requested explorer reference and display-system classification reference. Its anatomy has the BodyParts3D license above; its original classification material has the following license.

## Human Atlas MIT License

Copyright (c) 2026 ashemag

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Neutral presentation skin

`models/neutral-skin.glb` is adapted from BodyParts3D FJ2810 under the same CC BY 4.0 license. Custom processing changes the hand pose, reconstructs the forearm surface, removes external reproductive contours, and remeshes the skin for interactive display. See `scripts/build_neutral_skin.py`.

## Scanned presentation head

`models/scanned-head.glb` is adapted from **Eric Rigged 001**, © Renderpeople. Source: https://renderpeople.com/free-3d-people/ (FBX package), referenced at https://free3d.com/3d-model/eric-rigged-001-771956.html.

The head is a separate photographic scan, not the individual represented by the internal anatomy. Adaptations: head extraction, neck fitting, subdivision, texture cropping/resizing and browser compression. Renderpeople does not endorse Plethscape. This asset is not covered by the application's code license or the anatomy's CC BY license; reuse requires appropriate permission from Renderpeople.
