# Relatedness Atlas — Round 1 done (2026-05-11)

First migration round done. The single-file `Relatedness_atlas.html` /
`Relatedness_atlas.js` (1731 + 3134 LOC) is now split into the same per-page
tree shape as the Inversion Atlas, with a single stage `hub` containing the
five sub-tabs of the legacy mockup.

## Tree

```
relatedness-atlas/
  Relatedness_atlas.html                   ← LEGACY (still works, do not touch)
  Relatedness_atlas.js                     ← LEGACY (still works, do not touch)
  0_READ_ME_FIRST.md
  atlases/
    relatedness/
      manifest.json                        ← atlas_id, version, pages, registries, css
      pages/
        hub/
          network.{html,js}     + network/_state.js
          karyotypes.{html,js}  + karyotypes/_state.js
          inversions.{html,js}  + inversions/_state.js
          mendelian.{html,js}   + mendelian/_state.js
          compatibility.{html,js} + compatibility/_state.js
      registries/data/{layers,files,operations,pages,slots}.registry.json
      shared/
        demo_data.js     ← §1 verbatim, ES-module export DEMO + import { hashStr }
        state.js         ← §2 verbatim, ES-module export state (with state.compat init)
        utils.js         ← §2 utilities ($, $$, el, fmt, hashStr)
        chrome.js        ← §3 minus sub-tab routing (router owns that now)
        pop_tree.js      ← §4 (left column)
        pop_summary.js   ← §5 (left column bottom)
        inspector.js     ← §10 (right column)
        loaded_files.js  ← §11 (right column footer)
        karyotype_table.js ← §7 renderer (shared by Network preview + Karyotypes page)
        stats.js         ← logChoose / binomialPValueTwoSided / chiSquarePValue /
                            expectedOffspringPrior (extracted from §9)
        sex_badge.js     ← sexBadgeHtml (extracted from §9b)
        page_hooks.js    ← tiny pub/sub bus for cross-page selection events
      css/
        relatedness.css  ← <style> block extracted verbatim (1243 LOC)
      data/              ← empty in round 1
  _handoff_docs/
    HANDOFF_2026-05-11_round1_done.md      ← this file
```

## Wired into atlas-core

`atlas-core/build/atlas.config` now lists `atlas_relatedness = ../../relatedness-atlas`.
After `bash atlas-core/build/assemble.sh`:

```
==> copying atlas relatedness: /mnt/c/Users/quent/Desktop/relatedness-atlas/atlases/relatedness/
...
    atlases: inversion diversity genome population relatedness
```

The shell at `http://localhost:8000/` will discover the manifest via
`atlases/_index.json` and expose `#/relatedness/network`, `…/karyotypes`,
`…/inversions`, `…/mendelian`, `…/compatibility` URLs.

## ngsPedigree pairing

The Relatedness Atlas is paired with the analysis repo at
`C:\Users\quent\Desktop\ngsPedigree`. ngsPedigree's `pages/` folder holds the
**same** `Relatedness_atlas.html` + `.js` files (verified identical by `diff
-q`); the relatedness-atlas repo is the migration/consumer side.

Round-2 wiring (out of scope for this round, per the kickoff rule):

| ngsPedigree output                              | atlas pillBar slot | atlas layer (planned) |
|--------------------------------------------------|--------------------|------------------------|
| Stage 1 `pairwise_relationship_classification.tsv` | `.res`             | `res_pairwise`         |
| Stage 1 `family_hub_roster.tsv`                  | (same .res slot)   | `family_hub_roster`    |
| Stage 2 per-chromosome QC                        | (same .res slot)   | `per_chrom_qc`         |
| Stage 3 chromosome inheritance map               | `beagle`           | `chrom_inheritance_map`|
| Inversion-atlas catalogue export                 | `inv`              | `inversion_karyotypes` |

These are stubbed under `_planned_layers_round_2` /
`_planned_files_round_2` in the layers + files registries.

## Architectural notes

1. **Chrome routing**: the legacy `#subTabBar` sub-tab click handlers (§3,
   lines 524-534 of the legacy JS) are intentionally NOT in shared/chrome.js
   — those sub-tabs become real atlas-core router pages, addressed via the
   URL hash (`#/relatedness/<page>`). shared/chrome.js only owns theme,
   section collapse, pillbar stubs, reload.

2. **Cross-page selection sync**: shared/page_hooks.js is a tiny pub/sub bus
   for `individual_changed` and `chromosome_changed`. Each page subscribes in
   `mount()`, unsubscribes in `unmount()`. The Population Browser tree (in
   shared/pop_tree.js) emits when the user clicks a node. Future round
   promotes this to the atlas-core AtlasState `emit`/`on` pattern.

3. **State container**: shared/state.js exports a single mutable `state` object
   shared by every page module. The `state.mend`, `state.compat`,
   `state.inspector_pair` slots are pre-initialised here so other pages can
   pre-seed them before they navigate (e.g. the Inversions tab's
   "→ Mendelian tab" button pre-fills `state.mend.parent1/parent2/offspring`
   before changing `window.location.hash`).

4. **Registries are stubs**: per the kickoff "Architectural-discipline rule
   (chat-38 step 17)" — `requires_layers` / `requires_slots` / `preloads` /
   layer / file / operation content is OUT-OF-SCOPE for round 1. Each registry
   ships `_label` + `_doc` + a `_planned_<thing>_round_2` block listing the
   round-2 wiring. Round-2 is where Quentin owns the content decisions.

5. **CSS**: extracted verbatim from the legacy `<style>` block into
   `css/relatedness.css` (1243 LOC). One big bundle for now; future rounds may
   split per-page like the inversion atlas plans.

## What's NOT done in round 1

- No tests (the inversion-atlas pattern of `tests/test_<stage>_<page>.js` and
  `tests/smoke_<stage>_<page>_round<R>.mjs` should be added in round 2).
- No `engines/`, `analysis/`, `server/` — the round-1 demo is browser-only.
  The Mendelian + Compatibility testers run entirely in-browser today.
- No `data/` content. The round-1 mock is fully self-contained via baked
  DEMO data inside `shared/demo_data.js`.
- The legacy single-file (`Relatedness_atlas.html` + `Relatedness_atlas.js`)
  is preserved and still works standalone. Round-2 deletes the legacy files
  once the atlas-core build is validated.

## Communication preferences (still active)

Terse, direct, signal-not-flattery. PhD on LANTA, manuscript v19→v20 targeting
Nature Communications.

Active directives (carried over from the kickoff and the Inversion Atlas
migration):
- Migrate page by page; never wholesale.
- Page renumbering at the complete end of all migrations.
- Registry content is out-of-scope for migrations.
- Three-cohort discipline (NEVER violate).
