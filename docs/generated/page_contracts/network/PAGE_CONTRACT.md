# network — relationship graph — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: active (round 1, demo data)

## Purpose

Force-directed graph of the evidence hub. Edges classified by ngsPedigree
Stage 1: parent-offspring (PO), full-sibling (FS), ambiguous, Mendelian-
conflict. Click a node to centre the evidence hub on that individual.

## Architecture

Reads `res_pairwise` for edges + `family_hub_roster` for nodes. Runtime
falls back to baked DEMO data in
[`shared/demo_data.js`](../../../../atlases/relatedness/shared/demo_data.js)
when the loaders haven't fired.

Shared chrome rendered on every page mount:
[`shared/chrome.js`](../../../../atlases/relatedness/shared/chrome.js),
[`pop_tree.js`](../../../../atlases/relatedness/shared/pop_tree.js),
[`pop_summary.js`](../../../../atlases/relatedness/shared/pop_summary.js),
[`inspector.js`](../../../../atlases/relatedness/shared/inspector.js),
[`loaded_files.js`](../../../../atlases/relatedness/shared/loaded_files.js).

## Capabilities

- Force-directed layout.
- Edge classes (PO / FS / ambiguous / Mendelian-conflict).
- Click node → centre hub + Inspector.
- Filter by hub / family / edge class.

## Required data

- **Registry says (round 1)**: `requires_layers: []` (registry-content
  out-of-scope per kickoff rule)
- **Actually consumed**: `res_pairwise`, `family_hub_roster`

## User interactions

- Node click → recentre hub.
- Edge filter pills.

## Outputs

`activeIndividual` state slot (Inspector reacts).

## Connected analyses / adapters

- **IN adapter**: [`harvest_file → res_pairwise`](../../../../atlases/relatedness/registries/extractors/res_pairwise.py) →
  [`res_pairwise_v1`](../../../../atlases/relatedness/registries/schemas/schema_out/res_pairwise_v1.schema.json).
- **Upstream**: ngsPedigree Stage 1 (STEP_PED_01_annotate_relationships.py).

## Status and known issues

- **Demo data fallback** — until ngsPedigree TSVs land, page renders the
  baked DEMO graph.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)
- **Layer doc**: [layers.registry.json](../../../../atlases/relatedness/registries/data/layers.registry.json) → `layers.res_pairwise`

**Confidence**: high
