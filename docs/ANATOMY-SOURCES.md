# Anatomy sources and adaptations

Source and license pages verified on 2026-09-08.

## Selected source

Plethscape selects **BodyParts3D release 4.0**, distributed by the Database
Center for Life Science (DBCLS) through the Life Science Database Archive.
This is the same dataset release identified by the user's
[Human Atlas reference](https://github.com/ashemag/human-atlas). The lung
parenchyma comes from the separate Human Reference Atlas source below.

| Item | Provenance |
| --- | --- |
| Geometry archive | [isa_BP3D_4.0_obj_99.zip](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip) |
| Release and data dictionary | [Official archive README](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html) |
| Archive download catalog | [BodyParts3D downloads](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) |
| Dataset record | [BodyParts3D, DOI 10.18908/lsdba.nbdc00837-000](https://doi.org/10.18908/lsdba.nbdc00837-000) |
| Source publication | [Mitsuhashi et al., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37, D782–D785 (2009)](https://academic.oup.com/nar/article/37/suppl_1/D782/1000752) |
| Official license notice | [Archive license, updated 2025-02-27](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) |
| License terms | [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) |

The package name ends in `obj_99`; the archive describes it as 99% polygon
reduction. It is not the later full-resolution 4.3 collection. `LATEST` is the
archive path, not a claim that the geometry is the newest BodyParts3D release.
The archive history dates the 4.0 data update to 2013-06-19; its 2025 entry is a
license update. The [dated archive directory](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/)
also identifies the release-specific files.

Downloaded archive size: 142,903,898 bytes. SHA-256:
`40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e`.
The archive contains 2,234 OBJ entries; this is a source inventory, not a count
of the meshes selected for display.

## Additional lung source

**Kristen Browne and Heidi Schlehlein (2024), 3D Reference Organ for Lung,
Male v1.4**, [DOI 10.48539/HBM532.KLZD.394](https://doi.org/10.48539/HBM532.KLZD.394),
Human Reference Atlas / HuBMAP, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- [Official reference-organ record and metadata](https://lod.humanatlas.io/ref-organ/lung-male/v1.4/).
- [Source `3d-vh-m-lung.glb`](https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/assets/3d-vh-m-lung.glb).
- Source file size: 10,942,332 bytes. SHA-256:
  `bba95516fa993ac45c3b1c53f32b58d97232ffd78ae56397e5a2589c6ce4903d`.
- Selected root: `VH_M_lungs`; left and right parents: `VH_M_lungs_L` and
  `VH_M_lungs_R`. Lobar groups are left upper/lower and right upper/middle/lower.

The official metadata identifies the NLM Visible Human Male as the source and
explains that the lung model retains lobes and intrapulmonary bronchi, while
larynx, trachea, and main bronchi were removed starting with version 1.3.
These pulmonary surfaces supplement the selected BodyParts3D 4.0 package's
missing parenchymal surfaces. They are positioned together for illustration;
they are not from the same reference individual as BodyParts3D.

Retain the author names, dataset title/version, DOI, license link, and notice
that positioning/materials/animation were adapted for Plethscape. The metadata
cites the organ dataset as 2024; the graph-processing timestamp in 2026 is not
a new anatomy version or a new scan date.

## Attribution to retain when distributing the anatomy

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

Link that credit to the [BodyParts3D source](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html)
and the [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).
Identify the geometry adaptations described below. Preserve the attribution,
license notice, source identity, and adaptation notice alongside redistributed
assets. Attribution must not suggest that DBCLS endorses Plethscape.
The distributable [attribution file](../public/ATTRIBUTION.md) includes both
anatomy credits and the Human Atlas metadata permission notice.

CC BY 4.0 permits redistribution and adaptations, including commercial use,
with attribution and an indication of changes. It does not impose a ShareAlike
requirement. Anatomy data has its own license; this credit does not change the
licenses of application code or third-party software.

## Why older pages show a different license

The selected 4.0 archive's current license page explicitly specifies CC BY 4.0
and supplies the credit above. Its README lists the exact selected archive.
This is the provenance used for Plethscape's 4.0 anatomy adaptation.

The [legacy BodyParts3D site license](https://lifesciencedb.jp/bp3d/info_en/license/index.html)
still displays [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
Older OBJ headers and copies can retain that earlier notice. These historical
notices are not evidence that the archive license was never updated. The
archive README also retains a stale hyperlink under its CC BY 4.0 description
that leads to the older deed; use the explicit dated license notice and the
direct CC BY 4.0 link above.

The 4.0 archive notice does **not by itself establish** the current license of
the separate 4.3 full-resolution files obtained from the legacy service or a
mirror. No such 4.3 geometry is selected here. Do not transfer this document's
CC BY 4.0 label to a different source/version without checking its provenance.

## Geometry adaptation record

The independent [conversion script](../scripts/build_bodyparts_atlas.py) converts
official OBJ geometry to [the browser GLB](../public/models/bodyparts-atlas.glb).
The [conversion manifest](../public/models/bodyparts-atlas-metadata.json) records
selected source identifiers and names, display groups, exclusions, bounds,
source-vessel paths, source hashes, and asset statistics. BodyParts3D supplies
body, muscle, arterial, venous, nervous, skeletal, cardiac, airway, and diaphragm
surfaces; the HRA source supplies separate left and right lungs.

Adaptations include grouping meshes for rendering, quadric simplification,
smooth normals, Draco compression, display materials, and illustrative
animation. Reproductive structures and scalp/pubic hair are omitted; external
genital prominence in the skin surface is flattened for the neutral presentation.

BodyParts3D coordinates are millimeters, with Z superior and negative Y
anterior. The converter uses uniform scale
`s = 3.65 / 1.7194712 = 2.122745644125938` and this display transform:

```text
x = (x_mm × 0.001) × s
y = (z_mm × 0.001 + 0.0781112) × s
z = (−y_mm × 0.001 − 0.1) × s
```

This sets the displayed body height to 3.65 scene units; it does not imply a
3.65-meter human. HRA lung coordinates, already in meters, receive translation
`(0, +0.8, −0.01)` before the same uniform scale. This is an approximate visual
registration between references, not patient registration or a fitted
biomechanical relationship. Final asset statistics are reported by the linked
manifest and should be refreshed whenever conversion choices change.

The 2026-09-08 export contains 2,086,188 triangles in 26 batched meshes and
occupies 9,500,404 bytes with Draco compression. It selects 2,081 BodyParts3D
source parts plus the registered HRA lung meshes. Render calls additionally
include the ground, GPU-animated ribbon flow cues, and glow postprocessing.

Source FMA concepts, BP representations, and individual mesh files are different
identifiers. A named concept can aggregate several meshes; a count of concepts
must not be described as a count of individually modeled physical structures.
Display system grouping and material colors are curated for this interface.
The BodyParts3D source audit found 37 leaf meshes named as nerves, ganglia, or
spinal cord. They principally cover cranial/optic structures and the central
spinal canal; the package does not contain a complete limb peripheral nerve
network. Classification counts that include other nervous-system tissue should
not be presented as counts of nerves.

## Relationship to Human Atlas

[Human Atlas](https://github.com/ashemag/human-atlas) is a user-supplied reference
for an interactive BodyParts3D explorer. Its
[attribution file](https://github.com/ashemag/human-atlas/blob/main/public/ATTRIBUTION.md)
identifies the 4.0 archive and the updated CC BY 4.0 notice. Its
[MIT software license](https://github.com/ashemag/human-atlas/blob/main/LICENSE)
is separate from the anatomy data license.

The Plethscape converter uses official OBJ geometry and official English name
and element tables. Human Atlas's `atlas.json` is a reference for display-system
classification, with classifications corrected for this application's groups.
Credit for that metadata reference: **Human Atlas, Copyright (c) 2026 ashemag,
MIT License**. Preserve the linked copyright and permission notice if
redistributing reused classification material. The downloaded reference
converter is retained only in an excluded research cache; its application and
converter code are not incorporated into the production application. The
DBCLS credit covers the anatomy data, not separately reused software.

## Cardiovascular reference audit

The user also supplied the [Innerbody cardiovascular guide](https://www.innerbody.com/image/cardov.html).
It is a content reference only; none of its images, geometry, or application code
is included. Core circulation relationships were checked against the primary
publisher's [OpenStax heart anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy)
and [circulatory pathways](https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways).
In particular, the coronary sinus drains into the right atrium; the Innerbody
page incorrectly names the vena cava. See [simulation notes](SCIENCE.md#cardiovascular-routes-and-display-conventions)
for the verified educational route, oxygenation colors, and tracer limitations.
These sources establish anatomical relationships, not validation of this
application's flow animation. No textbook illustrations are redistributed.

## What this reference can and cannot establish

BodyParts3D describes an adult male reference based on TARO MRI, supplemented
by further segmentation and anatomical illustration. The reference publication
does not make every surface a direct MRI measurement. The
[maintainers' notes](https://lifesciencedb.jp/bp3d/info/index.html) identify missing
structures, artist-built or adjusted parts, and possible assignment errors.

Plethscape uses anatomical surfaces to explain spatial relationships. Omitting
reproductive structures creates a neutral presentation but does not change the
references' sex, population coverage, or biological variation. The displayed
palms face backward using an illustrative distal-forearm pose applied to tissues, flow routes and wearable attachments. The elbow remains in its source pose. A separately reconstructed skin envelope removes surface folds and external reproductive contours; it is generated from source FJ2810 by `scripts/build_neutral_skin.py`. This presentation pose
is not a biomechanical model of radioulnar joint motion. This assembly
uses BodyParts3D and Visible Human Male lungs from different reference sources;
it is not a patient-specific digital twin. Colors, transparency, animations, and PPG
or acceleration traces are educational adaptations; anatomical detail does not
validate the simulated physiology or make the interface suitable for clinical
measurements, diagnosis, or surgical planning.
