// atlases/relatedness/pages/hub/inversion_compare.js
// =============================================================================
// Side-by-side inversion comparison (#22). Picks 2–4 candidates; lines
// them up across identity / karyotype distribution / HWE / hub spread /
// Mendelian Test A / regime context / marker readiness. Designed for
// picking which inversions ship to Pass-2 marker validation.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { binomialPValueTwoSided, chiSquarePValue, expectedOffspringPrior } from '../../shared/stats.js';
import { carriersOf, carrierHubShare, focalChromOf } from '../../shared/inversion_meiosis.js';
import { _setActiveState } from './inversion_compare/_state.js';

function _populatePicker(id) {
  const sel = $(id);
  sel.innerHTML = (id === '#cmpC1' || id === '#cmpC2')
    ? ''
    : '<option value="">(none)</option>';
  const order = (c) => (c.status === 'pass' ? 0 : c.status === 'warn' ? 1 : 2);
  (DEMO.inversion_candidates_full || []).slice()
    .sort((a, b) => order(a) - order(b))
    .forEach(inv => sel.appendChild(el('option', {
      value: inv.candidate,
      text: `${inv.candidate} · ${inv.chromosome} · ${inv.status}`,
    })));
}

function _populateAll() {
  ['#cmpC1','#cmpC2','#cmpC3','#cmpC4'].forEach(_populatePicker);
  const cs = DEMO.inversion_candidates_full || [];
  if (state.inversion_compare.candidates && state.inversion_compare.candidates.length) {
    const c = state.inversion_compare.candidates;
    $('#cmpC1').value = c[0] || (cs[0] && cs[0].candidate);
    $('#cmpC2').value = c[1] || (cs[1] && cs[1].candidate);
    $('#cmpC3').value = c[2] || '';
    $('#cmpC4').value = c[3] || '';
  } else {
    $('#cmpC1').value = (cs[0] && cs[0].candidate) || '';
    $('#cmpC2').value = (cs[1] && cs[1].candidate) || '';
  }
}

function _activeCandidates() {
  const ids = [$('#cmpC1').value, $('#cmpC2').value,
               $('#cmpC3').value, $('#cmpC4').value]
    .filter(x => x);
  return ids
    .map(id => (DEMO.inversion_candidates_full || []).find(c => c.candidate === id))
    .filter(Boolean);
}

// ─── Per-candidate signal aggregation (one column) ─────────────────────

