// atlases/relatedness/pages/hub/mendelian.js
// =============================================================================
// Mendelian page — sub-tab #4. THE headline analytical feature: per-inversion
// Mendelian segregation testing for dyads, triads, and cohort scans.
//
// Extracted verbatim from legacy Relatedness_atlas.js §9 (lines 1967-2575),
// with three changes:
//   1. ES-module imports for DEMO / state / utils / stats.
//   2. The event-wiring (#mendMode change, #mendRunBtn click, etc.) used to
//      run at IIFE-evaluation time; in the modular world it runs once per
//      mount() and is cleaned up in unmount() via the page's _wired set.
//   3. invNormCdf and normCdf live in this module (not promoted to shared
//      because nothing else uses them; can be promoted later if needed).
//
// Methods (per the legacy comment block):
//   DYAD     — binomial transmission test for parent-het sites
//   TRIAD    — multinomial / chi-square against expected segregation
//   ALL_DYADS / ALL_TRIADS — Stouffer combination across the hub
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import {
  binomialPValueTwoSided, chiSquarePValue, expectedOffspringPrior,
} from '../../shared/stats.js';
import { on } from '../../shared/page_hooks.js';
import { _setActiveState } from './mendelian/_state.js';

// ─── §9 verbatim body (with event wiring promoted into wireMendelian()) ──

function populateMendSelectors() {
  const fam = DEMO.families.find(f => f.family_id === state.selected_family)
              || DEMO.families[0];
  const opts = fam.members.map(m => `<option value="${m}">${m}</option>`).join('');
  $('#mendParent1').innerHTML = opts;
  $('#mendParent2').innerHTML = opts;
  $('#mendOffspring').innerHTML = opts;
  if (fam.hub_individual) {
    $('#mendParent1').value = fam.hub_individual;
    state.mend.parent1 = fam.hub_individual;
  }
  const others = fam.members.filter(m => m !== fam.hub_individual);
  if (others.length) {
    $('#mendParent2').value = others[0];
    state.mend.parent2 = others[0];
  }
  if (others.length > 1) {
    $('#mendOffspring').value = others[1];
    state.mend.offspring = others[1];
  }
}

function updateMendModeUI() {
  const mode = $('#mendMode').value;
  state.mend.mode = mode;
  const showParent1   = (mode === 'dyad' || mode === 'triad');
  const showParent2   = (mode === 'triad');
  const showOffspring = (mode === 'dyad' || mode === 'triad');
  $('#rowParent1').style.display   = showParent1   ? '' : 'none';
  $('#rowParent2').style.display   = showParent2   ? '' : 'none';
  $('#rowOffspring').style.display = showOffspring ? '' : 'none';
  $('#lblParent1').textContent = (mode === 'dyad') ? 'Parent' : 'Parent 1';
}

function runDyadTest(parentId, offspringId, candidateList) {
  const pK = DEMO.karyotype_matrix[parentId]    || {};
  const oK = DEMO.karyotype_matrix[offspringId] || {};
  let n_inf = 0, n_zero = 0, n_one = 0;
  let n_consistent = 0, n_inconsistent = 0;
  const detail = [];
  for (const c of candidateList) {
    const p = pK[c.candidate];
    const o = oK[c.candidate];
    if (!p || p === 'NA' || !o || o === 'NA') continue;
    if ((p === '0/0' && o === '1/1') || (p === '1/1' && o === '0/0')) {
      n_inconsistent++;
      detail.push({ candidate: c.candidate, p_kt: p, o_kt: o, status: 'fail' });
      continue;
    }
    n_consistent++;
    if (p === '0/1') {
      if (o === '0/0') { n_zero++; n_inf++; }
      else if (o === '1/1') { n_one++; n_inf++; }
    }
    detail.push({ candidate: c.candidate, p_kt: p, o_kt: o, status: 'pass' });
  }
  const p_val = (n_inf > 0)
    ? binomialPValueTwoSided(n_zero, n_inf, 0.5)
    : NaN;
  const n_total = n_consistent + n_inconsistent;
  const consistency_p = (n_total > 0)
    ? binomialPValueTwoSided(n_inconsistent, n_total, 0.02)
    : NaN;
  return {
    mode: 'dyad',
    parent: parentId, offspring: offspringId,
    n_total, n_consistent, n_inconsistent,
    n_informative: n_inf, n_zero, n_one,
    transmission_p: p_val,
    consistency_p,
    detail,
  };
}

