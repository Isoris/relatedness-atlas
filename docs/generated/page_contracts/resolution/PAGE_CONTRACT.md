# resolution — per-window CO/(NCO+CO) (exchange / x map) — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Per-window CO/(NCO+CO) share — the closest visible proxy for the latent
exchange probability **x**. Windows with too few events are greyed out.

**Diagnostic rule**: inside an active heterokaryotypic inversion,
resolution drops sharply while NCO is preserved (per `eligibility`).

Karyotype matrix surfaced below.

## Architecture

Reads recomb-track data via
[`shared/recomb_track.js`](../../../../atlases/relatedness/shared/recomb_track.js)
+ `inversion_karyotypes`.

## Capabilities

- Per-window resolution track.
- Greyed-out low-N windows.
- Inversion-footprint overlay.
- Karyotype matrix below.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, demo recomb track

## User interactions

- Chromosome selector.

## Outputs

Preview only.

## Connected analyses / adapters

- **Future Mode B**: per-individual CO call layer.

## Status and known issues

- **Per the d/x identifiability limit** documented on `meiosis`, this
  is a proxy — not x itself.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
