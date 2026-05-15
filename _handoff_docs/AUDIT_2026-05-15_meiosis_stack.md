# Audit — Meiosis stack pause (2026-05-15)

Date: 2026-05-15
Branch: `claude/bdmi-incompatibility-screen-1KT7L`
Tip: `326babe`

ngsPedigree / ngsTracts is still at the spec level. The meiosis-flavoured
pages on this branch are therefore **layout-complete but biologically
inert**: they render correctly against synthetic data and have working
permutation / sorting / export plumbing, but the numbers they display are
deterministic functions of `Math.sin()` seeds in `demo_data.js`, not real
recombination calls. Anyone using the atlas today must read this audit
before quoting any of its outputs.

This document is the honest map of which pages are real, which are
gated, and which are decorative for the **one** scientific question the
stack is being built to answer:

> Does a parent's heterozygous karyotype at focal inversion INV_X alter
> crossover coincidence on non-focal chromosomes in the offspring — and
> if so, which marker panel can validate that effect at 10k–50k scale?

## Page-by-page audit

| # | Page | What it renders | Honest status |
|---|---|---|---|
| 1 | `network` | family-hub edge graph | **REAL.** Reads `DEMO.network_edges`; same shape as the real ngsPedigree output. |
| 2 | `karyotypes` | per-sample karyotype matrix | **REAL.** Reads `DEMO.karyotype_matrix`; same shape as the real Inversion Atlas output. |
| 3 | `inversions` | candidate list table | **REAL.** Reads `DEMO.inversion_candidates_full`. |
| 4 | `mendelian` | dyad/triad segregation tester | **REAL.** Pure karyotype math; no synthetic-recomb dependency. |
| 5 | `compatibility` | breeding-partner finder | **REAL** core logic. Breeding-decision overlay (added 2026-05-15) cross-links to the `focal_meiosis_scan` last-result blob; when that result is synthetic the overlay sentence is too. The other three overlay flags (heterokaryote → CO suppression note, shared-arrangement redundancy, clean-cross flag) are karyotype-only and are real. |
| 6 | `bdmi` | 6-test incompatibility screen | **REAL.** Every test runs on karyotype matrix + ancestry Q + triads. No synthetic-recomb dependency. |
| 7 | `regimes` | linked-inversion + drive/underdominance classifier | **REAL.** Karyotype-only contingency math. |
| 8 | `meiosis` | single CO / double CO / C / I calculator | **REAL.** Pure formula on user-supplied r1, r2, r12. The page is a calculator + documentation block; it doesn't read recomb data. |
| 9 | `eligibility` | per-window NCO/Mb track | **GATED.** Reads `DEMO.recomb_windows.n_NCO_pop` — synthetic. Page layout is correct; data is not. |
| 10 | `resolution` | per-window CO/(NCO+CO) track | **GATED.** Same — reads synthetic `n_NCO_pop` and `n_CO_ped`. |
| 11 | `coincidence` | 2D pair heatmap of C = r12/(r1·r2) | **GATED.** Reads synthetic `DEMO.recomb_pairs.n_DCO`. |
| 12 | `inversion_signature` | three stacked tracks + inside/flank verdict | **GATED.** Verdicts derive from synthetic ratios. The "INV_001 is CONSISTENT WITH INVERSION" verdict is showing up because I wrote the CO-suppression factor into the synthetic generator, not because biology produced it. |
| 13 | `focal_meiosis_scan` | family-aware permutation scan, causal ladder, neg-controls | **GATED.** Permutation framework is real; the carrier-effect function it permutes against is a hash-based fake. The displayed p_perm is testing nothing biological today. |
| 14 | `inversion_priority` | Pass-1 → Pass-2 bridge ranking | **GATED.** Intra effect signal comes from `inversion_signature`'s inside/flank ratios (synthetic). Inter effect from a fast pass over `focal_meiosis_scan`'s math (synthetic). Mendelian distortion from BDMI Test A (real). So the priority_score mixes one real signal with two synthetic ones. |
| 15 | `marker_test_designer` | focal markers + recombination-marker triplets | **PARTIAL.** Focal-inversion-state marker block (tag SNPs + breakpoint markers) is structurally real — those positions are derived from real inversion candidate boundaries. The per-tested-chromosome marker grid is synthetic (uniform 5-marker grid per chromosome). expected_DCO numbers use synthetic CO rates from `recomb_windows`. The page is useful as a panel-design template; the expected-power numbers are not. |

