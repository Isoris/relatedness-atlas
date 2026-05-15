// atlases/relatedness/shared/inversion_meiosis.js
// =============================================================================
// Focal-inversion × meiosis analysis. Implements the "interchromosomal effect"
// scan: for each focal inversion candidate, compares the coefficient of
// coincidence on every tested chromosome between carriers and matched non-
// carriers, using a family-aware permutation null.
//
// Source of truth for the result schema (one row per focal_inv × tested_chr):
//
//   focal_inv  focal_chr  tested_chr  relation        n_carriers
//   n_controls   C_carrier  C_control  delta_C  p_perm
//   carrier_share_in_hub      local_inv_controlled    status
//
// where relation ∈ {'intra', 'inter'}.
//
// IMPORTANT WARNING: when carriers concentrate in one family hub, comparing
// carriers to "everyone else" measures the family, not the inversion. The
// permutation shuffles labels within family hubs so the null preserves
// family structure / meiosis count / carrier count.
//
// Readiness ladder (per the user's design):
//   basic_ready       carriers vs non-carriers possible
//   family_ready      family / hub labels available  → permutation null
//   controlled_ready  other inversion karyotypes available → can residualise
//   interaction_ready enough N for pairwise inversion × inversion tests
//   phenotype_ready   phenotype / survival / fertility table loaded
//
// All math is deliberately small and decoupled from the page so a real
// per-dyad CO/DCO envelope (ngsPedigree Stage 3 / ngsTracts) can be swapped
// in by replacing baselineCoincidenceAndN() and carrierEffect() without
// touching the page code.
// =============================================================================

import { DEMO } from './demo_data.js';
import { hashStr } from './utils.js';
import {
  windowsForChrom, pairsForChrom, coincidence, coRatePerMeiosis,
} from './recomb_data.js';

// ─── Group construction ─────────────────────────────────────────────────

export function carriersOf(invId) {
  return DEMO.individuals.filter(ind => {
    const k = (DEMO.karyotype_matrix[ind] || {})[invId];
    return k === '0/1' || k === '1/1';
  });
}
export function controlsOf(invId) {
  return DEMO.individuals.filter(ind => {
    const k = (DEMO.karyotype_matrix[ind] || {})[invId];
    return k === '0/0';
  });
}
export function familyOf(ind) {
  const f = (DEMO.families || []).find(f => (f.members || []).includes(ind));
  return f ? f.family_id : null;
}
export function focalChromOf(invId) {
  const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === invId);
  return inv ? inv.chromosome : null;
}

// Carrier share inside the family hub with the most carriers — the diagnostic
// for "carriers concentrated in one family" that the user flagged.
export function carrierHubShare(carriers) {
  if (!carriers.length) return { hub: null, share: 0 };
  const counts = {};
  for (const c of carriers) {
    const f = familyOf(c) || '(none)';
    counts[f] = (counts[f] || 0) + 1;
  }
  let best = null, bestN = 0;
  for (const [f, n] of Object.entries(counts)) {
    if (n > bestN) { best = f; bestN = n; }
  }
  return { hub: best, share: bestN / carriers.length, count: bestN };
}

// ─── Baseline observable ─────────────────────────────────────────────────

// Mean coincidence on a tested chromosome, with the count of informative
// window-pairs ("n_meioses-pair"-ish). Currently aggregate from
// DEMO.recomb_pairs; swap to per-dyad event tables when those land.
export function baselineCoincidenceAndN(testedChr) {
  const wins = windowsForChrom(testedChr);
  const pairs = pairsForChrom(testedChr);
  let sum = 0, n_finite = 0;
  for (const p of pairs) {
    const C = coincidence(p, wins);
    if (Number.isFinite(C)) { sum += C; n_finite++; }
  }
  return { C: n_finite ? sum / n_finite : NaN, n_pairs: n_finite };
}

// ─── Carrier effect ──────────────────────────────────────────────────────

