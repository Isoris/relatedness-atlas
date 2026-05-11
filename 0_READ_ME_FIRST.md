# 🟢 START HERE — Population / Diversity / Genome atlas kickoffs

**Date:** 2026-05-07
**Author:** continuation of the chat-38 cont. session that closed
round-5-step-18 of the Inversion Atlas migration.
**Project:** MS_Inversions_North_african_catfish — 226-sample pure
*C. gariepinus* hatchery cohort, LANTA HPC.

---

## What this is

You asked for handoffs for the three sibling atlases analogous to
what the Inversion Atlas has. These three documents are **kickoff /
scoping** handoffs, not round-N continuations — because none of
the three sibling atlases has had a prior migration round.

Each kickoff describes:
1. Where the atlas stands today (what file exists, what shape it's
   in).
2. What it would mean to bring it under the same architecture as
   the Inversion Atlas.
3. What you need to decide before the first real migration round
   can start.
4. A concrete "first round" plan once decisions are made.

This is the honest version of "round 0" for each.

---

## The four-atlas picture

Per the ADR-14 four-file split (late April 2026):

| Atlas | File | Repo (per the four-repo split) | Status |
|---|---|---|---|
| Inversion | `Inversion_atlas.html` (legacy) | `inversion-atlas` / `inversion-popgen-toolkit` (dismantled post-v20) | **17 of 21 pages migrated** into `atlas-core` + `inversion-atlas/atlases/inversion/...`; 919/919 tests; round 5 step 18 just done |
| Population | `Population_atlas.html` (~63 KB scaffold) | `catfish-population-analysis` | **No migration yet.** Standalone scaffold HTML. |
| Diversity | `Diversity_atlas.html` (~2.5 MB, v2.4) | `catfish-diversity-analysis` | **No migration yet.** Standalone single-file. |
| Genome | `Genome_atlas.html` (~27 KB scaffold) | `catfish-genome-assembly` | **No migration yet.** Originally page 14 of the Inversion Atlas, then split out per ADR-14. |

The cohort split (NEVER violate):
1. **F₁ hybrid** (*C. gariepinus* × *C. macrocephalus*) — Genome
   Atlas / genome assembly paper only.
2. **226-sample pure *C. gariepinus* hatchery cohort on LANTA** —
   Inversion Atlas + Population Atlas + Diversity Atlas.
3. **Pure *C. macrocephalus* wild cohort** — future paper.

The Genome Atlas is the only one of the four that describes the F₁
hybrid; the other three all describe the 226-sample hatchery cohort.

---

## Reference architecture — go look at the Inversion Atlas first

Before starting any of the three sibling-atlas migrations, **read
the Inversion Atlas tree as the reference**. The shape that the
trio should converge to is:

```
atlas-core/                              ← shared engine, atlas-agnostic
  core/
    atlas_api.js, atlas_router.js, atlas_state.js,
    cache_store.js, layer_router.js, operation_runner.js,
    prewarm_scheduler.js, registry_core.js, registry_core.schema.json
  css/                                   ← shared atlas-chrome CSS
  server/                                ← atlas-core dev server
  index.html                             ← atlas-core shell
  tests/                                 ← engine tests
  toolkit_registries/                    ← shared registry definitions

<some-atlas>/                            ← atlas-specific repo
  atlases/<atlas-id>/
    manifest.json                        ← atlas_id, atlas_name, atlas_version,
                                              pages[], registries{}, shared_modules{},
                                              server{}, engines_dir, css_dir, stages[]
    pages/<stage>/page<N>.{html,js}      ← one page per "tab"
    pages/<stage>/page<N>/{_state.js,    ← per-page sub-modules
                          *_panel.js, …}
    registries/data/{layers,files,operations,pages,slots}.registry.json
    shared/                              ← per-atlas helpers (kmeans, hungarian, …)
    engines/                             ← per-atlas analysis pipelines
    css/, server/, analysis/, data/
  tests/{test_<stage>_page<N>.js,
        smoke_<stage>_page<N>_round<R>.mjs}
  _tooling/run_migrated_tests.sh
  _handoff_docs/                         ← migration handoffs
```

The Inversion Atlas in the round-5-step-18 tarball is the canonical
example of every one of those slots filled in.

### Key things the Inversion Atlas got right (worth copying)

- **`atlas-core` is its own repo, completely atlas-agnostic.** Three
  atlases can sit on the same engine.
- **`manifest.json` is the single source of truth** for an atlas:
  pages, registries, shared modules, server config, stages. The
  engine boots from this file.
- **Five registries**: `pages.registry.json` (which page declares
  what `requires_layers` / `requires_slots`), `layers.registry.json`
  (what layers exist), `slots.registry.json`, `files.registry.json`,
  `operations.registry.json`. Each is JSON; each has a sibling
  `_doc` block.
- **Pages are migrated one at a time**, never wholesale. Each page
  gets a unit test + a smoke test with the synthetic-DOM pattern.
  876 → 919 just for one ~30-min review-tier-1 migration.
- **"Stages"** group pages: `discovery` → `review` → `catalogue` →
  `comparative` for the Inversion Atlas. Each sibling atlas will
  pick its own stages.
- **Architectural-discipline rule (chat-38 step 17):** registry
  content (`requires_layers` / `requires_slots` / `preloads`) is
  **out-of-scope for migrations**. Migrations only add `_label` +
  `_doc` + flag mismatches in the `_doc`; Quentin owns the content
  decisions. This rule applies to all four atlases — write it into
  the first round handoff for each.

### Reading order before starting any of the three

