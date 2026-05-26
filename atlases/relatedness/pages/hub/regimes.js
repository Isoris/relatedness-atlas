// atlases/relatedness/pages/hub/regimes.js
// =============================================================================
// Linked Inversion Regimes — sub-tab #7.
//
// Tests whether a focal inversion's apparent segregation distortion / class
// depletion is explained by linkage to another inversion on the same
// chromosome. This is the "real core genetics" companion to the BDMI screen:
// it prevents the BDMI screen from over-calling mechanisms (drive,
// underdominance, incompatibility) when the signal is actually long-range
// haplotype regime coupling.
//
// Per the chat (2026-05-14): the page answers one question —
//
//   Does this inversion behave independently, or is it explained by another
//   inversion / chromosome haplotype regime?
//
// Outputs (one row per linked partner on the same chromosome):
//
//   chromosome, focal_id, partner_id, n, cramers_v, mutual_information,
//   missing_combination_count, conditional_distortion_before,
//   conditional_distortion_after, interpretation
//
// Interpretation labels:
//   - "regime-coupled"    — strong CV + recombinant classes (off-diagonals)
//                           missing. Inheritance comes as a chromosome block.
//   - "regime-explained"  — focal distortion present marginally but disappears
//                           after stratifying by partner. Don't call BDMI.
//   - "regime-residual"   — distortion remains after conditioning. Independent
//                           segregation signal at the focal candidate.
//   - "regime-independent"— focal not distorted; partner not coupled. Two
//                           independent inversions on the same chromosome.
//   - "regime-unknown"    — joint n below threshold; skipped.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { chiSquarePValue, expectedOffspringPrior } from '../../shared/stats.js';
import { on } from '../../shared/page_hooks.js';
import {
  karyoFor, loadLiveKaryotypes, renderKaryotypeBadgeSlots,
} from '../../shared/karyotype_source.js';
import { _setActiveState } from './regimes/_state.js';

// ─── Karyotype helpers (same convention as bdmi.js / mendelian.js) ────────

function ktIndex(kt) {
  if (kt === '0/0') return 0;
  if (kt === '0/1') return 1;
  if (kt === '1/1') return 2;
  return -1;
}
const KT_LABEL = ['AA', 'AB', 'BB'];

// 3×3 joint genotype table across all typed individuals.
function jointTable(focalId, partnerId) {
  const tbl = [[0,0,0],[0,0,0],[0,0,0]];
  let n = 0;
  for (const ind of DEMO.individuals) {
    const kf = karyoFor(ind)[focalId];
    const kp = karyoFor(ind)[partnerId];
    const i1 = ktIndex(kf), i2 = ktIndex(kp);
    if (i1 < 0 || i2 < 0) continue;
    tbl[i1][i2]++; n++;
  }
  return { tbl, n };
}

// Cramér's V (effect size from a contingency χ²).
function cramersV(tbl, n) {
  const rows = tbl.length, cols = tbl[0].length;
  const rowSum = tbl.map(r => r.reduce((a,b) => a+b, 0));
  const colSum = [0, 0, 0];
  for (const r of tbl) for (let j = 0; j < cols; j++) colSum[j] += r[j];
  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const e = (rowSum[i] * colSum[j]) / n;
      if (e > 0) chi2 += (tbl[i][j] - e) ** 2 / e;
    }
  }
  const k = Math.min(rows, cols) - 1;
  const v = (n > 0 && k > 0) ? Math.sqrt(chi2 / (n * k)) : 0;
  const chi2_p = chiSquarePValue(chi2, (rows - 1) * (cols - 1));
  return { chi2, chi2_p, v };
}

// Mutual information I(X;Y) in nats.
function mutualInformation(tbl, n) {
  if (n === 0) return 0;
  const rowSum = tbl.map(r => r.reduce((a,b) => a+b, 0));
  const colSum = [0, 0, 0];
  for (const r of tbl) for (let j = 0; j < 3; j++) colSum[j] += r[j];
  let mi = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (tbl[i][j] === 0 || rowSum[i] === 0 || colSum[j] === 0) continue;
      const pxy = tbl[i][j] / n;
      const px  = rowSum[i] / n;
      const py  = colSum[j] / n;
      mi += pxy * Math.log(pxy / (px * py));
    }
  }
  return mi;
}

// Count missing recombinant classes. A "missing combination" is a cell
// whose observed count is 0 but whose HWE-product expectation is ≥ 5%.
function missingCombinations(tbl, n) {
  if (n === 0) return 0;
  const rowSum = tbl.map(r => r.reduce((a,b) => a+b, 0));
  const colSum = [0, 0, 0];
  for (const r of tbl) for (let j = 0; j < 3; j++) colSum[j] += r[j];
  let count = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (tbl[i][j] > 0) continue;
      const e = (rowSum[i] * colSum[j]) / n;
      if (e / n >= 0.05) count++;
    }
  }
  return count;
}

// ─── Distortion score (marginal vs conditional) ───────────────────────────
//
// Distortion at the focal is measured as HWE chi² deviation (df=1) on the
// three-class marginal. The "after conditioning" score is the sum of HWE
// chi² across the partner-stratified slices, divided by the number of
// strata with enough samples — i.e. the mean within-stratum distortion.

function _hweDistortion(counts, n) {
  if (n < 5) return { chi2: NaN, chi2_p: NaN };
  const p = (counts[1] + 2 * counts[2]) / (2 * n);
  const q = 1 - p;
  const e0 = q*q*n, e1 = 2*p*q*n, e2 = p*p*n;
  let chi2 = 0;
  if (e0 > 0) chi2 += (counts[0] - e0) ** 2 / e0;
  if (e1 > 0) chi2 += (counts[1] - e1) ** 2 / e1;
  if (e2 > 0) chi2 += (counts[2] - e2) ** 2 / e2;
  return { chi2, chi2_p: chiSquarePValue(chi2, 1) };
}