function runTriadTest(p1Id, p2Id, oId, candidateList) {
  const p1K = DEMO.karyotype_matrix[p1Id] || {};
  const p2K = DEMO.karyotype_matrix[p2Id] || {};
  const oK  = DEMO.karyotype_matrix[oId]  || {};
  let n_total = 0, n_consistent = 0, n_inconsistent = 0;
  let n_het_het = 0;
  let n_het_het_obs00 = 0, n_het_het_obs01 = 0, n_het_het_obs11 = 0;
  const detail = [];
  for (const c of candidateList) {
    const p1 = p1K[c.candidate];
    const p2 = p2K[c.candidate];
    const o  = oK[c.candidate];
    if (!p1 || p1 === 'NA' || !p2 || p2 === 'NA' || !o || o === 'NA') continue;
    const expected = expectedOffspringPrior(p1, p2);
    if (!expected) continue;
    const o_idx = o === '0/0' ? 0 : (o === '0/1' ? 1 : 2);
    const isInExpected = expected[o_idx] > 0;
    n_total++;
    if (isInExpected) n_consistent++;
    else              n_inconsistent++;
    if (p1 === '0/1' && p2 === '0/1') {
      n_het_het++;
      if (o === '0/0') n_het_het_obs00++;
      else if (o === '0/1') n_het_het_obs01++;
      else                  n_het_het_obs11++;
    }
    detail.push({
      candidate: c.candidate, p1_kt: p1, p2_kt: p2, o_kt: o,
      expected, status: isInExpected ? 'pass' : 'fail',
    });
  }
  const consistency_p = (n_total > 0)
    ? binomialPValueTwoSided(n_inconsistent, n_total, 0.02)
    : NaN;
  let chi2 = NaN, chi2_p = NaN, chi2_df = 2;
  if (n_het_het >= 5) {
    const exp00 = n_het_het * 0.25;
    const exp01 = n_het_het * 0.50;
    const exp11 = n_het_het * 0.25;
    const x = ((n_het_het_obs00 - exp00) ** 2) / exp00
            + ((n_het_het_obs01 - exp01) ** 2) / exp01
            + ((n_het_het_obs11 - exp11) ** 2) / exp11;
    chi2 = x;
    chi2_p = chiSquarePValue(x, chi2_df);
  }
  return {
    mode: 'triad',
    parent1: p1Id, parent2: p2Id, offspring: oId,
    n_total, n_consistent, n_inconsistent,
    consistency_p,
    n_het_het, n_het_het_obs00, n_het_het_obs01, n_het_het_obs11,
    chi2, chi2_p, chi2_df,
    detail,
  };
}

function getMendCandidates() {
  let list = DEMO.inversion_candidates_full;
  const subset = $('#mendInvSubset').value;
  if (subset === 'status_pass') list = list.filter(i => i.status === 'pass');
  else if (subset === 'status_warn') list = list.filter(i => i.status === 'warn');
  else if (subset === 'freq_high') list = list.filter(i => i.frequency >= 0.10);
  else if (subset === 'chrom_only' && state.selected_chromosome) {
    list = list.filter(i => i.chromosome === state.selected_chromosome);
  }
  return list;
}

function runMendelianTest() {
  const mode = state.mend.mode;
  const candidates = getMendCandidates();
  const fam = DEMO.families.find(f => f.family_id === state.selected_family) || DEMO.families[0];
  let result;
  if (mode === 'dyad') {
    result = runDyadTest(state.mend.parent1, state.mend.offspring, candidates);
  } else if (mode === 'triad') {
    result = runTriadTest(state.mend.parent1, state.mend.parent2, state.mend.offspring, candidates);
  } else if (mode === 'all_dyads') {
    const hub = fam.hub_individual || fam.members[0];
    const others = fam.members.filter(m => m !== hub);
    const results = others.map(m => runDyadTest(hub, m, candidates));
    result = combineCohortDyads(results, hub);
  } else if (mode === 'all_triads') {
    const ms = fam.members;
    if (ms.length < 3) {
      result = { mode: 'all_triads', error: 'Hub has fewer than 3 members; no triads possible.' };
    } else {
      const p1 = ms[0], p2 = ms[1];
      const offspring = ms.slice(2);
      const results = offspring.map(o => runTriadTest(p1, p2, o, candidates));
      result = combineCohortTriads(results, p1, p2);
    }
  }
  state.mend.last_result = result;
  renderMendResult(result);
}

