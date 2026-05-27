// atlases/relatedness/pages/hub/cohort_summary.js
// =============================================================================
// Cohort summary (#20). Read-only single-screen overview. Aggregates over
// DEMO.individuals, DEMO.families, DEMO.triads, DEMO.network_edges,
// DEMO.inversion_candidates_full, DEMO.karyotype_matrix, DEMO.sex,
// DEMO.ancestry_q. No new compute.
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { _setActiveState } from './cohort_summary/_state.js';

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

// ─── Scale ──────────────────────────────────────────────────────────────

function _renderScale() {
  const slot = $('#csScale');
  slot.innerHTML = '';
  const n_samples    = (DEMO.individuals || []).length;
  const n_families   = (DEMO.families || []).length;
  const n_assigned   = new Set((DEMO.families || []).flatMap(f => f.members || [])).size;
  const n_unassigned = n_samples - n_assigned;
  const n_triads     = (DEMO.triads || []).length;
  const n_candidates = (DEMO.inversion_candidates_full || []).length;
  const n_chrom_with_cands = new Set(
    (DEMO.inversion_candidates_full || []).map(c => c.chromosome)).size;
  const cohortMeta = DEMO.cohort_meta || {};
  slot.appendChild(_sumCell('species', cohortMeta.species || '—'));
  slot.appendChild(_sumCell('cohort', cohortMeta.cohort || '—'));
  slot.appendChild(_sumCell('n samples', n_samples,
    n_samples < 50 ? 'warn' : null));
  slot.appendChild(_sumCell('n families', n_families,
    n_families < 2 ? 'fail' : null));
  slot.appendChild(_sumCell('n unassigned', n_unassigned,
    n_unassigned > 0 ? 'warn' : 'good'));
  slot.appendChild(_sumCell('n triads', n_triads,
    n_triads < 3 ? 'warn' : null));
  slot.appendChild(_sumCell('n inversion candidates', n_candidates));
  slot.appendChild(_sumCell('chromosomes with candidates', n_chrom_with_cands,
    null, `${(DEMO.chromosomes || []).length} chromosomes total`));
}

// ─── Sex ────────────────────────────────────────────────────────────────

function _renderSex() {
  const slot = $('#csSex');
  slot.innerHTML = '';
  const counts = { F: 0, M: 0, '?': 0 };
  for (const ind of (DEMO.individuals || [])) {
    const s = ((DEMO.sex || {})[ind] || '?').toUpperCase();
    counts[s === 'F' ? 'F' : s === 'M' ? 'M' : '?']++;
  }
  const total = (DEMO.individuals || []).length;
  const pct = (n) => total ? (n / total * 100).toFixed(0) + '%' : '—';
  slot.appendChild(_sumCell('female', counts.F, null, pct(counts.F)));
  slot.appendChild(_sumCell('male',   counts.M, null, pct(counts.M)));
  slot.appendChild(_sumCell('unknown', counts['?'],
    counts['?'] > 0 ? 'warn' : 'good', pct(counts['?'])));
}

// ─── Ancestry ──────────────────────────────────────────────────────────

function _renderAncestry() {
  const slot = $('#csAncestry');
  slot.innerHTML = '';
  const K = (DEMO.ancestry_palette || []).length;
  if (!K) { slot.appendChild(el('div', { text: 'no ancestry data' })); return; }
  const sum = new Array(K).fill(0); let n = 0;
  for (const ind of (DEMO.individuals || [])) {
    const q = DEMO.ancestry_q[ind] || [];
    if (!q.length) continue;
    n++;
    for (let k = 0; k < K; k++) sum[k] += (q[k] || 0);
  }
  const mean = sum.map(v => n ? v / n : 0);
  // Bar.
  const bar = el('div', { class: 'anc-stripe', style: { width: '420px', height: '14px',
    display: 'flex', overflow: 'hidden', borderRadius: '3px', border: '1px solid var(--rule)' } });
  mean.forEach((p, k) => {
    bar.appendChild(el('span', {
      style: { width: (p * 100) + '%',
               background: DEMO.ancestry_palette[k % DEMO.ancestry_palette.length] },
      title: `K${k+1}: ${(p * 100).toFixed(1)}%`,
    }));
  });
  slot.appendChild(bar);
  // Per-K table.
  const tbl = el('table', { class: 'data-table', style: { marginTop: '8px' } });
  const thead = el('thead'); const tr = el('tr');
  ['K','mean Q','%'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  mean.map((v, k) => ({ k, v }))
      .sort((a, b) => b.v - a.v)
      .forEach(row => {
        const r = el('tr');
        const swatch = el('span', { class: 'kt-cell',
          style: { background: DEMO.ancestry_palette[row.k % DEMO.ancestry_palette.length],
                   width: '12px', height: '12px', display: 'inline-block',
                   marginRight: '6px', verticalAlign: 'middle' } });
        const kTd = el('td');
        kTd.appendChild(swatch);
        kTd.appendChild(document.createTextNode('K' + (row.k + 1)));
        r.appendChild(kTd);
        r.appendChild(el('td', { class: 'num', text: fmt(row.v) }));
        r.appendChild(el('td', { class: 'num', text: (row.v * 100).toFixed(1) + '%' }));
        tbody.appendChild(r);
      });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Families ──────────────────────────────────────────────────────────

function _renderFamilies() {
  const slot = $('#csFamilies');
  slot.innerHTML = '';
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Family','Hub','n members','n triads here']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  (DEMO.families || []).forEach(f => {
    const tInHub = (DEMO.triads || []).filter(t =>
      (f.members || []).includes(t.parent_a) &&
      (f.members || []).includes(t.parent_b) &&
      (f.members || []).includes(t.offspring));
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: f.family_id }));
    row.appendChild(el('td', { text: f.hub_individual || '—' }));
    row.appendChild(el('td', { class: 'num', text: String(f.n) }));
    const ttd = el('td', { class: 'num', text: String(tInHub.length) });
    if (tInHub.length === 0) ttd.style.color = 'var(--warn)';
    row.appendChild(ttd);
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Inversion candidate status ────────────────────────────────────────