function _signals(c) {
  // Karyotype counts.
  let n_00 = 0, n_01 = 0, n_11 = 0, n_NA = 0;
  for (const ind of DEMO.individuals) {
    const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
    if (k === '0/0') n_00++;
    else if (k === '0/1') n_01++;
    else if (k === '1/1') n_11++;
    else n_NA++;
  }
  const n = n_00 + n_01 + n_11;
  const p = n > 0 ? (n_01 + 2 * n_11) / (2 * n) : NaN;
  const q = 1 - p;
  const exp_01 = 2 * p * q * n;
  const exp_00 = q*q*n, exp_11 = p*p*n;
  let chi2 = 0;
  if (exp_00 > 0) chi2 += (n_00 - exp_00) ** 2 / exp_00;
  if (exp_01 > 0) chi2 += (n_01 - exp_01) ** 2 / exp_01;
  if (exp_11 > 0) chi2 += (n_11 - exp_11) ** 2 / exp_11;
  const hwe_p = chiSquarePValue(chi2, 1);

  // Hub share.
  const carriers = carriersOf(c.candidate);
  const hs = carrierHubShare(carriers);

  // Mendelian Test A p.
  let n_total = 0, n_inconsistent = 0;
  for (const t of DEMO.triads || []) {
    const p1 = (DEMO.karyotype_matrix[t.parent_a] || {})[c.candidate];
    const p2 = (DEMO.karyotype_matrix[t.parent_b] || {})[c.candidate];
    const o  = (DEMO.karyotype_matrix[t.offspring] || {})[c.candidate];
    const prior = expectedOffspringPrior(p1, p2);
    if (!prior || !o || o === 'NA') continue;
    const ix = o === '0/0' ? 0 : (o === '0/1' ? 1 : 2);
    n_total++;
    if (prior[ix] <= 0) n_inconsistent++;
  }
  const mendel_p = n_total > 0
    ? binomialPValueTwoSided(n_inconsistent, n_total, 0.02) : NaN;

  // Regime: number of same-chrom companions.
  const companions = (DEMO.inversion_candidates_full || [])
    .filter(o => o.candidate !== c.candidate && o.chromosome === c.chromosome).length;

  // Marker readiness heuristic.
  const marker_ready = c.status === 'pass' && c.frequency >= 0.10;

  return {
    candidate: c.candidate, chromosome: c.chromosome,
    span: `${c.start_mb}–${c.end_mb}`, length_mb: c.length_mb,
    status: c.status, frequency: c.frequency,
    n_typed: n, n_00, n_01, n_11, n_NA,
    allele_freq: p, hwe_p,
    n_carriers: carriers.length,
    hub_share: hs.share, hub: hs.hub,
    mendel_n: n_total, mendel_p,
    same_chrom_companions: companions,
    marker_ready, marker_reason: c.status !== 'pass'
      ? `status=${c.status.toUpperCase()}`
      : (c.frequency < 0.10 ? 'freq < 0.10' : 'ready'),
  };
}

// ─── Render side-by-side ───────────────────────────────────────────────

function _badgeCell(value, severity) {
  const td = el('td');
  const cls = severity === 'fail' ? 'fail' : severity === 'warn' ? 'warn' : 'pass';
  td.appendChild(el('span', { class: 'status-pill-cell ' + cls, text: String(value) }));
  return td;
}