function combineCohortDyads(results, hub) {
  const valid = results.filter(r => Number.isFinite(r.consistency_p));
  const z_combined = valid.length
    ? valid.reduce((s, r) => s + invNormCdf(1 - r.consistency_p / 2), 0) / Math.sqrt(valid.length)
    : 0;
  const combined_p = 2 * (1 - normCdf(Math.abs(z_combined)));
  return {
    mode: 'all_dyads', hub, n_dyads: results.length,
    results, combined_p,
    summary: results.map(r => ({
      pair: r.parent + ' × ' + r.offspring,
      consistency_p: r.consistency_p,
      n_total: r.n_total,
      n_inconsistent: r.n_inconsistent,
    })),
  };
}

function combineCohortTriads(results, p1, p2) {
  const valid = results.filter(r => Number.isFinite(r.consistency_p));
  const z_combined = valid.length
    ? valid.reduce((s, r) => s + invNormCdf(1 - r.consistency_p / 2), 0) / Math.sqrt(valid.length)
    : 0;
  const combined_p = 2 * (1 - normCdf(Math.abs(z_combined)));
  return {
    mode: 'all_triads', parent1: p1, parent2: p2,
    n_triads: results.length,
    results, combined_p,
    summary: results.map(r => ({
      pair: r.parent1 + ' × ' + r.parent2 + ' → ' + r.offspring,
      consistency_p: r.consistency_p,
      chi2_p: r.chi2_p,
      n_total: r.n_total,
      n_inconsistent: r.n_inconsistent,
    })),
  };
}

function normCdf(x) {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p_ =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const xz = Math.abs(x) / Math.SQRT2;
  const t_ = 1 / (1 + p_ * xz);
  const y = 1 - (((((a5 * t_ + a4) * t_) + a3) * t_ + a2) * t_ + a1) * t_ * Math.exp(-xz * xz);
  return 0.5 * (1 + sign * y);
}

