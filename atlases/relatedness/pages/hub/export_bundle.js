// atlases/relatedness/pages/hub/export_bundle.js
// =============================================================================
// Export bundle (#23). Thin page over shared/export_bundle.js. Builds the
// 7-section bundle on demand, surfaces section row counts, downloads as
// one multi-section TSV or one JSON blob.
// =============================================================================

import { $, el } from '../../shared/utils.js';
import { state } from '../../shared/state.js';
import { buildBundle, bundleToTsv, bundleToJson } from '../../shared/export_bundle.js';
import { _setActiveState } from './export_bundle/_state.js';

// Try to surface a pre-built static snapshot (from scripts/build_static.mjs)
// next to the in-browser bundler. Fetches static/snapshots/index.json once
// on mount; if present + readable, renders the download links. If absent
// (no snapshot built yet, or running off file://), silently skips.
async function _renderStaticSnapshot() {
  const slot = $('#ebStaticSnapshot');
  if (!slot) return;
  slot.innerHTML = '';
  let idx;
  try {
    const res = await fetch('static/snapshots/index.json');
    if (!res.ok) return;
    idx = await res.json();
  } catch (_e) { return; }
  if (!idx || !idx.latest) return;
  const html = `<div class="ie-conclusion tier-moderate" style="margin-top: 10px;">`
    + `<div class="verdict">PRE-BUILT SNAPSHOT AVAILABLE · ${idx.latest.date}</div>`
    + `<div style="font-size: 10.5px; line-height: 1.55;">`
    + `Built by <code>npm run snapshot</code> on ${new Date(idx.built_at).toLocaleString()}. `
    + `Direct downloads (no Build click required):</div>`
    + `<div style="margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap;">`
    + `<a href="static/snapshots/${idx.latest.tsv}" class="status-pill-cell pass" `
    + `style="text-decoration: none; padding: 4px 10px;">⤓ latest.tsv</a>`
    + (idx.latest.json
        ? `<a href="static/snapshots/${idx.latest.json}" class="status-pill-cell pass" `
          + `style="text-decoration: none; padding: 4px 10px;">⤓ latest.json</a>`
        : '')
    + `</div>`
    + (idx.snapshots && idx.snapshots.length > 1
        ? `<div style="margin-top: 8px; font-size: 9.5px; color: var(--ink-dim);">`
          + `${idx.snapshots.length} snapshot${idx.snapshots.length === 1 ? '' : 's'} in `
          + `<code>static/snapshots/</code> · history: `
          + idx.snapshots.slice(0, 7).map(s =>
              `<a href="static/snapshots/${s.tsv || s.json}">${s.date}</a>`).join(' · ')
          + (idx.snapshots.length > 7 ? ' · …' : '')
          + `</div>`
        : '')
    + `</div>`;
  slot.innerHTML = html;
}

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

function _renderSummary() {
  const slot = $('#ebSummary');
  slot.innerHTML = '';
  const b = state.export_bundle.last_bundle;
  if (!b) return;
  let total_rows = 0;
  for (const rows of Object.values(b.sections)) total_rows += rows.length;
  slot.appendChild(_sumCell('sections',     Object.keys(b.sections).length, 'good'));
  slot.appendChild(_sumCell('total rows',   total_rows, 'good'));
  slot.appendChild(_sumCell('n_samples',    b.meta.n_samples));
  slot.appendChild(_sumCell('n_candidates', b.meta.n_candidates));
  slot.appendChild(_sumCell('built at',     new Date(b.meta.date_iso).toLocaleTimeString(),
    null, 'click Build again to refresh'));
}

function _renderSections() {
  const slot = $('#ebSections');
  slot.innerHTML = '';
  const b = state.export_bundle.last_bundle;
  if (!b) {
    slot.appendChild(el('div', {
      class: 'meiosis-caption',
      text: 'Click "Build bundle" to populate.' }));
    return;
  }
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Section','n rows','First-row keys'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  for (const [name, rows] of Object.entries(b.sections)) {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: name }));
    row.appendChild(el('td', { class: 'num', text: String(rows.length) }));
    const keys = rows.length ? Object.keys(rows[0]).join(', ') : '—';
    row.appendChild(el('td', {
      text: keys.length > 100 ? keys.slice(0, 100) + '…' : keys,
      style: { fontSize: '9.5px', color: 'var(--ink-dim)' },
      title: keys }));
    tbody.appendChild(row);
  }
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _doBuild() {
  const top_n = parseInt($('#ebTopN').value, 10) || 5;
  const focal_n_perm = parseInt($('#ebPerm').value, 10) || 200;
  state.export_bundle.last_bundle = buildBundle({ top_n, focal_n_perm });
  _renderSummary();
  _renderSections();
}

function _download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function _downloadTsv() {
  if (!state.export_bundle.last_bundle) _doBuild();
  const tsv = bundleToTsv(state.export_bundle.last_bundle);
  _download('relatedness_atlas_bundle_' + Date.now() + '.tsv',
            tsv, 'text/tab-separated-values');
}

function _downloadJson() {
  if (!state.export_bundle.last_bundle) _doBuild();
  const json = bundleToJson(state.export_bundle.last_bundle);
  _download('relatedness_atlas_bundle_' + Date.now() + '.json',
            json, 'application/json');
}

function wireEb() {
  $('#ebBuildBtn').addEventListener('click', _doBuild);
  $('#ebTsvBtn').addEventListener('click', _downloadTsv);
  $('#ebJsonBtn').addEventListener('click', _downloadJson);
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  wireEb();
  // Auto-build a small bundle on first mount so the user sees row counts
  // immediately. Uses top_n=3, perm=100 to stay snappy.
  if (!state.export_bundle.last_bundle) {
    state.export_bundle.last_bundle = buildBundle({ top_n: 3, focal_n_perm: 100 });
  }
  _renderSummary();
  _renderSections();
  _renderStaticSnapshot();
}

export async function unmount(root) {
  _setActiveState(null);
}