function _renderTable() {
  const slot = $('#cmpTable');
  slot.innerHTML = '';
  const cs = _activeCandidates();
  if (cs.length < 2) {
    slot.appendChild(el('div', { class: 'ie-conclusion tier-weak',
      html: '<div class="verdict">PICK AT LEAST 2 CANDIDATES</div>'
          + 'Select two or more candidates above and click Compare.' }));
    return;
  }
  const sigs = cs.map(_signals);

  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  tr.appendChild(el('th', { text: 'Signal' }));
  sigs.forEach(s => tr.appendChild(el('th', { text: s.candidate })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');

  function addRow(label, cellFn) {
    const r = el('tr');
    r.appendChild(el('td', { class: 'sample-id', text: label }));
    sigs.forEach(s => r.appendChild(cellFn(s)));
    tbody.appendChild(r);
  }

  addRow('chromosome',           s => el('td', { text: s.chromosome }));
  addRow('span (Mb)',            s => el('td', { text: s.span, style: { fontSize: '10px' } }));
  addRow('length (Mb)',          s => el('td', { class: 'num', text: String(s.length_mb) }));
  addRow('status',               s => _badgeCell(s.status.toUpperCase(),
    s.status === 'pass' ? 'pass' : s.status === 'warn' ? 'warn' : 'fail'));
  addRow('frequency',            s => {
    const td = el('td', { class: 'num', text: fmt(s.frequency) });
    if (s.frequency < 0.05) td.style.color = 'var(--bad)';
    else if (s.frequency < 0.10) td.style.color = 'var(--warn)';
    return td;
  });
  addRow('n typed',              s => el('td', { class: 'num', text: String(s.n_typed) }));
  addRow('hom-ref / het / hom-alt', s => el('td', { class: 'num',
    text: `${s.n_00} / ${s.n_01} / ${s.n_11}`,
    style: { fontSize: '10px' } }));
  addRow('NA',                   s => {
    const td = el('td', { class: 'num', text: String(s.n_NA) });
    if (s.n_NA / (s.n_typed + s.n_NA) > 0.20) td.style.color = 'var(--warn)';
    return td;
  });
  addRow('allele freq p',        s => el('td', { class: 'num', text: fmt(s.allele_freq) }));
  addRow('HWE χ² p',             s => {
    const td = el('td', { class: 'num', text: fmt(s.hwe_p) });
    if (Number.isFinite(s.hwe_p) && s.hwe_p < 0.05) td.style.color = 'var(--bad)';
    return td;
  });
  addRow('n carriers',           s => el('td', { class: 'num', text: String(s.n_carriers) }));
  addRow('top-hub carrier share', s => {
    const td = el('td', { class: 'num',
      text: (s.hub_share * 100).toFixed(0) + '%',
      title: `${s.hub || '—'}` });
    if (s.hub_share >= 0.80) td.style.color = 'var(--bad)';
    else if (s.hub_share >= 0.60) td.style.color = 'var(--warn)';
    return td;
  });
  addRow('Mendelian p (Test A)', s => {
    const td = el('td', { class: 'num', text: fmt(s.mendel_p),
      title: `n_informative_triads=${s.mendel_n}` });
    if (Number.isFinite(s.mendel_p) && s.mendel_p < 0.01) td.style.color = 'var(--bad)';
    else if (Number.isFinite(s.mendel_p) && s.mendel_p < 0.05) td.style.color = 'var(--warn)';
    return td;
  });
  addRow('same-chrom companions', s => el('td', { class: 'num', text: String(s.same_chrom_companions) }));
  addRow('marker ready',         s => _badgeCell(s.marker_ready ? 'READY' : 'NOT YET',
    s.marker_ready ? 'pass' : 'warn'));

  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _exportTsv() {
  const cs = _activeCandidates();
  if (cs.length < 2) { alert('Pick at least 2 candidates.'); return; }
  const sigs = cs.map(_signals);
  const cols = ['signal', ...sigs.map(s => s.candidate)];
  const keys = [
    ['chromosome',       'chromosome'],
    ['span_mb',          'span'],
    ['length_mb',        'length_mb'],
    ['status',           'status'],
    ['frequency',        'frequency'],
    ['n_typed',          'n_typed'],
    ['n_00',             'n_00'],
    ['n_01',             'n_01'],
    ['n_11',             'n_11'],
    ['n_NA',             'n_NA'],
    ['allele_freq',      'allele_freq'],
    ['hwe_p',            'hwe_p'],
    ['n_carriers',       'n_carriers'],
    ['top_hub_share',    'hub_share'],
    ['mendel_p',         'mendel_p'],
    ['mendel_n_triads',  'mendel_n'],
    ['same_chrom_companions','same_chrom_companions'],
    ['marker_ready',     'marker_ready'],
    ['marker_reason',    'marker_reason'],
  ];
  const lines = [
    '# Inversion comparison',
    '# Date: ' + new Date().toISOString(),
    '#',
    cols.join('\t'),
  ];
  for (const [label, key] of keys) {
    const row = [label];
    sigs.forEach(s => {
      const v = s[key];
      row.push(typeof v === 'number' ? (Number.isFinite(v) ? fmt(v) : '') : (v ?? ''));
    });
    lines.push(row.join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'inversion_compare_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wireCmp() {
  ['#cmpC1','#cmpC2','#cmpC3','#cmpC4'].forEach(id =>
    $(id).addEventListener('change', () => {
      state.inversion_compare.candidates = _activeCandidates().map(c => c.candidate);
    }));
  $('#cmpRunBtn').addEventListener('click', _renderTable);
  $('#cmpResetBtn').addEventListener('click', () => {
    $('#cmpTable').innerHTML = '';
  });
  $('#cmpExportBtn').addEventListener('click', _exportTsv);
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _populateAll();
  wireCmp();
  _renderTable();
}

export async function unmount(root) {
  _setActiveState(null);
}
