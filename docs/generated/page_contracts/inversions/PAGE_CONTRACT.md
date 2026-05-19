# inversions — candidate inventory + four-stage scoring — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: active (round 1, demo data)

## Purpose

All inversion candidates from the Inversion Atlas — filterable by
status / chromosome / length / frequency. Each candidate carries a
four-stage Mendelian-conflict score derived from `per_chrom_qc` +
`inversion_karyotypes`.

## Architecture

Reads `inversion_karyotypes`, `per_chrom_qc`, plus the optional cohort
Mendelian scan endpoint (`relatedness_cohort_mendelian_scan` —
browser fallback in [`inversions.js::scoreInversion`](../../../../atlases/relatedness/pages/hub/inversions.js)).

## Capabilities

- Candidate table (sortable, filterable).
- Per-candidate four-stage score breakdown.
- Cohort Mendelian scan trigger.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `per_chrom_qc`

## User interactions

- Filter pills (status / chromosome / length / frequency).
- Row click → centre other pages on this candidate.
- "Cohort scan" button.

## Outputs

Selected `candidate_id` → drives other hub pages.

## Connected analyses / adapters

- **IN adapters**: `harvest_file → inversion_karyotypes_v1` +
  `harvest_file → per_chrom_qc_v1`.
- **Server compute (optional)**: `relatedness_cohort_mendelian_scan`
  (async; see [`server/RELATEDNESS_ENDPOINTS.md`](../../../../atlases/relatedness/server/RELATEDNESS_ENDPOINTS.md)).
- **Browser fallback**: per-candidate scoring loop in `inversions.js`.

## Status and known issues

- **Server fallback path** is the round-1 default — page works without
  the cohort scan endpoint.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: high
