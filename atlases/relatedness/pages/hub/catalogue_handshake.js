// atlases/relatedness/pages/hub/catalogue_handshake.js
// =============================================================================
// Catalogue handshake / self-test (#17). Diagnostic page that reads the
// four JSONL files this atlas exposes to atlas-core's master workflow
// catalogue and verifies the three smoke-test constraints client-side.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { state } from '../../shared/state.js';
import { _setActiveState } from './catalogue_handshake/_state.js';

const REGISTRY_BASE = 'toolkit_registries/relatedness/01_registry/';
const FILES = [
  { id: 'module_registry',    file: 'module_registry.jsonl',    key: 'module_name' },
  { id: 'analysis_registry',  file: 'analysis_registry.jsonl',  key: 'analysis_id' },
  { id: 'analysis_modes',     file: 'analysis_modes.jsonl',     key: 'analysis_type' },
  { id: 'layer_registry',     file: 'layer_registry.jsonl',     key: 'layer_id' },
];

const STATUS_PILL_CLASS = {
  stable:                'pass',
  experimental:          'warn',
  experimental_gated:    'fail',
  ready:                 'pass',
  partial:               'warn',
  missing:               'fail',
  blocked:               'fail',
  stale:                 'fail',
};

// ─── Load + parse JSONL ─────────────────────────────────────────────────

async function _loadJsonl(file) {
  try {
    const path = _resolveBase() + file;
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => JSON.parse(l));
  } catch (e) {
    return { _error: String(e) };
  }
}

// Best-effort resolver — the modular shell serves from atlas-core root,
// the legacy single-file shell from the repo root. Try both.
function _resolveBase() {
  // If we're running under atlas-core (URL starts with #/relatedness/...)
  // the static root is the workspace; otherwise we're in the legacy shell
  // and the registry lives next to Relatedness_atlas.html.
  return REGISTRY_BASE;
}

// ─── Constraint checks ─────────────────────────────────────────────────

function _runConstraints(data) {
  const mods    = Array.isArray(data.module_registry)    ? data.module_registry    : [];
  const ans     = Array.isArray(data.analysis_registry)  ? data.analysis_registry  : [];
  const modes   = Array.isArray(data.analysis_modes)     ? data.analysis_modes     : [];
  const layers  = Array.isArray(data.layer_registry)     ? data.layer_registry     : [];
  const modNames = new Set(mods.map(m => m.module_name));
  const anaIds   = new Map(ans.map(a => [a.analysis_id, a.produces]));
  const layerIds = new Set(layers.map(l => l.layer_id));

  const c1 = []; // analysis_type ∈ analysis_registry
  const c2 = []; // produces single-valued AND matches registry
  const c3 = []; // module_name ∈ module_registry
  const cb = []; // bonus: produces ∈ layer_registry

  for (const m of modes) {
    if (!anaIds.has(m.analysis_type))
      c1.push(`mode ${m.analysis_type} not in analysis_registry`);
  }
  for (const m of modes) {
    if (typeof m.produces === 'string' && m.produces.includes(','))
      c2.push(`multi-valued produces on ${m.analysis_type}: ${m.produces}`);
    const exp = anaIds.get(m.analysis_type);
    if (exp && m.produces !== exp)
      c2.push(`produces mismatch on ${m.analysis_type}: modes=${m.produces} registry=${exp}`);
  }
  for (const m of modes) {
    if (!modNames.has(m.module_name))
      c3.push(`module ${m.module_name} (in mode ${m.analysis_type}) not in module_registry`);
  }
  for (const a of ans) {
    if (!layerIds.has(a.produces))
      cb.push(`produces ${a.produces} of ${a.analysis_id} not in layer_registry`);
  }
  return { c1, c2, c3, cb };
}

// ─── Render ────────────────────────────────────────────────────────────

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

function _renderFileStatus() {
  const slot = $('#chkFileStatus');
  slot.innerHTML = '';
  const d = state.catalogue.last_load;
  if (!d) return;
  for (const f of FILES) {
    const block = d[f.id];
    if (!block || block._error) {
      slot.appendChild(_sumCell(f.id, 'ERROR', 'fail',
        block && block._error ? block._error : 'no data'));
    } else {
      slot.appendChild(_sumCell(f.id, block.length, 'good', 'rows'));
    }
  }
}

