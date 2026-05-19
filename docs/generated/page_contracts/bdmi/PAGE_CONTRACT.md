# bdmi — BDMI incompatibility screen — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Bateson–Dobzhansky–Muller incompatibility screen. Six population-
genetic tests per inversion candidate:

1. **Mendelian distortion** (per-dyad)
2. **Missing class** (homozygous-1/het/homozygous-2 absences)
3. **Het deficit** (Hardy-Weinberg)
4. **Ancestry interaction** (K=8 stratified)
5. **Long-range forbidden combinations** (pairwise across chromosomes)
6. **Phenotype association** (when phenotype layer is loaded)

Assigns a confidence ladder: weak / moderate / strong / very strong.

## Architecture

Reads `inversion_karyotypes`, `family_hub_roster`, `per_chrom_qc`,
`ancestry_q` (when available). Companion to `regimes` (which screens
out coupled inversions before BDMI calls).

## Capabilities

- Six per-candidate tests.
- Confidence-ladder verdict.
- Per-candidate test-detail expansion.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `family_hub_roster`,
  `ancestry_q`

## User interactions

- Candidate-selector.
- Test-detail expansion.

## Outputs

Per-candidate BDMI verdict feeding the `inversion_priority` table.

## Connected analyses / adapters

- **IN adapters**: `inversion_karyotypes_v1`, `family_hub_roster_v1`,
  `ancestry_q_v1`.
- **Cross-page**: `regimes` must screen the candidate first — coupled
  inversions inflate BDMI false positives.

## Status and known issues

- **Phenotype layer not yet wired** — Test 6 disabled until upstream
  phenotype data ships.
- **Round-1 scaffold** — full six-test runner in flight.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
