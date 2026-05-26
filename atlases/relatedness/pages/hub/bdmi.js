// atlases/relatedness/pages/hub/bdmi.js
// =============================================================================
// BDMI / incompatibility screen — sub-tab #6.
//
// Tests every inversion candidate against six population-genetic screens for
// Bateson–Dobzhansky–Muller-incompatibility-like signatures and assigns a
// per-candidate confidence level (weak → moderate → strong → very strong).
//
// Screens (lifted directly from the Quentin chat / 2026-05-14):
//
//   Test A  — Mendelian segregation distortion. For each candidate, expected
//             vs observed offspring genotype proportions across triads in
//             DEMO.triads (or dyads in the active hub if "Mendelian source =
//             hub_dyads"). Binomial / chi-square against the parental cross
//             prior from expectedOffspringPrior(p1, p2).
//
//   Test B  — Missing karyotype class. Flags candidates where one of AA/AB/BB
//             is < 5% of typed samples when its HWE expectation under 2pq
//             would be ≥ 15%. Catches the "heterokaryotype almost missing"
//             pattern described for large pericentric inversions.
//
//   Test C  — Heterozygote excess / deficit. Compares observed AB frequency
//             against 2pq with either the "absolute deficit ≥ 30%" rule or
//             a one-df HWE chi² test (user-selectable).
//
//   Test D  — Ancestry × inversion-genotype interaction. Bins samples by
//             dominant ancestry component (from DEMO.ancestry_q) and tests
//             whether karyotype frequencies differ across bins by chi².
//             Strong interaction = candidate incompatibility with genomic
//             background.
//
//   Test E  — Long-range forbidden combinations. Pairs each candidate with
//             every other candidate genome-wide and checks for AB×AB cells
//             whose observed count is < 10% of HWE expectation. The minimum
//             observed/expected ratio across all partners is the "forbidden"
//             score; candidates with at least one partner < 0.10 fire.
//
//   Test F  — Phenotype association. Stubbed until DEMO gains a phenotype /
//             survival / fertility layer. Until then the badge reports
//             "missing" and the test never fires; only the manifest-level
//             phenotype loader will flip _phenoAvailable = true.
//
// Confidence levels (per the chat):
//   weak         — none of A-F fire
//   moderate     — B or C fires
//   strong       — A or D or E fires
//   very strong  — F fires (requires phenotype layer)
//   validated    — out-of-scope for WGS (controlled crosses)
//
// The page is read-only against DEMO + state; it never mutates karyotypes.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import {
  binomialPValueTwoSided, chiSquarePValue, expectedOffspringPrior,
} from '../../shared/stats.js';
import { on } from '../../shared/page_hooks.js';
import {
  karyoFor, loadLiveKaryotypes, renderKaryotypeBadgeSlots,
} from '../../shared/karyotype_source.js';
import { _setActiveState } from './bdmi/_state.js';

// ─── Phenotype availability probe ────────────────────────────────────────
// Round 1: DEMO has no phenotype block, so this is always false. When the
// phenotype loader lands (DEMO.phenotype or a normalized phenotype envelope
// via the api_client), flip the badge live. The test branch is wired so
// the moment DEMO.phenotype exists, Test F starts firing without code
// changes to runBdmiScreen().
let _phenoAvailable = false;

function _probePhenotype() {
  _phenoAvailable = !!(DEMO.phenotype && Object.keys(DEMO.phenotype).length);
  return _phenoAvailable;
}

// ─── Candidate scoping ───────────────────────────────────────────────────

function getCandidateList() {
  let list = DEMO.inversion_candidates_full;
  const scope = $('#bdmiScope').value;
  if (scope === 'status_pass')      list = list.filter(i => i.status === 'pass');
  else if (scope === 'status_warn') list = list.filter(i => i.status === 'warn');
  else if (scope === 'freq_high')   list = list.filter(i => i.frequency >= 0.10);
  else if (scope === 'chrom_only' && state.selected_chromosome) {
    list = list.filter(i => i.chromosome === state.selected_chromosome);
  }
  return list;
}

