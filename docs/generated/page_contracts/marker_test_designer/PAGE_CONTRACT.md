# marker_test_designer — interchromosomal marker designer — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Converts a candidate interchromosomal meiosis effect into a practical
**marker panel**:
- focal-inversion classifier markers in parents
- transmission/recombination markers on tested chromosomes for
  offspring panels (CO / DCO / coincidence)

Use this after `inversion_priority` to translate the SHIP list into a
concrete genotyping plan.

## Architecture

Reads `inversion_karyotypes` + the focal inversion + tested chromosomes
from `focal_meiosis_scan`. Designer logic in
[`shared/marker_designer.js`](../../../../atlases/relatedness/shared/marker_designer.js).

## Capabilities

- Focal-inversion picker (from `inversion_priority` SHIP list).
- Tested-chromosome multiselect.
- Marker-panel generator (parent classifier + offspring transmission).
- Panel export.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `focal_meiosis_scan`
  output

## User interactions

- Focal-inversion picker.
- Tested-chromosome multiselect.
- "Generate panel" button.
- Panel export (CSV / JSON).

## Outputs

Marker panel JSON / CSV download.

## Connected analyses / adapters

- **IN adapter**: `harvest_file → inversion_karyotypes`.
- **Cross-page**: input from `focal_meiosis_scan` + `inversion_priority`.
- **Downstream**: feeds Pass-2 marker-validation pipeline (out of atlas
  scope).

## Status and known issues

- **Round-1 scaffold** — designer logic prototyped against demo data.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
