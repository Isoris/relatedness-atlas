# meiosis — meiotic crossover observables — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Meiotic crossover observables — the introductory page for the future
Meiosis Atlas.

Quantities:
- single CO rates (r₁, r₂)
- double CO rate (r₁₂)
- coefficient of coincidence C = r₁₂ / (r₁ · r₂)
- interference I = 1 − C

Documents the **d / x identifiability limitation**: from offspring
genotype data alone the precondition probability d and exchange
probability x are not separable. Per-inversion-carrier CO frequency is a
stub until a per-individual CO call layer arrives.

## Architecture

Reads `inversion_karyotypes`, `family_hub_roster`. Shared module
[`recomb_data.js`](../../../../atlases/relatedness/shared/recomb_data.js)
holds the demo CO calls; round-2 swaps to a registry-backed layer.

## Capabilities

- Display r₁, r₂, r₁₂, C, I per chromosome.
- Document the d / x identifiability limit.
- Per-inversion-carrier CO frequency stub.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, demo CO calls
- **Future Mode B**: per-individual CO call layer (to be added when the
  meiosis-atlas ships)

## User interactions

- Chromosome filter from `#subTabBar`.

## Outputs

Preview only.

## Connected analyses / adapters

- None typed yet. Will move to the meiosis-atlas (transient home here).

## Status and known issues

- **Stub** — substrate produced by the future meiosis-atlas pipeline.
- **d / x identifiability** is an inherent limit; page surfaces it
  rather than hiding it.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (stub; awaiting meiosis-atlas)
