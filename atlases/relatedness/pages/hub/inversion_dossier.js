// atlases/relatedness/pages/hub/inversion_dossier.js
// =============================================================================
// Per-inversion dossier (#19). Single-candidate aggregation view that
// reuses BDMI Test A logic + carrier-set tooling from inversion_meiosis.js
// + readiness checks. No new compute; pulls real signals where available
// and flags gated signals clearly.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { binomialPValueTwoSided, chiSquarePValue, expectedOffspringPrior } from '../../shared/stats.js';
import {
  carriersOf, controlsOf, parentalCarriersOf, parentalMeioses,
  carrierHubShare, focalChromOf, readinessLevels,
} from '../../shared/inversion_meiosis.js';
import { _setActiveState } from './inversion_dossier/_state.js';

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

function _populatePicker() {
  const sel = $('#idoCandidate');
  sel.innerHTML = '';
  const order = (c) => (c.status === 'pass' ? 0 : c.status === 'warn' ? 1 : 2);
  (DEMO.inversion_candidates_full || []).slice()
    .sort((a, b) => order(a) - order(b))
    .forEach(inv => sel.appendChild(el('option', {
      value: inv.candidate,
      text: `${inv.candidate} · ${inv.chromosome} ${inv.start_mb}–${inv.end_mb} · ${inv.status}`,
    })));
  sel.value = state.inversion_dossier.focus_candidate
    || (DEMO.inversion_candidates_full[0] && DEMO.inversion_candidates_full[0].candidate);
  state.inversion_dossier.focus_candidate = sel.value;
}

function _activeCandidate() {
  return (DEMO.inversion_candidates_full || []).find(c =>
    c.candidate === state.inversion_dossier.focus_candidate)
    || DEMO.inversion_candidates_full[0];
}

// ─── Identity ───────────────────────────────────────────────────────────

function _renderIdentity() {
  const slot = $('#idoIdentity');
  slot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
  slot.appendChild(_sumCell('candidate',  c.candidate));
  slot.appendChild(_sumCell('chromosome', c.chromosome));
  slot.appendChild(_sumCell('span (Mb)',  `${c.start_mb}–${c.end_mb}`,
    null, `length ${c.length_mb} Mb`));
  slot.appendChild(_sumCell('frequency',  fmt(c.frequency),
    c.frequency < 0.05 ? 'warn' : null));
  slot.appendChild(_sumCell('status',     c.status.toUpperCase(),
    c.status === 'pass' ? 'good' : c.status === 'warn' ? 'warn' : 'fail',
    c.notes || ''));
}

// ─── Karyotype distribution + HWE ──────────────────────────────────────

function _ktCounts(invId) {
  let n_00 = 0, n_01 = 0, n_11 = 0, n_NA = 0;
  for (const ind of DEMO.individuals) {
    const k = (DEMO.karyotype_matrix[ind] || {})[invId];
    if (k === '0/0') n_00++;
    else if (k === '0/1') n_01++;
    else if (k === '1/1') n_11++;
    else n_NA++;
  }
  return { n_00, n_01, n_11, n_NA };
}

function _renderKaryoDist() {
  const slot = $('#idoKaryoDist');
  const hweSlot = $('#idoHWE');
  slot.innerHTML = ''; hweSlot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
  const { n_00, n_01, n_11, n_NA } = _ktCounts(c.candidate);
  const n = n_00 + n_01 + n_11;
  const p = n > 0 ? (n_01 + 2 * n_11) / (2 * n) : NaN;
  const q = 1 - p;
  const exp_00 = q * q * n;
  const exp_01 = 2 * p * q * n;
  const exp_11 = p * p * n;
  let chi2 = 0;
  if (exp_00 > 0) chi2 += (n_00 - exp_00) ** 2 / exp_00;
  if (exp_01 > 0) chi2 += (n_01 - exp_01) ** 2 / exp_01;
  if (exp_11 > 0) chi2 += (n_11 - exp_11) ** 2 / exp_11;
  const chi2_p = chiSquarePValue(chi2, 1);

  slot.appendChild(_sumCell('typed n',   n,    n < 10 ? 'fail' : null));
  slot.appendChild(_sumCell('hom-ref',   n_00, null, `obs · exp ${exp_00.toFixed(1)}`));
  slot.appendChild(_sumCell('het',       n_01,
    n_01 === 0 ? 'warn' : null,
    `obs · exp ${exp_01.toFixed(1)}`));
  slot.appendChild(_sumCell('hom-alt',   n_11, null, `obs · exp ${exp_11.toFixed(1)}`));
  slot.appendChild(_sumCell('NA',        n_NA, n_NA / (n + n_NA) > 0.20 ? 'warn' : null));
  slot.appendChild(_sumCell('allele freq p', fmt(p)));
  slot.appendChild(_sumCell('HWE χ² p',  fmt(chi2_p),
    Number.isFinite(chi2_p) && chi2_p < 0.05 ? 'fail' : null,
    'BDMI Test B/C feed off this'));

  // Class-balance bar.
  if (n > 0) {
    const bar = el('div', { class: 'pwf-bar', style: { width: '320px', height: '12px',
      display: 'flex', overflow: 'hidden', borderRadius: '3px',
      border: '1px solid var(--rule)', marginTop: '4px' } },
      el('div', { style: { width: (n_00 / n * 100) + '%', background: 'var(--good)' },
                  title: `hom-ref ${n_00}` }),
      el('div', { style: { width: (n_01 / n * 100) + '%', background: 'var(--warn)' },
                  title: `het ${n_01}` }),
      el('div', { style: { width: (n_11 / n * 100) + '%', background: 'var(--bad)' },
                  title: `hom-alt ${n_11}` }),
    );
    hweSlot.appendChild(el('div', { class: 'meiosis-caption',
      text: 'Class proportions (hom-ref / het / hom-alt):' }));
    hweSlot.appendChild(bar);
  }
}