function _renderConstraints() {
  const slot = $('#chkConstraints');
  slot.innerHTML = '';
  const d = state.catalogue.last_load;
  if (!d) return;
  if (FILES.some(f => !d[f.id] || d[f.id]._error)) {
    slot.appendChild(el('div', {
      class: 'ie-conclusion tier-conflict',
      html: '<div class="verdict">REGISTRY LOAD FAILED</div>'
          + 'One or more JSONL files could not be loaded. Most common cause: the page is being '
          + 'served from <code>file://</code> which blocks <code>fetch()</code> of sibling files. '
          + 'Serve the atlas via <code>python -m http.server</code> (or atlas-core) to load the registry.'
    }));
    return;
  }
  const c = _runConstraints(d);
  const total_failures = c.c1.length + c.c2.length + c.c3.length;
  const bonus_failures = c.cb.length;
  const tier = total_failures > 0 ? 'tier-conflict' : (bonus_failures > 0 ? 'tier-warn-family' : 'tier-strong');
  const verdict = total_failures > 0 ? 'CONSTRAINTS FAILED'
                : bonus_failures > 0 ? 'CONSTRAINTS PASS · BONUS FAIL'
                : 'CATALOGUE READY';

  function _block(name, fails) {
    return `<div style="margin: 4px 0; font-size: 10.5px;">`
         + (fails.length === 0
            ? `<span style="color: var(--good); font-weight: 600;">✓ ${name}</span>`
            : `<span style="color: var(--bad); font-weight: 600;">✗ ${name}</span>`
              + `<ul style="margin: 4px 0 0 18px; padding: 0; color: var(--bad);">`
              + fails.map(f => `<li>${f}</li>`).join('') + '</ul>')
         + `</div>`;
  }

  slot.appendChild(el('div', {
    class: 'ie-conclusion ' + tier,
    html: `<div class="verdict">${verdict}</div>`
        + _block('Constraint 1 — analysis_type ∈ analysis_registry', c.c1)
        + _block('Constraint 2 — produces single-valued AND matches registry', c.c2)
        + _block('Constraint 3 — module_name ∈ module_registry', c.c3)
        + _block('Bonus — analysis_registry.produces ∈ layer_registry', c.cb)
  }));
}

