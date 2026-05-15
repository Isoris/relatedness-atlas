// atlases/relatedness/shared/marker_designer.js
// =============================================================================
// Interchromosomal Marker Test Designer.
//
// Converts a candidate interchromosomal meiosis effect into a marker panel.
// Two marker types:
//
//   (1) Focal-inversion-state markers — tag SNPs + breakpoint markers used
//       to classify parents as heterozygous / homozygous at the focal
//       inversion.
//
//   (2) Transmission / recombination markers — ordered triplets m1-m2-m3
//       on each tested chromosome, so that two intervals A (m1→m2) and B
//       (m2→m3) can support CO, DCO, and C estimation in offspring panels.
//
// Marker positions are synthesised deterministically from DEMO; when real
// marker catalogs land, replace the two generators below.
//
// Status codes per tested chromosome: READY / PARTIAL / BLOCKED / MISSING /
// LOW_POWER.
// =============================================================================

import { DEMO } from './demo_data.js';
import { hashStr } from './utils.js';
import {
  windowsForChrom, coRatePerMeiosis,
} from './recomb_data.js';
import {
  focalChromOf, parentalCarriersOf, carrierHubShare,
} from './inversion_meiosis.js';

const N_MARKERS_PER_TESTED_CHROM = 5;  // five evenly spaced markers → 4 intervals → 3 ABi pairs

// ─── Focal-inversion markers ────────────────────────────────────────────

export function focalMarkersFor(invId) {
  const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === invId);
  if (!inv) return [];
  const mid = (inv.start_mb + inv.end_mb) / 2;
  return [
    { marker_id: invId + '_tag1', kind: 'tag_snp',    chromosome: inv.chromosome,
      position_mb: +(mid - 0.4).toFixed(2),
      purpose: 'classify inversion karyotype',
      assay_status: 'ready', expected_genotypes: '0/0 · 0/1 · 1/1' },
    { marker_id: invId + '_tag2', kind: 'tag_snp',    chromosome: inv.chromosome,
      position_mb: +(mid + 0.4).toFixed(2),
      purpose: 'classify inversion karyotype (replicate)',
      assay_status: 'ready', expected_genotypes: '0/0 · 0/1 · 1/1' },
    { marker_id: invId + '_bp1', kind: 'breakpoint', chromosome: inv.chromosome,
      position_mb: +inv.start_mb.toFixed(2),
      purpose: 'breakpoint validation (5′ end)',
      assay_status: 'candidate', expected_genotypes: 'present · absent' },
    { marker_id: invId + '_bp2', kind: 'breakpoint', chromosome: inv.chromosome,
      position_mb: +inv.end_mb.toFixed(2),
      purpose: 'breakpoint validation (3′ end)',
      assay_status: 'candidate', expected_genotypes: 'present · absent' },
  ];
}

// Focal-inversion-state readiness summary.
export function focalReadiness(invId) {
  const par = parentalCarriersOf(invId);
  const hub = carrierHubShare(par.carriers);
  const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === invId);
  const enough_het = par.carriers.length >= 3;
  const status = !inv ? 'MISSING'
    : !enough_het    ? 'BLOCKED'
    : hub.share >= 0.80 ? 'PARTIAL'
    : 'READY';
  return {
    classifier_ready: true,        // tag SNPs are always synthesisable in the demo
    candidate_markers_ready: true,
    enough_heterozygotes: enough_het,
    hub_share: hub.share,
    n_parents_het: par.carriers.length,
    n_parents_nonhet: par.controls.length,
    status,
  };
}

// ─── Per-tested-chromosome marker grid (synthetic generator) ────────────

function _markerSeed(chrom, idx) { return hashStr(chrom + '|M' + idx); }

export function chromosomeMarkerGrid(chrom) {
  const length_mb = DEMO.recomb_chrom_length_mb || 50;
  const step = length_mb / (N_MARKERS_PER_TESTED_CHROM + 1);
  const out = [];
  for (let i = 1; i <= N_MARKERS_PER_TESTED_CHROM; i++) {
    const pos = +(i * step).toFixed(2);
    const seed = _markerSeed(chrom, i);
    // Mappability / assay heuristics — deterministic from chromosome+index.
    const r = Math.abs(Math.sin(seed * 0.137)) % 1;
    const mappability = r < 0.8 ? 'good' : (r < 0.95 ? 'fair' : 'poor');
    out.push({
      marker_id: chrom + '_M' + i,
      chromosome: chrom,
      position_mb: pos,
      kind: 'snp',
      assay: 'GT-seq',
      mappability,
      missingness: +(r * 0.15).toFixed(3),    // 0–15% missing
    });
  }
  return out;
}

