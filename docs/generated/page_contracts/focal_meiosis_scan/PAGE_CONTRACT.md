# focal_meiosis_scan — focal inv × meiosis coincidence — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1; transient home)

## Purpose

Focal inversion × meiosis coincidence scan. For each focal inversion,
compares the coefficient of coincidence on every tested chromosome
**between carriers and matched non-carriers**, using a family-aware
permutation null.

Each row carries:
- intra / inter relation tag (focal-chrom intra vs cross-chrom inter)
- status pill: strong / moderate / weak / no effect / **FAMILY CONFOUNDED**

**Transient home**: this is the seed page of the future Meiosis Atlas.

## Architecture

Reads `inversion_karyotypes`, `family_hub_roster` (for permutation
matching), recomb-track data.

## Capabilities

- Per-(focal × chrom) coincidence comparison.
- Family-aware permutation null.
- Status pill per row.
- Filter by status / intra/inter / focal inversion.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `family_hub_roster`,
  demo recomb track

## User interactions

- Focal-inversion picker.
- Status-pill filter.
- Row click → drill on (focal, chrom).

## Outputs

`focal_meiosis_scan` results consumed by `inversion_priority`.

## Connected analyses / adapters

- **IN adapter**: `harvest_file → inversion_karyotypes` +
  `harvest_file → family_hub_roster`.
- **Future Mode B**: dedicated meiosis-atlas layer.

## Status and known issues

- **FAMILY CONFOUNDED** is a real status — the family-aware permutation
  catches it. UI surfaces it prominently so it's not mistaken for a
  real effect.
- **Transient home** — page may relocate to the meiosis-atlas in a
  future round.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold; relocating)
