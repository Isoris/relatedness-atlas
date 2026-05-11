// atlases/relatedness/shared/pop_summary.js
// =============================================================================
// Population Summary (left column bottom). Extracted from legacy
// Relatedness_atlas.js §5 (lines 777-799).
//
// Currently hard-coded counters that mirror the screenshot. Round 2 reads
// these from the .res file once the data layer is wired.
// =============================================================================

import { $, el } from './utils.js';

export function renderPopSummary() {
  const root = $('#popSummary');
  if (!root) return;
  root.innerHTML = '';
  const rows = [
    ['Individuals',          12, null],
    ['PO edges (strong)',     6, '<span class="legend-line" style="border-top-width:2.5px;"></span>'],
    ['PO edges (possible)',   4, '<span class="legend-line possible" style="border-top-width:1.5px;"></span>'],
    ['Ambiguous edges',       3, '<span class="legend-line ambig"></span>'],
    ['Mendelian warnings',    5, '<span class="legend-icon warn">⚠</span>'],
    ['Mendelian failures',    2, '<span class="legend-icon fail">⚐</span>'],
  ];
  for (const [lbl, val, ico] of rows) {
    const lblWrap = el('div', { class: 'pop-summary-label' });
    if (ico) lblWrap.innerHTML = ico + ' ' + lbl;
    else     lblWrap.textContent = lbl;
    root.appendChild(lblWrap);
    root.appendChild(el('div', { class: 'pop-summary-value', text: String(val) }));
  }
}
