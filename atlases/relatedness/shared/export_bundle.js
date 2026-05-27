// atlases/relatedness/shared/export_bundle.js
// =============================================================================
// Atlas-wide export bundle. Computes 7 cohort-level sections automatically
// from DEMO.* + existing shared modules. No DOM reads, no user choices.
// One click → one multi-section TSV (or one JSON blob) covering everything
// that can be derived without picking dyads / triads / scopes.
//
// Per-row analyses that NEED user choices (Mendelian dyad/triad picks,
// Compatibility focal, BDMI run scope, Regime focal, Inv × meiosis focal)
// are NOT in the bundle — those still go through each page's own TSV
// export button, by design.
// =============================================================================

import { DEMO } from './demo_data.js';
import { fmt } from './utils.js';
import {
  binomialPValueTwoSided, chiSquarePValue, expectedOffspringPrior,
} from './stats.js';
import {
  carriersOf, controlsOf, parentalCarriersOf, parentalMeioses,
  carrierHubShare, focalChromOf, inversionBurden,
  runFocalScan,
} from './inversion_meiosis.js';
import { runPriorityScan } from './inversion_priority.js';
import { runMarkerDesigner } from './marker_designer.js';

// ─── Section 1: cohort_overview (one row) ──────────────────────────────

function _cohortOverview() {
  const n_samples = (DEMO.individuals || []).length;
  const n_families = (DEMO.families || []).length;
  const n_triads = (DEMO.triads || []).length;
  const candidates = DEMO.inversion_candidates_full || [];
  const n_pass = candidates.filter(c => c.status === 'pass').length;
  const n_warn = candidates.filter(c => c.status === 'warn').length;
  const n_fail = candidates.filter(c => c.status === 'fail').length;
  const cohortMeta = DEMO.cohort_meta || {};
  // Karyotype call rate.
  let typed = 0, total = 0;
  for (const ind of (DEMO.individuals || [])) {
    for (const c of candidates) {
      total++;
      const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
      if (k && k !== 'NA') typed++;
    }
  }
  // Sex counts.
  const sx = { F: 0, M: 0, U: 0 };
  for (const ind of (DEMO.individuals || [])) {
    const s = ((DEMO.sex || {})[ind] || '?').toUpperCase();
    sx[s === 'F' ? 'F' : s === 'M' ? 'M' : 'U']++;
  }
  return [{
    species:        cohortMeta.species || '',
    cohort:         cohortMeta.cohort || '',
    n_samples,
    n_families,
    n_triads,
    n_candidates:   candidates.length,
    n_pass, n_warn, n_fail,
    n_sex_f: sx.F, n_sex_m: sx.M, n_sex_unknown: sx.U,
    karyotype_call_rate: total ? (typed / total).toFixed(4) : '',
  }];
}

// ─── Section 2: per_individual (one row per sample) ────────────────────

function _perIndividual() {
  const candidates = DEMO.inversion_candidates_full || [];
  const out = [];
  for (const ind of (DEMO.individuals || [])) {
    const fam = (DEMO.families || []).find(f => (f.members || []).includes(ind));
    const sex = (DEMO.sex || {})[ind] || '?';
    const q = DEMO.ancestry_q[ind] || [];
    let dominant_k = -1, dominant_q = 0;
    q.forEach((v, k) => { if (v > dominant_q) { dominant_q = v; dominant_k = k; } });
    let n_typed = 0, n_NA = 0, n_00 = 0, n_01 = 0, n_11 = 0;
    for (const c of candidates) {
      const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
      if (k === '0/0') { n_typed++; n_00++; }
      else if (k === '0/1') { n_typed++; n_01++; }
      else if (k === '1/1') { n_typed++; n_11++; }
      else { n_NA++; }
    }
    const n_as_parent = (DEMO.triads || []).filter(t =>
      t.parent_a === ind || t.parent_b === ind).length;
    const n_as_offspring = (DEMO.triads || []).filter(t => t.offspring === ind).length;
    out.push({
      sample_id:        ind,
      sex,
      family_id:        fam ? fam.family_id : '',
      role:             fam && fam.hub_individual === ind ? 'HUB' : (fam ? 'member' : 'unassigned'),
      dominant_k:       dominant_k >= 0 ? ('K' + (dominant_k + 1)) : '',
      dominant_q:       dominant_q.toFixed(3),
      ancestry_q_vector: q.map(v => v.toFixed(3)).join(';'),
      inversion_burden: inversionBurden(ind),
      n_het:            n_01,
      n_hom_alt:        n_11,
      n_typed,
      n_NA,
      call_rate:        (n_typed + n_NA) > 0 ? (n_typed / (n_typed + n_NA)).toFixed(3) : '',
      n_triads_as_parent:    n_as_parent,
      n_triads_as_offspring: n_as_offspring,
    });
  }
  return out;
}

