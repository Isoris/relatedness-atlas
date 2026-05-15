// atlases/relatedness/pages/hub/marker_test_designer.js
// =============================================================================
// Interchromosomal Marker Test Designer — page UI. Math + generators live
// in shared/marker_designer.js so the same designer can migrate to a
// future Meiosis Atlas / breeding-AI module unchanged.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import {
  runMarkerDesigner, PANEL_STATUS_LABEL,
} from '../../shared/marker_designer.js';
import { _setActiveState } from './marker_test_designer/_state.js';

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

const CHROM_STATUS_CLASS = {
  READY:     'pass',
  PARTIAL:   'warn',
  LOW_POWER: 'warn',
  BLOCKED:   'fail',
  MISSING:   'fail',
};

function _populateFocalPicker() {
  const sel = $('#mdFocal');
  sel.innerHTML = '';
  const order = (c) =>
    (c.status === 'pass' ? 0 : c.status === 'warn' ? 1 : c.status === 'fail' ? 2 : 3);
  const cands = (DEMO.inversion_candidates_full || []).slice()
    .sort((a, b) => order(a) - order(b));
  cands.forEach(inv => sel.appendChild(el('option', {
    value: inv.candidate,
    text: `${inv.candidate} · ${inv.chromosome} ${inv.start_mb}-${inv.end_mb} Mb · ${inv.status}`,
  })));
  sel.value = state.marker_designer.focal_inv || (cands[0] && cands[0].candidate);
  state.marker_designer.focal_inv = sel.value;
}

function _renderFocalStatus() {
  const slot = $('#mdFocalStatus');
  const mkSlot = $('#mdFocalMarkers');
  slot.innerHTML = ''; mkSlot.innerHTML = '';
  const d = state.marker_designer.last_design;
  if (!d) return;
  const r = d.readiness;
  slot.appendChild(_sumCell('focal',                 d.focal_inv));
  slot.appendChild(_sumCell('focal chrom',           d.focal_chr || '—'));
  slot.appendChild(_sumCell('parents het',           r.n_parents_het,
    r.n_parents_het < 3 ? 'fail' : null));
  slot.appendChild(_sumCell('parents non-het',       r.n_parents_nonhet,
    r.n_parents_nonhet < 3 ? 'fail' : null));
  slot.appendChild(_sumCell('top hub share (het)',   (r.hub_share * 100).toFixed(0) + '%',
    r.hub_share >= 0.80 ? 'fail' : (r.hub_share >= 0.60 ? 'warn' : null)));
  slot.appendChild(_sumCell('focal status',          r.status,
    r.status === 'READY'   ? 'good'
    : r.status === 'PARTIAL' ? 'warn'
    : 'fail'));
  // Focal-marker table.
  const tbl = el('table', { class: 'data-table', style: { marginTop: '10px' } });
  const thead = el('thead'); const tr = el('tr');
  ['Marker','Kind','Chrom','Pos (Mb)','Purpose','Assay','Expected genotypes']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  d.focal_markers.forEach(m => {
    const t = el('tr');
    t.appendChild(el('td', { class: 'sample-id', text: m.marker_id }));
    t.appendChild(el('td', { text: m.kind }));
    t.appendChild(el('td', { text: m.chromosome }));
    t.appendChild(el('td', { class: 'num', text: String(m.position_mb) }));
    t.appendChild(el('td', { text: m.purpose }));
    const assayTd = el('td');
    assayTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (m.assay_status === 'ready' ? 'pass' : 'warn'),
      text: m.assay_status.toUpperCase(),
    }));
    t.appendChild(assayTd);
    t.appendChild(el('td', { text: m.expected_genotypes }));
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  mkSlot.appendChild(tbl);
}

