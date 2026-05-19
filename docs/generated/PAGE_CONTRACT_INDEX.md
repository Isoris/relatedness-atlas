# Relatedness Atlas — Page Contract Index

Per-page capability contracts for all 15 Relatedness Atlas pages. Each
contract follows the Inversion Atlas template: Purpose · Architecture ·
Capabilities · Required data · Interactions · Outputs · Adapters ·
Status · Documents.

All pages share the single manifest stage `hub` ("evidence hub"). The
groupings below are thematic, not stage-based.

## By theme

### Core relationship pages

- [`network`](page_contracts/network/PAGE_CONTRACT.md) — force-directed graph · round 1
- [`karyotypes`](page_contracts/karyotypes/PAGE_CONTRACT.md) — per-sample × per-inversion matrix · round 1
- [`inversions`](page_contracts/inversions/PAGE_CONTRACT.md) — candidate inventory + four-stage scoring · round 1
- [`mendelian`](page_contracts/mendelian/PAGE_CONTRACT.md) — **headline** segregation tester · round 1
- [`compatibility`](page_contracts/compatibility/PAGE_CONTRACT.md) — breeding-partner finder · round 1

### Population-genetic screens

- [`bdmi`](page_contracts/bdmi/PAGE_CONTRACT.md) — six-test BDMI screen · scaffold
- [`regimes`](page_contracts/regimes/PAGE_CONTRACT.md) — coupling-aware drive vs underdominance · scaffold

### Meiosis observables (transient — relocating to meiosis-atlas)

- [`meiosis`](page_contracts/meiosis/PAGE_CONTRACT.md) — CO observables; d/x identifiability · scaffold
- [`eligibility`](page_contracts/eligibility/PAGE_CONTRACT.md) — NCO/Mb (**p map**) · scaffold
- [`resolution`](page_contracts/resolution/PAGE_CONTRACT.md) — CO/(NCO+CO) (**x map** proxy) · scaffold
- [`coincidence`](page_contracts/coincidence/PAGE_CONTRACT.md) — Sandler interference map · scaffold
- [`inversion_signature`](page_contracts/inversion_signature/PAGE_CONTRACT.md) — three-track diagnostic + verdict cards · scaffold
- [`focal_meiosis_scan`](page_contracts/focal_meiosis_scan/PAGE_CONTRACT.md) — focal inv × meiosis coincidence scan · scaffold

### Pass-1 → Pass-2 bridge

- [`inversion_priority`](page_contracts/inversion_priority/PAGE_CONTRACT.md) — SHIP/HOLD/DROP · scaffold
- [`marker_test_designer`](page_contracts/marker_test_designer/PAGE_CONTRACT.md) — marker panel generator · scaffold

## Adapter modes (IN side)

| mode | path | status |
|------|------|--------|
| **TSV staging** | `import_relatedness_tsv` → `extract_staging_relatedness_v0` (loose passthrough) | active |
| **Staging → typed promotion** | `normalize_relatedness` (reads `target.source_layer_id` from layers index) → `ngsrelate_pairs_v1` | active |
| **File-backed — typed** | [`harvest_file`](../../atlases/relatedness/registries/runners/harvest_file.py) → per-layer typed extractor → typed envelope | wired 2026-05-20 |

The typed file-backed mode walks the **two-step indirection**:
`layer_key` → `source_file` (from layers.registry.json) → `path_template`
(from files.registry.json). Unique to this atlas — pattern variant of
diversity-atlas's master_config indirection and population-atlas's
atlas-relative paths.

## Layer inventory snapshot

| layer | tier | preload | adapter |
|-------|------|---------|---------|
| `res_pairwise`         | hot  | atlas_open       | `harvest_file → res_pairwise_v1` |
| `family_hub_roster`    | hot  | atlas_open       | `harvest_file → family_hub_roster_v1` |
| `per_chrom_qc`         | warm | page_mount:mendelian | `harvest_file → per_chrom_qc_v1` |
| `inversion_karyotypes` | hot  | atlas_open       | `harvest_file → inversion_karyotypes_v1` |
| `ancestry_q`           | warm | atlas_open       | `harvest_file → ancestry_q_v1` (optional; falls back to demo palette) |

All five carry browser-side JS loaders in
[`shared/loaders/`](../../atlases/relatedness/shared/loaders/) — the
runtime can take either path (JS loader or dispatcher envelope).

## Server compute endpoints

| endpoint | sync | browser fallback |
|----------|------|------------------|
| `relatedness_mendelian_dyad_test`   | sync  | `mendelian.js::runDyadTest` |
| `relatedness_mendelian_triad_test`  | sync  | `mendelian.js::runTriadTest` |
| `relatedness_cohort_mendelian_scan` | async | `inversions.js::scoreInversion` |
| `relatedness_compatibility_search`  | sync  | `compatibility.js::runCompatibilitySearch` |

## Stage README

[`pages/hub/README.md`](../../atlases/relatedness/pages/hub/README.md) — single-stage README covering all 15 pages.

## Round phasing

| round | scope |
|-------|-------|
| 1     | all 15 pages ship as scaffolds with baked DEMO data; loaders wired; server fallback for the 4 compute endpoints |
| 2     | replace DEMO with ngsPedigree-produced TSVs (via JS loaders or dispatcher `harvest_file`) |
| 3+    | move meiosis triplet to the meiosis-atlas; promote `inversion_priority` SHIP list to a server endpoint |
