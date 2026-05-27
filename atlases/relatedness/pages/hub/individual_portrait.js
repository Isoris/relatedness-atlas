// atlases/relatedness/pages/hub/individual_portrait.js
// =============================================================================
// Per-individual portrait (#18). Read-only aggregation page that pulls
// every existing data product into one single-sample dossier. No new
// compute; no synthetic data; karyotype + pedigree-side only.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { sexBadgeHtml } from '../../shared/sex_badge.js';
import { renderAncestryStripe } from '../../shared/karyotype_table.js';
import { on } from '../../shared/page_hooks.js';
import { _setActiveState } from './individual_portrait/_state.js';

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
  const sel = $('#ipSample');
  sel.innerHTML = '';
  (DEMO.individuals || []).forEach(ind => sel.appendChild(el('option',
    { value: ind, text: ind })));
  sel.value = state.individual_portrait.focus_individual
    || DEMO.individuals[0];
  state.individual_portrait.focus_individual = sel.value;
}

function _familyOf(ind) {
  const f = (DEMO.families || []).find(f => (f.members || []).includes(ind));
  return f || null;
}

function _isHub(ind) {
  const f = _familyOf(ind);
  return f && f.hub_individual === ind;
}

// ─── Identity card ──────────────────────────────────────────────────────

function _renderIdentity() {
  const slot = $('#ipIdentity');
  slot.innerHTML = '';
  const ind = state.individual_portrait.focus_individual;
  if (!ind) return;
  const sex = (DEMO.sex || {})[ind] || '?';
  const fam = _familyOf(ind);
  const role = !fam ? 'unassigned' : (_isHub(ind) ? 'HUB' : 'member');
  slot.appendChild(_sumCell('sample_id', ind));
  const sxCell = _sumCell('sex', '');
  sxCell.querySelector('.val').innerHTML = sexBadgeHtml(ind) + ' ' + sex;
  slot.appendChild(sxCell);
  slot.appendChild(_sumCell('family', fam ? fam.family_id : '—',
    fam ? null : 'warn'));
  slot.appendChild(_sumCell('role',  role,
    role === 'HUB' ? 'good' : (role === 'unassigned' ? 'warn' : null)));
}

// ─── Ancestry breakdown ─────────────────────────────────────────────────

