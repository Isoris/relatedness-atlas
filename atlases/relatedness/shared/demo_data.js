// atlases/relatedness/shared/demo_data.js
// =============================================================================
// DEMO data — baked-in synthetic that mirrors the legacy mockup exactly.
// Replaced wholesale by the data layer once real .res / beagle / inv files are
// wired in via the status pills. Extracted verbatim from the legacy
// Relatedness_atlas.js §1 (lines 31-450).
//
// IIFE generators (genInversions, genKaryotypes, genQuality, rigDriveCandidate,
// rigNeedsCrosses, genAncestry) run at module-evaluation time. Module-level
// side-effects like this are fine in ES-module-land because each module is
// evaluated exactly once across the whole atlas — exactly the singleton
// semantics the legacy IIFE relied on.
// =============================================================================

import { hashStr } from './utils.js';

export const DEMO = {
  cohort_meta: {
    n_samples: 226,
    species: 'Clarias gariepinus',
    cohort: 'broodstock-226',
  },

  // K=8 ancestry palette — matches the Inversion Atlas defaults.
  ancestry_palette: [
    '#3b82f6',  // blue
    '#f97316',  // orange
    '#10b981',  // emerald
    '#8b5cf6',  // violet
    '#ec4899',  // pink
    '#f59e0b',  // amber
    '#06b6d4',  // cyan
    '#94a3b8',  // slate
  ],

  // The screenshot shows a flat 12-individual demo with 3 families. We keep
  // the same scope so the layout reads identically. The real cohort would
  // wire in 226 samples via Stage 1's family_hub_roster.tsv.
  individuals: [
    'Ind_001','Ind_044','Ind_087','Ind_102','Ind_155','Ind_168','Ind_193',
    'Ind_204','Ind_221','Ind_240','Ind_295','Ind_322'
  ],

  // Family hub topology — matches the network diagram in the screenshot.
  families: [
    {
      family_id: 'Family 1',
      hub_individual: 'Ind_001',
      members: ['Ind_001','Ind_044','Ind_087','Ind_102','Ind_155'],
      n: 5,
    },
    {
      family_id: 'Family 2',
      hub_individual: null,
      members: ['Ind_168','Ind_193','Ind_204','Ind_221'],
      n: 4,
    },
    {
      family_id: 'Family 3',
      hub_individual: null,
      members: ['Ind_240','Ind_295','Ind_322'],
      n: 3,
    },
  ],
  ambiguous_clusters: [
    { id: 'cluster_A', members: ['Ind_168','Ind_193'] },
    { id: 'cluster_B', members: ['Ind_322'] },
  ],
  unassigned: [],

  // Sex assignments — required for the Compatibility sex-aware mode.
  sex: {
    'Ind_001':'F', 'Ind_044':'M', 'Ind_087':'F', 'Ind_102':'M', 'Ind_155':'F',
    'Ind_168':'M', 'Ind_193':'F', 'Ind_204':'M', 'Ind_221':'F',
    'Ind_240':'M', 'Ind_295':'F', 'Ind_322':'?',
  },

  // 13 triads — enough to make DRIVE_CANDIDATE fire on INV_056 with binomial p < 0.01.
  triads: [
    { id: 'T01', parent_a: 'Ind_001', parent_b: 'Ind_044', offspring: 'Ind_087' },
    { id: 'T02', parent_a: 'Ind_001', parent_b: 'Ind_044', offspring: 'Ind_102' },
    { id: 'T03', parent_a: 'Ind_001', parent_b: 'Ind_044', offspring: 'Ind_155' },
    { id: 'T04', parent_a: 'Ind_168', parent_b: 'Ind_193', offspring: 'Ind_204' },
    { id: 'T05', parent_a: 'Ind_168', parent_b: 'Ind_193', offspring: 'Ind_221' },
    { id: 'T06', parent_a: 'Ind_240', parent_b: 'Ind_295', offspring: 'Ind_322' },
    { id: 'T07', parent_a: 'Ind_001', parent_b: 'Ind_240', offspring: 'Ind_087' },
    { id: 'T08', parent_a: 'Ind_044', parent_b: 'Ind_295', offspring: 'Ind_155' },
    { id: 'T09', parent_a: 'Ind_168', parent_b: 'Ind_044', offspring: 'Ind_193' },
    { id: 'T10', parent_a: 'Ind_001', parent_b: 'Ind_193', offspring: 'Ind_322' },
    { id: 'T11', parent_a: 'Ind_001', parent_b: 'Ind_044', offspring: 'Ind_204' },
    { id: 'T12', parent_a: 'Ind_240', parent_b: 'Ind_295', offspring: 'Ind_221' },
    { id: 'T13', parent_a: 'Ind_168', parent_b: 'Ind_295', offspring: 'Ind_087' },
  ],

  chromosomes: (() => {
    const c = [];
    for (let i = 1; i <= 28; i++) {
      c.push('Chr' + String(i).padStart(2, '0'));
    }
    return c;
  })(),

  // PO edges shown in the network panel for hub Ind_001.
  network_edges: [
    { a: 'Ind_001', b: 'Ind_044', class: 'strong_po' },
    { a: 'Ind_001', b: 'Ind_087', class: 'strong_po' },
    { a: 'Ind_001', b: 'Ind_102', class: 'strong_po' },
    { a: 'Ind_001', b: 'Ind_155', class: 'strong_po' },
    { a: 'Ind_001', b: 'Ind_168', class: 'possible_po' },
    { a: 'Ind_001', b: 'Ind_193', class: 'ambiguous' },
  ],

  // Per-individual ngsRelate-derived stats vs hub Ind_001. Used by Inspector.
  pairwise_stats: {
    'Ind_044': { k0: 0.012, k1: 0.955, k2: 0.033, kinship: 0.489, IBS0: 0.012,
                 PO_distance: 1, relationship_class: 'strong PO-compatible',
                 PASS: 24, WARN: 3, FAIL: 1, TOTAL: 28 },
    'Ind_087': { k0: 0.018, k1: 0.948, k2: 0.034, kinship: 0.483, IBS0: 0.014,
                 PO_distance: 1, relationship_class: 'strong PO-compatible',
                 PASS: 25, WARN: 2, FAIL: 1, TOTAL: 28 },
    'Ind_102': { k0: 0.024, k1: 0.940, k2: 0.036, kinship: 0.476, IBS0: 0.018,
                 PO_distance: 1, relationship_class: 'strong PO-compatible',
                 PASS: 23, WARN: 4, FAIL: 1, TOTAL: 28 },
    'Ind_155': { k0: 0.019, k1: 0.951, k2: 0.030, kinship: 0.485, IBS0: 0.016,
                 PO_distance: 1, relationship_class: 'strong PO-compatible',
                 PASS: 26, WARN: 1, FAIL: 1, TOTAL: 28 },
    'Ind_168': { k0: 0.083, k1: 0.812, k2: 0.105, kinship: 0.380, IBS0: 0.035,
                 PO_distance: 1.4, relationship_class: 'possible PO',
                 PASS: 18, WARN: 7, FAIL: 3, TOTAL: 28 },
    'Ind_193': { k0: 0.21, k1: 0.62, k2: 0.17, kinship: 0.250, IBS0: 0.062,
                 PO_distance: 2.1, relationship_class: 'ambiguous (FS/PO)',
                 PASS: 14, WARN: 9, FAIL: 5, TOTAL: 28 },
    'Ind_001': { k0: 0,     k1: 0,     k2: 1,     kinship: 0.500, IBS0: 0,
                 PO_distance: 0, relationship_class: 'self',
                 PASS: 28, WARN: 0, FAIL: 0, TOTAL: 28 },
  },

  inversion_candidates_full: [],   // filled procedurally below
  karyotype_matrix: {},            // filled procedurally below
  ancestry_q: {},                  // filled procedurally below
};