function _renderPanelSummary() {
  const slot = $('#mdPanelSummary');
  slot.innerHTML = '';
  const d = state.marker_designer.last_design;
  if (!d) return;
  slot.appendChild(_sumCell('tested chroms',     d.summary.n_tested));
  slot.appendChild(_sumCell('READY',             d.summary.n_ready,
    d.summary.n_ready === 0 ? 'fail' : 'good'));
  slot.appendChild(_sumCell('PARTIAL',           d.summary.n_partial,
    d.summary.n_partial > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('LOW_POWER',         d.summary.n_low_power,
    d.summary.n_low_power > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('MISSING',           d.summary.n_missing,
    d.summary.n_missing > 0 ? 'fail' : null));
}

function _renderPerChrom() {
  const slot = $('#mdPerChromSlot');
  slot.innerHTML = '';
  const d = state.marker_designer.last_design;
  if (!d) return;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Chrom','Relation','Markers','Good mappability','Triplets','Best status']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  d.per_chrom.forEach(c => {
    const t = el('tr');
    t.appendChild(el('td', { class: 'sample-id', text: c.tested_chr }));
    const relTd = el('td');
    relTd.appendChild(el('span', {
      class: 'fms-rel-pill ' + (c.relation === 'intra' ? 'intra' : 'inter'),
      text: c.relation.toUpperCase(),
    }));
    t.appendChild(relTd);
    t.appendChild(el('td', { class: 'num', text: String(c.markers.length) }));
    t.appendChild(el('td', { class: 'num',
      text: String(c.markers.filter(m => m.mappability === 'good').length) }));
    t.appendChild(el('td', { class: 'num', text: String(c.triplets.length) }));
    const stTd = el('td');
    stTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (CHROM_STATUS_CLASS[c.status] || 'warn'),
      text: c.status,
    }));
    t.appendChild(stTd);
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _renderTestDesign() {
  const slot = $('#mdTestDesignSlot');
  slot.innerHTML = '';
  const d = state.marker_designer.last_design;
  if (!d) return;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Tested','Relation','A (Mb)','B (Mb)','Markers','exp_DCO','families','status']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  d.per_chrom.forEach(c => {
    c.triplets.forEach(tr3 => {
      const t = el('tr');
      t.appendChild(el('td', { class: 'sample-id', text: c.tested_chr }));
      const relTd = el('td');
      relTd.appendChild(el('span', {
        class: 'fms-rel-pill ' + (tr3.relation === 'intra' ? 'intra' : 'inter'),
        text: tr3.relation.toUpperCase(),
      }));
      t.appendChild(relTd);
      t.appendChild(el('td', { text: `${tr3.interval_A_mb[0]}–${tr3.interval_A_mb[1]}` }));
      t.appendChild(el('td', { text: `${tr3.interval_B_mb[0]}–${tr3.interval_B_mb[1]}` }));
      t.appendChild(el('td', { text: tr3.markers_required.join(', '),
        style: { fontSize: '9.5px', color: 'var(--ink-dim)' } }));
      t.appendChild(el('td', { class: 'num', text: tr3.expected_DCO.toFixed(2) }));
      t.appendChild(el('td', { class: 'num', text: String(tr3.expected_informative_families) }));
      const stTd = el('td');
      stTd.appendChild(el('span', {
        class: 'status-pill-cell ' + (CHROM_STATUS_CLASS[tr3.status] || 'warn'),
        text: tr3.status,
      }));
      stTd.title = tr3.reason || '';
      t.appendChild(stTd);
      tbody.appendChild(t);
    });
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

function _renderPanelVerdict() {
  const slot = $('#mdPanelVerdict');
  slot.innerHTML = '';
  const d = state.marker_designer.last_design;
  if (!d) return;
  const tier = d.panel_status === 'PANEL_READY'   ? 'tier-strong'
            : d.panel_status === 'PANEL_PARTIAL' ? 'tier-moderate'
            : d.panel_status === 'PANEL_LOW_POWER' ? 'tier-warn-family'
            : 'tier-conflict';
  slot.appendChild(el('div', {
    class: 'ie-conclusion ' + tier,
    style: { marginTop: '10px' },
    html: `<div class="verdict">${PANEL_STATUS_LABEL[d.panel_status]}</div>`
        + `<div style="font-size: 10.5px; line-height: 1.5;">`
        + `Focal inversion <b>${d.focal_inv}</b> on <b>${d.focal_chr}</b>: classifier `
        + (d.readiness.status === 'READY' ? '✓ ready'
            : d.readiness.status === 'PARTIAL' ? '~ partial'
            : '✗ blocked')
        + `. Tested chromosomes: <b>${d.summary.n_ready}</b> READY, <b>${d.summary.n_partial}</b> PARTIAL, `
        + `<b>${d.summary.n_low_power}</b> LOW_POWER, <b>${d.summary.n_missing}</b> MISSING.<br/>`
        + (d.panel_status === 'PANEL_READY'
            ? '<b style="color: var(--good);">Panel can be ordered.</b> Send to the marker shop and design the offspring sampling.'
            : d.panel_status === 'PANEL_PARTIAL'
            ? 'Panel will test intra- and a subset of interchromosomal effects. Fill the gaps before scaling to 10k+ catfish.'
            : d.panel_status === 'PANEL_LOW_POWER'
            ? 'Marker grid produces too few expected DCOs for coincidence estimation. Densify the marker grid or restrict to CO-rate-only testing.'
            : 'Focal inversion cannot be reliably classified — fix the inversion-state markers first.')
        + `</div>`
  }));
}

function _runDesigner() {
  const focal = state.marker_designer.focal_inv;
  const mode = $('#mdTested').value;
  let testedChroms = null;
  if (mode === 'focal_only') {
    const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === focal);
    testedChroms = inv ? [inv.chromosome] : null;
  } else if (mode === 'non_focal') {
    const inv = (DEMO.inversion_candidates_full || []).find(i => i.candidate === focal);
    testedChroms = inv ? DEMO.chromosomes.filter(c => c !== inv.chromosome) : null;
  }
  const d = runMarkerDesigner(focal, { tested_chroms: testedChroms });
  state.marker_designer.last_design = d;
  state.marker_designer.tested_chroms = mode;
  _renderFocalStatus();
  _renderPanelSummary();
  _renderPerChrom();
  _renderTestDesign();
  _renderPanelVerdict();
}

