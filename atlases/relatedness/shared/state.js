// atlases/relatedness/shared/state.js
// =============================================================================
// Atlas-private state container for the Relatedness Atlas. Extracted verbatim
// from the legacy Relatedness_atlas.js §2 (lines 454-514).
//
// Slot summary (also declared in registries/data/slots.registry.json — registry
// content is OUT-OF-SCOPE for round 1 per the kickoff rule, so the runtime
// state object is the source of truth right now):
//
//   selected_individual   — Population Browser focus (drives Inspector)
//   selected_family       — Population Browser family focus (drives breadcrumb)
//   selected_chromosome   — chr-filter scope picker (null = "all")
//   inspector_pair        — (A, B) pair currently shown in the Inspector
//   inv_page_inline/full  — inversion-table pagination (per view)
//   inv_per_page          — page size for both inversion views
//   mend                  — Mendelian tester selections + last_result
//   loaded_files          — pillBar source state (path, kind, loaded?)
//   loaded_at             — wall-clock string for the "Loaded: ..." footer
//
// Round 1 (2026-05-11): state remains a single mutable object exported as a
// named binding. Pages mutate it directly. Cross-page reactivity (slot-change
// emit → re-render) is a follow-up round once we wire AtlasState properly.
// =============================================================================

export const state = {
  // Population Browser selection
  selected_individual: 'Ind_001',
  selected_family: 'Family 1',
  selected_chromosome: null,             // null = "all chromosomes"

  // Inspector + Mendelian-check focus
  inspector_pair: { a: 'Ind_001', b: 'Ind_044' },

  // Inversion candidates table pagination
  inv_page_inline: 1,
  inv_page_full:   1,
  inv_per_page:    4,                    // matches mockup's 4-row table

  // Mendelian-tester state
  mend: {
    mode: 'dyad',
    parent1: 'Ind_001',
    parent2: 'Ind_044',
    offspring: 'Ind_087',
    inv_subset: 'all',
    alpha: '0.05',
    last_result: null,
  },

  // Compatibility-finder state (initialised here so other pages can poke at
  // it — e.g. the Inversions tab's "open in Compatibility" button pre-seeds
  // state.compat.scope/inv_single before the user navigates to that tab).
  compat: {
    focal: 'Ind_001', target: '0/1',
    scope: 'chrom', inv_single: null, chrom: 'Chr28',
    sex_aware: false, exclude_kin: true, exclude_amb: true,
    last_results: null,
  },

  // BDMI / incompatibility-screen state. Six toggles (one per test) plus the
  // scope, distortion alpha, heterokaryotype-rule selector, and the last
  // results blob. Same direct-mutation pattern as state.mend / state.compat;
  // when an Inversions row eventually pre-seeds the BDMI tab the seeded
  // candidate goes into state.bdmi.focus_candidate.
  bdmi: {
    scope:        'all',
    mend_source:  'triads',
    alpha:        '0.01',
    het_rule:     'abs_deficit',
    screens_enabled: {
      mend: true, miss: true, het: true, anc: true, lr: true, pheno: false,
    },
    focus_candidate: null,
    last_results:    null,
  },

  // Chromosome regime inheritance — linked-inversion control + meiotic-drive
  // vs underdominance classifier. Same pattern: chromosome + focal candidate
  // pre-seedable from the Inversions tab; the last_results blob caches the
  // partner-table / mechanism-classifier output so navigating away does not
  // wipe it.
  regimes: {
    chromosome:       null,
    focal:            null,
    min_n:            '10',
    couple_threshold: '0.50',
    last_results:     null,
    last_mechanism:   null,
  },

  // pillBar source state (round 1: mock).
  loaded_files: [
    { kind: 'res',    path: '/data/project/population.res',     loaded: true },
    { kind: 'beagle', path: '/data/beagle/beagle.gz',            loaded: true },
    { kind: 'prune',  path: '/data/prune.in',                    loaded: true },
    { kind: 'inv',    path: '/data/inversion_candidates.tsv',    loaded: true },
  ],
  loaded_at: 'May 20, 2026  10:32:18',
};

// Expose for debugging / external scripts (matches the legacy attach to window).
if (typeof window !== 'undefined') {
  window.RA_state = state;
  window._RA_state = state;  // legacy alias
}
