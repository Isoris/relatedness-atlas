// atlases/relatedness/shared/inversion_priority.js
// =============================================================================
// Priority Table — Pass-1 (WGS discovery) → Pass-2 (marker validation at
// scale) bridge. One row per inversion candidate aggregating every signal
// the other pages compute, plus a composite priority_score and a
// recommended bucket: ship_to_pass2 / hold / drop.
//
// Per the user's spec (2026-05-15):
//
//   INV_ID, chromosome, karyotype frequency, intra-chromosomal CO effect,
//   interchromosomal CO/coincidence effect, Mendelian distortion,
//   family consistency, candidate marker readiness, breeding relevance,
//   priority score.
//
// Computation deliberately uses fast heuristics so the page can score all
// 248 candidates in one synchronous run. The expensive analyses
// (negative-control nulls, full permutation across all chromosomes) are
// still available per-candidate via the Inv × meiosis tab.
// =============================================================================

import { DEMO } from './demo_data.js';
import {
  insideFlankSummary, inversionVerdict,
} from './recomb_data.js';
import {
  parentalCarriersOf, parentalMeioses, carriersOf, controlsOf,
  carrierHubShare, confounderProfile, focalChromOf,
  baselineCoincidenceAndN, carrierC, controlC,
} from './inversion_meiosis.js';
import {
  binomialPValueTwoSided, expectedOffspringPrior,
} from './stats.js';

// ─── Per-candidate signal aggregators ──────────────────────────────────

function _mendelianDistortion(invId) {
  // Same logic as BDMI Test A but only the binomial p across DEMO.triads.
  let n_total = 0, n_inconsistent = 0;
  for (const t of DEMO.triads || []) {
    const p1 = (DEMO.karyotype_matrix[t.parent_a] || {})[invId];
    const p2 = (DEMO.karyotype_matrix[t.parent_b] || {})[invId];
    const o  = (DEMO.karyotype_matrix[t.offspring] || {})[invId];
    const prior = expectedOffspringPrior(p1, p2);
    if (!prior || !o || o === 'NA') continue;
    const ix = o === '0/0' ? 0 : (o === '0/1' ? 1 : 2);
    n_total++;
    if (prior[ix] <= 0) n_inconsistent++;
  }
  if (n_total === 0) return { n_total: 0, p: NaN };
  return {
    n_total, n_inconsistent,
    p: binomialPValueTwoSided(n_inconsistent, n_total, 0.02),
  };
}

function _intraCoEffect(invId) {
  // Use the inside-vs-flank CO ratio from the inversion_signature math:
  // the smaller the co_ratio, the stronger the intra suppression. We
  // return (1 - co_ratio) clipped to [0, 1] as the "intra effect" strength.
  const chrom = focalChromOf(invId);
  const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === invId);
  if (!inv || !chrom) return { strength: NaN, verdict: { code: 'no_data', label: 'NO DATA' } };
  const sum = insideFlankSummary(inv, chrom);
  const verdict = inversionVerdict(sum);
  const strength = Number.isFinite(sum.co_ratio)
    ? Math.max(0, Math.min(1, 1 - sum.co_ratio))
    : NaN;
  return { strength, verdict, sum };
}

function _interCoEffect(invId) {
  // Mean |delta_C| across off-chromosome tested chromosomes, using the
  // fast carrierC/controlC heuristics. No permutation here — that lives on
  // the Inv × meiosis page. This is a screening signal only.
  const carriers = carriersOf(invId);
  const controls = controlsOf(invId);
  const focal_chr = focalChromOf(invId);
  if (!carriers.length || !controls.length || !focal_chr) {
    return { mean_abs_delta: NaN, max_abs_delta: NaN, n_tested: 0 };
  }
  let n = 0, sum = 0, max = 0;
  for (const tc of DEMO.chromosomes) {
    if (tc === focal_chr) continue;
    const { C: base_C } = baselineCoincidenceAndN(tc);
    if (!Number.isFinite(base_C)) continue;
    const c_c = carrierC(carriers, tc, focal_chr, base_C);
    const c_n = controlC(controls, tc, focal_chr, base_C);
    const d = Math.abs(c_c - c_n);
    sum += d; n++;
    if (d > max) max = d;
  }
  return {
    mean_abs_delta: n ? sum / n : NaN,
    max_abs_delta: n ? max : NaN,
    n_tested: n,
  };
}

function _familyConsistency(invId) {
  // Spread across family hubs. Score = min(n_hubs, 3) / 3 — saturates at 3
  // hubs since DEMO has 3 families.
  const carriers = carriersOf(invId);
  const hubs = new Set(carriers.map(c => {
    const f = (DEMO.families || []).find(f => (f.members || []).includes(c));
    return f ? f.family_id : null;
  }).filter(Boolean));
  return { n_hubs: hubs.size, score: Math.min(hubs.size, 3) / 3 };
}