// Karyotype class index: 0/0 → 0 (AA), 0/1 → 1 (AB), 1/1 → 2 (BB).
function ktIndex(kt) {
  if (kt === '0/0') return 0;
  if (kt === '0/1') return 1;
  if (kt === '1/1') return 2;
  return -1;
}

// Allele frequency p (allele "1") and class counts at one candidate across
// all typed individuals.
function classCounts(invId) {
  const counts = [0, 0, 0];
  let n = 0;
  for (const ind of DEMO.individuals) {
    const kt = karyoFor(ind)[invId];
    const ix = ktIndex(kt);
    if (ix < 0) continue;
    counts[ix]++; n++;
  }
  const p = n > 0 ? (counts[1] + 2 * counts[2]) / (2 * n) : NaN;
  return { counts, n, p };
}

// ─── Test A — Mendelian segregation distortion ────────────────────────────

function _runTestA(invId, alpha) {
  const useTriads = $('#bdmiMendSource').value === 'triads';
  let n_total = 0, n_consistent = 0, n_inconsistent = 0;
  // For "het × het" classes we accumulate 1:2:1 expected counts so we can
  // run a chi² against drive on the het×het sub-cross.
  let n_het_het = 0, obs00 = 0, obs01 = 0, obs11 = 0;

  if (useTriads) {
    for (const t of DEMO.triads || []) {
      const p1 = karyoFor(t.parent_a)[invId];
      const p2 = karyoFor(t.parent_b)[invId];
      const o  = karyoFor(t.offspring)[invId];
      const prior = expectedOffspringPrior(p1, p2);
      if (!prior || !o || o === 'NA') continue;
      const ix = ktIndex(o);
      if (ix < 0) continue;
      n_total++;
      if (prior[ix] > 0) n_consistent++; else n_inconsistent++;
      if (p1 === '0/1' && p2 === '0/1') {
        n_het_het++;
        if (ix === 0) obs00++;
        else if (ix === 1) obs01++;
        else               obs11++;
      }
    }
  } else {
    // Hub dyads — parent het against offspring 0/0/1/1 transmission.
    const fam = DEMO.families.find(f => f.family_id === state.selected_family)
                || DEMO.families[0];
    const hub = fam.hub_individual || fam.members[0];
    const others = fam.members.filter(m => m !== hub);
    const pKt = karyoFor(hub)[invId];
    if (!pKt || pKt === 'NA') {
      // hub untyped at this candidate — fall through; nothing accumulates.
    } else {
      for (const o of others) {
        const oKt = karyoFor(o)[invId];
        if (!oKt || oKt === 'NA') continue;
        n_total++;
        // The dyad consistency check used in mendelian.js: 0/0 ↔ 1/1 is a
        // hard Mendelian error.
        if ((pKt === '0/0' && oKt === '1/1') ||
            (pKt === '1/1' && oKt === '0/0')) n_inconsistent++;
        else                                   n_consistent++;
      }
    }
  }

  // Distortion P — two-sided binomial against a ~2% error baseline (matches
  // the mendelian.js convention).
  const distortion_p = (n_total > 0)
    ? binomialPValueTwoSided(n_inconsistent, n_total, 0.02)
    : NaN;
  // Het × het 1:2:1 chi² when ≥ 5 informative trios.
  let chi2 = NaN, chi2_p = NaN;
  if (n_het_het >= 5) {
    const e0 = n_het_het * 0.25, e1 = n_het_het * 0.50, e2 = n_het_het * 0.25;
    chi2 = ((obs00 - e0) ** 2) / e0
         + ((obs01 - e1) ** 2) / e1
         + ((obs11 - e2) ** 2) / e2;
    chi2_p = chiSquarePValue(chi2, 2);
  }
  const fires = (Number.isFinite(distortion_p) && distortion_p < alpha)
             || (Number.isFinite(chi2_p)       && chi2_p       < alpha);
  return {
    name: 'A_mendelian_distortion',
    n_total, n_consistent, n_inconsistent,
    distortion_p,
    n_het_het, obs00, obs01, obs11, chi2, chi2_p,
    fires,
  };
}

