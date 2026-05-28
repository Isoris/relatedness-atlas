# Mathematics of an inversion-karyotype inheritance and recombination analysis chain

**A methods-and-results manuscript for a quantitative-genetics / population-genetics reader.**

---

## Provenance note (read first)

This document describes the estimators and decision rules implemented in this
repository, traced directly from source. Every formula, threshold, and default
is cited as `path:line` so it can be checked against the implementation.

> **Repository-state note (citation baseline).** Every `path:line` in this
> manuscript is verified against branch
> `claude/bdmi-incompatibility-screen-1KT7L` at commit `752c7b6`, where the full
> chain exists and is internally consistent. The default branch `main` (at the
> PR #2 merge `85b65e9`) has **diverged from that lineage**: a parallel
> spec-driven rewrite shifted line offsets in most files and, in the merge,
> **dropped three shared modules** — `atlases/relatedness/shared/recomb_data.js`,
> `…/inversion_meiosis.js`, `…/recomb_track.js` — together with the meiosis-stack
> pages they back. Because `main`'s surviving `…/export_bundle.js` and
> `…/inversion_priority.js` still `import` from the two dropped modules, **`main`
> currently has dangling imports for the §2 / §5 / §10 stages.** Read this
> manuscript against the cited branch; treat the corresponding stages on `main`
> as *present in history, absent in the merged tree* until the modules are
> restored. The numbers in Results were produced on the branch lineage.

- **All computation documented here is in-repo**, implemented in JavaScript
  ES-modules under `atlases/relatedness/shared/` and
  `atlases/relatedness/pages/hub/`. (File paths that contain `pages/` are cited
  purely as source locations; this manuscript describes the *computations*, not
  any interface.)
- **The executable input is a deterministic synthetic generator**
  (`atlases/relatedness/shared/demo_data.js`). There is **no external engine
  output loaded** on disk: the declared upstream producers — a pedigree/IBD
  caller (relationship classification, family roster, per-chromosome Mendelian
  QC) and an inversion-karyotype caller — are referenced by the loader contracts
  (`atlases/relatedness/shared/loaders/`) but their data files are absent in this
  checkout. Where a stage would normally consume an external product, the chain
  currently consumes the synthetic stand-in. This is flagged per stage and
  summarised in Appendix B.
- **The recombination layer (NCO/CO/DCO counts) is synthetic and gated.** It is
  produced by a `Math.sin`-seeded generator (`demo_data.js:331`), not by a
  crossover caller. Any statistic downstream of it (interference, the
  interchromosomal scan, marker-power numbers) is therefore *method-only* until a
  real per-dyad crossover table is supplied. This is stated wherever it applies
  and is the single most important caveat in the Results.
- **What to confirm against an engine**, should one be connected: (i) the
  pedigree caller's relationship/IBD estimator and its family-validity flag;
  (ii) the inversion-karyotype caller's genotype model; (iii) a crossover caller
  emitting per-(parent, offspring, chromosome) CO/DCO tracts in the schema given
  in §1.3.

---

## Abstract

We analyse a hatchery cohort of *Clarias gariepinus* encoded as a per-individual
**inversion-karyotype matrix** (each individual assigned `0/0`, `0/1`, `1/1`, or
missing at each candidate inversion) together with a small set of
parent–offspring **triads**. The analytical problem is to decide, for each
candidate inversion, whether its segregation and its effect on recombination are
consistent with a neutral, freely transmitted locus, or whether they show the
signatures of transmission distortion, heterokaryotype disadvantage, or
recombination suppression — and then to rank candidates and design a validation
marker panel. The chain proceeds: genotype encoding and 5-Mb windowing →
recombination observables (non-crossover density, crossover share, coefficient
of coincidence) → reusable exact tests (two-sided binomial, Wilson–Hilferty
chi-square upper tail, Mendelian offspring prior) → per-candidate karyotype
distribution and Hardy–Weinberg deviation → a four-stage Mendelian calling rule
→ linked-inversion regime construction (Cramér's V, mutual information,
conditional Hardy–Weinberg distortion) → a six-test incompatibility screen with
a four-level confidence ladder → a carrier-vs-control interchromosomal
coincidence scan with a family-aware permutation null and a five-level causal
ladder → a composite priority score → a marker-panel design. On the synthetic
demonstration cohort actually present in this checkout (12 typed individuals
labelled `broodstock-226`, 3 family hubs, 13 triads, 248 candidate inversions),
a single reproducible serialization run produced **1,072 rows across seven
sections** (`scripts/build_bundle.mjs`); of 248 candidates **88 were assigned
the highest priority bucket, 139 held, 21 dropped**; and the family-aware
permutation null returned **no candidate above the first rung of the causal
ladder** (all per-window permutation p ≥ 0.84), i.e. the synthetic
interchromosomal effects were fully absorbed by the null — a sanity result, not
a biological one.

---

## Introduction

Chromosomal inversions are difficult loci. In a heterokaryotype the inverted and
standard arrangements must pair through a loop, which suppresses the *recovery*
of crossovers within the inverted segment without necessarily changing where
double-strand breaks initiate; and inversions frequently capture coadapted
allele combinations whose disruption is selected against. The consequences are
statistical: an inversion can show distorted transmission from heterozygous
parents (meiotic drive), depletion of the heterokaryotype class
(underdominance), depletion of recombinant haplotype combinations with other
loci (epistatic incompatibility), and reduced crossover counts on its own
chromosome (intrachromosomal effect) or — more surprisingly — on other
chromosomes (interchromosomal effect). Each of these has a different estimator
and a different confound structure, and they are easy to conflate. The central
difficulty addressed by this chain is *attribution*: distinguishing a genuine
per-locus effect from family structure, ancestry, marker informativeness, and
coupling to a neighbouring inversion.

The remainder is organised by data flow. §1 fixes the input encoding and the
windowing of the recombination layer. §2 defines the per-window recombination
observables. §3 collects the reusable exact tests. §4 builds candidate-level
karyotype distributions and Hardy–Weinberg deviation. §5 forms the inside-vs-flank
recombination signature. §6 is the four-stage Mendelian calling rule. §7 builds
linked-inversion regimes. §8 is the six-test incompatibility screen. §9 covers
the parent–offspring transmission tests and the cross-design offspring
distribution. §10 is the carrier-vs-control interchromosomal coincidence scan
with its permutation null and causal ladder. §11 is the composite prioritisation
and marker-panel design. §12 covers serialization and reproducibility. The
Results section works one cohort end-to-end with real artifact numbers.

---

## 1. Input encoding and windowing

### 1.1 Genotype encoding

Each individual *i* carries, at each candidate inversion *c*, a karyotype
`K[i][c] ∈ {0/0, 0/1, 1/1, NA}` — homozygous standard, heterokaryotype,
homozygous inverted, or missing. This matrix is the substrate for every
downstream test. In this checkout it is produced synthetically: a deterministic
draw `r = |sin(seed·12.9898)|·43758.5453 mod 1` mapped to `NA` if `r<0.05`,
`0/0` if `r<0.40`, `0/1` if `r<0.80`, else `1/1`
(`atlases/relatedness/shared/demo_data.js:195`). A genuine caller would replace
this draw with a genotype-likelihood call; the downstream code only assumes the
four-symbol alphabet.

Each candidate carries a chromosome, a base-pair span `[start_mb, end_mb]`, a
length, a population frequency of the inverted arrangement, and a provisional
status `∈ {pass, warn, fail}` (`demo_data.js:163`).

### 1.2 Triads

Parent–offspring structure is encoded as triads `(parent_a, parent_b,
offspring)` grouped into family hubs. The triad count doubles as the meiosis
count used to normalise crossover frequencies (§2.3). The demonstration cohort
has 13 triads in 3 hubs (`demo_data.js:79`).

### 1.3 Recombination windowing (synthetic; gated)

The recombination layer discretises each chromosome into non-overlapping windows
of **5 Mb** (`DEMO.recomb_window_mb = 5`, `demo_data.js:325`) over a
**50 Mb** chromosome model (`demo_data.js:326`), i.e. 10 windows per chromosome.
For each window the generator emits two integer counts:

- `n_NCO_pop` — non-crossover (gene-conversion-like) events, the *population
  layer*;
- `n_CO_ped` — crossover events, the *pedigree layer*.

Baseline densities are `NCO/Mb ∈ [2.0,3.0]` and `CO/Mb ∈ [0.5,0.9]`
(`demo_data.js:354`). Inside an inversion span flagged `pass`/`fail` the
crossover density is multiplied by **0.05** (heterokaryotypic suppression), while
NCO is left unchanged (`demo_data.js:361`); inside a `warn` span NCO is multiplied
by 1.20 and CO is unchanged (`demo_data.js:363`). Per window pair `(i,j)` a
double-crossover count `n_DCO` is drawn around the independence expectation
`r_i·r_j·N_meioses` with multiplicative jitter in `[0.7,1.3]`
(`demo_data.js:387`).

> **A real crossover caller must emit**, per `(parent, offspring, chromosome)`
> meiosis: the set of crossover positions (for CO and DCO counts per window and
> window-pair) and, where detectable, non-crossover tract positions (for the NCO
> layer). The chain consumes only the per-window `n_NCO_pop`, `n_CO_ped` and the
> per-pair `n_DCO`; supplying those three from real tracts replaces the synthetic
> generator with no change to §2–§10.

---

## 2. Recombination observables

All three are defined per window (or window pair) and are pure functions of the
counts in §1.3 (`atlases/relatedness/shared/recomb_data.js`).

### 2.1 Eligibility (precondition density, "p-map")

NCO density per Mb,

```
eligibility(w) = n_NCO_pop(w) / window_mb          (window_mb = 5)
```

`recomb_data.js:33`. NCO traces where the meiotic substrate is competent for
exchange; it does not require the exchange to resolve as a crossover.

### 2.2 Resolution (crossover share, "x-map")

```
resolution(w) = n_CO_ped(w) / (n_NCO_pop(w) + n_CO_ped(w)),   undefined if total < minTotal
```

with `minTotal = 3` (`recomb_data.js:39`). This is the closest observable proxy
for the conditional probability that a precondition resolves as a crossover.

### 2.3 Crossover frequency and coefficient of coincidence

Per-meiosis crossover frequency in a window,

```
r_i = n_CO_ped(w_i) / N_meioses                    (N_meioses = |triads| = 13)
```

`recomb_data.js:45`. For a window pair the **coefficient of coincidence** is the
observed double-crossover frequency over the product of marginals,

```
C(i,j) = r_ij / (r_i · r_j),    r_ij = n_DCO(i,j) / N_meioses
```

`recomb_data.js:50`, with **interference** `I = 1 − C` (`recomb_data.js:59`).
`C ≈ 1` is independence, `C < 1` positive interference, `C ≫ 1` negative
interference. This is the classical coincidence statistic; it is built from
crossover (arm-exchange) events only — non-crossovers are *not* substitutable
into it.

---

## 3. Reusable comparison primitives

These exact tests are shared by every calling and screening stage
(`atlases/relatedness/shared/stats.js`).

### 3.1 Two-sided exact binomial

For `k` successes in `n` trials under `H0: p`, the p-value sums the point-mass
over all outcomes no more probable than the observed
(`stats.js:23`):

```
pmf(j)  = exp( logChoose(n,j) + j·ln p + (n−j)·ln(1−p) )
p-value = Σ_{j: pmf(j) ≤ pmf(k)+1e-12} pmf(j),   clipped to ≤ 1
```

with `logChoose(n,k) = Σ_{i=1..k} [ln(n−k+i) − ln i]` (`stats.js:15`).

### 3.2 Chi-square upper tail (Wilson–Hilferty)

The upper-tail probability of a chi-square with `df` degrees of freedom uses the
Wilson–Hilferty cube-root normal approximation followed by an Abramowitz–Stegun
error-function approximation for the normal CDF (`stats.js:37`):

```
t   = (x/df)^(1/3) − (1 − 2/(9·df))
z   = t / sqrt(2/(9·df))
P   = 1 − Φ(z)
```

Returned values are clipped to `[0,1]`. This is an approximation, adequate for
screening; an exact incomplete-gamma tail would be the production replacement.

### 3.3 Mendelian offspring prior

For a cross of parental karyotypes `p1 × p2`, the offspring class probabilities
are the Punnett expectation over the 2×2 allele combinations
(`stats.js:52`):

```
expectedOffspringPrior(p1,p2) = [P(0/0), P(0/1), P(1/1)],   each combination contributes 0.25
```

returning `null` if either parent is missing. The identical 0.25-per-combination
construction is reused for the cross-design offspring distribution (§9.3,
`atlases/relatedness/pages/hub/compatibility.js:45`).

---

## 4. Candidate-level karyotype distribution and Hardy–Weinberg deviation

For a candidate, the typed individuals are tallied into class counts
`(n00, n01, n11)`; the inverted-allele frequency is

```
p = (n01 + 2·n11) / (2·n_typed),    q = 1 − p
```

and the Hardy–Weinberg expectation `(q²·n, 2pq·n, p²·n)` gives a one-degree-of-freedom
goodness-of-fit chi-square whose upper tail (§3.2) is the HWE deviation p-value.
This construction appears identically in the candidate summary
(`atlases/relatedness/shared/export_bundle.js:131`), the heterokaryote-deficit
screen (§8, `atlases/relatedness/pages/hub/bdmi.js:212`), and the marginal
distortion statistic of the regime stage (§7,
`atlases/relatedness/pages/hub/regimes.js:129`). A heterokaryote deficit
(`n01 ≪ 2pq·n`) is the population-level signature of underdominance or
suppressed recombination.

---

## 5. Inside-vs-flank recombination signature

To decide whether a candidate's recombination profile is consistent with an
active heterokaryotypic inversion, the windows overlapping its span ("inside")
are compared with the rest of the chromosome ("flank")
(`recomb_data.js:79`):

```
nco_ratio = mean eligibility(inside) / mean eligibility(flank)
co_ratio  = mean r(inside)          / mean r(flank)
```

The verdict rule (`recomb_data.js:102`) is:

| condition | verdict |
|---|---|
| `0.80 ≤ nco_ratio ≤ 1.20` and `co_ratio < 0.30` | **consistent with inversion** (NCO preserved, CO suppressed) |
| `0.80 ≤ nco_ratio ≤ 1.20` and `co_ratio ≥ 0.70` | **reject** (no CO suppression this generation) |
| `nco_ratio < 0.70` and `co_ratio < 0.30` | **ancient cold region** |
| otherwise (incl. `nco_ratio > 1.20`) | **ambiguous** |

This is the cross-layer rule: the precondition layer (NCO) and the resolution
layer (CO) must move differently for the signature to be inversion-specific
rather than a generic cold region. **It currently operates on the synthetic
recombination layer and is therefore method-only** (Appendix B).

---

## 6. Four-stage Mendelian calling

For each candidate the triads are scored hierarchically
(`atlases/relatedness/pages/hub/inversions.js:100`):

1. **Family validity (Stage 1).** Triads flagged invalid upstream are partitioned
   off as "suspect" and excluded from the primary tally
   (`inversions.js:103`).
2. **Local Mendelian consistency (Stage 2).** Each valid informative family is
   labelled pass/warn/fail by comparing the offspring karyotype to the parental
   offspring prior (§3.3).
3. **Aggregate verdict (Stage 3).** `pass_frac = n_pass / n_inf`
   (`inversions.js:111`).
4. **Transmission test (Stage 4).** From heterozygous parents, allele
   transmissions are tallied as `(n0, n1)` over informative configurations
   (`inversions.js:121`), and a two-sided binomial against 0.5 is taken when at
   least 4 transmissions exist (`inversions.js:159`):
   `trans_p = binom(min(n0,n1), n0+n1, 0.5)`.

The category rule (`inversions.js:169`):

| condition (in order) | category |
|---|---|
| `n_inf < 3` | NEEDS_CROSSES |
| `pass_frac < 0.70` (failures in valid families) | LOCAL_CONFLICT |
| `n_fail ≥ 2` | LOCAL_CONFLICT |
| `trans_p < 0.02` and `n_total_t ≥ 8` and `concordant_families ≥ 5` | DRIVE_CANDIDATE |
| `trans_p < 0.05` and `n_total_t ≥ 6` | TRANSMISSION_SKEW |
| all-pass/warn | WARN_CALL / PASS tiers |

The drive-vs-skew split encodes the requirement that a drive call must be
*replicated across independent families*, not merely pooled-significant.

---

## 7. Linked-inversion regime construction

Before any per-locus distortion is attributed to a candidate, the chain tests
whether it is explained by coupling to another inversion on the same chromosome
(`atlases/relatedness/pages/hub/regimes.js`). For the focal × partner 3×3 joint
karyotype table:

- **Cramér's V** (`regimes.js:67`):
  `V = sqrt(χ² / (n·k))`, `k = min(rows,cols) − 1`, with χ² the contingency
  statistic.
- **Mutual information** in nats (`regimes.js:86`):
  `I(X;Y) = Σ_{x,y} p_xy · ln( p_xy / (p_x·p_y) )`.
- **Missing recombinant combinations** (`regimes.js:106`): cells with observed
  count 0 whose independence expectation exceeds 5% of `n`.
- **Conditional distortion** (`regimes.js:152`): the focal HWE chi-square (§4)
  recomputed *within each partner-karyotype stratum*, combined across strata. A
  focal distortion that vanishes after conditioning is attributed to the regime,
  not to the focal locus.

A companion classifier (`regimes.js`, mechanism rule) separates **meiotic drive**
(distortion follows the parent-transmitted allele) from **underdominance**
(the heterokaryote offspring class is depleted regardless of cross direction) by
aggregating triads by cross type (AA×AB, AB×BB, AB×AB) and comparing a
parent-allele-transmission bias against a mean heterokaryote deficit. All inputs
are karyotypes and triads; this stage is in-repo and runnable.

---

## 8. Six-test incompatibility screen

Per candidate, six independent tests each return a boolean "fires"
(`atlases/relatedness/pages/hub/bdmi.js`):

- **A — segregation distortion** (`bdmi.js:114`): two-sided binomial of Mendelian
  inconsistencies against a 2% error baseline, plus a het×het 1:2:1 chi-square
  (df=2) when ≥5 het×het triads exist; fires if either p < α
  (**α default 0.01**, `bdmi.html` selector).
- **B — missing karyotype class** (`bdmi.js:189`): a class with observed
  frequency < 5% but HWE expectation ≥ 15%.
- **C — heterokaryote excess/deficit** (`bdmi.js:212`):
  `dev = (obs_het − 2pq·n)/(2pq·n)`; fires if `|dev| ≥ 0.30` (default rule) or the
  one-df HWE chi-square p < 0.05.
- **D — ancestry × genotype interaction** (`bdmi.js:242`): a (K ancestry classes
  × 3 karyotype) contingency chi-square, `df = (rows−1)(cols−1)`; fires at p < 0.05.
- **E — long-range forbidden combination** (`bdmi.js:286`): the minimum
  observed/expected cell ratio across all cross-chromosome candidate pairs
  (joint `n ≥ 10`, expectation ≥ 1); fires if `min_ratio < 0.10`.
- **F — phenotype association** (`bdmi.js:341`): **stub** — returns "missing"
  until a phenotype layer exists; never fires in this checkout.

The **confidence ladder** (`bdmi.js:352`):

```
very strong  ⇐  F fires
strong       ⇐  A or D or E fires
moderate     ⇐  B or C fires
weak         ⇐  none fire
```

Tests A–E are karyotype/ancestry/triad-driven and runnable; F is a documented
stub. The ladder deliberately ranks transmission and epistatic signals (A,D,E)
above static population-frequency signals (B,C).

---

## 9. Transmission tests and cross-design offspring distribution

### 9.1 Dyad transmission (`atlases/relatedness/pages/hub/mendelian.js:80`)

For one parent × offspring, over sites where the parent is heterozygous, allele-0
vs allele-1 inheritances are tallied and tested against 0.5:
`transmission_p = binom(n_zero, n_inf, 0.5)` (`mendelian.js:103`). A separate
hard-error consistency test compares `0/0 × 1/1` impossibilities against a 2%
baseline: `consistency_p = binom(n_inconsistent, n_total, 0.02)`
(`mendelian.js:106`).

### 9.2 Triad transmission (`mendelian.js:120`)

`consistency_p` as above; additionally, het×het configurations are tested against
the 1:2:1 expectation with a df=2 chi-square when ≥5 such configurations exist
(`mendelian.js:154`). Cohort variants combine per-family p-values by Stouffer's
z (`mendelian.js:262`).

### 9.3 Cross-design offspring distribution (`compatibility.js:45`)

For planning, the offspring class distribution of a cross is the Punnett
expectation (`probs[a+b] += 0.25`, `compatibility.js:53`); a cross is
"guaranteed" for a target if `P(target) ≥ 0.999`, "possible" if `> 0`, else
"impossible" (`compatibility.js:74`). The verdict ranking over a partner set is
deterministic and karyotype-only.

---

## 10. Carrier-vs-control interchromosomal coincidence scan

This is the chain's headline cross-layer test
(`atlases/relatedness/shared/inversion_meiosis.js`): does carrying a focal
inversion change the coefficient of coincidence on *other* chromosomes?

### 10.1 Groups and the causal unit

Carriers are individuals with `0/1` or `1/1`; controls are `0/0`
(`inversion_meiosis.js:42`). The preferred causal unit is the **parental
meiosis**: parents appearing in triads, split by their own focal karyotype, with
each parent weighted by offspring count (`inversion_meiosis.js:62`).

### 10.2 Effect statistic (synthetic; gated)

The per-chromosome carrier effect is currently a **deterministic synthetic
contribution**, not a measured coincidence: per individual,
`±0.40·sin-noise + (−0.55 if testedChr = focalChr else 0)`
(`inversion_meiosis.js:203`); `carrierC = baseline_C + mean(contribution)`,
`controlC = baseline_C + small noise` (`inversion_meiosis.js:222`), and
`ΔC = carrierC − controlC`. **The −0.55 term hard-codes an intrachromosomal
suppression for demonstration**; the permutation machinery around it is real but
the signal it tests is not. A real layer replaces `_indvContribution` with the
per-parent aggregate of measured coincidence on the tested chromosome.

### 10.3 Family-aware permutation null (real machinery)

Carrier/control labels are shuffled **within family hubs**, preserving each
hub's carrier count (Fisher–Yates, `inversion_meiosis.js:241`); the two-sided
p-value is

```
p_perm = (#{|ΔC_perm| ≥ |ΔC_obs|} + 1) / (n_perm + 1)
```

`inversion_meiosis.js:266`, with **n_perm default 1000** (the serialization run
uses 200, §12). Preserving hub structure is what prevents a family-confounded
contrast from registering as an effect.

### 10.4 Causal ladder (`inversion_meiosis.js:505`)

A candidate is promoted through five rungs:

```
L0 association        : |ΔC| ≥ 0.15 on some tested chromosome
L1 family-controlled  : p_perm < 0.05
L2 confounder-clean   : ancestry L1 < 0.50, |burden Δ| < 1.5, no hub ≥ 80% of carriers
L3 replicated         : same-sign ΔC in ≥ 3 informative families, concordance ≥ 0.66
L4 mechanistic        : intra max |ΔC| ≥ 1.5 × inter median |ΔC|
L5 experimental       : out of scope (requires crosses)
```

with a negative-control null over random fake-carrier labels and a confounder
profile (ancestry L1 distance, inversion-burden difference, top-hub carrier
share) feeding L2 (`inversion_meiosis.js:139`, `447`).

---

## 11. Prioritisation and marker-panel design

### 11.1 Composite priority score (`atlases/relatedness/shared/inversion_priority.js:130`)

Five normalised pillars are combined with fixed weights:

```
score = 0.30·intra + 0.25·inter + 0.20·mendel + 0.15·family + 0.10·marker
```

where intra is the inside-vs-flank CO-suppression strength (§5), inter the
maximum |ΔC| across tested chromosomes (§10), mendel the −log10 of the Test-A
p-value (§8), family the hub spread, and marker a readiness flag. The bucket rule
(`inversion_priority.js:146`):

```
hub_share ≥ 0.80                         → HOLD (family-confounded)
marker_ready and score ≥ 0.55            → SHIP
score ≥ 0.55 but not marker_ready        → HOLD
score ≥ 0.30                             → HOLD
otherwise                                → DROP
```

Because intra and inter draw on the synthetic recombination layer, the priority
score mixes one real signal (Mendelian Test A) with two gated ones; this is noted
in Appendix B.

### 11.2 Marker-panel design (`atlases/relatedness/shared/marker_designer.js`)

For a focal candidate, two marker layers are generated: focal-state markers (tag
and breakpoint markers from the inversion boundaries) and, on each tested
chromosome, ordered triplets m₁–m₂–m₃ defining two intervals A and B so that CO,
DCO and coincidence (§2.3) become estimable in an offspring panel. Expected
double-crossover power per triplet is `r_A·r_B·N_meioses·25`
(`marker_designer.js`, `testDesign`); per-triplet status ∈
{READY, PARTIAL, LOW_POWER, MISSING}. The focal-marker positions are real
(derived from breakpoints); the per-chromosome grid spacing and the expected-DCO
numbers depend on the synthetic recombination layer.

---

## 12. Serialization and reproducibility

A single entry point assembles seven sections into one artifact
(`atlases/relatedness/shared/export_bundle.js:buildBundle`): a cohort overview, a
per-individual summary, a per-candidate summary (§4 + §8 Test A + hub share), a
per-family summary, the full priority ranking (§11.1), marker designs (§11.2) for
the top-N priority candidates, and interchromosomal scans (§10) for the same
top-N. The same function is callable headless
(`scripts/build_bundle.mjs`) for batch/CI use. The entire input is
deterministic: every synthetic draw is seeded by `Math.sin` of a string hash
(`demo_data.js`), so a given checkout reproduces byte-identical counts. The
top-N and permutation count are the only knobs (defaults: top-N = 5, n_perm =
200 in the serialization path).

---

## Results

### Cohort and run

The only data present in this checkout is the synthetic generator
(§1). It defines a cohort **labelled** `broodstock-226` / *Clarias gariepinus*
but containing **12 typed individuals**, **3 family hubs**, **13 triads**, and
**248 candidate inversions** (`demo_data.js:39`, `:79`, `:145`). A single
serialization run (`node scripts/build_bundle.mjs`, top-N = 5, n_perm = 200)
completed in ~0.2 s and wrote a 7-section artifact. All numbers below are read
back from that artifact (`/tmp/bundle.tsv`, `/tmp/bundle.json`); none are
hand-computed.

### Cohort overview (1 row, verified)

| field | value |
|---|---|
| species (label) | Clarias gariepinus |
| cohort (label) | broodstock-226 |
| n_samples (actual) | 12 |
| n_families | 3 |
| n_triads | 13 |
| n_candidates | 248 |
| status pass / warn / fail | 210 / 27 / 11 |
| sex F / M / unknown | 6 / 5 / 1 |
| karyotype call rate | 0.9556 |

### Worked example — candidate `INV_001` (verified from the per-candidate section)

`INV_001` is the seeded showcase locus on **Chr28:15.1–18.0 Mb** (length 2.9 Mb),
inverted-allele frequency 0.23, provisional status `pass`.

| statistic | value | §/source |
|---|---|---|
| typed individuals | 12 | §4 |
| class counts (0/0, 0/1, 1/1) | 2, 8, 2 | §4 |
| inverted-allele frequency p | 0.5000 | §4 |
| HWE χ² (df=1) | 1.333 | §4 / `stats.js:37` |
| HWE p | 0.247 | §3.2 |
| carriers | 10 | §10.1 |
| top family-hub carrier share | 0.400 (Family 1) | §10, `inversion_meiosis.js:122` |
| Mendelian Test-A informative triads | 13 | §8 / §6 |
| Mendelian inconsistencies | 0 | §8 |
| Test-A binomial p | 1.000 | §3.1 |
| marker-ready | yes | §11.2 |

The interpretation supported by these real numbers: `INV_001` has an excess of
heterokaryotes (8/12) but the HWE deviation is not significant (p = 0.247) at
this sample size, and it shows **zero** Mendelian inconsistencies across all 13
triads (Test-A p = 1.000) — i.e. on the data present, it is transmitted cleanly
and carries no segregation-distortion signal.

### Priority ranking (verified, all 248 candidates)

| bucket | count |
|---|---|
| SHIP → PASS 2 | 88 |
| HOLD | 139 |
| DROP | 21 |

The five highest-scoring SHIP candidates (priority score, §11.1) were
`INV_211` (Chr15, 0.786), `INV_014` (Chr14, 0.780), `INV_234` (Chr10, 0.779),
`INV_092` (Chr08, 0.775), `INV_003` (Chr17, 0.775).

### Marker designs for the top-5 (verified)

420 triplet rows were generated across the 5 candidates: **285 READY, 90 PARTIAL,
45 MISSING** at the triplet level; **252 PANEL_READY vs 168 BLOCKED** at the
panel-row level.

### Interchromosomal scan for the top-5 (verified — and a null sanity result)

140 carrier-vs-control rows were produced. The intrachromosomal rows carried the
seeded suppression (ΔC ≈ −0.41 to −0.70), but **after the family-aware
permutation null every row returned p_perm ≥ 0.84** (e.g. `INV_014`/Chr14
ΔC = −0.703, p_perm = 1.000; `INV_092`/Chr08 ΔC = −0.411, p_perm = 0.841). No
candidate cleared even **L1** of the causal ladder. Because the synthetic effect
is a deterministic function of the carrier set, shuffling labels within hubs
reproduces the same magnitude — so the null *correctly* refuses to call it. This
is a methodological sanity check on the permutation machinery, **not** evidence
of an interchromosomal effect.

### What was NOT produced on this data

- **No real cohort.** The 226-sample hatchery cohort is a label only; the
  executable input is 12 synthetic individuals. No genotype-likelihood calls, no
  IBD/relationship estimates, no per-chromosome QC from a pedigree engine are
  present on disk.
- **No real recombination layer.** NCO/CO/DCO counts are `Math.sin`-seeded
  (§1.3). Therefore §2 (eligibility/resolution/coincidence), §5 (inside-vs-flank
  verdict), §10 (interchromosomal ΔC), the intra/inter pillars of §11.1, and the
  expected-DCO numbers of §11.2 are **method-only**; their values exist as
  artifacts but carry no biological meaning.
- **Test F (phenotype association) never ran** — it is a stub returning "missing"
  (`bdmi.js:341`).
- **Causal ladder produced no L1+ candidate** — by construction of the null on
  synthetic data (above).
- **No external-engine confirmation.** The pedigree-caller and inversion-caller
  estimators referenced by the loader contracts could not be checked against an
  engine because none is connected.

---

## Appendix A — Default parameters

| parameter | default | source |
|---|---|---|
| recombination window size | 5 Mb | `atlases/relatedness/shared/demo_data.js:325` |
| chromosome length model | 50 Mb | `demo_data.js:326` |
| meiosis count (CO normaliser) | 13 (= #triads) | `demo_data.js:327` |
| baseline NCO density | 2.0–3.0 /Mb | `demo_data.js:354` |
| baseline CO density | 0.5–0.9 /Mb | `demo_data.js:355` |
| heterokaryotype CO multiplier (pass/fail span) | 0.05 | `demo_data.js:362` |
| warn-span NCO multiplier | 1.20 | `demo_data.js:364` |
| resolution min sample | 3 | `recomb_data.js:39` |
| inside-vs-flank: NCO ratio band | [0.80, 1.20] | `recomb_data.js:103` |
| inside-vs-flank: CO-suppressed threshold | < 0.30 | `recomb_data.js:104` |
| inside-vs-flank: CO-intact threshold | ≥ 0.70 | `recomb_data.js:105` |
| dyad/triad hard-error baseline | 0.02 | `mendelian.js:107` |
| het×het chi-square min count | 5 | `mendelian.js:155` |
| Stage-4 transmission min count | 4 | `inversions.js:159` |
| DRIVE_CANDIDATE: trans_p, n, concordant | 0.02, 8, 5 | `inversions.js:187` |
| TRANSMISSION_SKEW: trans_p, n | 0.05, 6 | `inversions.js:193` |
| pass_frac conflict threshold | 0.70 | `inversions.js:174` |
| BDMI Test A α | 0.01 | `bdmi.html` (`#bdmiAlpha` selected) |
| BDMI Test B: obs<, exp≥ | 0.05, 0.15 | `bdmi.js:197` |
| BDMI Test C: |dev| threshold | 0.30 | `bdmi.js:229` |
| BDMI Test C (z-rule) / D α | 0.05 | `bdmi.js:230`, `:280` |
| BDMI Test E: min obs/exp, min joint n | 0.10, 10 | `bdmi.js:308`, `:335` |
| interchromosomal intra bias (synthetic) | −0.55 | `inversion_meiosis.js:208` |
| interchromosomal carrier noise (synthetic) | ±0.40 | `inversion_meiosis.js:206` |
| permutation count (default / serialization) | 1000 / 200 | `inversion_meiosis.js:267`, `export_bundle.js` |
| causal ladder L0 / L2 / L3 thresholds | 0.15 / (0.50, 1.5, 0.80) / (3, 0.66) | `inversion_meiosis.js:505`+ |
| priority weights (intra/inter/mendel/family/marker) | 0.30/0.25/0.20/0.15/0.10 | `inversion_priority.js:133` |
| priority SHIP / HOLD thresholds | 0.55 / 0.30 | `inversion_priority.js:148` |
| family-confound HOLD threshold | hub_share ≥ 0.80 | `inversion_priority.js:147` |
| serialization top-N | 5 | `scripts/build_bundle.mjs` |

---

## Appendix B — Statistic provenance and run status

| statistic / stage | in-repo | external (engine) | run on this data |
|---|---|---|---|
| genotype encoding (§1.1) | synthetic generator | would be a genotype-likelihood caller | yes (synthetic) |
| triad structure (§1.2) | synthetic | would be a pedigree caller | yes (synthetic) |
| recombination counts (§1.3) | synthetic generator | **must come from a crossover caller** | yes (synthetic) — **gated** |
| eligibility / resolution (§2.1–2.2) | yes | — | method-only (synthetic input) |
| coefficient of coincidence (§2.3) | yes | — | method-only (synthetic input) |
| exact binomial (§3.1) | yes | — | yes |
| chi-square upper tail (§3.2) | yes | — | yes |
| offspring prior (§3.3) | yes | — | yes |
| karyotype distribution + HWE (§4) | yes | — | yes (synthetic genotypes) |
| inside-vs-flank verdict (§5) | yes | — | method-only (synthetic input) |
| four-stage Mendelian calling (§6) | yes | — | yes (synthetic genotypes/triads) |
| linked-inversion regime (§7) | yes | — | yes (synthetic genotypes) |
| incompatibility tests A–E (§8) | yes | — | yes (synthetic genotypes/ancestry) |
| incompatibility test F (§8) | yes (stub) | needs phenotype layer | **no** (stub) |
| dyad/triad transmission (§9.1–9.2) | yes | — | yes (synthetic genotypes/triads) |
| cross-design offspring dist. (§9.3) | yes | — | yes |
| interchromosomal ΔC effect (§10.2) | yes (synthetic effect fn) | **must come from crossover caller** | method-only — **gated** |
| family-aware permutation null (§10.3) | yes | — | yes (machinery), on synthetic ΔC |
| causal ladder (§10.4) | yes | — | yes — returned no L1+ candidate |
| priority score (§11.1) | yes | — | yes — mixes 1 real + 2 gated pillars |
| marker-panel design (§11.2) | yes | — | partial — focal markers real, power gated |
| serialization (§12) | yes | — | yes (1,072 rows, 7 sections) |

---

*End of draft.*