function _markerReadiness(invId) {
  // Heuristic: passing-status + ≥ 0.10 frequency = "marker ready".
  const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === invId);
  if (!inv) return { ready: false, reason: 'unknown candidate' };
  if (inv.status === 'pass' && inv.frequency >= 0.10)
    return { ready: true,  reason: 'pass + freq ≥ 0.10' };
  if (inv.status === 'warn')
    return { ready: false, reason: 'WARN status — confirm calls first' };
  if (inv.frequency < 0.05)
    return { ready: false, reason: 'low frequency — power-limited at scale' };
  return { ready: true, reason: 'usable' };
}

// ─── Composite score ────────────────────────────────────────────────────

function _normalize(x, lo, hi) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
}

function _compositeScore(parts) {
  // Equal-weight composite of the four pillars; can be tuned later.
  const weights = {
    intra:    0.30,   // direct expected effect, must-test
    inter:    0.25,   // novel discovery signal
    mendel:   0.20,   // distortion / transmission anomaly
    family:   0.15,   // consistency across hubs
    marker:   0.10,   // pass-2 readiness
  };
  return weights.intra  * parts.intra
       + weights.inter  * parts.inter
       + weights.mendel * parts.mendel
       + weights.family * parts.family
       + weights.marker * parts.marker;
}

function _bucket(score, marker_ready, hub_share, mend_p) {
  if (hub_share >= 0.80) return 'hold';      // family-confounded
  if (marker_ready && score >= 0.55) return 'ship_to_pass2';
  if (!marker_ready && score >= 0.55) return 'hold';
  if (score >= 0.30) return 'hold';
  return 'drop';
}

export const PRIORITY_BUCKET_LABEL = {
  ship_to_pass2: 'SHIP → PASS 2',
  hold:          'HOLD',
  drop:          'DROP',
};

// ─── Driver — one row per candidate ────────────────────────────────────

export function runPriorityScan(opts = {}) {
  const top_n = opts.top_n || 20;
  const rows = [];
  for (const inv of (DEMO.inversion_candidates_full || [])) {
    const carriers = carriersOf(inv.candidate);
    const controls = controlsOf(inv.candidate);
    const conf = confounderProfile(carriers, controls);
    const par  = parentalCarriersOf(inv.candidate);
    const mend = _mendelianDistortion(inv.candidate);
    const intra = _intraCoEffect(inv.candidate);
    const inter = _interCoEffect(inv.candidate);
    const fam   = _familyConsistency(inv.candidate);
    const marker = _markerReadiness(inv.candidate);

    const norm = {
      intra:  _normalize(intra.strength, 0.0, 0.9),
      inter:  _normalize(inter.max_abs_delta, 0.05, 0.50),
      mendel: Number.isFinite(mend.p) ? _normalize(-Math.log10(Math.max(1e-3, mend.p)), 0, 3) : 0,
      family: fam.score,
      marker: marker.ready ? 1 : 0,
    };
    const score = _compositeScore(norm);
    const bucket = _bucket(score, marker.ready, conf.hub_share.share, mend.p);

    rows.push({
      candidate: inv.candidate,
      chromosome: inv.chromosome,
      start_mb: inv.start_mb, end_mb: inv.end_mb, length_mb: inv.length_mb,
      status: inv.status, frequency: inv.frequency,
      n_carriers: carriers.length, n_controls: controls.length,
      n_parental_carriers: par.carriers.length,
      n_parental_meioses: parentalMeioses(par.carriers, par.meiosis_counts),
      hub_share: conf.hub_share.share,
      ancestry_l1: conf.ancestry_l1,
      burden_delta: conf.burden_delta,
      intra_effect: intra.strength,
      intra_verdict: intra.verdict.code,
      inter_mean_abs_delta: inter.mean_abs_delta,
      inter_max_abs_delta:  inter.max_abs_delta,
      mendel_p: mend.p,
      mendel_n_total: mend.n_total,
      family_n_hubs: fam.n_hubs,
      marker_ready: marker.ready,
      marker_reason: marker.reason,
      priority_score: score,
      bucket,
    });
  }
  rows.sort((a, b) => {
    // ship_to_pass2 first, then by score desc.
    const order = { ship_to_pass2: 0, hold: 1, drop: 2 };
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    return (b.priority_score || 0) - (a.priority_score || 0);
  });
  return {
    rows,
    n_ship: rows.filter(r => r.bucket === 'ship_to_pass2').length,
    n_hold: rows.filter(r => r.bucket === 'hold').length,
    n_drop: rows.filter(r => r.bucket === 'drop').length,
    top_n,
  };
}
