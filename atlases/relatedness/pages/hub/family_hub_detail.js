// atlases/relatedness/pages/hub/family_hub_detail.js
// =============================================================================
// Family-hub deep-dive (#16). Pure pedigree-side roster view. Aggregates
// the data the other pages already consume — no new compute, no new shared
// module. Reads DEMO.families / DEMO.sex / DEMO.ancestry_q / DEMO.network_edges
// / DEMO.triads / DEMO.trio_qc / DEMO.karyotype_matrix / DEMO.pairwise_stats.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { sexBadgeHtml } from '../../shared/sex_badge.js';
import { renderAncestryStripe } from '../../shared/karyotype_table.js';
import { on } from '../../shared/page_hooks.js';
import { _setActiveState } from './family_hub_detail/_state.js';

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

function _populateFamilyPicker() {
  const sel = $('#fhdFamily');
  sel.innerHTML = '';
  (DEMO.families || []).forEach(f => {
    sel.appendChild(el('option', { value: f.family_id,
      text: `${f.family_id} · n=${f.n}` + (f.hub_individual ? ` · hub=${f.hub_individual}` : '') }));
  });
  sel.value = state.family_hub_detail.focus_family
    || (DEMO.families[0] && DEMO.families[0].family_id);
  state.family_hub_detail.focus_family = sel.value;
}

function _activeFamily() {
  return (DEMO.families || []).find(f => f.family_id === state.family_hub_detail.focus_family)
      || DEMO.families[0];
}

function _renderSummary() {
  const slot = $('#fhdSummary');
  slot.innerHTML = '';
  const fam = _activeFamily();
  if (!fam) return;
  const triadsInHub = (DEMO.triads || []).filter(t =>
    fam.members.includes(t.parent_a) &&
    fam.members.includes(t.parent_b) &&
    fam.members.includes(t.offspring));
  slot.appendChild(_sumCell('family_id',        fam.family_id));
  slot.appendChild(_sumCell('n members',        fam.n,
    fam.n < 3 ? 'fail' : (fam.n < 5 ? 'warn' : null)));
  slot.appendChild(_sumCell('hub individual',   fam.hub_individual || '—',
    fam.hub_individual ? null : 'warn',
    fam.hub_individual ? '' : 'no hub assigned'));
  slot.appendChild(_sumCell('triads in hub',    triadsInHub.length,
    triadsInHub.length === 0 ? 'warn' : null));
}