function _exportTsv() {
  const d = state.marker_designer.last_design;
  if (!d) { alert('Design the panel first.'); return; }
  const lines = [
    '# Interchromosomal Marker Test Designer',
    '# Date: ' + new Date().toISOString(),
    '# Focal: ' + d.focal_inv + ' on ' + d.focal_chr,
    '# Focal classifier status: ' + d.readiness.status,
    '# Panel status: ' + d.panel_status,
    '# Tested chromosomes: ' + d.summary.n_tested
      + ' (READY=' + d.summary.n_ready
      + ' PARTIAL=' + d.summary.n_partial
      + ' LOW_POWER=' + d.summary.n_low_power
      + ' MISSING=' + d.summary.n_missing + ')',
    '#',
    '# === FOCAL-INVERSION-STATE MARKERS ===',
    ['inv_id','marker_id','kind','chromosome','position_mb','purpose',
     'assay_status','expected_genotypes'].join('\t'),
  ];
  for (const m of d.focal_markers) {
    lines.push([d.focal_inv, m.marker_id, m.kind, m.chromosome, m.position_mb,
                m.purpose, m.assay_status, m.expected_genotypes].join('\t'));
  }
  lines.push('#');
  lines.push('# === TRANSMISSION / RECOMBINATION MARKERS ===');
  lines.push(['focal_inv','tested_chr','marker_id','position_mb','kind','assay',
              'mappability','missingness'].join('\t'));
  for (const c of d.per_chrom) {
    for (const m of c.markers) {
      lines.push([d.focal_inv, c.tested_chr, m.marker_id, m.position_mb,
                  m.kind, m.assay, m.mappability, m.missingness].join('\t'));
    }
  }
  lines.push('#');
  lines.push('# === TEST DESIGN (interval pairs A, B) ===');
  lines.push(['focal_inv','tested_chr','relation',
              'interval_A_mb','interval_B_mb',
              'markers_required','expected_DCO',
              'expected_informative_families','status','reason'].join('\t'));
  for (const c of d.per_chrom) {
    for (const tr3 of c.triplets) {
      lines.push([d.focal_inv, c.tested_chr, tr3.relation,
                  tr3.interval_A_mb.join('-'), tr3.interval_B_mb.join('-'),
                  tr3.markers_required.join(','),
                  tr3.expected_DCO.toFixed(3),
                  tr3.expected_informative_families,
                  tr3.status, tr3.reason || ''].join('\t'));
    }
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'marker_panel_' + d.focal_inv + '_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wireDesigner() {
  $('#mdFocal').addEventListener('change', e => {
    state.marker_designer.focal_inv = e.target.value;
    state.marker_designer.last_design = null;
    ['#mdFocalStatus','#mdFocalMarkers','#mdPanelSummary','#mdPerChromSlot',
     '#mdTestDesignSlot','#mdPanelVerdict']
      .forEach(s => { const n = $(s); if (n) n.innerHTML = ''; });
  });
  $('#mdTested').addEventListener('change', e => state.marker_designer.tested_chroms = e.target.value);
  $('#mdRunBtn').addEventListener('click', _runDesigner);
  $('#mdResetBtn').addEventListener('click', () => {
    state.marker_designer.last_design = null;
    ['#mdFocalStatus','#mdFocalMarkers','#mdPanelSummary','#mdPerChromSlot',
     '#mdTestDesignSlot','#mdPanelVerdict']
      .forEach(s => { const n = $(s); if (n) n.innerHTML = ''; });
  });
  $('#mdExportBtn').addEventListener('click', _exportTsv);
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _populateFocalPicker();
  if (state.marker_designer.tested_chroms && $('#mdTested')) {
    $('#mdTested').value = state.marker_designer.tested_chroms === true
      ? 'non_focal' : state.marker_designer.tested_chroms;
  }
  wireDesigner();
  if (state.marker_designer.last_design) {
    _renderFocalStatus(); _renderPanelSummary(); _renderPerChrom();
    _renderTestDesign(); _renderPanelVerdict();
  } else {
    _runDesigner();   // populate on first mount
  }
}

export async function unmount(root) {
  _setActiveState(null);
}