function focalDistortion(focalId) {
  const counts = [0, 0, 0]; let n = 0;
  for (const ind of DEMO.individuals) {
    const kt = karyoFor(ind)[focalId];
    const ix = ktIndex(kt);
    if (ix < 0) continue;
    counts[ix]++; n++;
  }
  return { counts, n, ..._hweDistortion(counts, n) };
}

function conditionalDistortion(focalId, partnerId) {
  // Stratify focal counts by partner class, then summarise as the mean
  // within-stratum HWE chi² across strata with n_stratum >= 5.
  const strata = [[0,0,0], [0,0,0], [0,0,0]];
  for (const ind of DEMO.individuals) {
    const kf = karyoFor(ind)[focalId];
    const kp = karyoFor(ind)[partnerId];
    const i1 = ktIndex(kf), i2 = ktIndex(kp);
    if (i1 < 0 || i2 < 0) continue;
    strata[i2][i1]++;
  }
  const sliceStats = strata.map(s => {
    const n = s[0] + s[1] + s[2];
    return { counts: s, n, ..._hweDistortion(s, n) };
  });
  const valid = sliceStats.filter(s => Number.isFinite(s.chi2));
  const meanChi2 = valid.length
    ? valid.reduce((a, b) => a + b.chi2, 0) / valid.length
    : NaN;
  // Fisher-style combination of slice p-values via -2 Σ log p, χ²(2k).
  const validP = sliceStats.filter(s => Number.isFinite(s.chi2_p) && s.chi2_p > 0);
  let combined_p = NaN;
  if (validP.length) {
    const stat = -2 * validP.reduce((a, b) => a + Math.log(b.chi2_p), 0);
    combined_p = chiSquarePValue(stat, 2 * validP.length);
  }
  return { sliceStats, mean_chi2: meanChi2, combined_p };
}

// ─── Verdict assignment ───────────────────────────────────────────────────

function assignVerdict(opts) {
  const { jointN, minN, V, missing, vThr, focalDist, condDist } = opts;
  if (jointN < minN) return 'regime-unknown';
  // Marginal focal distortion test at α = 0.05 (HWE df=1).
  const focal_distorted = Number.isFinite(focalDist.chi2_p) && focalDist.chi2_p < 0.05;
  // Coupled-regime signature: high CV + recombinant cells missing.
  const coupled = V >= vThr && missing >= 1;
  if (focal_distorted) {
    const cond_distorted = Number.isFinite(condDist.combined_p) && condDist.combined_p < 0.05;
    if (coupled && !cond_distorted) return 'regime-explained';
    if (cond_distorted)             return 'regime-residual';
    return 'regime-explained';
  }
  if (coupled) return 'regime-coupled';
  return 'regime-independent';
}

const VERDICT_LABEL = {
  'regime-coupled':     'COUPLED REGIME',
  'regime-explained':   'EXPLAINED BY LINKAGE',
  'regime-residual':    'RESIDUAL DISTORTION',
  'regime-independent': 'INDEPENDENT',
  'regime-unknown':     'INSUFFICIENT N',
};

// ─── Pickers / scoping ───────────────────────────────────────────────────

function listChromosomesWithMultipleInversions() {
  const byChrom = new Map();
  for (const inv of DEMO.inversion_candidates_full) {
    if (!byChrom.has(inv.chromosome)) byChrom.set(inv.chromosome, []);
    byChrom.get(inv.chromosome).push(inv);
  }
  return [...byChrom.entries()]
    .filter(([_c, arr]) => arr.length >= 2)
    .map(([c, _arr]) => c)
    .sort();
}

function inversionsOnChromosome(chrom) {
  return DEMO.inversion_candidates_full.filter(i => i.chromosome === chrom);
}

function populatePickers() {
  const chroms = listChromosomesWithMultipleInversions();
  const chromSel = $('#regimesChrom');
  chromSel.innerHTML = '';
  if (!chroms.length) {
    chromSel.appendChild(el('option', { value: '', text: '(no chromosome has ≥ 2 candidates)' }));
    $('#regimesFocal').innerHTML = '';
    return;
  }
  chroms.forEach(c => chromSel.appendChild(el('option', { value: c, text: c })));
  const wanted = state.regimes.chromosome && chroms.includes(state.regimes.chromosome)
    ? state.regimes.chromosome
    : chroms[0];
  chromSel.value = wanted;
  state.regimes.chromosome = wanted;
  _populateFocal(wanted);
}

function _populateFocal(chrom) {
  const focals = inversionsOnChromosome(chrom);
  const focalSel = $('#regimesFocal');
  focalSel.innerHTML = '';
  focals.forEach(inv => {
    focalSel.appendChild(el('option', {
      value: inv.candidate,
      text: inv.candidate + ' — ' + inv.start_mb.toFixed(1) + '–' + inv.end_mb.toFixed(1) + ' Mb · freq=' + fmt(inv.frequency),
    }));
  });
  const wanted = state.regimes.focal && focals.some(f => f.candidate === state.regimes.focal)
    ? state.regimes.focal
    : (focals[0] && focals[0].candidate);
  if (wanted) {
    focalSel.value = wanted;
    state.regimes.focal = wanted;
  }
}

// ─── Driver ───────────────────────────────────────────────────────────────

function runRegimeTest() {
  const chrom    = $('#regimesChrom').value;
  const focalId  = $('#regimesFocal').value;
  const minN     = parseInt($('#regimesMinN').value, 10);
  const vThr     = parseFloat($('#regimesCoupleThr').value);
  if (!chrom || !focalId) return;
  const partners = inversionsOnChromosome(chrom).filter(i => i.candidate !== focalId);
  const focalDist = focalDistortion(focalId);
  const rows = partners.map(p => {
    const { tbl, n } = jointTable(focalId, p.candidate);
    const { v, chi2, chi2_p } = cramersV(tbl, n);
    const mi = mutualInformation(tbl, n);
    const missing = missingCombinations(tbl, n);
    const condDist = conditionalDistortion(focalId, p.candidate);
    const verdict = assignVerdict({
      jointN: n, minN, V: v, missing, vThr,
      focalDist, condDist,
    });
    return {
      partner: p,
      n, tbl,
      cramers_v: v, joint_chi2: chi2, joint_chi2_p: chi2_p,
      mutual_information: mi,
      missing_combinations: missing,
      conditional: condDist,
      verdict,
    };
  });
  // Sort: coupled / explained / residual first (most informative), then by CV desc.
  const order = {
    'regime-residual': 0, 'regime-explained': 1, 'regime-coupled': 2,
    'regime-independent': 3, 'regime-unknown': 4,
  };
  rows.sort((a, b) => {
    if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
    return b.cramers_v - a.cramers_v;
  });
  state.regimes.last_results = {
    chromosome: chrom, focal: focalId, focal_distortion: focalDist,
    min_n: minN, couple_threshold: vThr,
    rows,
  };
  state.regimes.last_mechanism = classifyMechanism(focalId, rows);
  renderRegimeResults();
  renderMechanismClassifier();
}