// Per-individual contribution to the carrier effect on a tested chromosome.
// In the demo this is deterministic from a hash, so permutations produce
// real variability. When per-dyad CO/DCO calls arrive, replace the body
// with the aggregate over each individual's actual meioses on testedChr.
function _indvContribution(ind, testedChr, focal_chr) {
  const s = hashStr(ind + '|' + testedChr);
  // ±0.4 noise per individual; deterministic.
  const noise = ((Math.sin(s * 0.91827) + 1) * 0.5 - 0.5) * 0.40;
  // Intra-chromosome inversion suppression — concentrated on the focal chr.
  const intra_bias = (testedChr === focal_chr) ? -0.55 : 0;
  return noise + intra_bias;
}

// Mean effect across a group of individuals.
function _groupEffect(group, testedChr, focal_chr) {
  if (!group.length) return 0;
  let sum = 0;
  for (const ind of group) sum += _indvContribution(ind, testedChr, focal_chr);
  return sum / group.length;
}

// Carriers' C, given the baseline. Synthesised deterministically from the
// carrier set; if the carrier set changes (permutation), the effect changes.
export function carrierC(carriers, testedChr, focal_chr, baseline_C) {
  return baseline_C + _groupEffect(carriers, testedChr, focal_chr);
}
export function controlC(controls, testedChr, focal_chr, baseline_C) {
  // Use a much smaller residual effect for the controls (only noise, no
  // intra-bias since controls don't carry the focal arrangement).
  let sum = 0;
  for (const ind of controls) {
    const s = hashStr(ind + '|' + testedChr);
    sum += ((Math.sin(s * 0.13971) + 1) * 0.5 - 0.5) * 0.05;
  }
  return baseline_C + (controls.length ? sum / controls.length : 0);
}

// ─── Family-aware permutation null ──────────────────────────────────────

// Shuffle carrier / non-carrier labels within each family hub, preserving
// each hub's carrier count. Returns a new carrier set the same size as
// the original.
function _permuteWithinHubs(carriers, controls) {
  const all = [...carriers, ...controls];
  // Group by family.
  const byFam = {};
  for (const ind of all) {
    const f = familyOf(ind) || '(none)';
    if (!byFam[f]) byFam[f] = { members: [], n_carrier: 0 };
    byFam[f].members.push(ind);
    if (carriers.includes(ind)) byFam[f].n_carrier++;
  }
  const out = [];
  for (const f of Object.keys(byFam)) {
    const fam = byFam[f];
    // Fisher–Yates shuffle.
    const arr = fam.members.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    out.push(...arr.slice(0, fam.n_carrier));
  }
  return out;
}

// Two-sided permutation p-value for delta_C on a single (focal, tested_chr).
export function permutationP(carriers, controls, testedChr, focal_chr,
                              baseline_C, observed_delta, n_perm = 1000) {
  if (!carriers.length || !controls.length) return NaN;
  let n_extreme = 0;
  for (let i = 0; i < n_perm; i++) {
    const perm_car = _permuteWithinHubs(carriers, controls);
    const perm_con = [...carriers, ...controls].filter(x => !perm_car.includes(x));
    const c_car = carrierC(perm_car, testedChr, focal_chr, baseline_C);
    const c_con = controlC(perm_con, testedChr, focal_chr, baseline_C);
    const delta = c_car - c_con;
    if (Math.abs(delta) >= Math.abs(observed_delta) - 1e-9) n_extreme++;
  }
  return (n_extreme + 1) / (n_perm + 1);
}

// ─── Readiness ladder ──────────────────────────────────────────────────

