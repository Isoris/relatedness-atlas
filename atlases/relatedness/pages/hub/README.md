# `pages/hub/` — Relatedness Atlas evidence hub

Family / Individual evidence hub. The atlas's single stage; every page
lives here. Pages are grouped below by **theme** rather than manifest
stage (which is uniform `hub`).

The hub is paired with the `ngsPedigree` analysis repo
(`C:/Users/quent/Desktop/ngsPedigree`) — that's the producer side; this
atlas is the consumer / browser UI.

## What each page does

### Core relationship-graph pages

| page | label | summary |
|------|-------|---------|
| `network`       | network       | force-directed graph; PO / FS / ambiguous / Mendelian-conflict edges |
| `karyotypes`    | karyotypes    | per-sample × per-inversion karyotype matrix + ancestry stripe |
| `inversions`    | inversions    | candidate inventory with four-stage Mendelian scoring |
| `mendelian`     | mendelian     | **headline feature** — dyad/triad segregation tests (binomial / multinomial) |
| `compatibility` | compatibility | breeding-partner finder with sex-aware + exclude-kin filters |

### Population-genetic screens

| page | label | summary |
|------|-------|---------|
| `bdmi`    | BDMI screen        | six-test Bateson-Dobzhansky-Muller incompatibility screen (weak / moderate / strong / very strong) |
| `regimes` | regime inheritance | screens coupled inversions before BDMI calls (drive-like vs underdominance-like) |

### Meiosis observables (transient — relocating to meiosis-atlas)

| page | label | summary |
|------|-------|---------|
| `meiosis`           | meiosis           | r₁, r₂, r₁₂, C, I; documents the d/x identifiability limit |
| `eligibility`       | eligibility       | per-window NCO/Mb — precondition / **p map** |
| `resolution`        | resolution        | per-window CO/(NCO+CO) — exchange / **x map** proxy |
| `coincidence`       | coincidence       | 2D Sandler interference map |
| `inversion_signature` | inversion signature | three-track diagnostic (NCO + CO + resolution) + verdict cards |
| `focal_meiosis_scan` | inv × meiosis     | focal inv × meiosis coincidence scan with family-aware permutation null |

### Pass-1 → Pass-2 bridge

| page | label | summary |
|------|-------|---------|
| `inversion_priority`    | priority         | per-inversion priority_score + SHIP/HOLD/DROP bucket |
| `marker_test_designer`  | marker designer  | turns a SHIP candidate into a concrete marker panel |

## Vocabulary contracts

### Edge classes (per `res_pairwise_v1`)

| value | meaning |
|-------|---------|
| `PO`            | parent-offspring |
| `FS`            | full siblings |
| `AMBIG`         | ambiguous (e.g. half-sib vs avuncular) |
| `MEND_CONFLICT` | Mendelian conflict flagged by Stage-2 QC |

### Karyotype values (per `inversion_karyotypes_v1`)

| value | meaning |
|-------|---------|
| `0/0` | homozygous reference arrangement |
| `0/1` | heterozygous |
| `1/1` | homozygous alternative arrangement |
| `NA`  | not called (low confidence / missing data) |

### BDMI confidence ladder (per `bdmi`)

| value | meaning |
|-------|---------|
| `weak`        | one test crosses threshold |
| `moderate`    | two tests |
| `strong`      | three or four tests |
| `very strong` | five or six tests |

### Family-permutation status pill (per `focal_meiosis_scan`)

| value | meaning |
|-------|---------|
| `strong` / `moderate` / `weak` | effect strength after family-aware permutation |
| `no effect`                    | within permutation null |
| `FAMILY CONFOUNDED`            | effect explained by family structure — **don't treat as a real meiosis effect** |

## Cross-page dependencies

- **`regimes` MUST screen first** before `bdmi` reports a verdict —
  coupled inversions inflate BDMI false positives.
- **`mendelian` is the headline** — it consumes data from `network`
  (Inspector selection), `karyotypes` (cell selection),
  `family_hub_roster` (sex + role).
- **`inversion_priority`** aggregates verdicts from `bdmi`, `regimes`,
  `inversion_signature`, `focal_meiosis_scan` → its SHIP list feeds
  `marker_test_designer`.