// ─── Section 3: per_candidate (one row per inversion) ──────────────────

function _perCandidate() {
  const out = [];
  for (const c of (DEMO.inversion_candidates_full || [])) {
    // Karyotype counts.
    let n_00 = 0, n_01 = 0, n_11 = 0, n_NA = 0;
    for (const ind of (DEMO.individuals || [])) {
      const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
      if (k === '0/0') n_00++;
      else if (k === '0/1') n_01++;
      else if (k === '1/1') n_11++;
      else n_NA++;
    }
    const n_typed = n_00 + n_01 + n_11;
    const p = n_typed > 0 ? (n_01 + 2 * n_11) / (2 * n_typed) : NaN;
    const q = 1 - p;
    const exp_00 = q*q*n_typed, exp_01 = 2*p*q*n_typed, exp_11 = p*p*n_typed;
    let chi2 = 0;
    if (exp_00 > 0) chi2 += (n_00 - exp_00) ** 2 / exp_00;
    if (exp_01 > 0) chi2 += (n_01 - exp_01) ** 2 / exp_01;
    if (exp_11 > 0) chi2 += (n_11 - exp_11) ** 2 / exp_11;
    const hwe_p = chiSquarePValue(chi2, 1);

    // Hub share.
    const carriers = carriersOf(c.candidate);
    const hs = carrierHubShare(carriers);

    // Mendelian Test A (BDMI Test A primitive).
    let n_total = 0, n_inconsistent = 0;
    for (const t of (DEMO.triads || [])) {
      const p1 = (DEMO.karyotype_matrix[t.parent_a] || {})[c.candidate];
      const p2 = (DEMO.karyotype_matrix[t.parent_b] || {})[c.candidate];
      const o  = (DEMO.karyotype_matrix[t.offspring] || {})[c.candidate];
      const prior = expectedOffspringPrior(p1, p2);
      if (!prior || !o || o === 'NA') continue;
      const ix = o === '0/0' ? 0 : (o === '0/1' ? 1 : 2);
      n_total++;
      if (prior[ix] <= 0) n_inconsistent++;
    }
    const mend_p = n_total > 0 ? binomialPValueTwoSided(n_inconsistent, n_total, 0.02) : NaN;

    // Parental meiosis counts.
    const par = parentalCarriersOf(c.candidate);
    const n_parent_meioses_carrier = parentalMeioses(par.carriers, par.meiosis_counts);
    const n_parent_meioses_control = parentalMeioses(par.controls, par.meiosis_counts);

    // Companions on same chromosome.
    const companions = (DEMO.inversion_candidates_full || [])
      .filter(o => o.candidate !== c.candidate && o.chromosome === c.chromosome).length;

    out.push({
      candidate:      c.candidate,
      chromosome:     c.chromosome,
      start_mb:       c.start_mb,
      end_mb:         c.end_mb,
      length_mb:      c.length_mb,
      status:         c.status,
      frequency:      c.frequency,
      n_typed,
      n_00, n_01, n_11, n_NA,
      allele_freq:    Number.isFinite(p) ? p.toFixed(4) : '',
      hwe_chi2:       chi2.toFixed(3),
      hwe_p:          fmt(hwe_p),
      n_carriers:     carriers.length,
      top_hub:        hs.hub || '',
      top_hub_share:  hs.share.toFixed(3),
      mendel_n_informative_triads: n_total,
      mendel_n_inconsistent:       n_inconsistent,
      mendel_test_a_p:             fmt(mend_p),
      n_parent_carriers:  par.carriers.length,
      n_parent_controls:  par.controls.length,
      n_parent_meioses_carrier,
      n_parent_meioses_control,
      n_same_chrom_companions: companions,
      marker_ready:   (c.status === 'pass' && c.frequency >= 0.10) ? 'yes' : 'no',
      marker_reason:  c.status !== 'pass' ? ('status=' + c.status.toUpperCase())
                      : (c.frequency < 0.10 ? 'freq<0.10' : 'ready'),
    });
  }
  return out;
}

