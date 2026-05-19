# inversion_signature — three-track diagnostic — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Three stacked tracks for one chromosome:
1. NCO/Mb
2. CO/meiosis
3. resolution

Plus per-candidate verdict cards.

**Cross-layer rule**:
- NCO ~ flank + CO suppressed = consistent with active inversion
- CO not suppressed = reject (no inversion signature)
- both low = ancient cold region
- NCO elevated = ambiguous

Karyotype matrix surfaced below.

## Architecture

Reads recomb-track data via [`shared/recomb_track.js`](../../../../atlases/relatedness/shared/recomb_track.js)
+ `inversion_karyotypes`. Verdict cards driven by
[`shared/inversion_meiosis.js`](../../../../atlases/relatedness/shared/inversion_meiosis.js).

## Capabilities

- Three stacked tracks.
- Per-candidate verdict cards (consistent / reject / ancient cold / ambiguous).
- Karyotype matrix.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, demo recomb track

## User interactions

- Chromosome selector.
- Verdict-card click → centre on candidate.

## Outputs

Verdict consumed by `inversion_priority`.

## Connected analyses / adapters

- **Future Mode B**: per-individual CO call layer.

## Status and known issues

- **The cross-layer rule** is a heuristic — verdict cards report it but
  don't claim certainty.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