## Shared-module audit

| Module | Status |
|---|---|
| `shared/utils.js` | real |
| `shared/state.js` | real (state slots; data shape is real) |
| `shared/demo_data.js` | real for karyotypes / ancestry / families / triads / inversion candidates. **Synthetic** for `recomb_windows`, `recomb_pairs` (the `genRecomb` IIFE block). |
| `shared/stats.js` | real (pure math) |
| `shared/karyotype_table.js` | real |
| `shared/page_hooks.js` | real |
| `shared/api_client.js` | real |
| `shared/recomb_data.js` | real math, **reads synthetic generators** |
| `shared/recomb_track.js` | real (SVG renderer) |
| `shared/inversion_meiosis.js` | real math except `_indvContribution` (synthetic carrier effect function) and `carrierC` / `controlC` (use the synthetic contribution) |
| `shared/inversion_priority.js` | real math; mixes real (Mendelian p) and synthetic (intra/inter effects) signals |
| `shared/marker_designer.js` | real generator for focal markers; synthetic for per-chrom marker grids and `expected_DCO` |

## What stops being synthetic when ngsTracts ships

Six functions are the only things that need to change:

1. `shared/demo_data.js::genRecomb` — delete the IIFE; let the loader populate `DEMO.recomb_windows` / `DEMO.recomb_pairs` from real per-dyad calls.
2. `shared/recomb_data.js::windowsForChrom` and `pairsForChrom` — already abstracted; no change required.
3. `shared/inversion_meiosis.js::_indvContribution` — replace the hash-based ±0.4 noise with the per-individual aggregate over that individual's actual offspring meioses on the tested chromosome.
4. `shared/inversion_meiosis.js::carrierC` / `controlC` — change from "mean per-individual contribution to baseline" to "weighted aggregate over each parent's actual CO/DCO counts on the tested chromosome, weighted by offspring count".
5. `shared/marker_designer.js::testDesign` — replace `r_mean = mean of windowsForChrom(testedChrom) coRatePerMeiosis` with a real per-interval rate from the ngsTracts adapter (or keep this as-is if `coRatePerMeiosis` is now real).
6. `shared/inversion_priority.js::_intraCoEffect` / `_interCoEffect` — no code change once (3)–(5) are real; they already call through the real interfaces.

Nothing else in the page layer changes. The 15 sub-tabs are structurally
correct; only the data flowing through them is currently fake.

## ngsTracts → atlas adapter — required input schema

The adapter that needs to be written (`shared/loaders/ngstracts_co_calls.js`)
should produce these two objects keyed by chromosome:

```
DEMO.recomb_windows[chromosome] = [
  {
    chromosome:      'Chr01',
    idx:             0,
    start_mb:        0,           // window start, Mb
    end_mb:          5,           // window end, Mb
    n_NCO_pop:       <int>,       // NCO count summed across population (gated on NCO caller)
    n_CO_ped:        <int>,       // CO count summed across all valid pedigree dyads
    inside_inversion: 'INV_001' | null,
    inv_status:      'pass' | 'warn' | 'fail' | null,
  }, ...
]
```

If NCO calling is not available (the current ngsPedigree spec assumes it
is not), set `n_NCO_pop = null` and treat Eligibility, Resolution, and
Inversion-signature as **disabled** rather than as showing zeros. The
honest page should display "NCO layer not loaded — these tracks are not
estimable from the current data" instead of plotting nothing.