function _renderAncestry() {
  const slot = $('#ipAncestry');
  slot.innerHTML = '';
  const ind = state.individual_portrait.focus_individual;
  if (!ind) return;
  const q = DEMO.ancestry_q[ind] || [];
  if (!q.length) {
    slot.appendChild(el('div', { class: 'meiosis-caption',
      text: 'No ancestry vector for this sample.' }));
    return;
  }
  // Stripe.
  slot.appendChild(renderAncestryStripe(ind));
  // Per-K row table.
  const tbl = el('table', { class: 'data-table', style: { marginTop: '8px' } });
  const thead = el('thead'); const tr = el('tr');
  ['K', 'Q', '%'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  q.forEach((v, k) => {
    const row = el('tr');
    const swatch = el('span', {
      class: 'kt-cell',
      style: { background: DEMO.ancestry_palette[k % DEMO.ancestry_palette.length],
               width: '14px', height: '14px', display: 'inline-block',
               marginRight: '6px', verticalAlign: 'middle' },
    });
    const kTd = el('td');
    kTd.appendChild(swatch);
    kTd.appendChild(document.createTextNode('K' + (k + 1)));
    row.appendChild(kTd);
    row.appendChild(el('td', { class: 'num', text: fmt(v) }));
    row.appendChild(el('td', { class: 'num', text: (v * 100).toFixed(1) + '%' }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Relationships ──────────────────────────────────────────────────────

function _renderRelationships() {
  const slot = $('#ipRelationships');
  slot.innerHTML = '';
  const ind = state.individual_portrait.focus_individual;
  if (!ind) return;
  // pairwise_stats in DEMO is keyed by partner_id (always vs Ind_001). Show
  // edges incident on this sample from DEMO.network_edges as the more
  // honest relationship table.
  const edges = (DEMO.network_edges || []).filter(e =>
    e.a === ind || e.b === ind);
  if (!edges.length && !((DEMO.pairwise_stats || {})[ind])) {
    slot.appendChild(el('div', { class: 'meiosis-caption',
      text: 'No incident edges in DEMO.network_edges for this sample. '
          + 'When real ngsRelate output loads, this table will populate.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Partner','Edge class','Relationship vs hub','kinship','PO distance']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  edges.forEach(e => {
    const other = e.a === ind ? e.b : e.a;
    const stat = (DEMO.pairwise_stats || {})[other];
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: other }));
    const clsTd = el('td');
    const cls = e.class === 'strong_po' ? 'pass'
              : e.class === 'possible_po' ? 'warn'
              : 'fail';
    clsTd.appendChild(el('span', { class: 'status-pill-cell ' + cls, text: e.class }));
    row.appendChild(clsTd);
    row.appendChild(el('td', { text: stat ? (stat.relationship_class || '—') : '—',
      style: stat ? {} : { color: 'var(--ink-dimmer)' } }));
    row.appendChild(el('td', { class: 'num', text: stat ? fmt(stat.kinship) : '—' }));
    row.appendChild(el('td', { class: 'num', text: stat ? String(stat.PO_distance ?? '—') : '—' }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Karyotype profile ──────────────────────────────────────────────────

function _renderKaryotype() {
  const sumSlot = $('#ipKaryoSummary');
  const brSlot = $('#ipKaryoBreakdown');
  sumSlot.innerHTML = ''; brSlot.innerHTML = '';
  const ind = state.individual_portrait.focus_individual;
  if (!ind) return;
  const candidates = DEMO.inversion_candidates_full || [];
  let n_00 = 0, n_01 = 0, n_11 = 0, n_NA = 0;
  for (const c of candidates) {
    const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
    if (k === '0/0') n_00++;
    else if (k === '0/1') n_01++;
    else if (k === '1/1') n_11++;
    else n_NA++;
  }
  const total = candidates.length;
  const typed = n_00 + n_01 + n_11;
  const pct = (n, d) => d ? ((n / d) * 100).toFixed(1) + '%' : '—';
  sumSlot.appendChild(_sumCell('candidates', total));
  sumSlot.appendChild(_sumCell('% typed', pct(typed, total),
    total && typed / total < 0.80 ? 'warn' : 'good'));
  sumSlot.appendChild(_sumCell('hom-ref (0/0)', n_00, null, pct(n_00, typed)));
  sumSlot.appendChild(_sumCell('het (0/1)', n_01, n_01 === 0 ? 'warn' : null, pct(n_01, typed)));
  sumSlot.appendChild(_sumCell('hom-alt (1/1)', n_11, null, pct(n_11, typed)));
  sumSlot.appendChild(_sumCell('missing (NA)', n_NA,
    n_NA / total > 0.20 ? 'warn' : null, pct(n_NA, total)));

  // Per-status breakdown — focal candidates this sample carries.
  const carriedCandidates = candidates.filter(c => {
    const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
    return k === '0/1' || k === '1/1';
  });
  if (carriedCandidates.length) {
    brSlot.appendChild(el('div', { class: 'meiosis-caption',
      text: `This sample carries ${carriedCandidates.length} inversion arrangement`
          + `${carriedCandidates.length === 1 ? '' : 's'} (het or hom-alt). `
          + `Top 10 by frequency shown below.` }));
    const tbl = el('table', { class: 'data-table' });
    const thead = el('thead'); const tr = el('tr');
    ['Candidate','Chrom','Span (Mb)','Length (Mb)','Freq','Status','Karyotype']
      .forEach(h => tr.appendChild(el('th', { text: h })));
    thead.appendChild(tr); tbl.appendChild(thead);
    const tbody = el('tbody');
    carriedCandidates
      .slice()
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .forEach(c => {
        const row = el('tr');
        row.appendChild(el('td', { class: 'sample-id', text: c.candidate }));
        row.appendChild(el('td', { text: c.chromosome }));
        row.appendChild(el('td', { text: `${c.start_mb}–${c.end_mb}` }));
        row.appendChild(el('td', { class: 'num', text: String(c.length_mb) }));
        row.appendChild(el('td', { class: 'num', text: fmt(c.frequency) }));
        const stTd = el('td');
        stTd.appendChild(el('span', {
          class: 'status-pill-cell ' + (c.status === 'pass' ? 'pass'
                                       : c.status === 'warn' ? 'warn' : 'fail'),
          text: c.status.toUpperCase(),
        }));
        row.appendChild(stTd);
        const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
        const kTd = el('td');
        kTd.appendChild(el('span', { class: 'kt-cell '
          + (k === '0/0' ? 'kt-00' : k === '0/1' ? 'kt-01' : k === '1/1' ? 'kt-11' : 'kt-na'),
          text: k || 'NA' }));
        row.appendChild(kTd);
        tbody.appendChild(row);
      });
    tbl.appendChild(tbody);
    brSlot.appendChild(tbl);
  }
}

// ─── Triad role ────────────────────────────────────────────────────────

function _renderTriads() {
  const slot = $('#ipTriads');
  slot.innerHTML = '';
  const ind = state.individual_portrait.focus_individual;
  if (!ind) return;
  const asParentA = (DEMO.triads || []).filter(t => t.parent_a === ind);
  const asParentB = (DEMO.triads || []).filter(t => t.parent_b === ind);
  const asOff     = (DEMO.triads || []).filter(t => t.offspring === ind);
  const all = [...asParentA.map(t => ({ ...t, role: 'parent_a' })),
               ...asParentB.map(t => ({ ...t, role: 'parent_b' })),
               ...asOff.map(t => ({ ...t, role: 'offspring' }))];
  if (!all.length) {
    slot.appendChild(el('div', { class: 'meiosis-caption',
      text: 'This sample does not appear in any triad in DEMO.triads.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Triad','Role','Parent_a','Parent_b','Offspring','Valid?']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  all.forEach(t => {
    const qc = (DEMO.trio_qc || {})[t.id] || {};
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: t.id }));
    const rTd = el('td');
    rTd.appendChild(el('span', {
      class: 'fms-rel-pill ' + (t.role === 'offspring' ? 'inter' : 'intra'),
      text: t.role.toUpperCase(),
    }));
    row.appendChild(rTd);
    row.appendChild(el('td', { text: t.parent_a }));
    row.appendChild(el('td', { text: t.parent_b }));
    row.appendChild(el('td', { text: t.offspring }));
    const vTd = el('td');
    vTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (qc.valid === false ? 'fail' : 'pass'),
      text: qc.valid === false ? 'INVALID' : 'OK',
    }));
    row.appendChild(vTd);
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Burden ────────────────────────────────────────────────────────────

function _renderBurden() {
  const slot = $('#ipBurden');
  slot.innerHTML = '';
  const ind = state.individual_portrait.focus_individual;
  if (!ind) return;
  const candidates = DEMO.inversion_candidates_full || [];
  let n_het = 0, n_hom_alt = 0;
  let n_pass_carrier = 0, n_warn_carrier = 0, n_fail_carrier = 0;
  for (const c of candidates) {
    const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
    if (k === '0/1') n_het++;
    else if (k === '1/1') n_hom_alt++;
    if (k === '0/1' || k === '1/1') {
      if (c.status === 'pass') n_pass_carrier++;
      else if (c.status === 'warn') n_warn_carrier++;
      else if (c.status === 'fail') n_fail_carrier++;
    }
  }
  slot.appendChild(_sumCell('inversion burden', n_het + n_hom_alt,
    null, `${n_het} het · ${n_hom_alt} hom-alt`));
  slot.appendChild(_sumCell('carries PASS', n_pass_carrier));
  slot.appendChild(_sumCell('carries WARN', n_warn_carrier, n_warn_carrier > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('carries FAIL', n_fail_carrier, n_fail_carrier > 0 ? 'fail' : null));
}

// ─── Jump-links ────────────────────────────────────────────────────────

function _renderJump() {
  const slot = $('#ipJumpBody');
  if (!slot) return;
  const ind = state.individual_portrait.focus_individual;
  if (!ind) { slot.innerHTML = ''; return; }
  const inAnyTriad = (DEMO.triads || []).some(t =>
    t.parent_a === ind || t.parent_b === ind || t.offspring === ind);
  const fam = _familyOf(ind);
  const lines = [];
  lines.push(`<li><b>Compatibility</b> — set <code>${ind}</code> as the focal individual; the breeding planner will rank partners.</li>`);
  if (inAnyTriad) {
    lines.push(`<li><b>Mendelian</b> — this sample appears in at least one triad and can be picked as parent_a / parent_b / offspring.</li>`);
    lines.push(`<li><b>BDMI Test A · Regimes mechanism classifier</b> — both use DEMO.triads; this sample contributes meioses to those scans.</li>`);
  }
  if (fam) {
    lines.push(`<li><b>Family deep-dive</b> — open <code>${fam.family_id}</code> for the wider hub roster, sex/ancestry composition, and within-hub edges.</li>`);
  }
  if (!lines.length) {
    lines.push('<li><i>No downstream analysis usable today for this sample.</i></li>');
  }
  slot.innerHTML = '<ul style="margin: 4px 0 0 18px; padding: 0;">' + lines.join('') + '</ul>';
}

function _drawAll() {
  _renderIdentity();
  _renderAncestry();
  _renderRelationships();
  _renderKaryotype();
  _renderTriads();
  _renderBurden();
  _renderJump();
}

function wireIp() {
  $('#ipSample').addEventListener('change', e => {
    state.individual_portrait.focus_individual = e.target.value;
    _drawAll();
  });
}

let _unsubInd = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _populatePicker();
  wireIp();
  _drawAll();
  _unsubInd = on('individual_changed', () => {
    if (state.selected_individual
        && state.selected_individual !== state.individual_portrait.focus_individual) {
      state.individual_portrait.focus_individual = state.selected_individual;
      $('#ipSample').value = state.selected_individual;
      _drawAll();
    }
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  _unsubInd = null;
}
