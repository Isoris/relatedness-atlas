// atlases/relatedness/pages/hub/cross_planner.js
// =============================================================================
// Batch cross planner (#21). Multi-pair extension of the existing
// Compatibility tab. Generates every candidate parent pair under the
// chosen filters, ranks by composite cross-utility, and flags inheritance-
// side warnings on each. Read-only.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { sexBadgeHtml } from '../../shared/sex_badge.js';
import { _setActiveState } from './cross_planner/_state.js';

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

function _familyOf(ind) {
  const f = (DEMO.families || []).find(f => (f.members || []).includes(ind));
  return f ? f.family_id : null;
}

function _isKin(a, b) {
  return (DEMO.network_edges || []).some(e =>
    ((e.a === a && e.b === b) || (e.a === b && e.b === a))
    && (e.class === 'strong_po' || e.class === 'possible_po'));
}

function _carriesAnyFail(ind) {
  for (const c of (DEMO.inversion_candidates_full || [])) {
    if (c.status !== 'fail') continue;
    const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
    if (k === '0/1' || k === '1/1') return true;
  }
  return false;
}

// Cross-evaluation: per-pair scoring + breeding-AI flags.
function _evaluatePair(a, b) {
  const candidates = DEMO.inversion_candidates_full || [];
  const sA = (DEMO.sex || {})[a] || '?';
  const sB = (DEMO.sex || {})[b] || '?';
  const fA = _familyOf(a);
  const fB = _familyOf(b);

  const opposite_sex = sA !== '?' && sB !== '?' && sA !== sB;
  const cross_family = fA && fB && fA !== fB;

  // Per-candidate cross outcomes.
  let n_pass = 0, n_pass_diff = 0, n_pass_both_typed = 0;
  let n_het_a = 0, n_het_b = 0;
  let n_redundant = 0;            // identical karyotype at every PASS candidate
  for (const c of candidates) {
    if (c.status !== 'pass') continue;
    n_pass++;
    const ka = (DEMO.karyotype_matrix[a] || {})[c.candidate];
    const kb = (DEMO.karyotype_matrix[b] || {})[c.candidate];
    if (!ka || ka === 'NA' || !kb || kb === 'NA') continue;
    n_pass_both_typed++;
    if (ka === '0/1') n_het_a++;
    if (kb === '0/1') n_het_b++;
    if (ka !== kb) n_pass_diff++; else n_redundant++;
  }
  const frac_diff     = n_pass > 0 ? n_pass_diff       / n_pass : 0;
  const frac_coverage = n_pass > 0 ? n_pass_both_typed / n_pass : 0;

  // Composite cross_utility_score per the page-level description.
  let score = 0;
  if (opposite_sex)             score += 0.35;
  if (cross_family)             score += 0.25;
  score += 0.15 * frac_diff;
  // Hub confound: penalty if either parent is heterokaryote at a candidate
  // whose carriers concentrate in ≥80% in one hub.
  let hubConfound = 0;
  let n_het_total = 0;
  for (const c of candidates) {
    if (c.status !== 'pass') continue;
    for (const x of [a, b]) {
      const k = (DEMO.karyotype_matrix[x] || {})[c.candidate];
      if (k !== '0/1') continue;
      n_het_total++;
      // Carrier hub share for this candidate.
      const carriers = (DEMO.individuals || []).filter(i => {
        const ki = (DEMO.karyotype_matrix[i] || {})[c.candidate];
        return ki === '0/1' || ki === '1/1';
      });
      const fams = {};
      carriers.forEach(i => { const f = _familyOf(i) || '(none)'; fams[f] = (fams[f] || 0) + 1; });
      const top = Math.max(...Object.values(fams).concat([0]));
      const share = carriers.length ? top / carriers.length : 0;
      hubConfound += share;
    }
  }
  const mean_confound = n_het_total > 0 ? hubConfound / n_het_total : 0;
  score += 0.15 * (1 - mean_confound);
  score += 0.10 * frac_coverage;   // both parents typed at PASS candidates

  // Flags (decorative, don't affect score).
  const flags = [];
  if (!opposite_sex) flags.push('same-or-unknown-sex');
  if (!cross_family) flags.push('same-family');
  if (n_redundant > 0 && n_pass_diff === 0) flags.push('redundant-cross');
  if (n_het_a + n_het_b > 0) flags.push('heterokaryote-CO-suppression');
  if (mean_confound >= 0.60) flags.push('hub-confounded');
  if (_isKin(a, b)) flags.push('close-kin');

  return {
    a, b, sex_a: sA, sex_b: sB,
    family_a: fA, family_b: fB,
    opposite_sex, cross_family,
    n_pass, n_pass_diff, frac_diff,
    n_het_a, n_het_b,
    mean_confound,
    cross_utility_score: Math.max(0, Math.min(1, score)),
    flags,
  };
}