// ─── Per-tested-chromosome test design (interval pairs A and B) ─────────

export function testDesign(invId, testedChrom, opts = {}) {
  const focal_chr = focalChromOf(invId);
  const relation = (testedChrom === focal_chr) ? 'intra' : 'inter';
  const markers = chromosomeMarkerGrid(testedChrom);
  // Build all adjacent triplets (m_i, m_{i+1}, m_{i+2}) → intervals A and B.
  const triplets = [];
  for (let i = 0; i + 2 < markers.length; i++) {
    triplets.push({
      tested_chr: testedChrom, relation,
      A_left:  markers[i],
      A_right: markers[i + 1],
      B_right: markers[i + 2],
      interval_A_mb: [markers[i].position_mb, markers[i + 1].position_mb],
      interval_B_mb: [markers[i + 1].position_mb, markers[i + 2].position_mb],
    });
  }
  // Expected DCO per triplet — Poisson on (r_A · r_B · n_meioses) using
  // the population coincidence numbers as a rough proxy.
  const wins = windowsForChrom(testedChrom);
  const r_mean = wins.length
    ? wins.reduce((s, w) => s + coRatePerMeiosis(w), 0) / wins.length
    : 0;
  for (const tr of triplets) {
    const r_A = r_mean;            // simplified — uniform CO rate per Mb
    const r_B = r_mean;
    const expected_DCO = r_A * r_B * (DEMO.recomb_n_meioses || 1) * 25;
    tr.expected_DCO = +expected_DCO.toFixed(3);
    tr.expected_informative_families = Math.min(
      (DEMO.families || []).length,
      Math.round((DEMO.families || []).length * (markers.filter(m => m.mappability === 'good').length / markers.length))
    );
    tr.markers_required = [tr.A_left.marker_id, tr.A_right.marker_id, tr.B_right.marker_id];
    // Status for this triplet.
    if (markers.filter(m => m.mappability !== 'poor').length < 3) {
      tr.status = 'MISSING';
      tr.reason = 'fewer than 3 usable markers on chromosome';
    } else if (expected_DCO < 0.2) {
      tr.status = 'LOW_POWER';
      tr.reason = 'expected_DCO < 0.2';
    } else if (markers.some(m => m.mappability === 'poor')) {
      tr.status = 'PARTIAL';
      tr.reason = 'one or more markers have poor mappability';
    } else {
      tr.status = 'READY';
      tr.reason = '';
    }
  }
  return { tested_chr: testedChrom, relation, markers, triplets };
}

// ─── Driver — full panel design for one focal inversion ─────────────────

export function runMarkerDesigner(invId, opts = {}) {
  const tested = (opts.tested_chroms && opts.tested_chroms.length)
    ? opts.tested_chroms
    : DEMO.chromosomes.slice();
  const focal_chr = focalChromOf(invId);
  const focal_markers = focalMarkersFor(invId);
  const readiness = focalReadiness(invId);
  const per_chrom = tested.map(c => testDesign(invId, c));

  // Aggregate panel-level status.
  const _classify_chrom = (d) => {
    if (!d.triplets.length) return 'MISSING';
    const codes = d.triplets.map(t => t.status);
    if (codes.includes('READY'))     return 'READY';
    if (codes.includes('PARTIAL'))   return 'PARTIAL';
    if (codes.includes('LOW_POWER')) return 'LOW_POWER';
    return 'MISSING';
  };
  per_chrom.forEach(d => { d.status = _classify_chrom(d); });

  const summary = {
    n_tested: per_chrom.length,
    n_ready:     per_chrom.filter(d => d.status === 'READY').length,
    n_partial:   per_chrom.filter(d => d.status === 'PARTIAL').length,
    n_low_power: per_chrom.filter(d => d.status === 'LOW_POWER').length,
    n_missing:   per_chrom.filter(d => d.status === 'MISSING').length,
  };

  return {
    focal_inv: invId, focal_chr,
    focal_markers, readiness,
    per_chrom, summary,
    panel_status: (
      readiness.status === 'BLOCKED' ? 'BLOCKED'
      : summary.n_ready >= 2 ? 'PANEL_READY'
      : summary.n_ready >= 1 ? 'PANEL_PARTIAL'
      : 'PANEL_LOW_POWER'
    ),
  };
}

export const PANEL_STATUS_LABEL = {
  PANEL_READY:     'PANEL READY',
  PANEL_PARTIAL:   'PANEL PARTIAL',
  PANEL_LOW_POWER: 'PANEL LOW POWER',
  BLOCKED:         'BLOCKED',
};
