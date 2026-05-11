// atlases/relatedness/pages/hub/network.js
// =============================================================================
// Network page — sub-tab #1 (Family / Individual Evidence Hub).
// Extracted from legacy Relatedness_atlas.js §6 (lines 802-871).
//
// Renders an SVG node-link diagram of the focal individual + every edge
// incident to them in DEMO.network_edges. Clicking a node calls
// shared/pop_tree.js::selectIndividual which emits 'individual_changed' so
// the Inspector + other pages stay in sync.
//
// The page also hosts the inline previews of the Karyotypes (top 5 rows) and
// Inversion candidates (4-row paginated table) — these reuse the
// shared/karyotype_table.js renderer and the local renderInversionTablesInline()
// helper imported from the Inversions page.
// =============================================================================

import { $ } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { selectIndividual } from '../../shared/pop_tree.js';
import { renderKaryotypeTable } from '../../shared/karyotype_table.js';
import { on } from '../../shared/page_hooks.js';
import { _setActiveState } from './network/_state.js';
import { renderInversionTablesInline } from './inversions.js';

export function renderNetwork() {
  const svg = $('#networkSvg');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 800, H = 360;
  const cx = W / 2, cy = H / 2;
  const center = state.selected_individual || 'Ind_001';

  const incident = DEMO.network_edges.filter(e =>
    e.a === center || e.b === center);
  const neighbors = incident.map(e => e.a === center ? e.b : e.a);
  const positions = { [center]: { x: cx, y: cy } };
  neighbors.forEach((n, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI / neighbors.length);
    const r = 130;
    positions[n] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  for (const e of incident) {
    const pa = positions[e.a];
    const pb = positions[e.b];
    if (!pa || !pb) continue;
    const cls = 'net-edge ' + (
      e.class === 'strong_po'   ? 'strong-po' :
      e.class === 'possible_po' ? 'possible-po' :
      e.class === 'ambiguous'   ? 'ambig' : 'conflict'
    );
    svg.appendChild(svgEl('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: cls,
    }));
  }

  for (const [name, p] of Object.entries(positions)) {
    const isCenter = name === center;
    const grp = svgEl('g', {
      class: 'net-node' + (isCenter ? ' selected' : ''),
      transform: `translate(${p.x},${p.y})`,
      'data-individual': name,
    });
    grp.appendChild(svgEl('circle', { r: isCenter ? 22 : 16 }));
    grp.appendChild(svgEl('text', { y: isCenter ? -32 : -22, class: 'net-label' }))
       .textContent = name;
    grp.addEventListener('click', () => selectIndividual(name));
    svg.appendChild(grp);
  }
}

let _unsubInd = null, _unsubChr = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  renderNetwork();
  renderKaryotypeTable('#karyoTableSlotInline');
  renderInversionTablesInline();
  _unsubInd = on('individual_changed', () => {
    renderNetwork();
    renderInversionTablesInline();
  });
  _unsubChr = on('chromosome_changed', () => renderInversionTablesInline());
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  _unsubInd = _unsubChr = null;
}