// ─── Section 4: per_family (one row per hub) ───────────────────────────

function _perFamily() {
  const out = [];
  for (const f of (DEMO.families || [])) {
    const members = f.members || [];
    const triads_in_hub = (DEMO.triads || []).filter(t =>
      members.includes(t.parent_a) &&
      members.includes(t.parent_b) &&
      members.includes(t.offspring));
    let f_count = 0, m_count = 0, u_count = 0;
    members.forEach(ind => {
      const s = ((DEMO.sex || {})[ind] || '?').toUpperCase();
      if (s === 'F') f_count++;
      else if (s === 'M') m_count++;
      else u_count++;
    });
    // Within-hub edge counts.
    const within = (DEMO.network_edges || []).filter(e =>
      members.includes(e.a) && members.includes(e.b));
    const edge_counts = { strong_po: 0, possible_po: 0, ambiguous: 0, mendelian_conflict: 0 };
    within.forEach(e => { if (edge_counts[e.class] !== undefined) edge_counts[e.class]++; });
    out.push({
      family_id:       f.family_id,
      hub_individual:  f.hub_individual || '',
      n_members:       members.length,
      members:         members.join(';'),
      n_triads_in_hub: triads_in_hub.length,
      n_sex_f:         f_count,
      n_sex_m:         m_count,
      n_sex_unknown:   u_count,
      n_strong_po:     edge_counts.strong_po,
      n_possible_po:   edge_counts.possible_po,
      n_ambiguous:     edge_counts.ambiguous,
      n_mend_conflict: edge_counts.mendelian_conflict,
    });
  }
  return out;
}

// ─── Section 5: inversion_priority (full priority scan) ────────────────

function _inversionPriority() {
  const r = runPriorityScan({ top_n: 9999 });
  return r.rows.map(row => ({
    candidate:               row.candidate,
    chromosome:              row.chromosome,
    start_mb:                row.start_mb,
    end_mb:                  row.end_mb,
    length_mb:               row.length_mb,
    status:                  row.status,
    frequency:               row.frequency,
    n_carriers:              row.n_carriers,
    n_controls:              row.n_controls,
    n_parental_carriers:     row.n_parental_carriers,
    n_parental_meioses:      row.n_parental_meioses,
    hub_share:               row.hub_share.toFixed(3),
    ancestry_l1:             Number.isFinite(row.ancestry_l1) ? row.ancestry_l1.toFixed(3) : '',
    burden_delta:            Number.isFinite(row.burden_delta) ? row.burden_delta.toFixed(3) : '',
    intra_effect:            Number.isFinite(row.intra_effect) ? row.intra_effect.toFixed(3) : '',
    intra_verdict:           row.intra_verdict,
    inter_mean_abs_delta:    Number.isFinite(row.inter_mean_abs_delta) ? row.inter_mean_abs_delta.toFixed(3) : '',
    inter_max_abs_delta:     Number.isFinite(row.inter_max_abs_delta) ? row.inter_max_abs_delta.toFixed(3) : '',
    mendel_p:                Number.isFinite(row.mendel_p) ? fmt(row.mendel_p) : '',
    mendel_n_total:          row.mendel_n_total,
    family_n_hubs:           row.family_n_hubs,
    marker_ready:            row.marker_ready ? 'yes' : 'no',
    marker_reason:           row.marker_reason,
    priority_score:          row.priority_score.toFixed(3),
    bucket:                  row.bucket,
  }));
}

// ─── Section 6: marker_designs (for top-N priority) ────────────────────