function _renderModuleTree() {
  const slot = $('#chkModuleTree');
  slot.innerHTML = '';
  const d = state.catalogue.last_load;
  if (!d || !Array.isArray(d.module_registry) || !Array.isArray(d.analysis_modes)) return;
  const byModule = {};
  d.module_registry.forEach(m => { byModule[m.module_name] = { m, modes: [] }; });
  d.analysis_modes.forEach(mode => {
    if (byModule[mode.module_name]) byModule[mode.module_name].modes.push(mode);
  });
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Module','Family','Status','Stale reason','Backs N analyses','Analyses']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  Object.values(byModule).forEach(({ m, modes }) => {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: m.module_name }));
    row.appendChild(el('td', { text: m.family }));
    const stTd = el('td');
    stTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (STATUS_PILL_CLASS[m.biomod_status] || 'warn'),
      text: m.biomod_status,
    }));
    row.appendChild(stTd);
    row.appendChild(el('td', { text: m.stale_reason || '—',
      style: { color: m.stale_reason ? 'var(--warn)' : 'var(--ink-dim)',
               fontSize: '9.5px' } }));
    row.appendChild(el('td', { class: 'num', text: String(modes.length) }));
    row.appendChild(el('td', {
      text: modes.map(x => x.analysis_type).join(', '),
      style: { fontSize: '9.5px', color: 'var(--ink-dim)' },
    }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _renderAnalyses() {
  const slot = $('#chkAnalyses');
  slot.innerHTML = '';
  const d = state.catalogue.last_load;
  if (!d || !Array.isArray(d.analysis_registry)) return;
  // Group by status.
  const buckets = { stable: [], experimental: [], experimental_gated: [], other: [] };
  d.analysis_registry.forEach(a => {
    const b = buckets[a.status] || buckets.other;
    b.push(a);
  });
  // Summary cells per bucket.
  const grid = el('div', { class: 'bdmi-summary' });
  grid.appendChild(_sumCell('stable',             buckets.stable.length, 'good'));
  grid.appendChild(_sumCell('experimental',       buckets.experimental.length, 'warn'));
  grid.appendChild(_sumCell('experimental_gated', buckets.experimental_gated.length, 'fail'));
  if (buckets.other.length) grid.appendChild(_sumCell('other', buckets.other.length, 'warn'));
  slot.appendChild(grid);

  const tbl = el('table', { class: 'data-table', style: { marginTop: '8px' } });
  const thead = el('thead'); const tr = el('tr');
  ['Analysis','Family','Status','Produces','Description']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  d.analysis_registry.forEach(a => {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: a.analysis_id }));
    row.appendChild(el('td', { text: a.family }));
    const stTd = el('td');
    stTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (STATUS_PILL_CLASS[a.status] || 'warn'),
      text: a.status,
    }));
    row.appendChild(stTd);
    row.appendChild(el('td', { text: a.produces, style: { fontSize: '9.5px' } }));
    row.appendChild(el('td', {
      text: (a.description || '').slice(0, 120) + ((a.description || '').length > 120 ? '…' : ''),
      style: { fontSize: '9.5px', color: 'var(--ink-dim)' },
      title: a.description || '',
    }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _renderChain() {
  const slot = $('#chkChain');
  slot.innerHTML = '';
  const d = state.catalogue.last_load;
  if (!d || !Array.isArray(d.analysis_registry)) return;
  const chain = d.analysis_registry.find(a => a.analysis_id === 'inversion_karyotype_meiosis_pipeline');
  if (!chain) {
    slot.appendChild(el('div', { class: 'ie-conclusion tier-weak',
      html: '<div class="verdict">NO CHAIN ROW</div>'
          + 'No <code>inversion_karyotype_meiosis_pipeline</code> in analysis_registry.' }));
    return;
  }
  const links = [
    'inversion_karyotypes',
    'parental_meiosis_grouping (in-line)',
    'focal_inversion_meiosis_scan',
    'inversion_priority_rank',
    'marker_panel_design',
  ];
  slot.appendChild(el('div', {
    class: 'ie-conclusion ' + (chain.status === 'experimental_gated' ? 'tier-warn-family' : 'tier-moderate'),
    html: `<div class="verdict">${chain.analysis_id.toUpperCase()} · ${chain.status}</div>`
        + '<div style="font-size: 10.5px; line-height: 1.5;">'
        + chain.description
        + '</div><br/>'
        + '<div style="font-family: var(--mono); font-size: 10.5px; line-height: 1.7;">'
        + links.map((s, i) => (i === 0 ? '' : '<br/>&nbsp;&nbsp;↓<br/>') + '<b>' + s + '</b>').join('')
        + '</div><br/>'
        + `<div style="font-size: 10.5px;">Final produces: <b>${chain.produces}</b></div>`
  }));
}

function _renderLayers() {
  const slot = $('#chkLayers');
  slot.innerHTML = '';
  const d = state.catalogue.last_load;
  if (!d || !Array.isArray(d.layer_registry)) return;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Layer','Entity type','Status','Description']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  d.layer_registry.forEach(l => {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: l.layer_id }));
    row.appendChild(el('td', { text: l.entity_type, style: { fontSize: '9.5px' } }));
    const stTd = el('td');
    stTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (STATUS_PILL_CLASS[l.status] || 'warn'),
      text: l.status,
    }));
    row.appendChild(stTd);
    row.appendChild(el('td', {
      text: (l.description || '').slice(0, 120) + ((l.description || '').length > 120 ? '…' : ''),
      style: { fontSize: '9.5px', color: 'var(--ink-dim)' },
      title: l.description || '',
    }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Driver ────────────────────────────────────────────────────────────

async function _doLoad() {
  const data = {};
  for (const f of FILES) data[f.id] = await _loadJsonl(f.file);
  state.catalogue.last_load = data;
  _renderFileStatus();
  _renderConstraints();
  _renderModuleTree();
  _renderAnalyses();
  _renderChain();
  _renderLayers();
}

function _exportReport() {
  const d = state.catalogue.last_load;
  if (!d) { alert('Reload the registry first.'); return; }
  const report = {
    date: new Date().toISOString(),
    counts: Object.fromEntries(FILES.map(f =>
      [f.id, Array.isArray(d[f.id]) ? d[f.id].length : 0])),
    constraints: _runConstraints(d),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'catalogue_handshake_' + Date.now() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wireCatalogue() {
  $('#chkLoadBtn').addEventListener('click', _doLoad);
  $('#chkExportBtn').addEventListener('click', _exportReport);
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  wireCatalogue();
  await _doLoad();
}

export async function unmount(root) {
  _setActiveState(null);
}