function _populatePairs() {
  const mode = $('#cpMode').value;
  const excludeKin    = $('#cpExcludeKin').checked;
  const excludeFail   = $('#cpExcludeFail').checked;
  const requireDiff   = $('#cpRequireDiff').checked;
  const inds = (DEMO.individuals || []).filter(ind =>
    !excludeFail || !_carriesAnyFail(ind));
  const out = [];
  for (let i = 0; i < inds.length; i++) {
    for (let j = i + 1; j < inds.length; j++) {
      const a = inds[i], b = inds[j];
      if (excludeKin && _isKin(a, b)) continue;
      const sA = (DEMO.sex || {})[a] || '?';
      const sB = (DEMO.sex || {})[b] || '?';
      const fA = _familyOf(a), fB = _familyOf(b);
      if (mode === 'cross_family' && (fA === null || fB === null || fA === fB)) continue;
      if (mode === 'opposite_sex' && (sA === '?' || sB === '?' || sA === sB)) continue;
      if (mode === 'opposite_sex_cross_family'
          && (sA === '?' || sB === '?' || sA === sB
              || fA === null || fB === null || fA === fB)) continue;
      const ev = _evaluatePair(a, b);
      if (requireDiff && ev.n_pass_diff === 0) continue;
      out.push(ev);
    }
  }
  return out.sort((x, y) => y.cross_utility_score - x.cross_utility_score);
}

function _renderSummary() {
  const slot = $('#cpSummary');
  slot.innerHTML = '';
  const r = state.cross_planner.last_results;
  if (!r) return;
  slot.appendChild(_sumCell('pairs evaluated', r.pairs.length));
  slot.appendChild(_sumCell('score ≥ 0.70', r.pairs.filter(p => p.cross_utility_score >= 0.70).length, 'good'));
  slot.appendChild(_sumCell('score 0.40–0.70', r.pairs.filter(p =>
    p.cross_utility_score >= 0.40 && p.cross_utility_score < 0.70).length, 'warn'));
  slot.appendChild(_sumCell('score < 0.40', r.pairs.filter(p => p.cross_utility_score < 0.40).length));
  slot.appendChild(_sumCell('top-N rendered', Math.min(r.pairs.length, r.top_n)));
}

const FLAG_TONE = {
  'same-or-unknown-sex':           'warn',
  'same-family':                   'warn',
  'redundant-cross':               'warn',
  'heterokaryote-CO-suppression':  'warn',
  'hub-confounded':                'fail',
  'close-kin':                     'fail',
};