function _renderInvStatus() {
  const slot = $('#csInvStatus');
  slot.innerHTML = '';
  const buckets = { pass: 0, warn: 0, fail: 0, other: 0 };
  for (const c of (DEMO.inversion_candidates_full || [])) {
    if (buckets[c.status] !== undefined) buckets[c.status]++;
    else buckets.other++;
  }
  slot.appendChild(_sumCell('PASS', buckets.pass, 'good'));
  slot.appendChild(_sumCell('WARN', buckets.warn, buckets.warn > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('FAIL', buckets.fail, buckets.fail > 0 ? 'fail' : null));
  if (buckets.other) slot.appendChild(_sumCell('other', buckets.other, 'warn'));
}

// ─── Frequency spectrum ───────────────────────────────────────────────

function _renderFreqSpectrum() {
  const slot = $('#csFreqSpectrum');
  slot.innerHTML = '';
  const candidates = DEMO.inversion_candidates_full || [];
  const bins = [0, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 1.01];
  const counts = new Array(bins.length - 1).fill(0);
  for (const c of candidates) {
    for (let i = 0; i < bins.length - 1; i++) {
      if (c.frequency >= bins[i] && c.frequency < bins[i + 1]) { counts[i]++; break; }
    }
  }
  const maxC = Math.max(...counts, 1);
  const wrap = el('div', { style: { display: 'flex', gap: '2px',
    alignItems: 'flex-end', height: '100px',
    borderBottom: '1px solid var(--rule)', padding: '2px 0' } });
  counts.forEach((n, i) => {
    const h = (n / maxC) * 100;
    const bar = el('div', {
      style: { width: '60px', background: 'var(--accent)',
               height: h + '%', borderRadius: '2px 2px 0 0' },
      title: `${bins[i].toFixed(2)}–${bins[i+1].toFixed(2)}: n=${n}`,
    });
    const col = el('div', { style: { display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end' } },
      bar,
      el('div', { style: { fontSize: '9px', color: 'var(--ink-dim)',
        marginTop: '2px', fontFamily: 'var(--mono)' },
        text: bins[i].toFixed(2) + '–' + bins[i+1].toFixed(2) }),
      el('div', { style: { fontSize: '10px', color: 'var(--ink)',
        fontFamily: 'var(--mono)' }, text: String(n) }),
    );
    wrap.appendChild(col);
  });
  slot.appendChild(wrap);
  slot.appendChild(el('div', { class: 'meiosis-caption',
    text: 'Bins are population allele-frequency intervals. Rare alleles (<5%) are usually power-limited for downstream analyses.' }));
}

// ─── Karyotype call rate ──────────────────────────────────────────────

function _renderCallRate() {
  const slot = $('#csCallRate');
  slot.innerHTML = '';
  let total = 0, typed = 0;
  const candidates = DEMO.inversion_candidates_full || [];
  for (const ind of (DEMO.individuals || [])) {
    for (const c of candidates) {
      total++;
      const k = (DEMO.karyotype_matrix[ind] || {})[c.candidate];
      if (k && k !== 'NA') typed++;
    }
  }
  const pct = total ? (typed / total * 100) : 0;
  slot.appendChild(_sumCell('total cells', total));
  slot.appendChild(_sumCell('typed cells', typed));
  slot.appendChild(_sumCell('call rate', pct.toFixed(2) + '%',
    pct < 80 ? 'warn' : 'good'));
}

// ─── Edges ────────────────────────────────────────────────────────────

function _renderEdges() {
  const slot = $('#csEdges');
  slot.innerHTML = '';
  const counts = { strong_po: 0, possible_po: 0, ambiguous: 0, mendelian_conflict: 0 };
  for (const e of (DEMO.network_edges || [])) {
    if (counts[e.class] !== undefined) counts[e.class]++;
  }
  slot.appendChild(_sumCell('strong PO',  counts.strong_po, 'good'));
  slot.appendChild(_sumCell('possible PO', counts.possible_po,
    counts.possible_po > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('ambiguous', counts.ambiguous,
    counts.ambiguous > 0 ? 'warn' : null));
  slot.appendChild(_sumCell('Mendelian conflict', counts.mendelian_conflict,
    counts.mendelian_conflict > 0 ? 'fail' : null));
}

// ─── Per-analysis runnability ─────────────────────────────────────────

function _renderRunnability() {
  const slot = $('#csRunnability');
  slot.innerHTML = '';
  const n_triads = (DEMO.triads || []).length;
  const n_families = (DEMO.families || []).length;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Analysis','Today','Note'].forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  const rows = [
    ['mendelian_dyad_test',          'READY',   'real numbers; karyotype + triads available'],
    ['mendelian_triad_test',         n_triads >= 1 ? 'READY' : 'BLOCKED', n_triads + ' triads in DEMO.triads'],
    ['cohort_mendelian_scan',        n_triads >= 1 ? 'READY' : 'BLOCKED', '4-stage scoring · uses triads'],
    ['compatibility_search',         'READY',   'karyotype-only'],
    ['bdmi_screen (A–E)',            'READY',   'karyotype + ancestry + triads available; Test F gated on phenotype layer'],
    ['regimes_linked_inversion',     'READY',   'karyotype-only; needs ≥2 candidates on a chromosome (true today)'],
    ['regimes_mechanism_classifier', n_triads >= 3 ? 'READY' : 'WARN',  n_triads + ' triads (≥3 recommended)'],
    ['single_co_calculator',         'READY',   'pure formula on user input'],
    ['eligibility / resolution / coincidence / inversion_signature', 'GATED',
      'reads DEMO.recomb_windows · synthetic until ngsTracts adapter ships'],
    ['focal_inversion_meiosis_scan', 'GATED',   'permutation framework real; carrier-effect synthetic until ngsTracts ships'],
    ['inversion_priority_rank',      'GATED',   'mixes 1 real signal (Mendelian) and 2 synthetic (intra/inter recomb)'],
    ['marker_panel_design',          'PARTIAL', 'focal markers real; per-chrom grids + expected_DCO synthetic'],
  ];
  rows.forEach(([name, st, note]) => {
    const row = el('tr');
    row.appendChild(el('td', { class: 'sample-id', text: name }));
    const stTd = el('td');
    const cls = st === 'READY'   ? 'pass'
              : st === 'PARTIAL' ? 'warn'
              : st === 'WARN'    ? 'warn'
              : st === 'GATED'   ? 'warn'
              :                    'fail';
    stTd.appendChild(el('span', { class: 'status-pill-cell ' + cls, text: st }));
    row.appendChild(stTd);
    row.appendChild(el('td', { text: note,
      style: { fontSize: '9.5px', color: 'var(--ink-dim)' } }));
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
}

// ─── Manuscript phrasing ──────────────────────────────────────────────

function _renderManuscript() {
  const slot = $('#csManuscriptBody');
  if (!slot) return;
  const cohortMeta = DEMO.cohort_meta || {};
  const n_samples = (DEMO.individuals || []).length;
  const n_families = (DEMO.families || []).length;
  const n_triads = (DEMO.triads || []).length;
  const n_candidates = (DEMO.inversion_candidates_full || []).length;
  const n_pass = (DEMO.inversion_candidates_full || []).filter(c => c.status === 'pass').length;
  slot.innerHTML =
    `We analysed <b>${n_samples}</b> ${cohortMeta.species || 'samples'} from `
    + `<b>${n_families}</b> family hub${n_families === 1 ? '' : 's'} `
    + `(<b>${n_triads}</b> informative triads) `
    + `at <b>${n_candidates}</b> inversion candidates `
    + `(<b>${n_pass}</b> PASS / `
    + `${(DEMO.inversion_candidates_full || []).filter(c => c.status === 'warn').length} WARN / `
    + `${(DEMO.inversion_candidates_full || []).filter(c => c.status === 'fail').length} FAIL).`;
}

function _drawAll() {
  _renderScale();
  _renderSex();
  _renderAncestry();
  _renderFamilies();
  _renderInvStatus();
  _renderFreqSpectrum();
  _renderCallRate();
  _renderEdges();
  _renderRunnability();
  _renderManuscript();
}

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _drawAll();
}

export async function unmount(root) {
  _setActiveState(null);
}
