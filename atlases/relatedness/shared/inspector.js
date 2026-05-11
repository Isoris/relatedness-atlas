// atlases/relatedness/shared/inspector.js
// =============================================================================
// Inspector / Stats (right column). Extracted from legacy
// Relatedness_atlas.js §10 (lines 2942-3045).
//
// Reads state.inspector_pair + DEMO.pairwise_stats and renders:
//   - the (A × B) pair header with swap button
//   - the k0/k1/k2/kinship/IBS0/PO-distance/relationship_class grid
//   - the PASS/WARN/FAIL counter row + stacked bar
//   - the Mendelian-check sub-panel (per-chromosome conflicts breakdown)
//
// Subscribes to 'individual_changed' on the page_hooks bus so a click on the
// Population Browser tree re-renders the Inspector regardless of which page
// is currently mounted in the center column.
// =============================================================================

import { $, el, fmt } from './utils.js';
import { DEMO } from './demo_data.js';
import { state } from './state.js';
import { on } from './page_hooks.js';

export function renderInspector() {
  const pair = state.inspector_pair;
  const sel = $('#insSelection');
  if (!sel) return;        // running in a context without the chrome DOM
  sel.innerHTML = '<a href="#" style="color: var(--accent); text-decoration: none;">' +
    pair.a + '</a> <span class="x">×</span> <a href="#" style="color: var(--accent); text-decoration: none;">' +
    pair.b + '</a>';

  const stats = DEMO.pairwise_stats[pair.b] || DEMO.pairwise_stats['Ind_044'];
  const grid = $('#insStatsGrid');
  grid.innerHTML = '';
  function addRow(lbl, val, type = '') {
    grid.appendChild(el('div', { class: 'ins-stat-label', text: lbl }));
    grid.appendChild(el('div', { class: 'ins-stat-value' + (type ? ' ' + type : ''),
                                  text: val }));
  }
  addRow('k0 (IBS0)', fmt(stats.k0));
  addRow('Kinship (φ)', fmt(stats.kinship));
  addRow('k1 (IBS1)', fmt(stats.k1));
  addRow('IBS0', fmt(stats.IBS0));
  addRow('k2 (IBS2)', fmt(stats.k2));
  addRow('PO distance', stats.PO_distance.toFixed(0));
  grid.appendChild(el('div', { class: 'ins-stat-label', text: '' }));
  grid.appendChild(el('div', { class: 'ins-stat-label', text: '' }));
  grid.appendChild(el('div', { class: 'ins-stat-label', text: 'Relationship class' }));
  let cls = 'tag good';
  if (stats.relationship_class.includes('possible')) cls = 'tag warn';
  else if (stats.relationship_class.includes('ambiguous')) cls = 'tag fail';
  grid.appendChild(el('div', {
    class: 'ins-stat-value ' + cls,
    text: stats.relationship_class,
    style: { textAlign: 'right' },
  }));

  // PASS/WARN/FAIL counter row
  const pwfRoot = $('#passWarnFail');
  pwfRoot.innerHTML = '';
  const cells = [
    { lbl: 'PASS',  val: stats.PASS,  cls: 'pass' },
    { lbl: 'WARN',  val: stats.WARN,  cls: 'warn' },
    { lbl: 'FAIL',  val: stats.FAIL,  cls: 'fail' },
    { lbl: 'TOTAL', val: stats.TOTAL, cls: '' },
  ];
  cells.forEach(c => {
    pwfRoot.appendChild(el('div', { class: 'pwf-cell ' + c.cls },
      el('div', { class: 'pwf-label', text: c.lbl }),
      el('div', { class: 'pwf-value', text: String(c.val) })
    ));
  });

  const total = stats.TOTAL || 1;
  const ppct = (stats.PASS / total * 100);
  const wpct = (stats.WARN / total * 100);
  const fpct = (stats.FAIL / total * 100);
  $('#pwfBar').innerHTML =
    `<div class="pwf-bar-pass" style="width:${ppct}%"></div>` +
    `<div class="pwf-bar-warn" style="width:${wpct}%"></div>` +
    `<div class="pwf-bar-fail" style="width:${fpct}%"></div>`;
  $('#pwfPcts').innerHTML =
    `<span>${ppct.toFixed(1)}%</span><span>${wpct.toFixed(1)}%</span><span>${fpct.toFixed(1)}%</span>`;

  // Mendelian-check sub-panel
  $('#mendCheckPair').textContent = '(' + pair.a + ' × ' + pair.b + ')';
  const mtbl = $('#mendCheckTable');
  const tbody = mtbl.querySelector('tbody');
  tbody.innerHTML = '';
  const chrSamples = [
    { chr: 'Chr03', status: stats.WARN > 0 ? 'warn' : 'pass',
      conflicts: stats.WARN > 0 ? 2 : 0 },
    { chr: 'Chr17', status: stats.FAIL > 0 ? 'fail' : 'pass',
      conflicts: stats.FAIL > 0 ? Math.max(5, stats.FAIL * 2) : 0 },
    { chr: 'Chr28', status: 'pass', conflicts: 0 },
    { chr: '…',     status: null,   conflicts: '…' },
  ];
  chrSamples.forEach(row => {
    const tr = el('tr');
    tr.appendChild(el('td', { text: row.chr }));
    if (row.status) {
      const tdSt = el('td');
      tdSt.appendChild(el('span', {
        class: 'status-pill-cell ' + row.status,
        text: row.status.toUpperCase(),
      }));
      tr.appendChild(tdSt);
    } else {
      tr.appendChild(el('td', { text: '' }));
    }
    tr.appendChild(el('td', { class: 'num', text: String(row.conflicts) }));
    tbody.appendChild(tr);
  });
  $('#mendCheckTotal').textContent = String(
    stats.WARN * 2 + Math.max(5, stats.FAIL * 2 || 0)
  );
}

export function wireInspector() {
  const swap = $('#insSwapBtn');
  if (swap && !swap.dataset.wired) {
    swap.dataset.wired = '1';
    swap.addEventListener('click', () => {
      const p = state.inspector_pair;
      state.inspector_pair = { a: p.b, b: p.a };
      renderInspector();
    });
  }
  // Auto-rerender when the Population Browser tree drives a new selection.
  on('individual_changed', () => renderInspector());
}