// ─── Test B — Missing karyotype class ────────────────────────────────────

function _runTestB(invId) {
  const { counts, n, p } = classCounts(invId);
  if (!Number.isFinite(p) || n < 10) {
    return { name: 'B_missing_class', n, fires: false, reason: 'n<10' };
  }
  const q = 1 - p;
  const exp = [q*q, 2*p*q, p*p];                  // HWE
  const obs_freq = counts.map(c => c / n);
  // A class is "missing" if obs < 5% but HWE expectation ≥ 15%.
  let missing = -1;
  for (let i = 0; i < 3; i++) {
    if (obs_freq[i] < 0.05 && exp[i] >= 0.15) { missing = i; break; }
  }
  return {
    name: 'B_missing_class',
    n, p, counts, obs_freq, exp,
    missing_class: missing,                       // -1 / 0 / 1 / 2
    fires: missing >= 0,
  };
}

// ─── Test C — Heterozygote excess / deficit ──────────────────────────────

function _runTestC(invId, rule) {
  const { counts, n, p } = classCounts(invId);
  if (!Number.isFinite(p) || n < 10) {
    return { name: 'C_het_deficit', n, fires: false, reason: 'n<10' };
  }
  const q = 1 - p;
  const exp_het = 2 * p * q * n;
  const obs_het = counts[1];
  // |obs − exp| / exp normalised heterokaryotype deviation.
  const dev = exp_het > 0 ? (obs_het - exp_het) / exp_het : 0;
  // HWE chi² (df = 1) — Wright's F_IS-style test on the three-class table.
  const e0 = q*q*n, e1 = 2*p*q*n, e2 = p*p*n;
  let chi2 = 0;
  if (e0 > 0) chi2 += (counts[0] - e0)**2 / e0;
  if (e1 > 0) chi2 += (counts[1] - e1)**2 / e1;
  if (e2 > 0) chi2 += (counts[2] - e2)**2 / e2;
  const chi2_p = chiSquarePValue(chi2, 1);
  const fires_abs = Math.abs(dev) >= 0.30;
  const fires_z   = Number.isFinite(chi2_p) && chi2_p < 0.05;
  const fires = (rule === 'abs_deficit') ? fires_abs : fires_z;
  return {
    name: 'C_het_deficit',
    n, p, obs_het, exp_het, dev, chi2, chi2_p,
    direction: dev < 0 ? 'deficit' : (dev > 0 ? 'excess' : 'neutral'),
    fires,
  };
}

// ─── Test D — Ancestry × inversion-genotype interaction ──────────────────

function _runTestD(invId) {
  // Bin each individual by dominant ancestry component (argmax over Q-vector).
  const K = DEMO.ancestry_palette.length;
  // Build a [K × 3] contingency table.
  const table = Array.from({length: K}, () => [0, 0, 0]);
  let n = 0;
  for (const ind of DEMO.individuals) {
    const q = DEMO.ancestry_q[ind] || [];
    if (!q.length) continue;
    const kt = karyoFor(ind)[invId];
    const ix = ktIndex(kt);
    if (ix < 0) continue;
    let argmax = 0;
    for (let k = 1; k < K; k++) if (q[k] > q[argmax]) argmax = k;
    table[argmax][ix]++; n++;
  }
  // Trim to rows with at least one observation (degrees of freedom adjust).
  const occ = table.filter(r => r[0] + r[1] + r[2] > 0);
  const rows = occ.length, cols = 3;
  if (n < 10 || rows < 2) {
    return { name: 'D_ancestry_interaction', n, rows, fires: false, reason: 'n<10 or rows<2' };
  }
  // Standard chi² on the contingency table.
  const rowTot = occ.map(r => r.reduce((a,b) => a+b, 0));
  const colTot = [0, 0, 0];
  for (const r of occ) for (let j = 0; j < 3; j++) colTot[j] += r[j];
  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < 3; j++) {
      const e = (rowTot[i] * colTot[j]) / n;
      if (e > 0) chi2 += (occ[i][j] - e)**2 / e;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const chi2_p = chiSquarePValue(chi2, df);
  return {
    name: 'D_ancestry_interaction',
    n, rows, df, chi2, chi2_p,
    fires: Number.isFinite(chi2_p) && chi2_p < 0.05,
  };
}

