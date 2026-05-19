# mendelian — Mendelian segregation tester — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: active (round 1) · **the headline feature**

## Purpose

The atlas's headline feature. Pick a dyad (parent–offspring) or triad
(both parents + offspring), choose an inversion subset, run binomial
(dyad) or multinomial (triad) tests for Mendelian segregation
deviation per candidate.

## Architecture

Reads `inversion_karyotypes`, `family_hub_roster`, `per_chrom_qc`. Two
compute endpoints:

- `relatedness_mendelian_dyad_test` (sync; browser fallback
  [`mendelian.js::runDyadTest`](../../../../atlases/relatedness/pages/hub/mendelian.js))
- `relatedness_mendelian_triad_test` (sync; browser fallback
  [`mendelian.js::runTriadTest`](../../../../atlases/relatedness/pages/hub/mendelian.js))

## Capabilities

- Dyad / triad selector (via Inspector).
- Inversion-subset picker.
- Binomial / multinomial test.
- Per-candidate p-value table.

## Required data

- **Registry says (round 1)**: `requires_layers: []`,
  `preload_on: page_mount:mendelian` for `per_chrom_qc`
- **Actually consumed**: `inversion_karyotypes`, `family_hub_roster`,
  `per_chrom_qc`

## User interactions

- Dyad/triad selector.
- Inversion-subset multiselect.
- "Run test" button.

## Outputs

Per-candidate p-value table.

## Connected analyses / adapters

- **IN adapters**: `inversion_karyotypes` + `family_hub_roster` + `per_chrom_qc`.
- **Compute**: see endpoints above (each has a browser fallback).

## Status and known issues

- **Browser-side compute** is the round-1 default. Server endpoints
  add deterministic shared compute when they ship.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: high
