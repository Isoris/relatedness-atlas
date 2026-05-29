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
import { resolveLatestLayer, readTsv } from '../../shared/api_client.js';
import { _setActiveState } from './network/_state.js';
import { renderInversionTablesInline } from './inversions.js';
import { probeModeB, renderModeBBadge, distinctCount } from '../../../../core/mode_b_badge.js';

// 2026-05-29: real-cohort network. When the precomputed hub-network TSVs
// (data/relatedness/network_layout.tsv + network_edges.tsv, produced by
// registries/runners/build_cohort226_relatedness.py from the ngsRelate
// export) are reachable, the SVG renders the real 226-sample first-degree
// graph at its precomputed force-directed layout, coloured by dominant
// ancestry component. Falls back to the DEMO hub-and-spoke when the files
// are absent (file:// origin, demo deployment) so the page never breaks.
const _NET_LAYOUT_PATH = 'atlases/relatedness/data/relatedness/network_layout.tsv';
const _NET_EDGES_PATH  = 'atlases/relatedness/data/relatedness/network_edges.tsv';
let _realNet = null;          // { nodes: Map<name,node>, edges: [...] } once loaded

async function _loadRealNetwork() {
  try {
    const [layout, edges] = await Promise.all([
      readTsv(_NET_LAYOUT_PATH),
      readTsv(_NET_EDGES_PATH),
    ]);
    if (!layout.rows.length || !edges.rows.length) return null;
    const nodes = new Map();
    for (const r of layout.rows) {
      if (!r.name) continue;
      nodes.set(r.name, {
        name: r.name,
        x: parseFloat(r.x), y: parseFloat(r.y),
        fill: r.node_fill || '#94a3b8',
        retained: (r.retained_status || 'retained') === 'retained',
        hub_degree: parseInt(r.hub_degree || '0', 10) || 0,
        component: r.component_id || '',
      });
    }
    const erows = edges.rows
      .filter(e => e.from && e.to && nodes.has(e.from) && nodes.has(e.to))
      .map(e => ({
        from: e.from, to: e.to,
        theta: parseFloat(e.theta),
        relationship: e.relationship || '',
      }));
    if (!nodes.size || !erows.length) return null;
    return { nodes, edges: erows };
  } catch (_e) {
    return null;   // fail-soft → DEMO
  }
}

function _edgeColor(rel) {
  if (rel === 'Duplicate/MZ') return 'rgba(239,68,68,0.75)';   // red — clones
  if (rel === 'First degree') return 'rgba(249,115,22,0.45)';  // orange — PO/FS
  if (rel === 'Second degree') return 'rgba(245,158,11,0.30)';
  return 'rgba(148,163,184,0.25)';
}

// Render the precomputed real-cohort graph into #networkSvg, scaling the
// layout coordinates to fit the viewport while preserving aspect ratio.
function renderRealNetwork(svg, net) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const W = 800, H = 360, pad = 24;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  };
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const n of net.nodes.values()) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    if (n.x < xMin) xMin = n.x; if (n.x > xMax) xMax = n.x;
    if (n.y < yMin) yMin = n.y; if (n.y > yMax) yMax = n.y;
  }
  const sx = (xMax > xMin) ? (W - 2 * pad) / (xMax - xMin) : 1;
  const sy = (yMax > yMin) ? (H - 2 * pad) / (yMax - yMin) : 1;
  const s = Math.min(sx, sy);
  const ox = (W - s * (xMax - xMin)) / 2;
  const oy = (H - s * (yMax - yMin)) / 2;
  const px = n => ox + (n.x - xMin) * s;
  const py = n => oy + (n.y - yMin) * s;

  for (const e of net.edges) {
    const a = net.nodes.get(e.from), b = net.nodes.get(e.to);
    if (!a || !b) continue;
    svg.appendChild(svgEl('line', {
      x1: px(a), y1: py(a), x2: px(b), y2: py(b),
      stroke: _edgeColor(e.relationship), 'stroke-width': e.relationship === 'Duplicate/MZ' ? 2 : 1,
    }));
  }

  const sel = state.selected_individual;
  for (const n of net.nodes.values()) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    const isSel = n.name === sel;
    const r = Math.max(3, Math.min(11, 3 + Math.sqrt(n.hub_degree) * 1.8));
    const grp = svgEl('g', {
      class: 'net-node' + (isSel ? ' selected' : ''),
      transform: `translate(${px(n)},${py(n)})`,
      'data-individual': n.name,
      style: 'cursor:pointer',
    });
    grp.appendChild(svgEl('circle', {
      r: isSel ? r + 3 : r,
      fill: n.fill,
      stroke: isSel ? '#facc15' : (n.retained ? 'rgba(255,255,255,0.55)' : 'rgba(239,68,68,0.8)'),
      'stroke-width': isSel ? 2.5 : (n.retained ? 0.8 : 1.6),
    }));
    grp.addEventListener('click', () => selectIndividual(n.name));
    grp.appendChild(svgEl('title', {})).textContent =
      `${n.name} · degree ${n.hub_degree} · ${n.component}${n.retained ? '' : ' · pruned'}`;
    svg.appendChild(grp);
  }
  // Label only the selected node + the highest-degree hubs, to avoid 205
  // overlapping labels.
  const top = [...net.nodes.values()]
    .filter(n => Number.isFinite(n.x))
    .sort((a, b) => b.hub_degree - a.hub_degree)
    .slice(0, 8);
  const labelSet = new Set(top.map(n => n.name));
  if (sel && net.nodes.has(sel)) labelSet.add(sel);
  for (const name of labelSet) {
    const n = net.nodes.get(name);
    const t = svgEl('text', { x: px(n) + 6, y: py(n) - 6, class: 'net-label' });
    t.textContent = name;
    svg.appendChild(t);
  }
}