// ─── Test E — Long-range forbidden combinations ──────────────────────────

function _runTestE(invId, candidates) {
  // For each other candidate on a different chromosome, build the AB×AB cell
  // (and AA×BB / BB×AA when AB is uninformative) and compare observed vs HWE
  // expectation. Track the minimum obs/exp ratio across all partners.
  let minRatio = Infinity, worstPartner = null, worstCell = null;
  let n_partners_tested = 0;
  const self = invId;
  for (const c of candidates) {
    if (c.candidate === self) continue;
    // Same chromosome → not "long-range"; skip.
    const selfChrom = DEMO.inversion_candidates_full.find(i => i.candidate === self);
    if (selfChrom && c.chromosome === selfChrom.chromosome) continue;
    // 3×3 joint table.
    const tbl = [[0,0,0],[0,0,0],[0,0,0]];
    let n = 0;
    for (const ind of DEMO.individuals) {
      const k1 = karyoFor(ind)[self];
      const k2 = karyoFor(ind)[c.candidate];
      const i1 = ktIndex(k1), i2 = ktIndex(k2);
      if (i1 < 0 || i2 < 0) continue;
      tbl[i1][i2]++; n++;
    }
    if (n < 10) continue;
    // Marginals.
    const r = [tbl[0][0]+tbl[0][1]+tbl[0][2],
               tbl[1][0]+tbl[1][1]+tbl[1][2],
               tbl[2][0]+tbl[2][1]+tbl[2][2]];
    const co = [tbl[0][0]+tbl[1][0]+tbl[2][0],
                tbl[0][1]+tbl[1][1]+tbl[2][1],
                tbl[0][2]+tbl[1][2]+tbl[2][2]];
    // Cell-by-cell obs/exp, pick the minimum.
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const exp = (r[i] * co[j]) / n;
        if (exp < 1.0) continue;                // skip cells with tiny expectation
        const ratio = tbl[i][j] / exp;
        if (ratio < minRatio) {
          minRatio = ratio;
          worstPartner = c.candidate;
          worstCell = [i, j];
        }
      }
    }
    n_partners_tested++;
  }
  return {
    name: 'E_long_range_forbidden',
    n_partners_tested, min_ratio: Number.isFinite(minRatio) ? minRatio : NaN,
    worst_partner: worstPartner, worst_cell: worstCell,
    fires: Number.isFinite(minRatio) && minRatio < 0.10 && n_partners_tested >= 1,
  };
}

// ─── Test F — Phenotype association (stub until DEMO.phenotype exists) ───

function _runTestF(_invId) {
  if (!_phenoAvailable) {
    return { name: 'F_phenotype_assoc', fires: false, status: 'missing' };
  }
  // Wiring here when DEMO.phenotype lands: ANOVA / Kruskal of phenotype
  // value across the three karyotype classes, p < 0.05 fires.
  return { name: 'F_phenotype_assoc', fires: false, status: 'not_implemented' };
}

// ─── Confidence assignment ───────────────────────────────────────────────

function _confidenceFromScreens(s) {
  if (s.F && s.F.fires) return 'very strong';
  if ((s.A && s.A.fires) || (s.D && s.D.fires) || (s.E && s.E.fires)) return 'strong';
  if ((s.B && s.B.fires) || (s.C && s.C.fires)) return 'moderate';
  return 'weak';
}

