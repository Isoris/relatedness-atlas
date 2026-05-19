# eligibility — per-window NCO/Mb (precondition / p map) — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Per-window NCO (non-crossover) density across one chromosome. NCO
traces the **precondition / DSB substrate layer**:
- high NCO = plentiful DSB substrate
- low NCO = ancient cold region

Inversion footprints overlaid. Karyotype matrix surfaced below so the
reader can see who carries which arrangement.

Part of the meiosis triplet: **eligibility (p map)** → **resolution
(x map)** → **coincidence**.

## Architecture

Reads recomb-track data via
[`shared/recomb_track.js`](../../../../atlases/relatedness/shared/recomb_track.js)
+ `inversion_karyotypes` for the karyotype matrix.

## Capabilities

- Per-window NCO/Mb track.
- Inversion-footprint overlay.
- Karyotype matrix below.
- Chromosome selector.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, demo recomb track

## User interactions

- Chromosome selector.
- Inversion-footprint click → centre on candidate.

## Outputs

Preview only.

## Connected analyses / adapters

- **Future Mode B**: per-individual NCO call layer (will live in the
  meiosis-atlas).

## Status and known issues

- **Demo recomb track** until meiosis-atlas substrate ships.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
