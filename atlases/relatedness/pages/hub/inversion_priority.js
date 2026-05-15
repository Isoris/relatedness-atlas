// atlases/relatedness/pages/hub/inversion_priority.js
// =============================================================================
// Inversion priority page — the Pass-1 → Pass-2 bridge.
// Thin page: math is in shared/inversion_priority.js so the same scoring
// migrates to the future Meiosis Atlas / breeding-AI advisor unchanged.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { state } from '../../shared/state.js';
import { runPriorityScan, PRIORITY_BUCKET_LABEL } from '../../shared/inversion_priority.js';
import { _setActiveState } from './inversion_priority/_state.js';

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

const BUCKET_CLASS = {
  ship_to_pass2: 'ship',
  hold:          'hold',
  drop:          'drop',
};

function _renderSummary() {
  const slot = $('#prioSummary');
  if (!slot) return;
  slot.innerHTML = '';
  const r = state.priority.last_results;
  if (!r) return;
  slot.appendChild(_sumCell('candidates scanned', r.rows.length));
  slot.appendChild(_sumCell('SHIP → PASS 2',      r.n_ship,
    r.n_ship === 0 ? 'fail' : 'good',
    r.n_ship + '/' + r.rows.length));
  slot.appendChild(_sumCell('HOLD',               r.n_hold,
    r.n_hold > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('DROP',               r.n_drop, null));
  slot.appendChild(_sumCell('top-N for export',   r.top_n));
}

function _renderTable() {
  const slot = $('#prioResultSlot');
  if (!slot) return;
  slot.innerHTML = '';
  const r = state.priority.last_results;
  if (!r) return;
  const bucketFilter = state.priority.bucket || 'ship_to_pass2';
  const rows = bucketFilter === 'all'
    ? r.rows
    : r.rows.filter(row => row.bucket === bucketFilter);
  if (!rows.length) {
    slot.appendChild(el('div', { class: 'ie-conclusion tier-weak',
      html: '<div class="verdict">NO ROWS IN BUCKET</div>'
          + 'No candidates fall in the "' + bucketFilter + '" bucket. Try "all".' }));
    return;
  }
  const tbl = el('table', { class: 'data-table prio-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Candidate','Chrom','Freq','Intra','Inter |ΔC|max','Mend p','Hubs','Hub share','Marker','Score','Bucket']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  rows.forEach(row => {
    const t = el('tr');
    t.appendChild(el('td', { class: 'sample-id', text: row.candidate }));
    t.appendChild(el('td', { text: row.chromosome }));
    t.appendChild(el('td', { class: 'num', text: fmt(row.frequency) }));
    const intraTd = el('td', { class: 'num',
      text: Number.isFinite(row.intra_effect) ? row.intra_effect.toFixed(2) : '—' });
    if (Number.isFinite(row.intra_effect) && row.intra_effect >= 0.6) intraTd.style.color = 'var(--bad)';
    else if (Number.isFinite(row.intra_effect) && row.intra_effect >= 0.3) intraTd.style.color = 'var(--warn)';
    t.appendChild(intraTd);
    const interTd = el('td', { class: 'num',
      text: Number.isFinite(row.inter_max_abs_delta) ? row.inter_max_abs_delta.toFixed(2) : '—' });
    if (Number.isFinite(row.inter_max_abs_delta) && row.inter_max_abs_delta >= 0.30) interTd.style.color = 'var(--bad)';
    else if (Number.isFinite(row.inter_max_abs_delta) && row.inter_max_abs_delta >= 0.15) interTd.style.color = 'var(--warn)';
    t.appendChild(interTd);
    const mTd = el('td', { class: 'num', text: fmt(row.mendel_p) });
    if (Number.isFinite(row.mendel_p) && row.mendel_p < 0.01) mTd.style.color = 'var(--bad)';
    else if (Number.isFinite(row.mendel_p) && row.mendel_p < 0.05) mTd.style.color = 'var(--warn)';
    t.appendChild(mTd);
    t.appendChild(el('td', { class: 'num', text: String(row.family_n_hubs) }));
    const hsTd = el('td', { class: 'num', text: (row.hub_share * 100).toFixed(0) + '%' });
    if (row.hub_share >= 0.80) hsTd.style.color = 'var(--bad)';
    else if (row.hub_share >= 0.60) hsTd.style.color = 'var(--warn)';
    t.appendChild(hsTd);
    const mkTd = el('td');
    mkTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (row.marker_ready ? 'pass' : 'warn'),
      text: row.marker_ready ? 'READY' : 'NOT YET',
    }));
    mkTd.title = row.marker_reason || '';
    t.appendChild(mkTd);
    t.appendChild(el('td', { class: 'num', text: row.priority_score.toFixed(2) }));
    const bkTd = el('td');
    bkTd.appendChild(el('span', {
      class: 'prio-bucket-pill ' + BUCKET_CLASS[row.bucket],
      text: PRIORITY_BUCKET_LABEL[row.bucket],
    }));
    t.appendChild(bkTd);
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _exportTsv() {
  const r = state.priority.last_results;
  if (!r) { alert('Run the priority scan first.'); return; }
  const topN = state.priority.top_n || 20;
  const top = r.rows.filter(row => row.bucket !== 'drop').slice(0, topN);
  const cols = ['candidate','chromosome','start_mb','end_mb','length_mb',
                'status','frequency',
                'n_carriers','n_controls','n_parental_carriers','n_parental_meioses',
                'hub_share','ancestry_l1','burden_delta',
                'intra_effect','intra_verdict',
                'inter_mean_abs_delta','inter_max_abs_delta',
                'mendel_p','mendel_n_total',
                'family_n_hubs',
                'marker_ready','marker_reason',
                'priority_score','bucket'];
  const lines = [
    '# Inversion priority — Pass-1 → Pass-2 bridge',
    '# Date: ' + new Date().toISOString(),
    '# Top-N exported: ' + topN + ' (across SHIP + HOLD buckets, sorted by score desc)',
    '# Bucket counts: ship=' + r.n_ship + ' hold=' + r.n_hold + ' drop=' + r.n_drop,
    '# Score weights: intra 0.30 · inter 0.25 · mendel 0.20 · family 0.15 · marker 0.10',
    '#',
    cols.join('\t'),
  ];
  for (const row of top) {
    lines.push([
      row.candidate, row.chromosome, row.start_mb, row.end_mb, row.length_mb,
      row.status, row.frequency,
      row.n_carriers, row.n_controls, row.n_parental_carriers, row.n_parental_meioses,
      row.hub_share.toFixed(3),
      Number.isFinite(row.ancestry_l1) ? row.ancestry_l1.toFixed(3) : '',
      Number.isFinite(row.burden_delta) ? row.burden_delta.toFixed(3) : '',
      Number.isFinite(row.intra_effect) ? row.intra_effect.toFixed(3) : '',
      row.intra_verdict,
      Number.isFinite(row.inter_mean_abs_delta) ? row.inter_mean_abs_delta.toFixed(3) : '',
      Number.isFinite(row.inter_max_abs_delta) ? row.inter_max_abs_delta.toFixed(3) : '',
      Number.isFinite(row.mendel_p) ? fmt(row.mendel_p) : '',
      row.mendel_n_total,
      row.family_n_hubs,
      row.marker_ready ? 'yes' : 'no',
      row.marker_reason,
      row.priority_score.toFixed(3),
      row.bucket,
    ].join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inversion_priority_top' + topN + '_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function _runScan() {
  const topN = parseInt(($('#prioTopN') && $('#prioTopN').value) || '20', 10);
  state.priority.top_n = topN;
  state.priority.bucket = ($('#prioBucket') && $('#prioBucket').value) || 'ship_to_pass2';
  state.priority.last_results = runPriorityScan({ top_n: topN });
  _renderSummary();
  _renderTable();
}

function wirePriority() {
  $('#prioBucket').addEventListener('change', e => {
    state.priority.bucket = e.target.value;
    _renderTable();
  });
  $('#prioTopN').addEventListener('change', e => {
    state.priority.top_n = parseInt(e.target.value, 10);
  });
  $('#prioRunBtn').addEventListener('click', _runScan);
  $('#prioResetBtn').addEventListener('click', () => {
    state.priority.last_results = null;
    $('#prioSummary').innerHTML = '';
    $('#prioResultSlot').innerHTML = '';
  });
  $('#prioExportBtn').addEventListener('click', _exportTsv);
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  if (state.priority.bucket && $('#prioBucket')) $('#prioBucket').value = state.priority.bucket;
  if (state.priority.top_n && $('#prioTopN'))    $('#prioTopN').value   = String(state.priority.top_n);
  wirePriority();
  if (state.priority.last_results) { _renderSummary(); _renderTable(); }
  else _runScan();   // run on first mount so the page is never empty.
}

export async function unmount(root) {
  _setActiveState(null);
}