function _renderMembers() {
  const slot = $('#fhdMembers');
  slot.innerHTML = '';
  const fam = _activeFamily();
  if (!fam) return;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Member','Sex','Ancestry','Relationship to hub','k0/k1/k2','Kinship','PO distance','Role']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  fam.members.forEach(ind => {
    const t = el('tr');
    t.appendChild(el('td', { class: 'sample-id', text: ind }));
    const sxTd = el('td'); sxTd.innerHTML = sexBadgeHtml(ind); t.appendChild(sxTd);
    const ancTd = el('td');
    ancTd.appendChild(renderAncestryStripe(ind));
    t.appendChild(ancTd);
    // Relationship vs hub from DEMO.pairwise_stats (keyed by partner_id).
    const stat = (DEMO.pairwise_stats || {})[ind];
    t.appendChild(el('td', { text: stat ? (stat.relationship_class || '—') : '—',
      style: stat ? {} : { color: 'var(--ink-dimmer)' } }));
    t.appendChild(el('td', { class: 'num',
      text: stat ? `${fmt(stat.k0)} / ${fmt(stat.k1)} / ${fmt(stat.k2)}` : '—' }));
    t.appendChild(el('td', { class: 'num',
      text: stat ? fmt(stat.kinship) : '—' }));
    t.appendChild(el('td', { class: 'num',
      text: stat ? String(stat.PO_distance ?? '—') : '—' }));
    t.appendChild(el('td', { text: ind === fam.hub_individual ? 'HUB' : 'member',
      style: { fontWeight: ind === fam.hub_individual ? '600' : '400' } }));
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _renderComposition() {
  const slot = $('#fhdComposition');
  slot.innerHTML = '';
  const fam = _activeFamily();
  if (!fam) return;
  // Sex breakdown.
  const sxCounts = { F: 0, M: 0, '?': 0 };
  fam.members.forEach(ind => {
    const sx = ((DEMO.sex || {})[ind] || '?').toUpperCase();
    sxCounts[sx === 'F' ? 'F' : sx === 'M' ? 'M' : '?']++;
  });
  slot.appendChild(_sumCell('sex F / M / ?', `${sxCounts.F} / ${sxCounts.M} / ${sxCounts['?']}`,
    sxCounts['?'] > 0 ? 'warn' : null));
  // Mean ancestry vector.
  const K = (DEMO.ancestry_palette || []).length;
  const meanQ = new Array(K).fill(0);
  let n = 0;
  fam.members.forEach(ind => {
    const q = DEMO.ancestry_q[ind] || [];
    if (!q.length) return;
    n++;
    for (let k = 0; k < K; k++) meanQ[k] += (q[k] || 0);
  });
  for (let k = 0; k < K; k++) meanQ[k] = n ? meanQ[k] / n : 0;
  // Dominant K = argmax.
  let dominant = 0;
  for (let k = 1; k < K; k++) if (meanQ[k] > meanQ[dominant]) dominant = k;
  slot.appendChild(_sumCell('dominant ancestry K',
    'K' + (dominant + 1),
    null,
    (meanQ[dominant] * 100).toFixed(1) + '% mean Q'));
  // Mean K1, K2 string.
  const topThree = meanQ
    .map((v, k) => ({ k, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3);
  slot.appendChild(_sumCell('top-3 K mix',
    topThree.map(t => `K${t.k+1}=${(t.v*100).toFixed(0)}%`).join(' · ')));
  // Ancestry spread = L1 distance between each member and the mean.
  let spread = 0;
  fam.members.forEach(ind => {
    const q = DEMO.ancestry_q[ind] || [];
    if (!q.length) return;
    let d = 0;
    for (let k = 0; k < K; k++) d += Math.abs((q[k] || 0) - meanQ[k]);
    spread += d;
  });
  spread /= Math.max(1, n);
  slot.appendChild(_sumCell('ancestry spread (L1)', fmt(spread),
    spread >= 0.50 ? 'warn' : null,
    'mean |member − family-mean|; >0.50 → heterogeneous hub'));
}

function _renderEdges() {
  const slot = $('#fhdEdges');
  slot.innerHTML = '';
  const fam = _activeFamily();
  if (!fam) return;
  const within = (DEMO.network_edges || []).filter(e =>
    fam.members.includes(e.a) && fam.members.includes(e.b));
  const counts = { strong_po: 0, possible_po: 0, ambiguous: 0, mendelian_conflict: 0 };
  within.forEach(e => { if (counts[e.class] !== undefined) counts[e.class]++; });
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Class','Count'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  [['strong PO','strong_po'],['possible PO','possible_po'],
   ['ambiguous','ambiguous'],['Mendelian conflict','mendelian_conflict']]
    .forEach(([label, key]) => {
      const t = el('tr');
      t.appendChild(el('td', { class: 'sample-id', text: label }));
      t.appendChild(el('td', { class: 'num', text: String(counts[key]),
        style: { color: counts[key] > 0 && key.includes('conflict') ? 'var(--bad)'
                      : counts[key] > 0 && key === 'ambiguous' ? 'var(--warn)'
                      : '' } }));
      tbody.appendChild(t);
    });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
  if (within.length === 0) {
    slot.appendChild(el('div', {
      style: { fontSize: '10px', color: 'var(--ink-dim)',
               marginTop: '4px', fontStyle: 'italic' },
      text: 'No within-hub edges in DEMO.network_edges for this family. '
          + 'When real ngsRelate output loads, this table will populate.',
    }));
  }
}

function _renderTriads() {
  const slot = $('#fhdTriads');
  slot.innerHTML = '';
  const fam = _activeFamily();
  if (!fam) return;
  const triadsInHub = (DEMO.triads || []).filter(t =>
    fam.members.includes(t.parent_a) &&
    fam.members.includes(t.parent_b) &&
    fam.members.includes(t.offspring));
  if (!triadsInHub.length) {
    slot.appendChild(el('div', { class: 'ie-conclusion tier-warn-family',
      html: '<div class="verdict">NO TRIADS IN THIS HUB</div>'
          + 'No triad in DEMO.triads has all three samples inside this family. '
          + 'Mendelian / BDMI / Inv × meiosis cannot use this hub as input until triads exist.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Triad','Parent A','Parent B','Offspring','PO_a','PO_b','GW Mend err','Anc dist','Valid?']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  triadsInHub.forEach(t => {
    const qc = (DEMO.trio_qc || {})[t.id] || {};
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: t.id }));
    row.appendChild(el('td', { text: t.parent_a }));
    row.appendChild(el('td', { text: t.parent_b }));
    row.appendChild(el('td', { text: t.offspring }));
    row.appendChild(el('td', { text: qc.po_a || '—' }));
    row.appendChild(el('td', { text: qc.po_b || '—' }));
    const meTd = el('td', { class: 'num', text: fmt(qc.gw_mend_error) });
    if (qc.gw_mend_error > 0.02) meTd.style.color = 'var(--bad)';
    row.appendChild(meTd);
    const adTd = el('td', { class: 'num', text: fmt(qc.anc_dist) });
    if (qc.anc_dist > 0.25) adTd.style.color = 'var(--warn)';
    row.appendChild(adTd);
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

function _renderInformativeness() {
  const slot = $('#fhdInformativeness');
  slot.innerHTML = '';
  const fam = _activeFamily();
  if (!fam) return;
  const candidates = DEMO.inversion_candidates_full || [];
  if (!candidates.length) return;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Member','n typed','n NA','% typed','homozygous-ref %','het %','homozygous-alt %']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  fam.members.forEach(ind => {
    const row = el('tr');
    let n_typed = 0, n_NA = 0, n_00 = 0, n_01 = 0, n_11 = 0;
    candidates.forEach(c => {
      const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
      if (k === '0/0') { n_typed++; n_00++; }
      else if (k === '0/1') { n_typed++; n_01++; }
      else if (k === '1/1') { n_typed++; n_11++; }
      else { n_NA++; }
    });
    const total = n_typed + n_NA;
    const pct = (n, d) => d ? ((n / d) * 100).toFixed(1) + '%' : '—';
    row.appendChild(el('td', { class: 'sample-id', text: ind }));
    row.appendChild(el('td', { class: 'num', text: String(n_typed) }));
    row.appendChild(el('td', { class: 'num', text: String(n_NA),
      style: { color: n_NA / total > 0.20 ? 'var(--warn)' : '' } }));
    const pctTd = el('td', { class: 'num', text: pct(n_typed, total) });
    if (total && n_typed / total < 0.80) pctTd.style.color = 'var(--warn)';
    row.appendChild(pctTd);
    row.appendChild(el('td', { class: 'num', text: pct(n_00, n_typed) }));
    row.appendChild(el('td', { class: 'num', text: pct(n_01, n_typed) }));
    row.appendChild(el('td', { class: 'num', text: pct(n_11, n_typed) }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _renderJumpLinks() {
  const slot = $('#fhdJumpBody');
  if (!slot) return;
  const fam = _activeFamily();
  if (!fam) { slot.innerHTML = ''; return; }
  const triadsInHub = (DEMO.triads || []).filter(t =>
    fam.members.includes(t.parent_a) &&
    fam.members.includes(t.parent_b) &&
    fam.members.includes(t.offspring));
  const lines = [];
  if (fam.members.length >= 2) {
    lines.push(`<li><b>Mendelian / Compatibility</b> — open the Mendelian tab and select members of <b>${fam.family_id}</b> as dyad / triad inputs.</li>`);
  }
  if (triadsInHub.length >= 1) {
    lines.push(`<li><b>BDMI Test A · Regimes mechanism classifier</b> — uses DEMO.triads; ${triadsInHub.length} triad${triadsInHub.length === 1 ? '' : 's'} in this hub feed those analyses.</li>`);
  }
  if (fam.members.length >= 4 && triadsInHub.length >= 1) {
    lines.push(`<li><b>Inv × meiosis scan</b> — this hub has enough members for a family-aware permutation null (once the ngsTracts CO call adapter ships).</li>`);
  }
  if (!lines.length) {
    lines.push('<li><i>Hub too small or has no triads — not usable as an analysis anchor today.</i></li>');
  }
  slot.innerHTML = '<ul style="margin: 4px 0 0 18px; padding: 0;">' + lines.join('') + '</ul>';
}

function _drawAll() {
  _renderSummary();
  _renderMembers();
  _renderComposition();
  _renderEdges();
  _renderTriads();
  _renderInformativeness();
  _renderJumpLinks();
}

function wireFhd() {
  $('#fhdFamily').addEventListener('change', e => {
    state.family_hub_detail.focus_family = e.target.value;
    _drawAll();
  });
}

let _unsubFam = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _populateFamilyPicker();
  wireFhd();
  _drawAll();
  _unsubFam = on('family_changed', () => {
    if (state.selected_family
        && state.selected_family !== state.family_hub_detail.focus_family) {
      state.family_hub_detail.focus_family = state.selected_family;
      $('#fhdFamily').value = state.selected_family;
      _drawAll();
    }
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubFam) _unsubFam();
  _unsubFam = null;
}
