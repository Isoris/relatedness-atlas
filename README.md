# relatedness-atlas

Family / Individual Evidence Hub — browser UI for the 226-sample pure
*C. gariepinus* hatchery cohort. Consumer of
[ngsPedigree](https://github.com/quentin-andres/ngsPedigree) outputs
(Stage 1 graph annotator, Stage 2 per-chromosome QC, Stage 3 chromosome
inheritance map) plus an inversion karyotype TSV from the
[inversion-atlas](https://github.com/quentin-andres/inversion-atlas).

The headline feature is the Mendelian segregation tester — it tests
Mendelian segregation for selected dyads or triads at every inversion
candidate, using a binomial-exact P-value for dyads and chi-square 1:2:1
for het × het triads, plus Stouffer combination across cohorts.

## Atlas tree

```
relatedness-atlas/
  Relatedness_atlas.{html,js}              ← LEGACY standalone single-file (still works)
  atlases/relatedness/
    manifest.json
    pages/hub/{network,karyotypes,inversions,mendelian,compatibility}.{html,js}
    registries/data/{layers,files,operations,pages,slots}.registry.json
    shared/                                ← demo_data, state, utils, chrome,
                                              pop_tree, pop_summary, inspector,
                                              loaded_files, karyotype_table,
                                              stats, sex_badge, page_hooks
    css/relatedness.css
  _handoff_docs/                           ← migration handoffs
```

## How it fits

The relatedness-atlas is one of five sibling atlases that share the
[atlas-core](https://github.com/quentin-andres/atlas-core) engine:

| Atlas        | Repo                | Brand color |
|--------------|---------------------|-------------|
| Inversion    | inversion-atlas     | blue        |
| Diversity    | diversity-atlas     | green       |
| Genome       | genome-atlas        | orange      |
| Population   | population-atlas    | yellow      |
| Relatedness  | **this repo**       | violet      |

Assemble all five into one browser-loadable workspace with:

```bash
bash atlas-core/build/assemble.sh
cd atlas-workspace
bash start.sh                              # http://localhost:8000/
```

## ngsPedigree pairing

The legacy single-file `Relatedness_atlas.html` + `Relatedness_atlas.js`
live in BOTH `ngsPedigree/pages/` and this repo's root; the two copies are
kept byte-identical (verified by `diff -q`). ngsPedigree is the producer
(analysis pipeline), relatedness-atlas is the consumer (browser UI).

Same producer/consumer split as
inversion-popgen-toolkit ↔ inversion-atlas and
catfish-diversity-analysis ↔ diversity-atlas.

## Status

**Round 1 done (2026-05-11).** Single-file migrated to the same per-page
tree shape as the Inversion Atlas. Registry content is round-2 work per
the kickoff "Architectural-discipline rule (chat-38 step 17)" — Quentin
owns the `requires_layers` / `requires_slots` / `preloads` decisions.