// Generate inversion candidate set (248 to match the mockup's "248" badge).
(function genInversions() {
  const N_INV = 248;
  const chroms = DEMO.chromosomes;
  let inv_id = 1;
  for (let i = 0; i < N_INV; i++) {
    const chrom = chroms[i % chroms.length];
    const len_mb = Math.round((0.4 + (i * 17 % 56) / 10) * 10) / 10;
    const start_mb = Math.round((((i * 31 + 13) % 100) + 5) * 10) / 10;
    const end_mb = Math.round((start_mb + len_mb) * 10) / 10;
    const freq = Math.round((0.04 + (i * 7 % 41) / 100) * 100) / 100;
    const status_roll = (i * 41 + 17) % 100;
    let status = 'pass', notes = '';
    if (status_roll < 85)      { status = 'pass';
                                  notes = ['Strong PO-supported','High frequency','Stable across chrs',''][i%4]; }
    else if (status_roll < 96) { status = 'warn';
                                  notes = 'Mendelian warns in chr'+chrom.slice(-2); }
    else                       { status = 'fail';
                                  notes = 'Mendelian failures'; }
    if (freq < 0.10) notes = 'Low frequency';
    DEMO.inversion_candidates_full.push({
      candidate: 'INV_' + String(inv_id++).padStart(3, '0'),
      chromosome: chrom,
      start_mb, end_mb, length_mb: len_mb,
      frequency: freq,
      status,
      notes,
    });
  }
  Object.assign(DEMO.inversion_candidates_full[0], {
    candidate: 'INV_001', chromosome: 'Chr28',
    start_mb: 15.1, end_mb: 18.0, length_mb: 2.9, frequency: 0.23,
    status: 'pass', notes: 'Strong PO-supported',
  });
  Object.assign(DEMO.inversion_candidates_full[1], {
    candidate: 'INV_002', chromosome: 'Chr03',
    start_mb: 22.4, end_mb: 25.9, length_mb: 3.5, frequency: 0.41,
    status: 'warn', notes: 'Mendelian warns in chr17',
  });
  Object.assign(DEMO.inversion_candidates_full[2], {
    candidate: 'INV_003', chromosome: 'Chr17',
    start_mb: 7.2, end_mb: 9.8, length_mb: 2.6, frequency: 0.12,
    status: 'fail', notes: 'Mendelian failures',
  });
  Object.assign(DEMO.inversion_candidates_full[3], {
    candidate: 'INV_004', chromosome: 'Chr10',
    start_mb: 12.7, end_mb: 14.3, length_mb: 1.6, frequency: 0.08,
    status: 'pass', notes: 'Low frequency',
  });
})();

