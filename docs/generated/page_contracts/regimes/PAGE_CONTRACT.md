# regimes — chromosome regime inheritance — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: scaffold (round 1)

## Purpose

Chromosome regime inheritance screen. Tests whether a focal inversion's
segregation distortion is explained by **linkage** to another inversion
on the same chromosome (haplotype-regime coupling), then classifies the
residual signal as **meiotic-drive-like** vs **underdominance-like** via
cross-type comparison.

**Critical role**: prevents over-calling BDMI / drive / underdominance
on coupled inversions in `bdmi` page.

## Architecture

Reads `inversion_karyotypes`, `family_hub_roster`. Companion to `bdmi`
(must screen first).

## Capabilities

- Focal-inversion picker.
- Coupling-test panel.
- Residual-classification panel (drive-like vs underdominance-like).

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `family_hub_roster`

## User interactions

- Focal-inversion picker.

## Outputs

Coupling verdict → cleared inversions go into `bdmi`.

## Connected analyses / adapters

- **IN adapters**: `inversion_karyotypes_v1`, `family_hub_roster_v1`.
- **Cross-page**: feeds `bdmi`.

## Status and known issues

- **Round-1 scaffold**.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: medium (scaffold)