- **The meiosis-observables triplet** (`eligibility` /
  `resolution` / `coincidence`) is conceptually a transient home —
  these pages relocate to the meiosis-atlas in a future round.

## Shared chrome

Every page mount renders the shared chrome:
- [`pop_tree.js`](../../shared/pop_tree.js) — Population Browser tree (§4)
- [`pop_summary.js`](../../shared/pop_summary.js) — Population Summary (§5)
- [`inspector.js`](../../shared/inspector.js) — Inspector / Stats (§10)
- [`loaded_files.js`](../../shared/loaded_files.js) — Loaded files panel (§11)
- [`karyotype_table.js`](../../shared/karyotype_table.js) — karyotype matrix surfaced on the meiosis pages

## Round status

Round 1 ships every page as a scaffold with baked DEMO data. Round 2
replaces DEMO with the four ngsPedigree-produced files (loaded via
[`shared/loaders/`](../../shared/loaders/) JS modules, or via the new
typed `harvest_file` dispatcher path added 2026-05-20).

## IN / OUT adapters

| layer | runner | extractor | schema_out |
|-------|--------|-----------|-----------|
| `res_pairwise`         | [`harvest_file`](../../registries/runners/harvest_file.py) | [`extractors/res_pairwise.py`](../../registries/extractors/res_pairwise.py) | [`res_pairwise_v1`](../../registries/schemas/schema_out/res_pairwise_v1.schema.json) |
| `family_hub_roster`    | `harvest_file` | [`extractors/family_hub_roster.py`](../../registries/extractors/family_hub_roster.py) | [`family_hub_roster_v1`](../../registries/schemas/schema_out/family_hub_roster_v1.schema.json) |
| `per_chrom_qc`         | `harvest_file` | [`extractors/per_chrom_qc.py`](../../registries/extractors/per_chrom_qc.py) | [`per_chrom_qc_v1`](../../registries/schemas/schema_out/per_chrom_qc_v1.schema.json) |
| `inversion_karyotypes` | `harvest_file` | [`extractors/inversion_karyotypes.py`](../../registries/extractors/inversion_karyotypes.py) | [`inversion_karyotypes_v1`](../../registries/schemas/schema_out/inversion_karyotypes_v1.schema.json) |
| `ancestry_q`           | `harvest_file` | [`extractors/ancestry_q.py`](../../registries/extractors/ancestry_q.py) | [`ancestry_q_v1`](../../registries/schemas/schema_out/ancestry_q_v1.schema.json) |

The existing `import_relatedness_tsv` + `normalize_relatedness` actions
(staging → typed promotion) are preserved for the generic TSV-capture
path.

## Server compute endpoints

| endpoint | sync | browser fallback |
|----------|------|------------------|
| `relatedness_mendelian_dyad_test`   | sync  | `mendelian.js::runDyadTest` |
| `relatedness_mendelian_triad_test`  | sync  | `mendelian.js::runTriadTest` |
| `relatedness_cohort_mendelian_scan` | async | `inversions.js::scoreInversion` (per-candidate loop) |
| `relatedness_compatibility_search`  | sync  | `compatibility.js::runCompatibilitySearch` |

Contract source: [`server/RELATEDNESS_ENDPOINTS.md`](../../server/RELATEDNESS_ENDPOINTS.md).

The atlas-side falls back to in-browser compute when an endpoint is
missing — it's fully usable today without the server-side handlers.

## Per-page contracts

[`docs/generated/page_contracts/<page>/`](../../../../docs/generated/page_contracts/) — every hub page has a contract.

## Notes for new contributors

- **Producer / consumer split** — analysis lives in `ngsPedigree`; this
  atlas is browser-only. Don't add analysis logic here.
- **DEMO data path is real** — the scaffold renders even when no TSV
  files are loaded. Always test with and without DEMO.
- **The meiosis triplet relocates** — page contracts mark these as
  "transient home"; don't bake hub-specific assumptions into them.
- **FAMILY CONFOUNDED is not failure** — surface it; many pseudo-
  meiosis effects evaporate under family-aware permutation.
