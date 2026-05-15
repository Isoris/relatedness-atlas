# Relatedness Atlas — Round 2 done (2026-05-15)

Eight new sub-tabs added on top of the round-1 evidence hub. They make the
Relatedness Atlas the temporary home of inheritance-side inversion analysis
(BDMI screening, regime inheritance, meiotic crossover observables, and the
focal-inversion × meiosis coincidence scan) until the Meiosis Atlas exists.

Same architectural discipline as round 1: one page per sub-tab, shared math
in `shared/`, the legacy `Relatedness_atlas.html` shell carries a one-for-one
mirror of every fragment so the demo works without atlas-core.

## Tree (additions only — round 1 layout unchanged)

```
relatedness-atlas/
  atlases/relatedness/
    pages/hub/
      bdmi.{html,js}                   + bdmi/_state.js
      regimes.{html,js}                + regimes/_state.js
      meiosis.{html,js}                + meiosis/_state.js
      eligibility.{html,js}            + eligibility/_state.js
      resolution.{html,js}             + resolution/_state.js
      coincidence.{html,js}            + coincidence/_state.js
      inversion_signature.{html,js}    + inversion_signature/_state.js
      focal_meiosis_scan.{html,js}     + focal_meiosis_scan/_state.js
    shared/
      recomb_data.js          ← per-window math (eligibility / resolution /
                                  coincidence / inside-vs-flank / verdicts)
      recomb_track.js         ← SVG renderer (linear track + 2D heatmap +
                                  ramp legend)
      inversion_meiosis.js    ← seed of future Meiosis Atlas: carriers,
                                  baseline C, carrier/control effect,
                                  family-aware permutation null,
                                  per-family scan, direction consistency,
                                  negative-control null, confounder profile,
                                  dosage groups, inversion burden,
                                  causal-ladder Levels 0..5
```

`demo_data.js` extended with `recomb_windows[chrom]` (10 × 5 Mb windows per
chromosome, NCO_pop and CO_ped counts), `recomb_pairs[chrom]` (all i<j pair
DCO counts), plus `recomb_window_mb`, `recomb_chrom_length_mb`,
`recomb_n_meioses`. Showcase pattern: INV_001 on Chr28 has NCO ≈ flank but
CO ≈ 0.05 × flank, so it renders as `CONSISTENT WITH INVERSION` on the
Inversion-signature tab and the coincidence cells touching it collapse.

`state.js` extended with `state.recomb` (chromosome + highlight_inversion,
shared across Eligibility / Resolution / Coincidence / Inversion-signature),
`state.bdmi`, `state.regimes`, `state.meiosis`, and `state.focal_meiosis`.

## The eight pages

### #6 BDMI screen (`bdmi`)
Per-candidate Bateson–Dobzhansky–Muller incompatibility screen. Six tests
with toggles: Mendelian segregation distortion (triads or hub dyads),
missing karyotype class (HWE), heterozygote excess/deficit, ancestry ×
genotype interaction, long-range forbidden combinations across
chromosomes, and phenotype association (stub until a phenotype envelope
is wired in). Confidence ladder weak → moderate → strong → very strong →
validated. Per-row drill-down + manuscript-ready phrasing footer + TSV
export.

### #7 Regime inheritance (`regimes`)
Core-genetics control page for the BDMI screen. Four sections:
A. focal HWE marginal distortion;
B. linked-inversion regime control (Cramér's V, mutual information,
   missing recombinants, conditional-distortion combined p, joint 3×3
   table with cell shading);
C. meiotic-drive vs underdominance classifier from cross-type aggregate
   (AA × AB, AB × BB, AB × AB);
D. breeding-risk interpretation hierarchy.
Two TSV exports: `linked_inversion_regimes.tsv` and
`segregation_mechanism_classifier.tsv`.

### #8 Meiosis (`meiosis`)
Parks the single-CO / double-CO / coincidence / interference model so it
doesn't get lost. Small calculator (`r1`, `r2`, `r12` → `C`, `I`) + the
observable-vs-latent reference table that flags `a, b, d, x` as latent
(3 equations, 4 unknowns). Section E explicitly captures the
"geometry, not nucleotides" insight: inversions preserve local sequence
but alter pairing geometry in heterokaryotypes, so the inversion loop is
what reduces observable crossover products. Cross-link to the sibling
Inversion Atlas geometry page (do not duplicate the biology here). Also
parks the "what 'precondition of exchange' means" note (homolog pairing,
synapsis / SC formation, chromatin accessibility, DSB formation,
recombination nodules, strand-invasion intermediates, crossover
designation, interference signalling).

### #9 Eligibility (`eligibility`) — p map
Per-window NCO/Mb track for one chromosome from the population layer.
Inversion footprints overlaid. Prediction inside a true heterokaryotypic
inversion: NCO ≈ flank (sequence-driven DSB competence preserved).
Karyotype matrix below.