function _renderResults() {
  const slot = $('#cpResults');
  slot.innerHTML = '';
  const r = state.cross_planner.last_results;
  if (!r || !r.pairs.length) {
    slot.appendChild(el('div', { class: 'ie-conclusion tier-weak',
      html: '<div class="verdict">NO PAIRS</div>'
          + 'Either no individuals matched the filters, or the require-diff filter ruled them all out.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table prio-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Pair','sex','family','PASS Δ','het a/b','hub confound','score','flags']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  r.pairs.slice(0, r.top_n).forEach(p => {
    const row = el('tr');
    const pairTd = el('td');
    pairTd.innerHTML = `<span class="sample-id">${p.a}</span> × <span class="sample-id">${p.b}</span>`;
    row.appendChild(pairTd);
    row.appendChild(el('td', { html: sexBadgeHtml(p.a) + ' × ' + sexBadgeHtml(p.b),
      style: { whiteSpace: 'nowrap' } }));
    row.appendChild(el('td', {
      text: `${p.family_a || '—'} × ${p.family_b || '—'}`,
      style: { fontSize: '9.5px', color: p.cross_family ? '' : 'var(--warn)' } }));
    row.appendChild(el('td', { class: 'num',
      text: `${p.n_pass_diff}/${p.n_pass}`, style: { fontSize: '10px' } }));
    row.appendChild(el('td', { class: 'num',
      text: `${p.n_het_a}/${p.n_het_b}`, style: { fontSize: '10px' } }));
    const hcTd = el('td', { class: 'num', text: (p.mean_confound * 100).toFixed(0) + '%' });
    if (p.mean_confound >= 0.60) hcTd.style.color = 'var(--bad)';
    else if (p.mean_confound >= 0.40) hcTd.style.color = 'var(--warn)';
    row.appendChild(hcTd);
    const scTd = el('td', { class: 'num', text: p.cross_utility_score.toFixed(2) });
    if (p.cross_utility_score >= 0.70) scTd.style.color = 'var(--good)';
    else if (p.cross_utility_score < 0.40) scTd.style.color = 'var(--ink-dim)';
    row.appendChild(scTd);
    const flagTd = el('td');
    p.flags.forEach(f => {
      flagTd.appendChild(el('span', {
        class: 'status-pill-cell ' + (FLAG_TONE[f] === 'fail' ? 'fail'
                                    : FLAG_TONE[f] === 'warn' ? 'warn' : 'pass'),
        text: f.replace(/-/g, ' '),
        style: { marginRight: '4px', fontSize: '8.5px' },
      }));
    });
    row.appendChild(flagTd);
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _runPlanner() {
  const pairs = _populatePairs();
  state.cross_planner.last_results = {
    pairs,
    top_n: parseInt($('#cpTopN').value, 10) || 25,
    mode: $('#cpMode').value,
  };
  _renderSummary();
  _renderResults();
}

function _exportTsv() {
  const r = state.cross_planner.last_results;
  if (!r) { alert('Run the planner first.'); return; }
  const cols = ['rank','sample_a','sample_b','sex_a','sex_b','family_a','family_b',
                'opposite_sex','cross_family','n_pass','n_pass_diff','n_het_a','n_het_b',
                'mean_confound','cross_utility_score','flags'];
  const lines = [
    '# Batch cross planner — top-N pairs',
    '# Date: ' + new Date().toISOString(),
    '# Mode: ' + r.mode + '  top_n: ' + r.top_n,
    '# Pairs evaluated: ' + r.pairs.length,
    '#',
    cols.join('\t'),
  ];
  r.pairs.slice(0, r.top_n).forEach((p, i) => {
    lines.push([
      i + 1, p.a, p.b, p.sex_a, p.sex_b,
      p.family_a || '', p.family_b || '',
      p.opposite_sex ? 'yes' : 'no',
      p.cross_family ? 'yes' : 'no',
      p.n_pass, p.n_pass_diff, p.n_het_a, p.n_het_b,
      p.mean_confound.toFixed(3),
      p.cross_utility_score.toFixed(3),
      p.flags.join(','),
    ].join('\t'));
  });
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cross_planner_top' + r.top_n + '_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wireCp() {
  $('#cpRunBtn').addEventListener('click', _runPlanner);
  $('#cpResetBtn').addEventListener('click', () => {
    state.cross_planner.last_results = null;
    $('#cpSummary').innerHTML = '';
    $('#cpResults').innerHTML = '';
  });
  $('#cpExportBtn').addEventListener('click', _exportTsv);
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  wireCp();
  if (!state.cross_planner.last_results) _runPlanner();
  else { _renderSummary(); _renderResults(); }
}

export async function unmount(root) {
  _setActiveState(null);
}