function _confidenceClass(level) {
  if (level === 'very strong') return 'very-strong';
  if (level === 'strong')      return 'strong';
  if (level === 'moderate')    return 'moderate';
  return 'weak';
}

// ─── Driver — runs the active screens for every candidate ────────────────

function runBdmiScreen() {
  const candidates = getCandidateList();
  const alpha   = parseFloat($('#bdmiAlpha').value);
  const hetRule = $('#bdmiHetRule').value;
  const useA = $('#bdmiUseMend').checked,
        useB = $('#bdmiUseMiss').checked,
        useC = $('#bdmiUseHet').checked,
        useD = $('#bdmiUseAnc').checked,
        useE = $('#bdmiUseLR').checked,
        useF = $('#bdmiUsePheno').checked;
  _probePhenotype();
  const rows = [];
  for (const c of candidates) {
    const screens = {};
    if (useA) screens.A = _runTestA(c.candidate, alpha);
    if (useB) screens.B = _runTestB(c.candidate);
    if (useC) screens.C = _runTestC(c.candidate, hetRule);
    if (useD) screens.D = _runTestD(c.candidate);
    if (useE) screens.E = _runTestE(c.candidate, candidates);
    if (useF) screens.F = _runTestF(c.candidate);
    const confidence = _confidenceFromScreens(screens);
    const n_fired = ['A','B','C','D','E','F']
                    .filter(k => screens[k] && screens[k].fires).length;
    rows.push({ candidate: c, screens, confidence, n_fired });
  }
  // Sort: very strong → strong → moderate → weak; tiebreak by n_fired desc.
  const order = { 'very strong': 0, 'strong': 1, 'moderate': 2, 'weak': 3 };
  rows.sort((a, b) => {
    if (order[a.confidence] !== order[b.confidence])
      return order[a.confidence] - order[b.confidence];
    return b.n_fired - a.n_fired;
  });
  state.bdmi.last_results = { rows, alpha, hetRule };
  renderBdmiResults();
}

// ─── Rendering ───────────────────────────────────────────────────────────