export function renderNetwork() {
  const svg = $('#networkSvg');
  if (!svg) return;
  if (_realNet) { renderRealNetwork(svg, _realNet); return; }
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
    // Don't downgrade to the DEMO message when the real precomputed cohort
    // network is already rendered — the captured-audit-trail envelope being
    // absent is orthogonal to the on-disk network TSVs being present.
    if (_realNet) return;
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
  // Load the real precomputed cohort network before the first paint so the
  // SVG shows real data immediately when the TSVs are present; renderNetwork
  // falls back to the DEMO hub-and-spoke when _realNet stays null.
  try { _realNet = await _loadRealNetwork(); } catch (_e) { _realNet = null; }
  if (_realNet) {
    const slot = $('#networkDataSource');
    if (slot) {
      slot.className = 'data-source-badge live';
      slot.textContent =
        `●  Real cohort network: ${_realNet.nodes.size} samples · ` +
        `${_realNet.edges.length} first-degree edges (ngsRelate)`;
      slot.title = 'Source: data/relatedness/network_layout.tsv + network_edges.tsv ' +
                   '(build_cohort226_relatedness.py from the 05_ngsrelate export).';
    }
  }
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

  // Mode-B cross-check — direct registry.resolve('res_pairwise'). Distinct
  // from the envelope probe above: the envelope detector looks for a
  // captured staging-layer audit trail, while this probe checks whether
  // the on-disk TSV (data/relatedness/pairwise_relationship_classification.tsv)
  // is actually reachable through the layer registry. Round-1: empty
  // disk → "○ data pending" until ngsPedigree Stage 1 ships. Auto-flips
  // to ● once the TSV lands.
  _renderRelatednessModeBBadge(registry).catch((e) => {
    console.warn('network.mount: Mode-B probe threw —', e);
  });
}

async function _renderRelatednessModeBBadge(registry) {
  const probe = await probeModeB(registry, 'res_pairwise', {});
  renderModeBBadge('netModeBBadge', probe, {
    label:    'pairwise rel. classification',
    layerKey: 'res_pairwise',
    compare:  (probeResult) => {
      // res_pairwise rows carry: sample_a, sample_b, relationship_class
      // (per the v1 schema). Split the class distribution + flag the
      // unique-sample count so the reviewer can sanity-check against
      // ngsPedigree's expected output shape.
      const classes = {};
      for (const r of probeResult.rows) {
        const k = r && (r.relationship_class || r.class || 'unknown');
        classes[k] = (classes[k] || 0) + 1;
      }
      const samples = new Set();
      for (const r of probeResult.rows) {
        if (r && r.sample_a) samples.add(r.sample_a);
        if (r && r.sample_b) samples.add(r.sample_b);
      }
      const classChips = Object.entries(classes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, n]) => `${k}=${n}`).join(' · ');
      return {
        pass: probeResult.n > 0 && samples.size > 0,
        summary: `${probeResult.n} pairs · ${samples.size} unique samples · ${classChips || 'no class column'}`,
      };
    },
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  _unsubInd = _unsubChr = null;
}