1. `inversion-atlas/atlases/inversion/manifest.json` — see the
   shape.
2. `inversion-atlas/atlases/inversion/pages/discovery/page1.html` +
   `page1.js` + `page1/` subdir — see a "big page" with sub-modules.
3. `inversion-atlas/atlases/inversion/pages/review/page7.js` (220 LOC)
   + `pages/review/page7/_state.js` (14 LOC) + `tests/test_review_page7.js`
   (100 LOC) + `tests/smoke_review_page7_round5.mjs` (200 LOC) —
   see the **simplest possible migrated page** (pattern 4
   thin-loader-stub variant). This is the template every "external
   renderer" page should follow.
4. `inversion-atlas/_tooling/run_migrated_tests.sh` — see how the
   test harness is structured.
5. The most recent `CONTINUE_HERE_*` + `HANDOFF_*` pair in the
   Inversion Atlas handoff stream — to see the cadence of handoff
   writing.

---

## How to use these kickoffs

Each of the three per-atlas kickoff files is structured the same
way:

1. **What exists today** — the literal current state.
2. **Open questions for Quentin** — what needs to be decided
   before any "real round 1" can be planned.
3. **First-round plan** — what round 1 looks like once the open
   questions are answered.
4. **Reference paths** — exact pointers into the Inversion Atlas
   tree.

The three files:

- `KICKOFF_population_atlas.md`
- `KICKOFF_diversity_atlas.md`
- `KICKOFF_genome_atlas.md`

---

## Recommended VS Code folder layout

Following the four-repo split (per chat 6144abe7 / "merging module
3 into diversity repository"), the recommended layout for Claude
Code in VS Code is:

```
~/Atlas_workspace/                       ← parent folder
  atlas-core/                            ← engine, shared (already exists)
  inversion-atlas/                       ← currently active migration (17 / 21 pages)
  population-atlas/                      ← NEW — to be created
    Population_atlas.html                ← drop the current scaffold here
    KICKOFF_population_atlas.md          ← this kickoff (copy in)
    atlases/                             ← created at round 1
      population/
        manifest.json
        pages/
        registries/
        ...
    tests/
    _tooling/
    _handoff_docs/
  diversity-atlas/                       ← NEW — to be created
    Diversity_atlas.html
    KICKOFF_diversity_atlas.md
    atlases/diversity/...
    ...
  genome-atlas/                          ← NEW — to be created
    Genome_atlas.html
    KICKOFF_genome_atlas.md
    atlases/genome/...
    ...
```

**Why three separate repos and not one big `atlases/` monorepo:**
Quentin's four-repo split (population, diversity, variant,
inversion) was made deliberately at the analysis-pipeline level —
each repo owns one analytical question. Mirroring that split at
the atlas level keeps the analysis repo and its atlas repo close.
Also, the Inversion Atlas migration is already its own self-
contained tarball trio (`atlas-core` + `inversion-atlas` +
`handoff`); adding three more `inversion-atlas-style` siblings is
the cheapest move.

(If at some point you want to consolidate everything into one
`atlases-monorepo` repo, that's fine — the four-repo split is a
convention, not a constraint. But default to mirroring it.)

---

## Order of attack

You probably **don't want to migrate all three at once.** The
Inversion Atlas has consumed most of a year of chat-time precisely
because page-by-page migration is the right discipline. Pick one
of the three to start, and let the other two stay as flat HTML
until that one is at the "review tier-1" milestone.

Suggested order (lowest-cost first):

1. **Genome Atlas** — it's a 27 KB scaffold. Almost no real content
   yet; the migration is mostly about establishing the skeleton +
   `manifest.json` + `atlases/genome/...` structure. Once done, it
   becomes the **template** for Population + Diversity (which both
   have more content).
2. **Population Atlas** — also a small scaffold (63 KB). One real
   migration round will get its first 1-3 pages migrated.
3. **Diversity Atlas** — by far the biggest (2.5 MB v2.4). Lots of
   in-page content. This is the one that genuinely needs the
   page-by-page discipline.

But the order is your call. Each kickoff is written so that any
one of the three can be started first.

---

## What this kickoff IS NOT

- Not a "round 1 handoff." None of the three atlases has had a
  round 1 yet. These docs are the scoping needed before round 1
  can be planned.
- Not an audit of what's inside the three HTML files. That work
  belongs to the first real round (or to a pre-round-1 audit
  session, see each kickoff's "first-round plan" section).
- Not a commitment that all three need to be migrated. You may
  decide some can stay as flat HTML forever; that's a legitimate
  endpoint.

---

## Communication preferences (still active)

Terse, direct, signal-not-flattery. PhD on LANTA, manuscript v19→v20
targeting Nature Communications.

**Active directives:**
- Migrate page by page; never wholesale.
- Page renumbering at the complete end of all migrations.
- **NO workspace rename** (for the Inversion Atlas; the three
  sibling atlases haven't named their workspaces yet — that
  decision is in their kickoffs).
- **Registry content is out-of-scope for migrations** (rule
  established Inversion Atlas step 17).
- **Three-cohort discipline (NEVER violate)** — see top of this
  file.

---

## Suggested next move

1. Drop the three current HTMLs (`Genome_atlas.html`,
   `Population_atlas.html`, `Diversity_atlas.html`) into three new
   sibling folders in VS Code.
2. Drop each kickoff into the matching folder.
3. Read this file + the relevant kickoff + the Inversion Atlas
   reference paths it points at.
4. Answer the kickoff's "open questions" section.
5. Then schedule round 1.