// ─── Rendering ────────────────────────────────────────────────────────────

function renderRegimeResults() {
  const r = state.regimes.last_results;
  const sumSlot = $('#regimesSummary');
  const focalSlot = $('#regimesFocalDistortionSlot');
  const partSlot = $('#regimesPartnerTableSlot');
  const jointSlot = $('#regimesJointTableSlot');
  const verdictWrap = $('#regimesVerdictSlot');
  sumSlot.innerHTML = ''; focalSlot.innerHTML = '';
  partSlot.innerHTML = ''; jointSlot.innerHTML = '';
  verdictWrap.style.display = 'none';
  if (!r) return;

  // Top summary cells.
  const fd = r.focal_distortion;
  const counts = fd.counts;
  sumSlot.appendChild(_sumCell('chromosome', r.chromosome));
  sumSlot.appendChild(_sumCell('focal', r.focal));
  sumSlot.appendChild(_sumCell('partners on chrom', r.rows.length));
  sumSlot.appendChild(_sumCell('AA / AB / BB', counts.join(' / '),
    null, 'n=' + fd.n));
  sumSlot.appendChild(_sumCell('focal HWE χ² p', fmt(fd.chi2_p),
    Number.isFinite(fd.chi2_p) && fd.chi2_p < 0.05 ? 'fail' : null));

  // Focal-distortion block.
  focalSlot.appendChild(el('div', {
    class: 'ie-conclusion ' + (Number.isFinite(fd.chi2_p) && fd.chi2_p < 0.05 ? 'tier-conflict' : 'tier-weak'),
    style: { marginTop: '14px' },
    html: '<div class="verdict">FOCAL MARGINAL DISTORTION</div>'
        + 'Focal <b>' + r.focal + '</b> on <b>' + r.chromosome + '</b>: '
        + 'AA=' + counts[0] + ', AB=' + counts[1] + ', BB=' + counts[2] + ' '
        + '(n=' + fd.n + '). HWE χ² = ' + fmt(fd.chi2)
        + ', p = ' + fmt(fd.chi2_p) + '. '
        + (Number.isFinite(fd.chi2_p) && fd.chi2_p < 0.05
            ? 'Marginal distortion present. The partner table below tests whether this disappears after conditioning on each linked candidate.'
            : 'No marginal distortion at α=0.05. Coupling tests still report which partners share a long-range haplotype regime.')
  }));

  // Partner table.
  if (r.rows.length === 0) {
    partSlot.appendChild(el('div', {
      class: 'ie-conclusion tier-weak',
      style: { marginTop: '14px' },
      html: '<div class="verdict">NO LINKED PARTNERS</div>'
          + r.chromosome + ' has no other inversion candidate, so no regime test can be run. Pick a chromosome with ≥ 2 candidates.'
    }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Partner','n','Cramér V','MI (nats)','Missing comb.','Cond. χ̄²','Cond. Fisher p','Marginal p','Verdict']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  r.rows.forEach((row, idx) => {
    const t = el('tr', { class: 'clickable' });
    t.addEventListener('click', () => _renderJointTable(row));
    t.appendChild(el('td', { class: 'sample-id', text: row.partner.candidate }));
    t.appendChild(el('td', { class: 'num', text: String(row.n) }));
    t.appendChild(el('td', { class: 'num', text: row.cramers_v.toFixed(3) }));
    t.appendChild(el('td', { class: 'num', text: row.mutual_information.toFixed(3) }));
    t.appendChild(el('td', { class: 'num', text: String(row.missing_combinations) }));
    t.appendChild(el('td', { class: 'num',
      text: Number.isFinite(row.conditional.mean_chi2) ? row.conditional.mean_chi2.toFixed(3) : '—' }));
    t.appendChild(el('td', { class: 'num', text: fmt(row.conditional.combined_p) }));
    t.appendChild(el('td', { class: 'num', text: fmt(row.joint_chi2_p) }));
    const verdTd = el('td');
    verdTd.appendChild(el('span', {
      class: 'regimes-verdict-pill ' + row.verdict,
      text: VERDICT_LABEL[row.verdict],
    }));
    t.appendChild(verdTd);
    tbody.appendChild(t);
    // Auto-open the first (most-informative) row's joint table.
    if (idx === 0) setTimeout(() => _renderJointTable(row), 0);
  });
  tbl.appendChild(tbody);
  partSlot.appendChild(tbl);
}

function _renderJointTable(row) {
  const slot = $('#regimesJointTableSlot');
  slot.innerHTML = '';
  const r = state.regimes.last_results;
  const wrap = el('div', { class: 'bdmi-detail' });
  wrap.appendChild(el('div', { class: 'bdmi-detail-title',
    html: 'Joint 3×3 table — focal <b>' + r.focal + '</b> × partner <b>' + row.partner.candidate + '</b> '
        + '(' + row.partner.chromosome + ' ' + row.partner.start_mb.toFixed(1)
        + '–' + row.partner.end_mb.toFixed(1) + ' Mb, freq=' + fmt(row.partner.frequency) + ')'
  }));
  const tbl = el('table', { class: 'regimes-joint-table' });
  // Header row.
  const thead = el('thead'); const hr = el('tr');
  hr.appendChild(el('th', { text: r.focal + ' \\ ' + row.partner.candidate }));
  for (let j = 0; j < 3; j++) hr.appendChild(el('th', { text: KT_LABEL[j] }));
  hr.appendChild(el('th', { text: 'row Σ' }));
  thead.appendChild(hr); tbl.appendChild(thead);
  // Body — colour the cells.
  const rowSum = row.tbl.map(rr => rr.reduce((a,b) => a+b, 0));
  const colSum = [0, 0, 0];
  for (const rr of row.tbl) for (let j = 0; j < 3; j++) colSum[j] += rr[j];
  const tbody = el('tbody');
  for (let i = 0; i < 3; i++) {
    const tr = el('tr');
    tr.appendChild(el('th', { text: KT_LABEL[i] }));
    for (let j = 0; j < 3; j++) {
      const obs = row.tbl[i][j];
      const exp = row.n > 0 ? (rowSum[i] * colSum[j]) / row.n : 0;
      let cls = '';
      // Diagonals on a coupled regime are typically over-represented;
      // off-diagonals (recombinant haplotypes) are typically depleted.
      if (i === j && obs > exp * 1.20)      cls = 'cell-coupled';
      else if (i !== j && obs === 0 && exp / row.n >= 0.05) cls = 'cell-missing';
      else if (i !== j && obs > 0 && obs < exp * 0.50)      cls = 'cell-recombinant';
      tr.appendChild(el('td', { class: cls, html: String(obs) + '<br/><span style="color:var(--ink-dimmer);font-size:9px;">(' + exp.toFixed(1) + ')</span>' }));
    }
    tr.appendChild(el('td', { text: String(rowSum[i]),
      style: { color: 'var(--ink-dim)' } }));
    tbody.appendChild(tr);
  }
  // Column-sum footer row.
  const tf = el('tr');
  tf.appendChild(el('th', { text: 'col Σ' }));
  for (let j = 0; j < 3; j++) tf.appendChild(el('td', { text: String(colSum[j]),
    style: { color: 'var(--ink-dim)' } }));
  tf.appendChild(el('td', { text: String(row.n),
    style: { color: 'var(--ink-dim)', fontWeight: 600 } }));
  tbody.appendChild(tf);
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  wrap.appendChild(el('div', { class: 'regimes-joint-caption',
    text: 'Cell value = observed (expected under independence). '
        + 'Green = over-represented diagonal coupling; red = missing recombinant haplotype class; '
        + 'amber = under-represented recombinant class.'
  }));

  // Conditional breakdown.
  wrap.appendChild(_renderConditionalBreakdown(row));

  slot.appendChild(wrap);

  // Verdict block.
  const verdictWrap = $('#regimesVerdictSlot');
  verdictWrap.style.display = '';
  verdictWrap.className = 'ie-conclusion ' + _verdictTier(row.verdict);
  $('#regimesVerdictBody').innerHTML = _verdictExplanation(row, r);
}

function _renderConditionalBreakdown(row) {
  const wrap = el('div', { style: { marginTop: '12px' } });
  wrap.appendChild(el('div', { class: 'bdmi-detail-block-title',
    text: 'Conditional distortion at focal, stratified by partner class' }));
  const tbl = el('table', { class: 'regimes-joint-table' });
  const thead = el('thead'); const hr = el('tr');
  hr.appendChild(el('th', { text: 'Partner stratum' }));
  hr.appendChild(el('th', { text: 'n' }));
  hr.appendChild(el('th', { text: 'focal AA' }));
  hr.appendChild(el('th', { text: 'focal AB' }));
  hr.appendChild(el('th', { text: 'focal BB' }));
  hr.appendChild(el('th', { text: 'HWE χ²' }));
  hr.appendChild(el('th', { text: 'p' }));
  thead.appendChild(hr); tbl.appendChild(thead);
  const tbody = el('tbody');
  row.conditional.sliceStats.forEach((s, ix) => {
    const tr = el('tr');
    tr.appendChild(el('th', { text: 'partner = ' + KT_LABEL[ix] }));
    tr.appendChild(el('td', { text: String(s.n) }));
    tr.appendChild(el('td', { text: String(s.counts[0]) }));
    tr.appendChild(el('td', { text: String(s.counts[1]) }));
    tr.appendChild(el('td', { text: String(s.counts[2]) }));
    tr.appendChild(el('td', { text: Number.isFinite(s.chi2) ? s.chi2.toFixed(2) : '—' }));
    tr.appendChild(el('td', { text: fmt(s.chi2_p) }));
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}

function _verdictTier(verdict) {
  if (verdict === 'regime-coupled')     return 'tier-strong';
  if (verdict === 'regime-explained')   return 'tier-drive';
  if (verdict === 'regime-residual')    return 'tier-conflict';
  if (verdict === 'regime-independent') return 'tier-weak';
  return 'tier-warn-family';
}

function _verdictExplanation(row, r) {
  const focalDistorted = Number.isFinite(r.focal_distortion.chi2_p)
                      && r.focal_distortion.chi2_p < 0.05;
  switch (row.verdict) {
    case 'regime-coupled':
      return `<b>${r.focal}</b> and <b>${row.partner.candidate}</b> form a coupled long-range haplotype regime `
           + `on ${r.chromosome} (Cramér's V = ${row.cramers_v.toFixed(3)}, `
           + `${row.missing_combinations} missing recombinant class${row.missing_combinations === 1 ? '' : 'es'}). `
           + `Treat these two candidates as a single inherited block in downstream BDMI / drive / underdominance calls.`;
    case 'regime-explained':
      return `Apparent distortion at <b>${r.focal}</b> is explained by linkage to <b>${row.partner.candidate}</b>. `
           + `Within-stratum HWE chi² combined p = ${fmt(row.conditional.combined_p)} — distortion is consistent with HWE inside each partner stratum. `
           + `<b>Do not call this independent BDMI / drive / underdominance</b>; report it as long-range haplotype-regime coupling.`;
    case 'regime-residual':
      return `Focal distortion at <b>${r.focal}</b> persists after conditioning on <b>${row.partner.candidate}</b> `
           + `(within-stratum combined p = ${fmt(row.conditional.combined_p)}). `
           + `Independent segregation signal at the focal candidate — `
           + `proceed to the BDMI / drive / underdominance interpretation hierarchy.`;
    case 'regime-independent':
      return `<b>${r.focal}</b> shows no marginal distortion and is not coupled to <b>${row.partner.candidate}</b>. `
           + `These two candidates segregate independently on ${r.chromosome}.`;
    case 'regime-unknown':
    default:
      return `Joint n = ${row.n} below the minimum threshold (${r.min_n}). `
           + `Increase sample size or relax the threshold to test this pair.`;
  }
}

function _sumCell(label, value, severity = null, sub = '') {
  const cell = el('div', { class: 'mend-summary-cell' },
    el('div', { class: 'lbl', text: label }),
    el('div', { class: 'val', text: String(value) }),
    sub ? el('div', { class: 'sub', text: sub }) : null,
  );
  if (severity === 'fail')      cell.style.borderColor = 'rgba(224,85,92,0.55)';
  else if (severity === 'warn') cell.style.borderColor = 'rgba(232,196,76,0.55)';
  else if (severity === 'good') cell.style.borderColor = 'rgba(95,212,154,0.55)';
  return cell;
}

// ─── Section C — Meiotic drive vs underdominance classifier ──────────────
//
// Aggregates DEMO.triads at the focal candidate. For each triad, infer the
// cross-type from the parents' karyotypes, then accumulate observed
// offspring class counts vs the Mendelian prior. Three diagnostic cross
// types matter:
//
//   AA × AB → 1:1 (AA:AB)
//   AB × BB → 1:1 (AB:BB)
//   AB × AB → 1:2:1 (AA:AB:BB)
//
// Decision logic (per the chat, 2026-05-14):
//
//   - Drive  = the AB-parent under-transmits one allele consistently.
//              In AA × AB the AB offspring class is depleted because B
//              (the allele the AB parent failed to transmit) is rare;
//              in AB × BB the AB offspring class is *elevated* because
//              the AB parent transmitted A more often, mixing with the
//              BB parent's B. The signed parent-allele bias (preference
//              for A vs B) is the diagnostic.
//
//   - Underdominance = the AB offspring class is depleted in ALL three
//              crosses (AA×AB AB depleted; AB×BB AB depleted; AB×AB AB
//              massively depleted), regardless of which parent provided
//              which allele.
//
// The classifier reports:
//   parent_allele_bias  ∈ [-1, +1]  (negative → A over-transmitted)
//   het_offspring_deficit            (mean (exp - obs)/exp across crosses)
//   mechanism           ∈ {meiotic_drive_candidate,
//                          underdominance_candidate,
//                          linked_regime_explained,
//                          ambiguous_distortion,
//                          normal_mendelian,
//                          possible_genotyping_or_pedigree_error}
//
// The mechanism defers to "linked_regime_explained" when Section B already
// concluded that the focal is regime-explained against any partner.

const CROSS_KIND = {
  AA_AB: 'AA × AB',
  AB_BB: 'AB × BB',
  AB_AB: 'AB × AB',
  AA_BB: 'AA × BB',
  HOM:   'AA × AA / BB × BB',
  OTHER: 'other / NA',
};

function _classifyCross(p1, p2) {
  const a = ktIndex(p1), b = ktIndex(p2);
  if (a < 0 || b < 0) return 'OTHER';
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo === 0 && hi === 1) return 'AA_AB';
  if (lo === 1 && hi === 2) return 'AB_BB';
  if (lo === 1 && hi === 1) return 'AB_AB';
  if (lo === 0 && hi === 2) return 'AA_BB';
  return 'HOM';
}

function classifyMechanism(focalId, regimesRows) {
  // Aggregate offspring counts per cross-type.
  const buckets = {};
  for (const k of Object.keys(CROSS_KIND)) buckets[k] = { n: 0, obs: [0,0,0], triads: [] };
  for (const t of DEMO.triads || []) {
    const p1 = karyoFor(t.parent_a)[focalId];
    const p2 = karyoFor(t.parent_b)[focalId];
    const o  = karyoFor(t.offspring)[focalId];
    const oi = ktIndex(o);
    if (oi < 0) continue;
    const kind = _classifyCross(p1, p2);
    buckets[kind].n++;
    buckets[kind].obs[oi]++;
    buckets[kind].triads.push({
      triad_id: t.id, parent_a: t.parent_a, parent_b: t.parent_b,
      offspring: t.offspring, p1_kt: p1, p2_kt: p2, o_kt: o,
    });
  }

  // Expected proportions per cross.
  const EXP = {
    AA_AB: [0.50, 0.50, 0.00],
    AB_BB: [0.00, 0.50, 0.50],
    AB_AB: [0.25, 0.50, 0.25],
    AA_BB: [0.00, 1.00, 0.00],
    HOM:   null,    // not informative for transmission
    OTHER: null,
  };

  // Per-bucket distortion + signed allele bias.
  const summary = {};
  let aTransmitted = 0, bTransmitted = 0, nInformativeTrans = 0;
  for (const kind of ['AA_AB','AB_BB','AB_AB','AA_BB']) {
    const b = buckets[kind];
    if (!EXP[kind] || b.n === 0) {
      summary[kind] = { n: b.n, obs: b.obs.slice(), exp: EXP[kind], chi2: NaN, chi2_p: NaN, het_deficit: NaN };
      continue;
    }
    const exp = EXP[kind].map(p => p * b.n);
    let chi2 = 0;
    for (let i = 0; i < 3; i++) {
      if (exp[i] > 0) chi2 += (b.obs[i] - exp[i]) ** 2 / exp[i];
    }
    const df = EXP[kind].filter(p => p > 0).length - 1;
    const chi2_p = df > 0 ? chiSquarePValue(chi2, df) : NaN;
    const het_exp = exp[1];
    const het_def = het_exp > 0 ? (het_exp - b.obs[1]) / het_exp : NaN;
    summary[kind] = { n: b.n, obs: b.obs.slice(), exp, chi2, chi2_p, het_deficit: het_def };

    // Accumulate parent-transmitted allele counts from cross types that
    // have an AB parent. In AA × AB the offspring genotype directly
    // reveals the AB parent's transmitted allele (AA → A, AB → B). In
    // AB × BB symmetric: AB offspring → A, BB offspring → B. AB × AB
    // contributes twice (both parents), distributed by offspring class
    // (AA → 2A, AB → 1A+1B, BB → 2B).
    if (kind === 'AA_AB') {
      aTransmitted += b.obs[0]; bTransmitted += b.obs[1]; nInformativeTrans += b.n;
    } else if (kind === 'AB_BB') {
      aTransmitted += b.obs[1]; bTransmitted += b.obs[2]; nInformativeTrans += b.n;
    } else if (kind === 'AB_AB') {
      aTransmitted += 2 * b.obs[0] + b.obs[1];
      bTransmitted += 2 * b.obs[2] + b.obs[1];
      nInformativeTrans += 2 * b.n;
    }
  }

  const parent_allele_bias = nInformativeTrans > 0
    ? (aTransmitted - bTransmitted) / nInformativeTrans
    : NaN;
  const het_deficits = ['AA_AB','AB_BB','AB_AB']
    .map(k => summary[k].het_deficit).filter(Number.isFinite);
  const mean_het_deficit = het_deficits.length
    ? het_deficits.reduce((a,b) => a + b, 0) / het_deficits.length
    : NaN;

  // Verdict.
  const nUsable = ['AA_AB','AB_BB','AB_AB']
                  .reduce((s, k) => s + buckets[k].n, 0);
  let mechanism;
  let confidence = 'weak';
  if (nUsable < 3) {
    mechanism = 'normal_mendelian';
    confidence = 'insufficient';
  } else {
    // Regime defer — if any partner concluded regime-explained, the focal
    // distortion is already attributed to linkage.
    const regimeExplained = (regimesRows || []).some(r => r.verdict === 'regime-explained');
    if (regimeExplained) {
      mechanism = 'linked_regime_explained';
      confidence = 'moderate';
    } else if (Number.isFinite(mean_het_deficit) && mean_het_deficit >= 0.30
               && summary.AA_AB.het_deficit > 0.20
               && summary.AB_BB.het_deficit > 0.20
               && (summary.AB_AB.het_deficit > 0.20 || Number.isNaN(summary.AB_AB.het_deficit))) {
      mechanism = 'underdominance_candidate';
      confidence = 'strong';
    } else if (Number.isFinite(parent_allele_bias) && Math.abs(parent_allele_bias) >= 0.20) {
      mechanism = 'meiotic_drive_candidate';
      confidence = Math.abs(parent_allele_bias) >= 0.40 ? 'strong' : 'moderate';
    } else if (Number.isFinite(mean_het_deficit) && mean_het_deficit >= 0.15) {
      mechanism = 'ambiguous_distortion';
      confidence = 'weak';
    } else {
      mechanism = 'normal_mendelian';
      confidence = 'good';
    }
  }

  // Detect inconsistent / impossible offspring (0/0 × 0/0 → 1/1 etc.) as
  // a possible pedigree / genotyping error.
  let n_impossible = 0;
  for (const t of DEMO.triads || []) {
    const p1 = karyoFor(t.parent_a)[focalId];
    const p2 = karyoFor(t.parent_b)[focalId];
    const o  = karyoFor(t.offspring)[focalId];
    const prior = expectedOffspringPrior(p1, p2);
    const oi = ktIndex(o);
    if (!prior || oi < 0) continue;
    if (prior[oi] <= 0) n_impossible++;
  }
  if (n_impossible > 0 && n_impossible >= Math.max(2, (DEMO.triads || []).length * 0.2)) {
    mechanism = 'possible_genotyping_or_pedigree_error';
    confidence = 'override';
  }

  return {
    focal: focalId, n_usable: nUsable,
    parent_allele_bias, mean_het_deficit,
    a_transmitted: aTransmitted, b_transmitted: bTransmitted,
    n_informative_transmissions: nInformativeTrans,
    n_impossible,
    buckets, summary,
    mechanism, confidence,
  };
}

const MECH_LABEL = {
  'normal_mendelian':                        'NORMAL MENDELIAN',
  'linked_regime_explained':                 'LINKED REGIME EXPLAINS IT',
  'meiotic_drive_candidate':                 'MEIOTIC DRIVE CANDIDATE',
  'underdominance_candidate':                'UNDERDOMINANCE CANDIDATE',
  'ambiguous_distortion':                    'AMBIGUOUS DISTORTION',
  'possible_genotyping_or_pedigree_error':   'GENOTYPING / PEDIGREE ERROR?',
};

function _mechTier(mech) {
  if (mech === 'meiotic_drive_candidate')                 return 'tier-drive';
  if (mech === 'underdominance_candidate')                return 'tier-conflict';
  if (mech === 'linked_regime_explained')                 return 'tier-moderate';
  if (mech === 'ambiguous_distortion')                    return 'tier-warn-family';
  if (mech === 'possible_genotyping_or_pedigree_error')   return 'tier-warn-family';
  return 'tier-weak';
}

function renderMechanismClassifier() {
  const sumSlot = $('#regimesMechSummarySlot');
  const tabSlot = $('#regimesMechTableSlot');
  const verSlot = $('#regimesMechVerdictSlot');
  const verBody = $('#regimesMechVerdictBody');
  sumSlot.innerHTML = ''; tabSlot.innerHTML = '';
  verSlot.style.display = 'none';
  const m = state.regimes.last_mechanism;
  if (!m) return;

  // Summary cells.
  sumSlot.appendChild(_sumCell('triads usable',        m.n_usable));
  sumSlot.appendChild(_sumCell('parent allele bias',
    Number.isFinite(m.parent_allele_bias) ? m.parent_allele_bias.toFixed(3) : '—',
    Math.abs(m.parent_allele_bias) >= 0.20 ? 'warn' : null,
    `A=${m.a_transmitted} · B=${m.b_transmitted} (n=${m.n_informative_transmissions})`));
  sumSlot.appendChild(_sumCell('mean het deficit',
    Number.isFinite(m.mean_het_deficit) ? (m.mean_het_deficit * 100).toFixed(1) + '%' : '—',
    m.mean_het_deficit >= 0.30 ? 'fail' : (m.mean_het_deficit >= 0.15 ? 'warn' : null)));
  sumSlot.appendChild(_sumCell('impossible offspring',
    String(m.n_impossible),
    m.n_impossible > 0 ? 'fail' : null));

  // Per-cross-type table.
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Cross type','n','Observed (AA/AB/BB)','Expected (AA/AB/BB)','χ²','p','Het deficit']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  for (const kind of ['AA_AB','AB_BB','AB_AB','AA_BB']) {
    const s = m.summary[kind];
    const t = el('tr');
    t.appendChild(el('td', { class: 'sample-id', text: CROSS_KIND[kind] }));
    t.appendChild(el('td', { class: 'num', text: String(s.n) }));
    t.appendChild(el('td', { class: 'num', text: s.obs.join(' / ') }));
    t.appendChild(el('td', { class: 'num',
      text: s.exp ? s.exp.map(x => x.toFixed(1)).join(' / ') : '—' }));
    t.appendChild(el('td', { class: 'num', text: Number.isFinite(s.chi2) ? s.chi2.toFixed(2) : '—' }));
    const pTd = el('td', { class: 'num', text: fmt(s.chi2_p) });
    if (Number.isFinite(s.chi2_p) && s.chi2_p < 0.05) pTd.style.color = 'var(--bad)';
    t.appendChild(pTd);
    t.appendChild(el('td', { class: 'num',
      text: Number.isFinite(s.het_deficit) ? (s.het_deficit * 100).toFixed(1) + '%' : '—',
      style: { color: Number.isFinite(s.het_deficit) && s.het_deficit >= 0.30 ? 'var(--bad)'
              : (Number.isFinite(s.het_deficit) && s.het_deficit >= 0.15 ? 'var(--warn)' : '') } }));
    tbody.appendChild(t);
  }
  tbl.appendChild(tbody);
  tabSlot.appendChild(tbl);

  // Verdict.
  verSlot.style.display = '';
  verSlot.className = 'ie-conclusion ' + _mechTier(m.mechanism);
  verBody.innerHTML = _mechExplanation(m);
}

function _mechExplanation(m) {
  const bias = Number.isFinite(m.parent_allele_bias)
    ? m.parent_allele_bias.toFixed(3) : '—';
  const def = Number.isFinite(m.mean_het_deficit)
    ? (m.mean_het_deficit * 100).toFixed(1) + '%' : '—';
  const banner = `<b>${MECH_LABEL[m.mechanism]}</b> &nbsp;·&nbsp; confidence: ${m.confidence}`;
  switch (m.mechanism) {
    case 'normal_mendelian':
      return banner + '<br/>'
           + `Across ${m.n_usable} usable triads at <b>${m.focal}</b>, parent allele bias = ${bias}, `
           + `mean het deficit = ${def}. Cross-type counts are consistent with normal Mendelian segregation.`;
    case 'linked_regime_explained':
      return banner + '<br/>'
           + `Section B already concluded the focal distortion is explained by linkage to another inversion on the same chromosome. `
           + `Do not call drive or underdominance on <b>${m.focal}</b> alone — treat the linked pair as a single inherited block.`;
    case 'meiotic_drive_candidate':
      return banner + '<br/>'
           + `The AB parent over-transmits one allele (parent allele bias = ${bias}; `
           + `A=${m.a_transmitted} vs B=${m.b_transmitted} across ${m.n_informative_transmissions} transmissions). `
           + `Distortion follows the parent-transmitted allele, not the offspring class — meiotic drive is the leading mechanism for <b>${m.focal}</b>.`;
    case 'underdominance_candidate':
      return banner + '<br/>'
           + `The AB offspring class is depleted across all informative crosses `
           + `(mean het deficit = ${def}). The signal follows the offspring genotype, not the parent-transmitted allele, `
           + `which is the signature of underdominance / heterokaryotype disadvantage for <b>${m.focal}</b>.`;
    case 'ambiguous_distortion':
      return banner + '<br/>'
           + `A moderate het deficit (${def}) is present but cross-type evidence does not cleanly separate drive `
           + `from underdominance (parent bias = ${bias}). Recommend conditioning on more triads or controlled crosses.`;
    case 'possible_genotyping_or_pedigree_error':
      return banner + '<br/>'
           + `${m.n_impossible} triad(s) at <b>${m.focal}</b> have offspring genotypes that are Mendelianly impossible `
           + `(e.g. 0/0 × 0/0 → 1/1). Resolve genotyping / pedigree first before interpreting any drive / underdominance / BDMI signal.`;
    default:
      return banner;
  }
}

// ─── Export — the linked_inversion_regimes.tsv contract ──────────────────

function exportRegimesTsv() {
  const r = state.regimes.last_results;
  if (!r) { alert('Run the regime test first.'); return; }
  const cols = [
    'chromosome','focal_candidate_id','linked_candidate_id','n_samples',
    'cramers_v','mutual_information','missing_combination_count',
    'conditional_distortion_before','conditional_distortion_after',
    'interpretation',
  ];
  const lines = [
    '# Linked inversion regimes',
    '# Date: ' + new Date().toISOString(),
    '# Focal: ' + r.focal + '  Chromosome: ' + r.chromosome,
    '# Min joint n: ' + r.min_n + '  Couple threshold: V >= ' + r.couple_threshold,
    '# Focal marginal HWE chi-square p: ' + fmt(r.focal_distortion.chi2_p),
    '#',
    cols.join('\t'),
  ];
  for (const row of r.rows) {
    lines.push([
      r.chromosome, r.focal, row.partner.candidate, row.n,
      row.cramers_v.toFixed(4),
      row.mutual_information.toFixed(4),
      row.missing_combinations,
      Number.isFinite(r.focal_distortion.chi2_p) ? fmt(r.focal_distortion.chi2_p) : '',
      fmt(row.conditional.combined_p),
      row.verdict,
    ].join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'linked_inversion_regimes_' + r.chromosome + '_' + r.focal + '_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportMechanismTsv() {
  const r = state.regimes.last_results;
  const m = state.regimes.last_mechanism;
  if (!m || !r) { alert('Run the regime test first.'); return; }
  const lines = [
    '# Segregation mechanism classifier',
    '# Date: ' + new Date().toISOString(),
    '# Focal: ' + m.focal + '  Chromosome: ' + r.chromosome,
    '# Mechanism: ' + m.mechanism + '  Confidence: ' + m.confidence,
    '# Parent allele bias: ' + (Number.isFinite(m.parent_allele_bias) ? m.parent_allele_bias.toFixed(4) : ''),
    '# Mean het deficit: ' + (Number.isFinite(m.mean_het_deficit) ? m.mean_het_deficit.toFixed(4) : ''),
    '# Impossible offspring: ' + m.n_impossible,
    '#',
  ];
  // Per-triad rows (the segregation_mechanism_classifier.tsv contract).
  const cols = ['candidate_id','chromosome','family_id','cross_type',
                'parent_a','parent_b','offspring',
                'p1_kt','p2_kt','o_kt',
                'expected_counts_aa_ab_bb','observed_offspring_class',
                'distortion_detected','linked_regime_explains_signal',
                'allele_transmission_bias','heterozygote_deficit',
                'most_likely_mechanism','confidence','interpretation'];
  lines.push(cols.join('\t'));
  const regimeExplained = (r.rows || []).some(rr => rr.verdict === 'regime-explained');
  const distortionDetected = Number.isFinite(r.focal_distortion.chi2_p)
                          && r.focal_distortion.chi2_p < 0.05;
  // For each cross-type bucket, emit one row per recorded triad.
  for (const kind of ['AA_AB','AB_BB','AB_AB','AA_BB','HOM','OTHER']) {
    const bucket = m.buckets[kind];
    const summary = m.summary[kind] || {};
    for (const tr of bucket.triads) {
      // Family id (first family that contains both parents and offspring).
      const fam = DEMO.families.find(f =>
        f.members.includes(tr.parent_a) && f.members.includes(tr.parent_b)
                                        && f.members.includes(tr.offspring));
      lines.push([
        m.focal, r.chromosome, fam ? fam.family_id : '',
        CROSS_KIND[kind], tr.parent_a, tr.parent_b, tr.offspring,
        tr.p1_kt, tr.p2_kt, tr.o_kt,
        summary.exp ? summary.exp.map(x => x.toFixed(2)).join('/') : '',
        ['AA','AB','BB'][ktIndex(tr.o_kt)] || tr.o_kt,
        distortionDetected ? 'yes' : 'no',
        regimeExplained ? 'yes' : 'no',
        Number.isFinite(m.parent_allele_bias) ? m.parent_allele_bias.toFixed(4) : '',
        Number.isFinite(summary.het_deficit) ? summary.het_deficit.toFixed(4) : '',
        m.mechanism, m.confidence,
        MECH_LABEL[m.mechanism] || '',
      ].join('\t'));
    }
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'segregation_mechanism_classifier_'
                            + m.focal + '_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ─── Wiring ────────────────────────────────────────────────────────────

function wireRegimes() {
  $('#regimesChrom').addEventListener('change', e => {
    state.regimes.chromosome = e.target.value;
    state.regimes.focal = null;
    _populateFocal(e.target.value);
  });
  $('#regimesFocal').addEventListener('change', e => {
    state.regimes.focal = e.target.value;
  });
  $('#regimesMinN').addEventListener('change',  e => state.regimes.min_n = e.target.value);
  $('#regimesCoupleThr').addEventListener('change', e => state.regimes.couple_threshold = e.target.value);
  $('#regimesRunBtn').addEventListener('click', runRegimeTest);
  $('#regimesResetBtn').addEventListener('click', () => {
    state.regimes.last_results = null;
    state.regimes.last_mechanism = null;
    $('#regimesSummary').innerHTML = '';
    $('#regimesFocalDistortionSlot').innerHTML = '';
    $('#regimesPartnerTableSlot').innerHTML = '';
    $('#regimesJointTableSlot').innerHTML = '';
    $('#regimesVerdictSlot').style.display = 'none';
    $('#regimesMechSummarySlot').innerHTML = '';
    $('#regimesMechTableSlot').innerHTML = '';
    $('#regimesMechVerdictSlot').style.display = 'none';
  });
  $('#regimesExportBtn').addEventListener('click', exportRegimesTsv);
  $('#regimesExportMechBtn').addEventListener('click', exportMechanismTsv);
}

function _restoreFromState() {
  if (state.regimes.min_n)            $('#regimesMinN').value           = String(state.regimes.min_n);
  if (state.regimes.couple_threshold) $('#regimesCoupleThr').value      = String(state.regimes.couple_threshold);
}

// ─── Lifecycle ────────────────────────────────────────────────────────

let _unsubChr = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  loadLiveKaryotypes(registry).catch((e) =>
    console.warn('regimes.mount: karyotype load threw —', e));
  renderKaryotypeBadgeSlots();
  populatePickers();
  _restoreFromState();
  wireRegimes();
  if (state.regimes.last_results) renderRegimeResults();
  if (state.regimes.last_mechanism) renderMechanismClassifier();
  _unsubChr = on('chromosome_changed', () => {
    // If the cross-tab chromosome filter changes to a chromosome with >= 2
    // candidates, follow it.
    const c = state.selected_chromosome;
    if (!c) return;
    const allChroms = listChromosomesWithMultipleInversions();
    if (allChroms.includes(c) && c !== state.regimes.chromosome) {
      state.regimes.chromosome = c;
      $('#regimesChrom').value = c;
      _populateFocal(c);
    }
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubChr) _unsubChr();
  _unsubChr = null;
}