export function readinessLevels(focal_inv_id) {
  const carriers = carriersOf(focal_inv_id);
  const controls = controlsOf(focal_inv_id);
  const focal_chr = focalChromOf(focal_inv_id);
  // basic_ready: both groups non-empty
  const basic_ready = carriers.length > 0 && controls.length > 0;
  // family_ready: ≥ 2 families have at least one carrier
  const hubs = new Set(carriers.map(c => familyOf(c)).filter(Boolean));
  const family_ready = hubs.size >= 2;
  // controlled_ready: at least 1 other inversion candidate on a tested chrom
  const other_invs = DEMO.inversion_candidates_full
    .filter(i => i.candidate !== focal_inv_id && i.chromosome !== focal_chr).length;
  const controlled_ready = other_invs >= 1;
  // interaction_ready: at least 6 carriers and 6 controls
  const interaction_ready = carriers.length >= 6 && controls.length >= 6;
  // phenotype_ready: DEMO.phenotype present
  const phenotype_ready = !!(DEMO.phenotype && Object.keys(DEMO.phenotype).length);
  return {
    basic_ready, family_ready, controlled_ready, interaction_ready, phenotype_ready,
    n_carriers: carriers.length, n_controls: controls.length,
    n_hubs: hubs.size, n_other_invs: other_invs,
  };
}

// ─── Driver — one row per tested chromosome ─────────────────────────────

export function runFocalScan(focal_inv_id, opts = {}) {
  const scope     = opts.scope     || 'both';        // 'intra' / 'inter' / 'both'
  const n_perm    = opts.n_perm    || 1000;
  const control_local = !!opts.control_local;
  const focal_chr = focalChromOf(focal_inv_id);
  const carriers = carriersOf(focal_inv_id);
  const controls = controlsOf(focal_inv_id);
  const hubShare = carrierHubShare(carriers);
  const tested = DEMO.chromosomes.filter(c => {
    if (scope === 'intra') return c === focal_chr;
    if (scope === 'inter') return c !== focal_chr;
    return true;
  });
  const rows = [];
  for (const tc of tested) {
    const { C: base_C, n_pairs } = baselineCoincidenceAndN(tc);
    if (!Number.isFinite(base_C)) {
      rows.push({
        focal_inv: focal_inv_id, focal_chr, tested_chr: tc,
        relation: tc === focal_chr ? 'intra' : 'inter',
        n_carriers: carriers.length, n_controls: controls.length,
        n_pairs, C_carrier: NaN, C_control: NaN,
        delta_C: NaN, p_perm: NaN, carrier_share_in_hub: hubShare.share,
        local_inv_controlled: control_local,
        status: 'no_data',
      });
      continue;
    }
    const C_c = carrierC(carriers, tc, focal_chr, base_C);
    const C_n = controlC(controls, tc, focal_chr, base_C);
    const delta = C_c - C_n;
    const p = permutationP(carriers, controls, tc, focal_chr, base_C, delta, n_perm);
    rows.push({
      focal_inv: focal_inv_id, focal_chr, tested_chr: tc,
      relation: tc === focal_chr ? 'intra' : 'inter',
      n_carriers: carriers.length, n_controls: controls.length,
      n_pairs,
      C_carrier: C_c, C_control: C_n, delta_C: delta, p_perm: p,
      carrier_share_in_hub: hubShare.share,
      local_inv_controlled: control_local,
      status: _classify(delta, p, hubShare.share),
    });
  }
  return {
    focal_inv: focal_inv_id, focal_chr,
    n_carriers: carriers.length, n_controls: controls.length,
    hub_share: hubShare,
    scope, n_perm, control_local,
    rows,
  };
}

function _classify(delta, p, hubShare) {
  if (!Number.isFinite(delta) || !Number.isFinite(p)) return 'no_data';
  if (hubShare >= 0.80)        return 'family_confounded';
  if (p < 0.01 && Math.abs(delta) >= 0.30) return 'strong_effect';
  if (p < 0.05 && Math.abs(delta) >= 0.15) return 'moderate_effect';
  if (p < 0.05)                return 'weak_effect';
  return 'no_effect';
}

export const STATUS_LABEL = {
  no_data:           'NO DATA',
  family_confounded: 'FAMILY CONFOUNDED',
  strong_effect:     'STRONG EFFECT',
  moderate_effect:   'MODERATE EFFECT',
  weak_effect:       'WEAK EFFECT',
  no_effect:         'NO EFFECT',
};
