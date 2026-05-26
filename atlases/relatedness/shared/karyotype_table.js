// atlases/relatedness/shared/karyotype_table.js
// =============================================================================
// Shared karyotype-matrix renderer + ancestry stripe + legend chip. Extracted
// verbatim from legacy Relatedness_atlas.js §7 (lines 877-984).
//
// Used by:
//   - pages/hub/network.js      — inline 5-row preview at the top of the
//                                 network page (subset of inversion columns)
//   - pages/hub/karyotypes.js   — full 12-row matrix on the dedicated tab
//
// The slot parameter accepts either a selector string or a DOM node. opts
// lets the caller override rows + columns (used by the karyotypes page to
// show all 12 individuals across Chr01..Chr28).
// =============================================================================

import { $, el } from './utils.js';
import { DEMO } from './demo_data.js';
import { karyoFor, getLiveInversions } from './karyotype_source.js';

export function renderKaryotypeTable(slot, opts = { rows: null, columns: null }) {
  const target = typeof slot === 'string' ? $(slot) : slot;
  if (!target) return;
  target.innerHTML = '';

  const rows = opts.rows || DEMO.individuals.slice(0, 5);
  const cols = opts.columns || ['Chr01','Chr02','Chr03','Chr04','Chr05','Chr06',
                                  null, 'Chr17','Chr18', null, 'Chr28'];

  // 2026-05-26: prefer the live inversion catalogue from the
  // karyotype_source so cell lookups join against the same IDs the
  // registry payload uses. Falls back to DEMO when live data isn't
  // loaded — same lookup table the page used before.
  const liveInvs = getLiveInversions();
  const chrCandidate = {};
  const invSource = (liveInvs && liveInvs.length > 0)
                    ? liveInvs
                    : DEMO.inversion_candidates_full;
  for (const inv of invSource) {
    if (!chrCandidate[inv.chromosome]) chrCandidate[inv.chromosome] = inv.candidate;
  }

  const table = el('table', { class: 'data-table' });
  const thead = el('thead');
  const tr = el('tr');
  tr.appendChild(el('th', { text: 'Ancestry' }));
  cols.forEach(c => tr.appendChild(el('th',
    { text: c === null ? '…' : c, style: { textAlign: 'center' } })));
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const ind of rows) {
    const r = el('tr');
    r.appendChild((function(){
      const td = el('td', null);
      const ancWrap = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        el('span', { class: 'sample-id', text: ind }),
        renderAncestryStripe(ind),
      );
      td.appendChild(ancWrap);
      return td;
    })());
    cols.forEach(c => {
      const td = el('td', { style: { textAlign: 'center' } });
      if (c === null) {
        td.textContent = '…';
        td.style.color = 'var(--ink-dimmer)';
      } else {
        const cand = chrCandidate[c];
        const k = cand ? karyoFor(ind)[cand] : null;
        let cls = 'kt-cell';
        if (k === '0/0') cls += ' kt-00';
        else if (k === '0/1') cls += ' kt-01';
        else if (k === '1/1') cls += ' kt-11';
        else cls += ' kt-na';
        let display = k || 'NA';
        if (ind === 'Ind_155' && k && k !== 'NA') {
          if (k === '0/0') display = 'STD/STD';
          else if (k === '0/1') display = 'STD/INV';
          else if (k === '1/1') display = 'INV/INV';
        }
        td.appendChild(el('span', { class: cls, text: display }));
      }
      r.appendChild(td);
    });
    tbody.appendChild(r);
  }
  table.appendChild(tbody);
  target.appendChild(table);

  const legend = el('div', { class: 'kt-legend' },
    legendChip('kt-00', '0/0 or STD/STD'),
    legendChip('kt-01', '0/1 or STD/INV'),
    legendChip('kt-11', '1/1 or INV/INV'),
    legendChip('kt-na', 'No call / missing'),
  );
  target.appendChild(legend);
}

export function legendChip(cls, label) {
  return el('div', { class: 'item' },
    el('span', { class: 'kt-cell ' + cls,
                 style: { width: '18px', height: '12px',
                          minWidth: '0', padding: '0' } }),
    el('span', { text: label })
  );
}

export function renderAncestryStripe(ind) {
  const wrap = el('div', { class: 'anc-stripe' });
  const q = DEMO.ancestry_q[ind] || [];
  q.forEach((p, k) => {
    if (p < 0.005) return;
    wrap.appendChild(el('span', {
      style: {
        width: (p * 100).toFixed(2) + '%',
        background: DEMO.ancestry_palette[k % DEMO.ancestry_palette.length],
      },
      title: 'K' + (k + 1) + ': ' + (p * 100).toFixed(1) + '%',
    }));
  });
  return wrap;
}