// ─── Carrier roster ────────────────────────────────────────────────────

function _renderCarriers() {
  const slot = $('#idoCarriers');
  slot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
  const carriers = carriersOf(c.candidate);
  if (!carriers.length) {
    slot.appendChild(el('div', { class: 'meiosis-caption',
      text: 'No carriers (no individual with 0/1 or 1/1) for this candidate.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Sample','Karyotype','Sex','Family']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  carriers.slice(0, 50).forEach(ind => {
    const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
    const fam = (DEMO.families || []).find(f => (f.members || []).includes(ind));
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: ind }));
    const kTd = el('td');
    kTd.appendChild(el('span', {
      class: 'kt-cell ' + (k === '0/1' ? 'kt-01' : k === '1/1' ? 'kt-11' : 'kt-na'),
      text: k }));
    row.appendChild(kTd);
    row.appendChild(el('td', { text: (DEMO.sex || {})[ind] || '?' }));
    row.appendChild(el('td', { text: fam ? fam.family_id : 'unassigned',
      style: fam ? {} : { color: 'var(--warn)' } }));
    tbody.appendChild(row);
  });
  if (carriers.length > 50) {
    const tr2 = el('tr');
    tr2.appendChild(el('td', { colspan: 4,
      text: `… ${carriers.length - 50} more rows omitted`,
      style: { textAlign: 'center', color: 'var(--ink-dim)',
               fontStyle: 'italic', padding: '8px' } }));
    tbody.appendChild(tr2);
  }
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Family-hub spread ─────────────────────────────────────────────────

function _renderHubSpread() {
  const slot = $('#idoHubSpread');
  slot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
  const carriers = carriersOf(c.candidate);
  const byFam = {};
  carriers.forEach(ind => {
    const f = (DEMO.families || []).find(f => (f.members || []).includes(ind));
    const id = f ? f.family_id : '(unassigned)';
    byFam[id] = (byFam[id] || 0) + 1;
  });
  const hs = carrierHubShare(carriers);
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Family','n carriers','% of carriers'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  Object.entries(byFam)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => {
      const row = el('tr');
      row.appendChild(el('td', { class: 'sample-id', text: f }));
      row.appendChild(el('td', { class: 'num', text: String(n) }));
      const pct = carriers.length ? (n / carriers.length * 100).toFixed(0) + '%' : '—';
      const pctTd = el('td', { class: 'num', text: pct });
      if (carriers.length && n / carriers.length >= 0.80) pctTd.style.color = 'var(--bad)';
      else if (carriers.length && n / carriers.length >= 0.60) pctTd.style.color = 'var(--warn)';
      row.appendChild(pctTd);
      tbody.appendChild(row);
    });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
  if (hs.share >= 0.80) {
    slot.appendChild(el('div', { class: 'ie-conclusion tier-conflict',
      style: { marginTop: '8px' },
      html: '<div class="verdict">FAMILY CONFOUNDED</div>'
          + `${(hs.share * 100).toFixed(0)}% of carriers are in <b>${hs.hub}</b>. `
          + `Any carrier-vs-non-carrier contrast on this candidate would mostly be measuring `
          + `that family hub, not the inversion itself.` }));
  }
}

// ─── Mendelian distortion (BDMI Test A) ────────────────────────────────

function _renderMendel() {
  const slot = $('#idoMendel');
  slot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
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
  const p = n_total > 0 ? binomialPValueTwoSided(n_inconsistent, n_total, 0.02) : NaN;
  const grid = el('div', { class: 'bdmi-summary' });
  grid.appendChild(_sumCell('triads informative', n_total));
  grid.appendChild(_sumCell('inconsistent', n_inconsistent,
    n_inconsistent > 0 ? 'fail' : null));
  grid.appendChild(_sumCell('Test A binomial p', fmt(p),
    Number.isFinite(p) && p < 0.01 ? 'fail'
    : Number.isFinite(p) && p < 0.05 ? 'warn' : null));
  slot.appendChild(grid);
  if (n_total === 0) {
    slot.appendChild(el('div', { class: 'meiosis-caption',
      text: 'No informative triad at this candidate. Mendelian distortion '
          + 'cannot be tested until more triads or denser typing exist.' }));
  }
}