function _markerDesigns(prio, top_n = 5) {
  const top = prio.filter(r => r.bucket !== 'drop').slice(0, top_n);
  const out = [];
  for (const r of top) {
    const d = runMarkerDesigner(r.candidate, {});
    // Flatten: one row per (focal_inv × tested_chr × triplet).
    for (const c of d.per_chrom) {
      for (const tr of c.triplets) {
        out.push({
          focal_inv:                   d.focal_inv,
          focal_chr:                   d.focal_chr,
          panel_status:                d.panel_status,
          focal_readiness_status:      d.readiness.status,
          tested_chr:                  c.tested_chr,
          relation:                    tr.relation,
          interval_A_mb:               tr.interval_A_mb.join('-'),
          interval_B_mb:               tr.interval_B_mb.join('-'),
          markers_required:            tr.markers_required.join(','),
          expected_DCO:                tr.expected_DCO,
          expected_informative_families: tr.expected_informative_families,
          triplet_status:              tr.status,
          triplet_reason:              tr.reason || '',
        });
      }
    }
  }
  return out;
}

// ─── Section 7: focal_meiosis_scans (for top-N priority) ───────────────

function _focalMeiosisScans(prio, top_n = 5, n_perm = 200) {
  const top = prio.filter(r => r.bucket !== 'drop').slice(0, top_n);
  const out = [];
  for (const r of top) {
    const res = runFocalScan(r.candidate, {
      scope: 'both', n_perm, control_local: true, unit: 'parental_meiosis',
    });
    res.rows.forEach(row => {
      out.push({
        focal_inv:            row.focal_inv,
        focal_chr:            row.focal_chr,
        tested_chr:           row.tested_chr,
        relation:             row.relation,
        n_carriers:           row.n_carriers,
        n_controls:           row.n_controls,
        n_pairs:              row.n_pairs,
        C_carrier:            fmt(row.C_carrier),
        C_control:            fmt(row.C_control),
        delta_C:              fmt(row.delta_C),
        p_perm:               fmt(row.p_perm),
        carrier_share_in_hub: row.carrier_share_in_hub.toFixed(3),
        local_inv_controlled: row.local_inv_controlled ? 'yes' : 'no',
        status:               row.status,
      });
    });
  }
  return out;
}

// ─── Bundle assembly ───────────────────────────────────────────────────

export function buildBundle(opts = {}) {
  const top_n = opts.top_n || 5;
  const focal_n_perm = opts.focal_n_perm || 200;
  const cohort = _cohortOverview();
  const per_ind = _perIndividual();
  const per_cand = _perCandidate();
  const per_fam = _perFamily();
  const priority = _inversionPriority();
  const markers = _markerDesigns(priority, top_n);
  const focal = _focalMeiosisScans(priority, top_n, focal_n_perm);
  return {
    meta: {
      atlas: 'relatedness',
      date_iso: new Date().toISOString(),
      cohort: (DEMO.cohort_meta || {}).cohort || '',
      n_samples: (DEMO.individuals || []).length,
      n_candidates: (DEMO.inversion_candidates_full || []).length,
      top_n_priority_for_marker_and_focal: top_n,
      focal_meiosis_n_perm: focal_n_perm,
      note: 'Sections 6 (marker_designs) and 7 (focal_meiosis_scans) draw on the meiosis-stack pages, which are GATED on a real ngsTracts CO-call adapter per _handoff_docs/AUDIT_2026-05-15_meiosis_stack.md. Their numbers are synthetic until that adapter ships.',
    },
    sections: { cohort_overview: cohort, per_individual: per_ind,
                per_candidate: per_cand, per_family: per_fam,
                inversion_priority: priority, marker_designs: markers,
                focal_meiosis_scans: focal },
  };
}

// ─── TSV (multi-section, one file) ─────────────────────────────────────

export function bundleToTsv(bundle) {
  const lines = [];
  // Header.
  lines.push('# Relatedness Atlas — bundle export');
  for (const [k, v] of Object.entries(bundle.meta)) {
    lines.push('# ' + k + ': ' + v);
  }
  // Each section.
  for (const [name, rows] of Object.entries(bundle.sections)) {
    lines.push('');
    lines.push('# === ' + name + ' === (n=' + rows.length + ')');
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    lines.push(cols.join('\t'));
    for (const r of rows) {
      lines.push(cols.map(c => r[c] === undefined || r[c] === null ? '' : r[c]).join('\t'));
    }
  }
  return lines.join('\n') + '\n';
}

// ─── JSON ──────────────────────────────────────────────────────────────

export function bundleToJson(bundle) {
  return JSON.stringify(bundle, null, 2);
}