(function genKaryotypes() {
  function pick(seed) {
    const r = Math.abs(Math.sin(seed * 12.9898)) * 43758.5453 % 1;
    if (r < 0.05) return 'NA';
    if (r < 0.40) return '0/0';
    if (r < 0.80) return '0/1';
    return '1/1';
  }
  for (const ind of DEMO.individuals) {
    const seed_base = hashStr(ind);
    DEMO.karyotype_matrix[ind] = {};
    DEMO.inversion_candidates_full.forEach((inv, j) => {
      DEMO.karyotype_matrix[ind][inv.candidate] = pick(seed_base * 0.001 + j);
    });
  }
  // INV_001 — showcase inversion. Diagnostic 0/0 × 1/1 → 0/1 patterns.
  DEMO.karyotype_matrix['Ind_001']['INV_001'] = '0/0';
  DEMO.karyotype_matrix['Ind_044']['INV_001'] = '1/1';
  DEMO.karyotype_matrix['Ind_087']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_102']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_155']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_168']['INV_001'] = '0/0';
  DEMO.karyotype_matrix['Ind_193']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_204']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_221']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_240']['INV_001'] = '1/1';
  DEMO.karyotype_matrix['Ind_295']['INV_001'] = '0/1';
  DEMO.karyotype_matrix['Ind_322']['INV_001'] = '0/1';

  // Rig INV_003 as Conflict tier (0/0 × 0/0 → 1/1 = impossible).
  DEMO.karyotype_matrix['Ind_001']['INV_003'] = '0/0';
  DEMO.karyotype_matrix['Ind_044']['INV_003'] = '0/0';
  DEMO.karyotype_matrix['Ind_087']['INV_003'] = '1/1';
  DEMO.karyotype_matrix['Ind_102']['INV_003'] = '0/0';
  DEMO.karyotype_matrix['Ind_155']['INV_003'] = '0/0';
})();

