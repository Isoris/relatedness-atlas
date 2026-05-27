# Relatedness Atlas — workflow registration for atlas-core Catalogue

This directory mirrors the popstats `toolkit_registries/<atlas>/01_registry/`
contract so atlas-core's Catalogue (page 4) can surface every Relatedness
Atlas workflow without bespoke wiring.

## What's in here

```
module_registry.jsonl     9 rows  · one per biomod module backing the analyses
analysis_registry.jsonl  22 rows  · 21 atomic analyses + 1 CHAIN workflow
analysis_modes.jsonl     22 rows  · exactly one per bloc, no fan-out by scope
layer_registry.jsonl     15 rows  · output layers (analysis_result kind) referenced by produces
```

All rows tagged `atlas: "relatedness_atlas"`. Cohort: 226-sample hatchery
*Clarias gariepinus* on `fClaHyb_Gar_LG`. No cross-species rows.

## What's stable vs experimental_gated

Per `_handoff_docs/AUDIT_2026-05-15_meiosis_stack.md`, modules and
analyses are marked:

- **`stable`** — round-1 Mendelian + Compatibility operations; the
  single-CO calculator. Produce real numbers today.
- **`experimental`** — BDMI screen + Regime inheritance pages. Karyotype-
  only math; correct on synthetic and real input, just not yet validated
  on the 226-sample cohort.
- **`experimental_gated`** — the meiosis stack (eligibility, resolution,
  coincidence, inversion_signature, focal_inversion_meiosis_scan,
  inversion_priority_rank, marker_panel_design) plus the
  `inversion_karyotype_meiosis_pipeline` CHAIN. Layout is correct;
  current numbers are synthetic. Unblocks when the
  `shared/loaders/ngstracts_co_calls.js` adapter lands per the audit
  schema.

## The CHAIN workflow

`inversion_karyotype_meiosis_pipeline` is the manuscript-path-B target:

```
inversion_karyotypes  (Inversion Atlas product)
        ↓
parental_meiosis_grouping  (parents-of-triad split by focal karyotype)
        ↓
focal_inversion_meiosis_scan  (C_carrier vs C_control, family-aware perm)
        ↓
inversion_priority_rank  (composite score → SHIP/HOLD/DROP)
        ↓
marker_panel_design  (focal classifier + recombination-marker triplets)
```

Final produce: `marker_panel_design`. This is the one-bloc CHAIN
analogous to popstats `inversion_groupwise_popstats`.

## Atlas-core smoke-test constraints (verified)

- ✅ Every `analysis_modes.analysis_type` ∈ `analysis_registry.analysis_id`
- ✅ Every `analysis_modes.produces` is single-valued AND ∈ that registry row's declared `produces`
- ✅ Every `analysis_modes.module_name` ∈ `module_registry.module_name`

## Cross-references

- Browser-side reference implementations: `atlases/relatedness/pages/hub/*.js`
- Server-side contract (some endpoints not yet registered in `atlas_server.py::COMPUTE_REGISTRY`): `atlases/relatedness/server/RELATEDNESS_ENDPOINTS.md`
- Round-1 operations contract: `atlases/relatedness/registries/data/operations.registry.json`
- Round-2 page additions: `_handoff_docs/HANDOFF_2026-05-15_round2_done.md`
- **Honest audit (READ BEFORE TRUSTING NUMBERS):** `_handoff_docs/AUDIT_2026-05-15_meiosis_stack.md`

## What atlas-core's Catalogue can do today

With these registrations, page 4 can surface:

- 8 **stable / experimental** analyses that produce real numbers on the
  current cohort: `mendelian_dyad_test`, `mendelian_triad_test`,
  `cohort_mendelian_scan`, `compatibility_search`, `bdmi_screen` (and
  its 6 atomic sub-tests), `regimes_linked_inversion`,
  `regimes_mechanism_classifier`, `single_co_calculator`.
- 7 **experimental_gated** analyses that are layout-ready but produce
  synthetic numbers today: the meiosis stack.
- 1 **CHAIN** that becomes runnable end-to-end once the ngsTracts
  adapter lands.

The Catalogue should treat `biomod_status == "experimental_gated"` as
"surface in the UI but block 'Run' button"; the `stale_reason` field
gives the human-readable explanation.
