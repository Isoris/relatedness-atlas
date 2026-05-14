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
//
// Envelope-aware data source detection (2026-05-14): mount() probes the
// atlas-core action pipeline (via shared/api_client.js) for the latest
// ngsrelate_pairs_v1 envelope. When one exists, a small status badge above
// the SVG advertises it (layer_id, n_pairs, created_at); when none exists
// or the server is unreachable (e.g. file:// origin), the page silently
// falls back to DEMO rendering. The migration is intentionally additive —
// the SVG rendering itself still reads DEMO.network_edges. Switching the
// edge set to envelope pairs[] is a follow-up once a relatedness threshold
// convention is settled for {strong_po, possible_po, ambiguous, conflict}.
// =============================================================================

import { $ } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { selectIndividual } from '../../shared/pop_tree.js';
import { renderKaryotypeTable } from '../../shared/karyotype_table.js';
import { on } from '../../shared/page_hooks.js';
import { resolveLatestLayer } from '../../shared/api_client.js';
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

// ---------------------------------------------------------------------------
// Envelope-aware data-source badge
// ---------------------------------------------------------------------------

// Probe the action pipeline for the latest normalized ngsrelate_pairs
// envelope. Returns the full envelope, null when none exists, or null on
// any error (file:// origin, server offline, CORS) — fail-soft so the
// page always renders.
async function _findRelatednessEnvelope(atlasState) {
  const dataset_id = (atlasState && atlasState.cohort) || undefined;
  try {
    return await resolveLatestLayer('ngsrelate_pairs', {
      dataset_id,
      stage: 'normalized',
    });
  } catch (_e) {
    return null;
  }
}

// Render a one-line status badge above the SVG. The HTML slot
// #networkDataSource is added in network.html; this is a no-op when the
// slot is missing (the page renders identically to its pre-migration
// form, just without the badge).
function _renderDataSourceBadge(envelope) {
  const slot = $('#networkDataSource');
  if (!slot) return;
  if (envelope == null) {
    slot.className = 'data-source-badge demo';
    slot.textContent = '◌  Showing DEMO network (no ngsrelate_pairs envelope for this cohort).';
    slot.title = 'Submit a normalize_relatedness action to promote ' +
                 'staging_relatedness_v0 → ngsrelate_pairs_v1.';
    return;
  }
  const n = (envelope.payload && envelope.payload.summary
              && envelope.payload.summary.n_pairs) || 0;
  slot.className = 'data-source-badge live';
  slot.textContent =
    `●  ngsrelate_pairs envelope: ${envelope.layer_id}  ` +
    `· ${n} pair${n === 1 ? '' : 's'}  ` +
    `· created ${envelope.created_at || '?'}`;
  slot.title = `Provenance: action_id=${envelope.provenance?.action_id || '?'}` +
               (envelope.provenance?.source_layer_ids
                ? `, source_layer_ids=[${envelope.provenance.source_layer_ids.join(', ')}]`
                : '');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

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
  // Envelope detection runs asynchronously after the synchronous render so
  // the page is interactive immediately; the badge updates when the probe
  // resolves. Any failure (404, offline, CORS) silently degrades to DEMO.
  try {
    const envelope = await _findRelatednessEnvelope(atlasState);
    _renderDataSourceBadge(envelope);
  } catch (_e) {
    _renderDataSourceBadge(null);
  }
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  _unsubInd = _unsubChr = null;
}