function invNormCdf(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return  Infinity;
  const a = [-3.969683028665376e+01,  2.209460984245205e+02,
             -2.759285104469687e+02,  1.383577518672690e+02,
             -3.066479806614716e+01,  2.506628277459239e+00];
  const b = [-5.447609879822406e+01,  1.615858368580409e+02,
             -1.556989798598866e+02,  6.680131188771972e+01,
             -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01,
             -2.400758277161838e+00, -2.549732539343734e+00,
              4.374664141464968e+00,  2.938163982698783e+00];
  const d = [ 7.784695709041462e-03,  3.224671290700398e-01,
              2.445134137142996e+00,  3.754408661907416e+00];
  const plow = 0.02425, phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= phigh) {
    const q = p - 0.5; const r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

function renderMendResult(r) {
  const sumSlot = $('#mendSummary');
  const detSlot = $('#mendResultSlot');
  sumSlot.innerHTML = '';
  detSlot.innerHTML = '';
  if (!r) return;
  if (r.error) {
    detSlot.appendChild(el('div', {
      style: { color: 'var(--bad)', padding: '14px',
               background: 'var(--panel-2)',
               border: '1px solid var(--rule)', borderRadius: '4px' },
      text: r.error,
    }));
    return;
  }

  if (r.mode === 'dyad') {
    sumSlot.appendChild(summaryCell('mode', 'Dyad test'));
    sumSlot.appendChild(summaryCell('candidates tested', r.n_total));
    sumSlot.appendChild(summaryCell('consistent', r.n_consistent));
    sumSlot.appendChild(summaryCell('inconsistent (Mendelian errors)', r.n_inconsistent,
                                     r.n_inconsistent > 0 ? 'fail' : 'good'));
    sumSlot.appendChild(summaryCell('consistency P-value',
                                     fmt(r.consistency_p),
                                     pSeverity(r.consistency_p, $('#mendAlpha').value)));
    sumSlot.appendChild(summaryCell('informative (parent het)', r.n_informative,
                                     null,
                                     r.n_informative > 0
                                       ? `${r.n_zero}× allele 0, ${r.n_one}× allele 1`
                                       : ''));
    if (r.n_informative > 0) {
      sumSlot.appendChild(summaryCell('transmission P-value (binomial 0.5)',
                                       fmt(r.transmission_p),
                                       pSeverity(r.transmission_p, $('#mendAlpha').value)));
    }
  } else if (r.mode === 'triad') {
    sumSlot.appendChild(summaryCell('mode', 'Triad test'));
    sumSlot.appendChild(summaryCell('candidates tested', r.n_total));
    sumSlot.appendChild(summaryCell('consistent', r.n_consistent));
    sumSlot.appendChild(summaryCell('inconsistent', r.n_inconsistent,
                                     r.n_inconsistent > 0 ? 'fail' : 'good'));
    sumSlot.appendChild(summaryCell('consistency P-value',
                                     fmt(r.consistency_p),
                                     pSeverity(r.consistency_p, $('#mendAlpha').value)));
    if (r.n_het_het >= 5) {
      sumSlot.appendChild(summaryCell('het × het class size', r.n_het_het));
      sumSlot.appendChild(summaryCell('het×het χ² P (1:2:1)', fmt(r.chi2_p),
                                       pSeverity(r.chi2_p, $('#mendAlpha').value)));
    }
  } else if (r.mode === 'all_dyads') {
    sumSlot.appendChild(summaryCell('mode', 'Cohort dyad test'));
    sumSlot.appendChild(summaryCell('hub', r.hub));
    sumSlot.appendChild(summaryCell('dyads tested', r.n_dyads));
    sumSlot.appendChild(summaryCell('combined P (Stouffer)',
                                     fmt(r.combined_p),
                                     pSeverity(r.combined_p, $('#mendAlpha').value)));
  } else if (r.mode === 'all_triads') {
    sumSlot.appendChild(summaryCell('mode', 'Cohort triad test'));
    sumSlot.appendChild(summaryCell('parent₁', r.parent1));
    sumSlot.appendChild(summaryCell('parent₂', r.parent2));
    sumSlot.appendChild(summaryCell('triads tested', r.n_triads));
    sumSlot.appendChild(summaryCell('combined P (Stouffer)',
                                     fmt(r.combined_p),
                                     pSeverity(r.combined_p, $('#mendAlpha').value)));
  }

  if (r.mode === 'dyad' || r.mode === 'triad') {
    const tbl = el('table', { class: 'data-table', style: { marginTop: '12px' } });
    const thead = el('thead');
    const tr = el('tr');
    const cols = r.mode === 'dyad'
      ? ['Candidate','Parent','Offspring','Status']
      : ['Candidate','Parent 1','Parent 2','Offspring','Expected support','Status'];
    cols.forEach(c => tr.appendChild(el('th', { text: c })));
    thead.appendChild(tr);
    tbl.appendChild(thead);
    const tbody = el('tbody');
    r.detail.slice(0, 50).forEach(row => {
      const t = el('tr');
      t.appendChild(el('td', { class: 'sample-id', text: row.candidate }));
      if (r.mode === 'dyad') {
        t.appendChild(el('td', { text: row.p_kt }));
        t.appendChild(el('td', { text: row.o_kt }));
      } else {
        t.appendChild(el('td', { text: row.p1_kt }));
        t.appendChild(el('td', { text: row.p2_kt }));
        t.appendChild(el('td', { text: row.o_kt }));
        t.appendChild(el('td', {
          text: row.expected.map((p, i) => p > 0
                  ? (['0/0','0/1','1/1'][i] + '(' + (p*100).toFixed(0) + '%)') : null)
                  .filter(Boolean).join(' '),
          style: { color: 'var(--ink-dim)', fontSize: '10px' }
        }));
      }
      const tdSt = el('td');
      tdSt.appendChild(el('span', {
        class: 'status-pill-cell ' + (row.status === 'pass' ? 'pass' : 'fail'),
        text: row.status.toUpperCase(),
      }));
      t.appendChild(tdSt);
      tbody.appendChild(t);
    });
    if (r.detail.length > 50) {
      const tr2 = el('tr');
      tr2.appendChild(el('td', {
        colspan: cols.length,
        text: `… ${r.detail.length - 50} more rows omitted (export to TSV for full set)`,
        style: { textAlign: 'center', color: 'var(--ink-dim)',
                 fontStyle: 'italic', padding: '8px' },
      }));
      tbody.appendChild(tr2);
    }
    tbl.appendChild(tbody);
    detSlot.appendChild(tbl);
  } else if (r.mode === 'all_dyads' || r.mode === 'all_triads') {
    const tbl = el('table', { class: 'data-table', style: { marginTop: '12px' } });
    const thead = el('thead');
    const tr = el('tr');
    ['Pair','N total','N inconsistent','Consistency P','χ² P (where applicable)']
      .forEach(c => tr.appendChild(el('th', { text: c })));
    thead.appendChild(tr);
    tbl.appendChild(thead);
    const tbody = el('tbody');
    r.summary.forEach(row => {
      const t = el('tr');
      t.appendChild(el('td', { class: 'sample-id', text: row.pair }));
      t.appendChild(el('td', { class: 'num', text: String(row.n_total) }));
      t.appendChild(el('td', { class: 'num', text: String(row.n_inconsistent) }));
      const tdP = el('td', { class: 'num', text: fmt(row.consistency_p) });
      const sev = pSeverity(row.consistency_p, $('#mendAlpha').value);
      if (sev === 'fail') tdP.style.color = 'var(--bad)';
      else if (sev === 'warn') tdP.style.color = 'var(--warn)';
      else if (sev === 'good') tdP.style.color = 'var(--good)';
      t.appendChild(tdP);
      t.appendChild(el('td', { class: 'num',
        text: row.chi2_p === undefined ? '—' : fmt(row.chi2_p) }));
      tbody.appendChild(t);
    });
    tbl.appendChild(tbody);
    detSlot.appendChild(tbl);
  }
}

function summaryCell(label, value, severity = null, sub = '') {
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

function pSeverity(p, alphaSelect) {
  if (!Number.isFinite(p)) return null;
  let alpha;
  if (alphaSelect === 'bonferroni') {
    alpha = 0.05 / Math.max(1, getMendCandidates().length);
  } else {
    alpha = parseFloat(alphaSelect);
  }
  if (p < alpha)        return 'fail';
  if (p < alpha * 5)    return 'warn';
  return 'good';
}

function mendResultToTsv(r) {
  if (r.mode === 'dyad' || r.mode === 'triad') {
    const cols = r.mode === 'dyad'
      ? ['candidate','parent_kt','offspring_kt','status']
      : ['candidate','p1_kt','p2_kt','o_kt','expected_support','status'];
    const lines = [cols.join('\t')];
    r.detail.forEach(row => {
      const cells = r.mode === 'dyad'
        ? [row.candidate, row.p_kt, row.o_kt, row.status]
        : [row.candidate, row.p1_kt, row.p2_kt, row.o_kt,
           row.expected.map((p, i) => ['0/0','0/1','1/1'][i] + ':' + p).join(';'),
           row.status];
      lines.push(cells.join('\t'));
    });
    return lines.join('\n') + '\n';
  } else {
    const cols = ['pair','n_total','n_inconsistent','consistency_p','chi2_p'];
    const lines = [cols.join('\t')];
    r.summary.forEach(row => {
      lines.push([row.pair, row.n_total, row.n_inconsistent,
                  fmt(row.consistency_p),
                  row.chi2_p === undefined ? '' : fmt(row.chi2_p)].join('\t'));
    });
    return lines.join('\n') + '\n';
  }
}

function wireMendelian() {
  $('#mendMode').addEventListener('change', () => updateMendModeUI());
  $('#mendParent1').addEventListener('change', e => state.mend.parent1 = e.target.value);
  $('#mendParent2').addEventListener('change', e => state.mend.parent2 = e.target.value);
  $('#mendOffspring').addEventListener('change', e => state.mend.offspring = e.target.value);
  $('#mendInvSubset').addEventListener('change', e => state.mend.inv_subset = e.target.value);
  $('#mendAlpha').addEventListener('change', e => state.mend.alpha = e.target.value);
  $('#mendRunBtn').addEventListener('click', runMendelianTest);
  $('#mendResetBtn').addEventListener('click', () => {
    state.mend.last_result = null;
    $('#mendSummary').innerHTML = '';
    $('#mendResultSlot').innerHTML = '';
  });
  $('#mendExportBtn').addEventListener('click', () => {
    const r = state.mend.last_result;
    if (!r) { alert('Run a test first.'); return; }
    const tsv = mendResultToTsv(r);
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mendelian_' + r.mode + '_' + Date.now() + '.tsv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

let _unsubInd = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  populateMendSelectors();
  updateMendModeUI();
  wireMendelian();

  // If the user arrived here via the Inversions tab's "open in Mendelian"
  // action, _pendingMode / _pendingFromInversion was pre-seeded by
  // inversions.js. Apply it now.
  if (state.mend._pendingMode) {
    $('#mendMode').value = state.mend._pendingMode;
    updateMendModeUI();
    $('#mendParent1').value = state.mend.parent1;
    $('#mendParent2').value = state.mend.parent2;
    $('#mendOffspring').value = state.mend.offspring;
    state.mend._pendingMode = null;
    state.mend._pendingFromInversion = null;
  }

  // Replay the last result, if any, so navigating away and back doesn't
  // wipe it.
  if (state.mend.last_result) renderMendResult(state.mend.last_result);

  _unsubInd = on('individual_changed', () => {
    populateMendSelectors();
    updateMendModeUI();
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  _unsubInd = null;
}