DEMO.karyotype_quality = {};
(function genQuality() {
  for (const ind of DEMO.individuals) {
    DEMO.karyotype_quality[ind] = {};
    DEMO.inversion_candidates_full.forEach(inv => {
      DEMO.karyotype_quality[ind][inv.candidate] = 'high';
    });
  }
  DEMO.karyotype_quality['Ind_221']['INV_001'] = 'low';
})();

// ──────────────────────────────────────────────────────────────────────
// Genome-wide trio QC. T08 is engineered as family-suspect (high
// genome-wide Mendelian error rate + weak PO support on parent A) so the
// Mendelian tab's FAMILY_SUSPECT branch fires.
// ──────────────────────────────────────────────────────────────────────
DEMO.trio_qc = {
  'T01': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.003, anc_dist: 0.05, valid: true },
  'T02': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.004, anc_dist: 0.06, valid: true },
  'T03': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.002, anc_dist: 0.04, valid: true },
  'T04': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.005, anc_dist: 0.07, valid: true },
  'T05': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.006, anc_dist: 0.08, valid: true },
  'T06': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.003, anc_dist: 0.05, valid: true },
  'T07': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.004, anc_dist: 0.06, valid: true },
  'T08': { po_a: 'weak',   po_b: 'strong', gw_mend_error: 0.024, anc_dist: 0.31, valid: false },
  'T09': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.003, anc_dist: 0.05, valid: true },
  'T10': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.004, anc_dist: 0.06, valid: true },
  'T11': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.003, anc_dist: 0.05, valid: true },
  'T12': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.004, anc_dist: 0.06, valid: true },
  'T13': { po_a: 'strong', po_b: 'strong', gw_mend_error: 0.005, anc_dist: 0.07, valid: true },
};

// INV_056 — DRIVE_CANDIDATE / TRANSMISSION_SKEW showcase.
(function rigDriveCandidate() {
  DEMO.karyotype_matrix['Ind_001']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_044']['INV_056'] = '0/0';
  DEMO.karyotype_matrix['Ind_087']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_102']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_155']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_168']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_193']['INV_056'] = '0/0';
  DEMO.karyotype_matrix['Ind_204']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_221']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_240']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_295']['INV_056'] = '0/0';
  DEMO.karyotype_matrix['Ind_322']['INV_056'] = '0/1';
  DEMO.karyotype_matrix['Ind_193']['INV_056'] = '0/0';
})();

// INV_028 — NEEDS_CROSSES showcase (mostly NA).
(function rigNeedsCrosses() {
  DEMO.individuals.forEach(p => {
    if (p !== 'Ind_001') {
      DEMO.karyotype_matrix[p]['INV_028'] = 'NA';
    }
  });
  DEMO.karyotype_matrix['Ind_001']['INV_028'] = '0/0';
})();

(function genAncestry() {
  const K = DEMO.ancestry_palette.length;
  for (const ind of DEMO.individuals) {
    const seed_base = hashStr(ind);
    const raw = [];
    let sum = 0;
    for (let k = 0; k < K; k++) {
      const r = Math.abs(Math.sin((seed_base + k) * 78.233)) * 43758.5 % 1;
      const v = Math.pow(r, 1.5);
      raw.push(v); sum += v;
    }
    const dominant = (seed_base | 0) % K;
    raw[dominant] += sum * 1.4;
    sum = raw.reduce((a, b) => a + b, 0);
    DEMO.ancestry_q[ind] = raw.map(v => v / sum);
  }
})();

// ──────────────────────────────────────────────────────────────────────
// Recombination event counts — synthetic per-window NCO (population layer)
// and CO (pedigree layer), plus per-window-pair DCO. Drives the four
// recombination pages (eligibility / resolution / coincidence /
// inversion_signature). The grid is intentionally coarse: 5 Mb windows,
// ~50 Mb per chromosome, so 10 windows × 28 chromosomes = 280 windows.
//
// Per-chromosome generation:
//   - Baseline:           NCO_pop_per_Mb ~ 2.4,  CO_ped_per_Mb ~ 0.6
//   - Inside an inversion span flagged 'pass' or 'fail': CO is multiplied
//     by 0.05 (the heterokaryotypic-suppression prediction). NCO is
//     unchanged (sequence-driven DSB competence preserved).
//   - Inside a 'warn' inversion span: NCO mildly elevated, CO ≈ flank →
//     the "reject as real inversion" pattern from the cross-layer rule.
//   - DCO per pair: Poisson-ish on (CO_i · CO_j / n_meioses) so the
//     coefficient of coincidence is ≈ 1 outside inversions and ↓ inside.
// ──────────────────────────────────────────────────────────────────────
DEMO.recomb_window_mb = 5;
DEMO.recomb_chrom_length_mb = 50;
DEMO.recomb_n_meioses = (DEMO.triads || []).length || 13;
DEMO.recomb_windows = {};
DEMO.recomb_pairs = {};

