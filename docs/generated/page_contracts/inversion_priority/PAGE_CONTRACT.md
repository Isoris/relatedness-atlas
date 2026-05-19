# inversion_priority — Pass-1 → Pass-2 bridge — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Pass-1 (WGS discovery, n=226) → Pass-2 (marker validation at scale,
n=10k–50k fish) bridge. One row per inversion with a composite
`priority_score` and a SHIP / HOLD / DROP bucket.

Use this page to pick the 5–20 inversions to take into the next marker
round.

## Architecture

Reads `inversion_karyotypes` + per-candidate verdicts from `bdmi`,
`regimes`, `inversion_signature`, `focal_meiosis_scan`. Scoring logic
in [`shared/inversion_priority.js`](../../../../atlases/relatedness/shared/inversion_priority.js).

## Capabilities

- Per-inversion priority table.
- Composite priority_score.
- SHIP / HOLD / DROP bucket.
- Filter / sort by bucket.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, per-page verdicts

## User interactions

- Sort / filter table.
- Row click → drill into per-candidate evidence.

## Outputs

Top-N list → `marker_test_designer`.

## Connected analyses / adapters

- **IN adapter**: `harvest_file → inversion_karyotypes`.
- **Cross-page**: aggregates verdicts from `bdmi`, `regimes`,
  `inversion_signature`, `focal_meiosis_scan`.

## Status and known issues

- **Composite score weights** persist to localStorage.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