### #10 Resolution (`resolution`) — x map
Per-window CO/(NCO+CO) track. Min-n threshold greys out underpowered
windows. Inside a true heterokaryotypic inversion: resolution drops
sharply while NCO is preserved. Karyotype matrix below.

### #11 Coincidence (`coincidence`)
2D per-window-pair heatmap of `C = r12 / (r1·r2)`. Diverging colour ramp
centred at C=1. Click any cell to inspect the pair (r1, r2, observed
n_DCO, expected n_DCO under independence, C, I). Band filter restricts
to |i−j| ≤ k. Karyotype matrix below.

### #12 Inversion signature (`inversion_signature`)
Three stacked per-window tracks for one chromosome (NCO/Mb, CO/meiosis,
resolution) plus per-candidate inside-vs-flank verdict cards using the
cross-layer rule: `CONSISTENT` / `REJECT — NO CO SUPPRESSION` /
`ANCIENT COLD REGION` / `AMBIGUOUS`. Karyotype matrix below.

### #13 Inv × meiosis (`focal_meiosis_scan`) — seed of Meiosis Atlas
For each focal inversion candidate, compares crossover coincidence on
every tested chromosome between carriers (heterokaryotype or
homozygous-alt) and matched non-carriers, using a family-aware
permutation null (carrier labels shuffled within family hubs, preserving
each hub's carrier count).

Layered cards rendered on every Run:

- **Causal ladder** (`L0..L5`): L0 association → L1 family-aware null
  passed → L2 confounder controls clean → L3 direction consistent across
  hubs → L4 mechanistic coherence (intra > inter) → L5 experimental
  (out of scope). Reasons list shows the first ✗ blocking the next level.
- **Confounder profile**: ancestry L1 (carriers vs controls), inversion
  burden delta, top-hub carrier share, per-hub `n_carriers / n_controls`
  balance table.
- **Per-family direction**: leading row's ΔC broken out by family with a
  concordance score (`n_concordant / n_informative`).
- **Negative-control null**: K random fake-focal labels sampled across
  the full population (no hub stratification), reports `p_outside` —
  observed effect vs fake-label null.
- **Dose / genotype classes**: hom_ref / het / hom_alt counts plus mean
  inversion burden per class.
- **Status pill**: `STRONG / MODERATE / WEAK / NO EFFECT / FAMILY CONFOUNDED`
  (when top-hub carrier share ≥ 80%).

TSV export carries a header block with the causal ladder, confounder
profile, leading-row detail, per-family direction breakdown, negative
control summary, and dose/genotype counts, followed by the per-row
table.

**Transient home**: this page (and `shared/inversion_meiosis.js`) is
the seed of the future Meiosis Atlas. Lives in the Relatedness Atlas
only because the family-hub layer is already here. Migration target:
move both files to `meiosis-atlas/atlases/meiosis/...` once that atlas
is created; the Relatedness Atlas then exports `family_hubs`,
`parent_offspring_edges`, and `valid_dyads` as products that the new
atlas consumes. No page-side code changes required.

## Wired into atlas-core

`manifest.json` lists all eight new pages in the `pages[]` array under
`stage: 'hub'` and registers `recomb_data`, `recomb_track`, and
`inversion_meiosis` in `shared_modules`.

`pages.registry.json` has full `_label` + `_doc` for every new page
(architectural-discipline rule: registry content
`requires_layers` / `requires_slots` / `preloads` left empty for round 2,
Quentin owns those decisions).

CSS additions in `css/relatedness.css`: BDMI confidence pills + screen
pills + detail blocks + manuscript italics; Regimes coupling/missing/
recombinant cell shading + verdict pills; Meiosis config + caption +
reference table; recomb track wrap + linear track + heatmap + ramp legend
+ inversion-footprint shading; FMS readiness pills + intra/inter relation
pills.

## What's *not* in this round (deliberately)

- **Per-individual CO call data**: every track on the recomb pages reads
  `DEMO.recomb_windows` / `DEMO.recomb_pairs` aggregate. When a real
  ngsTracts / NCO-tract envelope arrives, swap the two functions in
  `recomb_data.js` (`windowsForChrom`, `pairsForChrom`); no page code
  changes.
- **Geometry / loop / synapsis biology**: Section E of the Meiosis page
  parks the conceptual note and explicitly hands the biology off to the
  sibling Inversion Atlas geometry page. Don't duplicate it here.
- **Phenotype layer**: BDMI Test F and the Inv × meiosis readiness
  `phenotype_ready` both stub until `DEMO.phenotype` (or a normalized
  phenotype envelope via the api_client) is loaded.
- **Estimability Manager / Status Manager / Librarian split**: started in
  a working draft then dropped per "forget last message". Architecture
  stays at the simple readiness-ladder level for now.

## Communication preferences (still active)

Terse, direct, signal-not-flattery. Page-by-page, never wholesale. The
inheritance-side analyses (BDMI, regime, meiosis observables, focal ×
meiosis) belong long-term in dedicated atlases; the Relatedness Atlas
hosts them now because it owns the family-hub layer they need.
