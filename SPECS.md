# SPECS — relatedness-atlas master index

Cross-cutting index of every specification in this repo. Mirrors the
`inversion-atlas/SPECS.md` and `meiosis-atlas/SPECS.md` conventions.

## Folder convention

```
specs_todo/   — design backlog (authored, not yet implemented)
specs_done/   — shipped (implementation matches the SPEC)
```

**Rule**: a SPEC never gets deleted. When code ships, move the SPEC
from `specs_todo/` to `specs_done/`, update its status line, and add an
`Implemented in:` block at the top.

## Atlas at a glance

The relatedness-atlas consumes the ngsRelate → ngsPedigree → mendelian
chain plus inversion-karyotype TSVs from the inversion-atlas. Producer:
[`ngsPedigree`](https://github.com/Isoris/ngsPedigree). 226-sample pure
*C. gariepinus* hatchery cohort.

Registered in `atlas-core/toolkit_registries/relatedness/01_registry/atlases.jsonl`
with lead question `mendelian_qc_on_LG28_candidate`; primary products:
`parent_offspring_edges.v1`, `family_hubs.v1`, `pedigree_dyads.v1`,
`mendelian_status.v1`.

## Shipped — `specs_done/`

| SPEC | what it covers | implementation |
|------|----------------|----------------|
| [SPEC_relatedness_adapter.md](specs_done/SPEC_relatedness_adapter.md) | IN/OUT adapters for ngsRelate/ngsPedigree/mendelian TSVs (`import_relatedness_tsv` → `staging_relatedness_v0`; `normalize_relatedness` → `ngsrelate_pairs_v1`). The canonical staging→normalized example referenced by [atlas-core's adapter cookbook](../atlas-core/docs/SPEC_atlas_adapter_cookbook.md). | [atlases/relatedness/registries/](atlases/relatedness/registries/) |
| [SPEC_network_page.md](specs_done/SPEC_network_page.md) | `network` hub page: SVG force-directed-ish edge graph (PO / FS / ambiguous / Mendelian-conflict edges) + inline previews of Karyotypes and Inversions tables. Envelope-aware: probes `ngsrelate_pairs_v1` and renders a status badge above the SVG. | [pages/hub/network.{html,js}](atlases/relatedness/pages/hub/) |
| [SPEC_compatibility_page.md](specs_done/SPEC_compatibility_page.md) | `compatibility` hub page: breeding-partner finder. Pick focal individual + target karyotype + scope; lists compatible partners with sex-aware and exclude-kin filters. Envelope-aware badge tied to the "Exclude close kin" checkbox. | [pages/hub/compatibility.{html,js}](atlases/relatedness/pages/hub/) |

## Backlog — `specs_todo/`

### Original 5 hub pages (round-1 extraction)

| SPEC | page id        | what it covers | status |
|------|----------------|----------------|--------|
| [SPEC_karyotypes_page.md](specs_todo/SPEC_karyotypes_page.md) | `karyotypes` | Per-sample genotype matrix at every inversion candidate. Ancestry stripe column from K=8 admixture. Filterable by chromosome. | extracted from legacy; not yet envelope-aware |
| [SPEC_inversions_page.md](specs_todo/SPEC_inversions_page.md) | `inversions` | Paginated table of all inversion candidates (status, chrom, start/end, length, frequency). Click-to-scope routes to network + inspector. | extracted from legacy; not yet envelope-aware |
| [SPEC_mendelian_page.md](specs_todo/SPEC_mendelian_page.md) | `mendelian` | **HEADLINE FEATURE**: Mendelian segregation tester for dyads (binomial), triads (multinomial / chi-square), or full cohort scans (Stouffer combination). 4 modes × 5 inversion subsets × 4 p-thresholds. Server fallback for the slow cohort scans. | extracted from legacy; in-browser compute works; server compute endpoints pending |

### Round-2 additions (more recent migrations) — all speced 2026-05-20

| SPEC                                                                       | page id                | overlap concern |
|-----------------------------------------------------------------------------|------------------------|-----------------|
| [SPEC_bdmi_page.md](specs_todo/SPEC_bdmi_page.md)                            | `bdmi`                  | independent — Bateson-Dobzhansky-Muller 6-test screen |
| [SPEC_regimes_page.md](specs_todo/SPEC_regimes_page.md)                      | `regimes`               | reads `long_range_haplotype_regimes.v1` from inversion-atlas |
| [SPEC_meiosis_page.md](specs_todo/SPEC_meiosis_page.md)                       | `meiosis`               | **overlap with meiosis-atlas** — recommend DELETE |
| [SPEC_eligibility_page.md](specs_todo/SPEC_eligibility_page.md)              | `eligibility`           | independent — p map (NCO/Mb per window) |
| [SPEC_resolution_page.md](specs_todo/SPEC_resolution_page.md)                | `resolution`            | independent — x map (CO share per window) |
| [SPEC_coincidence_page.md](specs_todo/SPEC_coincidence_page.md)               | `coincidence`           | **overlap with meiosis-atlas/interchromosomal** — recommend KEEP as intra slice |
| [SPEC_inversion_signature_page.md](specs_todo/SPEC_inversion_signature_page.md) | `inversion_signature` | synthesis page — 3 stacked tracks + verdict cards |
| [SPEC_focal_meiosis_scan_page.md](specs_todo/SPEC_focal_meiosis_scan_page.md)  | `focal_meiosis_scan`    | **overlap with meiosis-atlas/interchromosomal** — recommend DELETE once meiosis page ships |
| [SPEC_inversion_priority_page.md](specs_todo/SPEC_inversion_priority_page.md)  | `inversion_priority`    | independent — Pass-1 → Pass-2 SHIP/HOLD/DROP table |
| [SPEC_marker_test_designer_page.md](specs_todo/SPEC_marker_test_designer_page.md) | `marker_test_designer` | independent (eventual migration to future `marker_design` atlas) |

## Architecture note — relatedness ↔ meiosis overlap

Several relatedness-atlas pages (`meiosis`, `coincidence`, `focal_meiosis_scan`)
have direct counterparts in the meiosis-atlas. Per
`atlases.jsonl`, meiosis-atlas products are owned by `meiosis_atlas`
(not `relatedness_atlas`) — `chromosome_meiosis_events.v1`,
`coincidence_matrix.v1`, `inversion_meiosis_effects.v1`, etc.

The relatedness-atlas pages were extracted from the legacy single-file
mockup before the meiosis-atlas was created. They predate the split.
Two ways to reconcile:

1. **Delete the relatedness-atlas overlapping pages**, keep them only in
   meiosis-atlas. Clean but loses the inline-context the legacy mockup
   provided.
2. **Keep both** — relatedness-atlas's versions become thin proxies that
   embed the meiosis-atlas page via an `<iframe>` or a shared module.
   More work but preserves the "evidence hub" UX where everything is
   reachable from one atlas.

Decision is pending. Documented in this index so future-Quentin doesn't
re-derive the overlap.

## Paired analysis repo

[`ngsPedigree`](https://github.com/Isoris/ngsPedigree) — producer of
parent_offspring_edges, family_hubs, pedigree_dyads, mendelian_status.