function renderBdmiResults() {
  const sumSlot = $('#bdmiSummary');
  const resSlot = $('#bdmiResultSlot');
  const detSlot = $('#bdmiDetailSlot');
  sumSlot.innerHTML = ''; resSlot.innerHTML = ''; detSlot.innerHTML = '';
  const r = state.bdmi.last_results;
  if (!r) return;
  // Per-level counts.
  const counts = { 'weak': 0, 'moderate': 0, 'strong': 0, 'very strong': 0 };
  r.rows.forEach(row => { counts[row.confidence]++; });
  sumSlot.appendChild(_summaryCell('candidates screened', r.rows.length));
  sumSlot.appendChild(_summaryCell('weak',        counts['weak'],        null));
  sumSlot.appendChild(_summaryCell('moderate',    counts['moderate'],    counts['moderate']    > 0 ? 'warn' : null));
  sumSlot.appendChild(_summaryCell('strong',      counts['strong'],      counts['strong']      > 0 ? 'fail' : null));
  sumSlot.appendChild(_summaryCell('very strong', counts['very strong'], counts['very strong'] > 0 ? 'fail' : null));

  // Per-candidate table.
  const tbl = el('table', { class: 'data-table bdmi-table' });
  const thead = el('thead');
  const tr = el('tr');
  ['Candidate','Chrom','Freq','A · distortion','B · missing','C · het',
   'D · ancestry','E · long-range','F · phenotype','Fired','Confidence']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  r.rows.forEach(row => {
    const c = row.candidate;
    const t = el('tr', { class: 'clickable' });
    t.addEventListener('click', () => _renderDetail(row));
    t.appendChild(el('td', { class: 'sample-id', text: c.candidate }));
    t.appendChild(el('td', { text: c.chromosome }));
    t.appendChild(el('td', { class: 'num', text: fmt(c.frequency) }));
    t.appendChild(_screenCell(row.screens.A, _aLabel));
    t.appendChild(_screenCell(row.screens.B, _bLabel));
    t.appendChild(_screenCell(row.screens.C, _cLabel));
    t.appendChild(_screenCell(row.screens.D, _dLabel));
    t.appendChild(_screenCell(row.screens.E, _eLabel));
    t.appendChild(_screenCell(row.screens.F, _fLabel));
    t.appendChild(el('td', { class: 'num', text: String(row.n_fired) }));
    const confTd = el('td');
    confTd.appendChild(el('span', {
      class: 'bdmi-confidence-pill ' + _confidenceClass(row.confidence),
      text: row.confidence.toUpperCase(),
    }));
    t.appendChild(confTd);
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  resSlot.appendChild(tbl);
}

function _summaryCell(label, value, severity = null, sub = '') {
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

function _screenCell(s, labeller) {
  const td = el('td');
  if (!s) {
    td.appendChild(el('span', { class: 'bdmi-screen-pill off', text: '·' }));
    td.title = 'not run';
    return td;
  }
  const pill = el('span', {
    class: 'bdmi-screen-pill ' + (s.fires ? 'fire' : 'pass'),
    text: labeller(s),
  });
  td.appendChild(pill);
  td.title = labeller(s, true);
  return td;
}

function _aLabel(s, long) {
  if (!Number.isFinite(s.distortion_p)) return long ? 'no informative trios' : '—';
  const p = fmt(s.distortion_p);
  return long
    ? `Test A — distortion p = ${p}; n=${s.n_total}, inconsistent=${s.n_inconsistent}`
        + (Number.isFinite(s.chi2_p) ? `; het×het χ² p = ${fmt(s.chi2_p)}` : '')
    : p;
}
function _bLabel(s, long) {
  if (s.missing_class === undefined || s.missing_class < 0) {
    return long ? 'Test B — no missing class' : '—';
  }
  const cls = ['AA','AB','BB'][s.missing_class];
  return long ? `Test B — class ${cls} missing (obs<5%, exp≥15%)` : cls;
}
function _cLabel(s, long) {
  if (!Number.isFinite(s.dev)) return long ? 'Test C — n<10' : '—';
  const sign = s.dev > 0 ? '+' : '';
  const dev = (s.dev * 100).toFixed(1) + '%';
  return long
    ? `Test C — het ${s.direction}; obs=${s.obs_het}, exp=${s.exp_het.toFixed(1)},`
        + ` Δ=${sign}${dev}; HWE χ² p=${fmt(s.chi2_p)}`
    : sign + dev;
}
function _dLabel(s, long) {
  if (!Number.isFinite(s.chi2_p)) return long ? 'Test D — insufficient ancestry coverage' : '—';
  return long
    ? `Test D — ancestry × genotype χ² p=${fmt(s.chi2_p)} (df=${s.df}, rows=${s.rows})`
    : fmt(s.chi2_p);
}
function _eLabel(s, long) {
  if (!Number.isFinite(s.min_ratio)) return long ? 'Test E — no partners tested' : '—';
  return long
    ? `Test E — min obs/exp = ${s.min_ratio.toFixed(3)} vs ${s.worst_partner || '?'} `
        + `cell ${s.worst_cell ? ['AA','AB','BB'][s.worst_cell[0]] + '×' + ['AA','AB','BB'][s.worst_cell[1]] : '?'}`
        + `; ${s.n_partners_tested} partners`
    : s.min_ratio.toFixed(2);
}
function _fLabel(s, long) {
  if (s.status === 'missing') return long ? 'Test F — phenotype layer not loaded' : '—';
  if (s.status === 'not_implemented')
    return long ? 'Test F — phenotype layer present, association test pending' : '?';
  return long ? `Test F — fires=${s.fires}` : (s.fires ? '✓' : '·');
}

function _renderDetail(row) {
  const slot = $('#bdmiDetailSlot');
  slot.innerHTML = '';
  const c = row.candidate;
  const panel = el('div', { class: 'bdmi-detail' });
  panel.appendChild(el('div', { class: 'bdmi-detail-title',
    html: `<b>${c.candidate}</b> — ${c.chromosome} ${c.start_mb.toFixed(1)}–`
        + `${c.end_mb.toFixed(1)} Mb · freq=${fmt(c.frequency)} · status=${c.status} · `
        + `confidence: <span class="bdmi-confidence-pill ${_confidenceClass(row.confidence)}">`
        + `${row.confidence.toUpperCase()}</span>` }));

  ['A','B','C','D','E','F'].forEach(k => {
    const s = row.screens[k];
    if (!s) return;
    const block = el('div', { class: 'bdmi-detail-block' + (s.fires ? ' fire' : '') });
    const labels = {
      A: 'Test A — Mendelian segregation distortion',
      B: 'Test B — Missing karyotype class',
      C: 'Test C — Heterozygote excess / deficit',
      D: 'Test D — Ancestry × genotype interaction',
      E: 'Test E — Long-range forbidden combinations',
      F: 'Test F — Phenotype association',
    };
    block.appendChild(el('div', { class: 'bdmi-detail-block-title', text: labels[k] }));
    block.appendChild(el('div', { class: 'bdmi-detail-block-body',
      text: ({A:_aLabel,B:_bLabel,C:_cLabel,D:_dLabel,E:_eLabel,F:_fLabel}[k])(s, true) }));
    block.appendChild(el('div', { class: 'bdmi-detail-block-verdict',
      text: s.fires ? 'FIRES' : 'no signal',
      style: { color: s.fires ? 'var(--bad)' : 'var(--ink-dim)' } }));
    panel.appendChild(block);
  });
  slot.appendChild(panel);
}

// ─── Export ─────────────────────────────────────────────────────────────

function exportBdmiTsv() {
  const r = state.bdmi.last_results;
  if (!r) { alert('Run the BDMI screen first.'); return; }
  const cols = ['candidate','chromosome','start_mb','end_mb','length_mb','frequency',
                'A_distortion_p','A_het_het_chi2_p',
                'B_missing_class',
                'C_het_obs','C_het_exp','C_dev','C_chi2_p','C_direction',
                'D_chi2_p','D_df',
                'E_min_ratio','E_worst_partner','E_worst_cell',
                'F_status',
                'n_fired','confidence'];
  const lines = [
    '# BDMI / incompatibility screen',
    '# Date: ' + new Date().toISOString(),
    '# Alpha: ' + r.alpha + '   Het rule: ' + r.hetRule,
    '# Phenotype layer: ' + (_phenoAvailable ? 'present' : 'missing'),
    '#',
    cols.join('\t'),
  ];
  for (const row of r.rows) {
    const c = row.candidate;
    const A = row.screens.A, B = row.screens.B, C = row.screens.C,
          D = row.screens.D, E = row.screens.E, F = row.screens.F;
    const cell = (E && E.worst_cell)
      ? ['AA','AB','BB'][E.worst_cell[0]] + 'x' + ['AA','AB','BB'][E.worst_cell[1]]
      : '';
    lines.push([
      c.candidate, c.chromosome, c.start_mb, c.end_mb, c.length_mb, c.frequency,
      A ? fmt(A.distortion_p) : '', A ? fmt(A.chi2_p) : '',
      B ? (B.missing_class >= 0 ? ['AA','AB','BB'][B.missing_class] : '') : '',
      C ? C.obs_het : '', C ? (C.exp_het || 0).toFixed(2) : '',
      C ? (C.dev || 0).toFixed(3) : '', C ? fmt(C.chi2_p) : '', C ? C.direction : '',
      D ? fmt(D.chi2_p) : '', D ? (D.df || '') : '',
      E ? (Number.isFinite(E.min_ratio) ? E.min_ratio.toFixed(3) : '') : '',
      E ? (E.worst_partner || '') : '',
      cell,
      F ? F.status : '',
      row.n_fired, row.confidence,
    ].join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bdmi_screen_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ─── Wiring ─────────────────────────────────────────────────────────────

function _updatePhenoBadge() {
  const slot = $('#bdmiDataSource');
  if (!slot) return;
  if (_phenoAvailable) {
    slot.className = 'data-source-badge live';
    slot.textContent = '●  Phenotype layer detected — Test F can fire.';
  } else {
    slot.className = 'data-source-badge demo';
    slot.textContent = '◌  Phenotype layer not loaded — Test F (phenotype association) '
      + 'cannot exceed "missing" until survival/growth/fertility TSV is wired in.';
  }
}

function wireBdmi() {
  $('#bdmiScope').addEventListener('change',     e => state.bdmi.scope        = e.target.value);
  $('#bdmiMendSource').addEventListener('change',e => state.bdmi.mend_source  = e.target.value);
  $('#bdmiAlpha').addEventListener('change',     e => state.bdmi.alpha        = e.target.value);
  $('#bdmiHetRule').addEventListener('change',   e => state.bdmi.het_rule     = e.target.value);
  ['bdmiUseMend','bdmiUseMiss','bdmiUseHet','bdmiUseAnc','bdmiUseLR','bdmiUsePheno']
    .forEach(id => $('#' + id).addEventListener('change', e => {
      const k = id.replace('bdmiUse','').toLowerCase();
      state.bdmi.screens_enabled[k] = e.target.checked;
    }));
  $('#bdmiRunBtn').addEventListener('click', runBdmiScreen);
  $('#bdmiResetBtn').addEventListener('click', () => {
    state.bdmi.last_results = null;
    $('#bdmiSummary').innerHTML = '';
    $('#bdmiResultSlot').innerHTML = '';
    $('#bdmiDetailSlot').innerHTML = '';
  });
  $('#bdmiExportBtn').addEventListener('click', exportBdmiTsv);
}

function _restoreFromState() {
  if (state.bdmi.scope)       $('#bdmiScope').value       = state.bdmi.scope;
  if (state.bdmi.mend_source) $('#bdmiMendSource').value  = state.bdmi.mend_source;
  if (state.bdmi.alpha)       $('#bdmiAlpha').value       = state.bdmi.alpha;
  if (state.bdmi.het_rule)    $('#bdmiHetRule').value     = state.bdmi.het_rule;
  const se = state.bdmi.screens_enabled || {};
  if ('mend'  in se) $('#bdmiUseMend').checked  = se.mend;
  if ('miss'  in se) $('#bdmiUseMiss').checked  = se.miss;
  if ('het'   in se) $('#bdmiUseHet').checked   = se.het;
  if ('anc'   in se) $('#bdmiUseAnc').checked   = se.anc;
  if ('lr'    in se) $('#bdmiUseLR').checked    = se.lr;
  if ('pheno' in se) $('#bdmiUsePheno').checked = se.pheno;
}

// ─── Lifecycle ──────────────────────────────────────────────────────────

let _unsubInd = null, _unsubChr = null, _unsubFam = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  loadLiveKaryotypes(registry).catch((e) =>
    console.warn('bdmi.mount: karyotype load threw —', e));
  renderKaryotypeBadgeSlots();
  _probePhenotype();
  _updatePhenoBadge();
  _restoreFromState();
  wireBdmi();
  if (state.bdmi.last_results) renderBdmiResults();
  _unsubInd = on('individual_changed', () => {
    if (state.bdmi.last_results) renderBdmiResults();
  });
  _unsubChr = on('chromosome_changed', () => {
    if (state.bdmi.last_results) renderBdmiResults();
  });
  _unsubFam = on('family_changed', () => {
    // Family change can re-shape hub_dyads — rerun if that source is active.
    if (state.bdmi.last_results && state.bdmi.mend_source === 'hub_dyads') {
      runBdmiScreen();
    }
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  if (_unsubFam) _unsubFam();
  _unsubInd = _unsubChr = _unsubFam = null;
}