(function genRecomb() {
  const WIN = DEMO.recomb_window_mb;
  const CHR_LEN = DEMO.recomb_chrom_length_mb;
  const N_WIN_PER_CHR = Math.round(CHR_LEN / WIN);
  const N_MEIOSES = DEMO.recomb_n_meioses;
  // Deterministic pseudo-random per (chrom, window) seed.
  function rand(seed) {
    const r = Math.abs(Math.sin(seed * 12.9898 + 4.1414)) * 43758.5453 % 1;
    return r;
  }
  // Inversion spans by chromosome so we can decorate the corresponding
  // windows with the heterokaryotype-suppression signature.
  const spansByChrom = {};
  for (const inv of DEMO.inversion_candidates_full) {
    if (!spansByChrom[inv.chromosome]) spansByChrom[inv.chromosome] = [];
    spansByChrom[inv.chromosome].push(inv);
  }
  for (const chrom of DEMO.chromosomes) {
    const seed_base = hashStr(chrom);
    const wins = [];
    for (let i = 0; i < N_WIN_PER_CHR; i++) {
      const start_mb = i * WIN;
      const end_mb = (i + 1) * WIN;
      let nco_per_mb = 2.0 + rand(seed_base + i * 7) * 1.0;     // 2.0 – 3.0
      let co_per_mb  = 0.5 + rand(seed_base + i * 11) * 0.4;    // 0.5 – 0.9
      let inside_inv = null;
      for (const inv of spansByChrom[chrom] || []) {
        if (inv.start_mb < end_mb && inv.end_mb > start_mb) { inside_inv = inv; break; }
      }
      if (inside_inv) {
        if (inside_inv.status === 'pass' || inside_inv.status === 'fail') {
          co_per_mb *= 0.05;                 // strong CO suppression
        } else if (inside_inv.status === 'warn') {
          nco_per_mb *= 1.20;                // mildly elevated NCO, CO unchanged
        }
      }
      const n_NCO_pop = Math.round(nco_per_mb * WIN);
      const n_CO_ped  = Math.max(0, Math.round(co_per_mb  * WIN));
      wins.push({
        chromosome: chrom, idx: i, start_mb, end_mb,
        n_NCO_pop, n_CO_ped,
        inside_inversion: inside_inv ? inside_inv.candidate : null,
        inv_status: inside_inv ? inside_inv.status : null,
      });
    }
    DEMO.recomb_windows[chrom] = wins;

    // Pair-wise DCO. Expected under independence: r_i · r_j · N_meioses,
    // where r_i is CO frequency per meiosis. Inside an inversion span we
    // multiply by ~0 so C → 0; outside we sample around the expectation.
    const pairs = [];
    for (let i = 0; i < wins.length; i++) {
      for (let j = i + 1; j < wins.length; j++) {
        const wi = wins[i], wj = wins[j];
        const r_i = wi.n_CO_ped / N_MEIOSES;
        const r_j = wj.n_CO_ped / N_MEIOSES;
        const expected = r_i * r_j * N_MEIOSES;
        const jitter = rand(seed_base + i * 101 + j * 13) * 0.6 + 0.7;  // 0.7 – 1.3
        let n_DCO = expected > 0 ? Math.round(expected * jitter) : 0;
        // Inside-inversion suppression of DCO is automatic via CO suppression.
        // For the showcase: pairs straddling the inversion break boundary
        // show very few DCOs.
        pairs.push({ i, j, n_DCO });
      }
    }
    DEMO.recomb_pairs[chrom] = pairs;
  }
})();