```
DEMO.recomb_pairs[chromosome] = [
  { i: <window_idx>, j: <window_idx>, n_DCO: <int> }, ...
]
```

`n_DCO` is the count of dyads where the offspring inherits CO in both
window i and window j. Comes from ngsTracts when the per-dyad CO call
table is aggregated by (parent, offspring, chromosome).

Plus, separately, what the `focal_meiosis_scan` real version needs:

```
DEMO.dyad_co_calls = [
  {
    parent_id:        'Ind_xxx',
    offspring_id:     'Ind_yyy',
    chromosome:       'Chr07',
    co_positions_mb:  [12.3, 41.7],   // every CO observed in this meiosis
    n_informative_windows: 9,         // for power weighting
  }, ...
]
```

This is the **causal-unit-correct** input: one row per meiosis, parent
attached. `inversion_meiosis.js::_indvContribution` will aggregate this
by parent and tested chromosome rather than synthesising a hash.

## What to read first when work resumes

In order:

1. This audit.
2. `_handoff_docs/HANDOFF_2026-05-11_round1_done.md` — original migration handoff.
3. `_handoff_docs/HANDOFF_2026-05-15_round2_done.md` — eight-pages-added handoff.
4. `shared/recomb_data.js` — the math interface every gated page calls through.
5. `shared/inversion_meiosis.js` — read the comment block; the `_indvContribution` function is where the real-vs-synthetic boundary lives.
6. One example ngsTracts output file from whichever real run lands first — the adapter contract above is a guess until then.

## What NOT to do when work resumes

- Do **not** add more meiosis pages. The 7 gated pages are already more surface area than the real data will populate cleanly. If the real data shows that 3 of them are duplicative, delete the other 4.
- Do **not** trust any p_perm, ΔC, priority_score, or expected_DCO number rendered today. They are all functions of `Math.sin()`.
- Do **not** publish a figure from the gated pages without verifying the input came from the real adapter, not the synthetic generator.

## Migration notes

The seven gated pages plus `shared/inversion_meiosis.js` and
`shared/marker_designer.js` and `shared/inversion_priority.js` are
written to migrate to a future **Meiosis Atlas** repo unchanged once
that atlas exists. The Relatedness Atlas hosts them today only because
the family-hub layer they consume is already here. When the Meiosis
Atlas is created:

- move `pages/hub/{eligibility,resolution,coincidence,inversion_signature,focal_meiosis_scan,inversion_priority,marker_test_designer}.*` to `meiosis-atlas/atlases/meiosis/pages/`;
- move `shared/{recomb_data,recomb_track,inversion_meiosis,inversion_priority,marker_designer}.js` to `meiosis-atlas/atlases/meiosis/shared/`;
- the Relatedness Atlas exports `family_hubs`, `parent_offspring_edges`, `valid_dyads`, `karyotype_matrix`, `inversion_candidates_full` as input products to the new atlas.

`bdmi` and `regimes` stay in the Relatedness Atlas — they're karyotype-
only and don't depend on the meiosis layer.

## One-paragraph summary for next reviewer

The Relatedness Atlas at tip `326babe` has 15 sub-tabs. 8 of them
(network / karyotypes / inversions / mendelian / compatibility / bdmi /
regimes / meiosis-calculator) are biologically real today. 7 of them
(eligibility / resolution / coincidence / inversion_signature /
focal_meiosis_scan / inversion_priority / marker_test_designer) are
layout-complete but read synthetic CO/NCO/DCO numbers from
`demo_data.js::genRecomb`. Connecting them to real data requires
writing one adapter (`shared/loaders/ngstracts_co_calls.js`) and
replacing the synthetic carrier-effect function in
`shared/inversion_meiosis.js`. Nothing else in the page layer changes.
Do not extend the meiosis stack further until that adapter exists.
