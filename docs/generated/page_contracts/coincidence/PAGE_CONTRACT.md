# coincidence — Sandler interference map — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

2D per-window-pair heatmap of the coefficient of coincidence
C = r₁₂ / (r₁ · r₂) for one chromosome — the Sandler interference map.

Interpretation:
- C ≈ 1 → independence (no interference)
- C < 1 → positive interference (the normal pattern)
- C ≫ 1 → negative interference (usually an artefact; flag)

Click any cell to inspect the window-pair. Karyotype matrix below.

## Architecture

Reads recomb-track data via [`shared/recomb_track.js`](../../../../atlases/relatedness/shared/recomb_track.js)
+ `inversion_karyotypes`.

## Capabilities

- 2D window-pair heatmap.
- Cell click → window-pair inspection.
- Chromosome selector.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, demo recomb track

## User interactions

- Chromosome selector.
- Cell click → pair inspector.

## Outputs

Preview only.

## Connected analyses / adapters

- **Future Mode B**: per-individual CO call layer.

## Status and known issues

- **C ≫ 1 cells** are flagged as likely artefacts in the UI.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