// ─── Same-chromosome companions ────────────────────────────────────────

function _renderCompanions() {
  const slot = $('#idoCompanions');
  slot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
  const companions = (DEMO.inversion_candidates_full || []).filter(o =>
    o.candidate !== c.candidate && o.chromosome === c.chromosome);
  if (!companions.length) {
    slot.appendChild(el('div', { class: 'meiosis-caption',
      text: `${c.chromosome} has no other inversion candidate. Regime inheritance `
          + 'analyses need at least one same-chromosome partner.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Companion','Span (Mb)','Length','Freq','Status']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  companions.forEach(o => {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: o.candidate }));
    row.appendChild(el('td', { text: `${o.start_mb}–${o.end_mb}` }));
    row.appendChild(el('td', { class: 'num', text: String(o.length_mb) }));
    row.appendChild(el('td', { class: 'num', text: fmt(o.frequency) }));
    const stTd = el('td');
    stTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (o.status === 'pass' ? 'pass'
                                   : o.status === 'warn' ? 'warn' : 'fail'),
      text: o.status.toUpperCase() }));
    row.appendChild(stTd);
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Downstream readiness ──────────────────────────────────────────────

function _renderReadiness() {
  const slot = $('#idoReadiness');
  slot.innerHTML = '';
  const c = _activeCandidate();
  if (!c) return;
  const r = readinessLevels(c.candidate);
  const par = parentalCarriersOf(c.candidate);
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Analysis','Status','Note'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  const rows = [
    ['BDMI screen',           r.basic_ready ? 'READY' : 'BLOCKED',
       r.basic_ready ? 'karyotypes + ancestry + triads available'
                     : 'requires non-empty carrier + control sets'],
    ['Regime inheritance (linked-inv)', ((DEMO.inversion_candidates_full || [])
        .filter(o => o.chromosome === c.chromosome).length >= 2) ? 'READY' : 'BLOCKED',
       'requires ≥1 same-chromosome companion'],
    ['Regime inheritance (mechanism)',  r.basic_ready ? 'READY' : 'BLOCKED',
       'uses DEMO.triads'],
    ['Inv × meiosis scan (parental)',
       par.carriers.length >= 1 && par.controls.length >= 1 ? 'GATED' : 'BLOCKED',
       par.carriers.length >= 1 && par.controls.length >= 1
         ? `${par.carriers.length} carrier-parents · ${par.controls.length} non-carrier-parents · ${parentalMeioses(par.carriers, par.meiosis_counts)} carrier meioses · ngsTracts adapter pending`
         : 'no carrier-parents and/or no non-carrier-parents in DEMO.triads'],
    ['Inversion priority (composite)',  'GATED',
       'intra/inter effect signals synthetic until ngsTracts ships'],
    ['Marker panel design',             r.basic_ready ? 'PARTIAL' : 'BLOCKED',
       'focal markers real (from breakpoints); per-chrom grids + expected_DCO synthetic'],
  ];
  rows.forEach(([analysis, st, note]) => {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: analysis }));
    const stTd = el('td');
    const cls = st === 'READY'   ? 'pass'
              : st === 'PARTIAL' ? 'warn'
              : st === 'GATED'   ? 'warn'
              :                    'fail';
    stTd.appendChild(el('span', { class: 'status-pill-cell ' + cls, text: st }));
    row.appendChild(stTd);
    row.appendChild(el('td', { text: note,
      style: { fontSize: '9.5px', color: 'var(--ink-dim)' } }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Jump-links ────────────────────────────────────────────────────────

function _renderJump() {
  const slot = $('#idoJumpBody');
  if (!slot) return;
  const c = _activeCandidate();
  if (!c) { slot.innerHTML = ''; return; }
  const lines = [
    `<li><b>BDMI screen</b> — set scope to "current chromosome only" to focus on ${c.chromosome}; this candidate is one of the rows.</li>`,
    `<li><b>Regime inheritance</b> — set focal to <code>${c.candidate}</code> to compare against same-chromosome partners.</li>`,
    `<li><b>Mendelian tab</b> — run Test A directly on this candidate via dyad or triad mode.</li>`,
    `<li><b>Compatibility</b> — pick a carrier from this candidate's roster as the focal individual; set scope to "single candidate".</li>`,
    `<li><b>Inv × meiosis</b> — set focal to <code>${c.candidate}</code> for the family-aware scan once ngsTracts ships.</li>`,
  ];
  slot.innerHTML = '<ul style="margin: 4px 0 0 18px; padding: 0;">' + lines.join('') + '</ul>';
}

function _drawAll() {
  _renderIdentity();
  _renderKaryoDist();
  _renderCarriers();
  _renderHubSpread();
  _renderMendel();
  _renderCompanions();
  _renderReadiness();
  _renderJump();
}

function wireIdo() {
  $('#idoCandidate').addEventListener('change', e => {
    state.inversion_dossier.focus_candidate = e.target.value;
    _drawAll();
  });
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _populatePicker();
  wireIdo();
  _drawAll();
}

export async function unmount(root) {
  _setActiveState(null);
}
