# karyotypes — per-sample karyotype calls — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: active (round 1, demo data)

## Purpose

Per-sample genotype calls at every inversion candidate. Sample rows ×
inversion columns, with karyotype cells (`0/0` | `0/1` | `1/1` | `NA`).
Ancestry composition stripe alongside karyotype patterns when
`ancestry_q` is loaded.

## Architecture

Reads `inversion_karyotypes` + `ancestry_q` (optional). Karyotype matrix
shared via [`shared/karyotype_table.js`](../../../../atlases/relatedness/shared/karyotype_table.js).

## Capabilities

- Sample × inversion karyotype matrix.
- Ancestry stripe overlay (when `ancestry_q` loaded).
- Filter by chromosome / inversion status.
- Hover cell → sample · inversion · karyotype · quality.

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `ancestry_q` (optional),
  `family_hub_roster`

## User interactions

- Cell click → drill-down on (sample, inversion).
- Chromosome filter from `#subTabBar`.

## Outputs

Selection state for the cross-page karyotype matrix overlay.

## Connected analyses / adapters

- **IN adapter**: [`harvest_file → inversion_karyotypes`](../../../../atlases/relatedness/registries/extractors/inversion_karyotypes.py) →
  [`inversion_karyotypes_v1`](../../../../atlases/relatedness/registries/schemas/schema_out/inversion_karyotypes_v1.schema.json).
- **Optional ancestry**: [`harvest_file → ancestry_q`](../../../../atlases/relatedness/registries/extractors/ancestry_q.py) →
  [`ancestry_q_v1`](../../../../atlases/relatedness/registries/schemas/schema_out/ancestry_q_v1.schema.json).
- **Upstream**: Inversion Atlas catalogue export.

## Status and known issues

- **`ancestry_q` falls back to synthetic palette** when absent.
- **NA karyotypes** are common — UI shades them grey.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: high
