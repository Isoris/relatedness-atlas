// atlases/relatedness/pages/hub/compatibility.js
// =============================================================================
// Compatibility page — sub-tab #5. Breeding partner finder. Given a focal
// individual + target offspring karyotype + inversion scope, finds every
// other individual whose cross with the focal could produce the target.
//
// Extracted verbatim from legacy Relatedness_atlas.js §9b (lines 2545-2940),
// with three changes:
//   1. ES-module imports.
//   2. Event wiring runs once per mount() (not at IIFE-evaluation time).
//   3. state.compat initial moved into shared/state.js so other pages can
//      pre-seed scope/inv_single before they navigate here.
// =============================================================================

import { $, el } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { sexBadgeHtml } from '../../shared/sex_badge.js';
import { computeAndWait, isComputeAvailable, resolveLatestLayer } from '../../shared/api_client.js';
import { _setActiveState } from './compatibility/_state.js';

const SERVER_ENDPOINT = 'relatedness_compatibility_search';
let _serverComputeAvailable = false;

// ─── §9b verbatim body ────────────────────────────────────────────────────

const COMPAT_RULES = {
  '0/0': {
    '0/0': { guaranteed: ['0/0'], possible: ['0/1'] },
    '0/1': { guaranteed: ['1/1'], possible: ['0/1'] },
    '1/1': { guaranteed: [],      possible: ['0/1'] },
  },
  '0/1': {
    '0/0': { guaranteed: [],      possible: ['0/0','0/1'] },
    '0/1': { guaranteed: [],      possible: ['0/0','0/1','1/1'] },
    '1/1': { guaranteed: [],      possible: ['0/1','1/1'] },
  },
  '1/1': {
    '0/0': { guaranteed: [],      possible: ['0/1'] },
    '0/1': { guaranteed: ['0/0'], possible: ['0/1'] },
    '1/1': { guaranteed: ['1/1'], possible: ['0/1'] },
  },
};

function offspringDist(p1, p2) {
  if (!p1 || !p2 || p1 === 'NA' || p2 === 'NA') return null;
  const probs = { '0/0': 0, '0/1': 0, '1/1': 0 };
  const a = p1.split('/').map(Number);
  const b = p2.split('/').map(Number);
  for (const aa of a) for (const bb of b) {
    const sum = aa + bb;
    const k = sum === 0 ? '0/0' : (sum === 1 ? '0/1' : '1/1');
    probs[k] += 0.25;
  }
  return probs;
}

function evaluatePartnership(focalId, partnerId, invSet, targetKt) {
  const focalK   = DEMO.karyotype_matrix[focalId]   || {};
  const partnerK = DEMO.karyotype_matrix[partnerId] || {};
  const perInv = [];
  let n_guaranteed = 0, n_possible = 0, n_impossible = 0, n_unknown = 0;
  for (const inv of invSet) {
    const fk = focalK[inv.candidate];
    const pk = partnerK[inv.candidate];
    if (!fk || !pk || fk === 'NA' || pk === 'NA') {
      perInv.push({ inv: inv.candidate, focal_kt: fk || 'NA', partner_kt: pk || 'NA',
                     prob_target: null, status: 'unknown' });
      n_unknown++; continue;
    }
    const dist = offspringDist(fk, pk);
    const p = dist[targetKt] || 0;
    let status;
    if (p >= 0.999)      { status = 'guaranteed'; n_guaranteed++; }
    else if (p > 0)      { status = 'possible';   n_possible++; }
    else                 { status = 'impossible'; n_impossible++; }
    perInv.push({ inv: inv.candidate, focal_kt: fk, partner_kt: pk,
                   prob_target: p, status });
  }
  let verdict;
  if (n_impossible > 0)            verdict = 'reject';
  else if (n_guaranteed === invSet.length - n_unknown && n_guaranteed > 0)
                                   verdict = 'ideal';
  else if (n_guaranteed > 0)       verdict = 'good';
  else if (n_possible > 0)         verdict = 'possible';
  else                             verdict = 'unknown';
  return { partner_id: partnerId, n_guaranteed, n_possible, n_impossible, n_unknown,
           verdict, perInv };
}

function getCompatInversionSet() {
  const scope = $('#compatInvScope').value;
  if (scope === 'single') {
    const id = $('#compatInvSingle').value;
    return DEMO.inversion_candidates_full.filter(i => i.candidate === id);
  } else if (scope === 'chrom') {
    const c = $('#compatChrom').value;
    return DEMO.inversion_candidates_full.filter(i => i.chromosome === c);
  } else {
    return DEMO.inversion_candidates_full;
  }
}

async function runCompatibilitySearch() {
  const focalId  = $('#compatFocal').value;
  const targetKt = $('#compatTarget').value;
  const invSet   = getCompatInversionSet();
  const sexAware = $('#compatSexAware').checked;
  const excludeKin = $('#compatExcludeKin').checked;
  const excludeAmb = $('#compatExcludeAmbig').checked;

  state.compat = {
    focal: focalId, target: targetKt,
    scope: $('#compatInvScope').value,
    inv_single: $('#compatInvSingle').value,
    chrom: $('#compatChrom').value,
    sex_aware: sexAware,
    exclude_kin: excludeKin,
    exclude_amb: excludeAmb,
    last_results: null,
  };

  // Server fast path — if /compute/relatedness_compatibility_search is
  // registered we dispatch there. The endpoint returns the same shape
  // renderCompatibilityResults() expects.
  if (_serverComputeAvailable) {
    try {
      const args = {
        focal_id:         focalId,
        target_karyotype: targetKt,
        scope:            $('#compatInvScope').value,
        inv_single:       $('#compatInvSingle').value,
        chrom:            $('#compatChrom').value,
        sex_aware:        sexAware,
        exclude_kin:      excludeKin,
        exclude_ambig:    excludeAmb,
      };
      const result = await computeAndWait(SERVER_ENDPOINT, args);
      state.compat.last_results = result;
      renderCompatibilityResults();
      return;
    } catch (err) {
      console.warn('[compatibility] server compute failed, falling back in-browser:', err);
      // fall through to local path
    }
  }

  let candidates = DEMO.individuals.filter(p => p !== focalId);

  let sex_data_available = true;
  let sex_filter_applied = false;
  if (sexAware) {
    const focalSex = (DEMO.sex || {})[focalId];
    if (!focalSex || focalSex === '?' || focalSex === 'unknown') {
      sex_data_available = false;
    } else {
      candidates = candidates.filter(p => {
        const ps = (DEMO.sex || {})[p];
        if (!ps || ps === '?') return false;
        return ps !== focalSex;
      });
      sex_filter_applied = true;
    }
  }

  if (excludeKin) {
    const kinList = new Set();
    DEMO.network_edges.forEach(e => {
      if (e.class === 'strong_po' || e.class === 'possible_po') {
        if (e.a === focalId) kinList.add(e.b);
        if (e.b === focalId) kinList.add(e.a);
      }
    });
    candidates = candidates.filter(p => !kinList.has(p));
  }

  const results = candidates.map(p => evaluatePartnership(focalId, p, invSet, targetKt));

  const order = { ideal: 0, good: 1, possible: 2, unknown: 3, reject: 4 };
  results.sort((a, b) => {
    if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
    return b.n_guaranteed - a.n_guaranteed;
  });

  state.compat.last_results = {
    focal: focalId, target: targetKt, invSet,
    sex_data_available, sex_filter_applied,
    results,
  };
  renderCompatibilityResults();
}

function renderCompatibilityResults() {
  const sumSlot = $('#compatSummary');
  const resSlot = $('#compatResultSlot');
  sumSlot.innerHTML = ''; resSlot.innerHTML = '';
  const r = state.compat.last_results;
  if (!r) return;

  const focalSex = (DEMO.sex || {})[r.focal] || '?';
  const sexNote = state.compat.sex_aware
    ? (r.sex_data_available
        ? ` (filtering for opposite-sex partners; focal is ${focalSex})`
        : ' (sex-aware enabled but no sex data for focal — falling back to non-sex-aware)')
    : '';
  const n_total = r.results.length;
  const n_ideal = r.results.filter(x => x.verdict === 'ideal').length;
  const n_good  = r.results.filter(x => x.verdict === 'good').length;
  const n_poss  = r.results.filter(x => x.verdict === 'possible').length;
  const n_rej   = r.results.filter(x => x.verdict === 'reject').length;
  sumSlot.appendChild(el('div', { class: 'compat-summary', html:
    `<b>${r.focal}</b> ${sexBadgeHtml(r.focal)} · target offspring `
    + `<b>${r.target}</b>${sexNote}<br/>`
    + `Tested across <b>${r.invSet.length}</b> inversion candidate(s). `
    + `<b>${n_total}</b> partners considered: `
    + `<b>${n_ideal}</b> ideal · <b>${n_good}</b> good · `
    + `<b>${n_poss}</b> possible-only · <b>${n_rej}</b> rejected.`
  }));

  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead');
  const tr = el('tr');
  ['Partner','Sex','Verdict','Guaranteed','Possible','Impossible','Per-inversion preview']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  r.results.forEach(p => {
    const t = el('tr');
    t.appendChild(el('td', { class: 'sample-id', text: p.partner_id }));
    t.appendChild((function(){
      const td = el('td'); td.innerHTML = sexBadgeHtml(p.partner_id);
      return td;
    })());
    {
      const td = el('td');
      const cls = p.verdict === 'ideal'    ? 'pass'
                : p.verdict === 'good'     ? 'pass'
                : p.verdict === 'possible' ? 'warn'
                : p.verdict === 'unknown'  ? 'weak'
                                           : 'fail';
      td.appendChild(el('span', {
        class: p.verdict === 'unknown' ? 'tier-pill weak' : 'status-pill-cell ' + cls,
        text: p.verdict.toUpperCase(),
      }));
      t.appendChild(td);
    }
    t.appendChild(el('td', { class: 'num', text: String(p.n_guaranteed) }));
    t.appendChild(el('td', { class: 'num', text: String(p.n_possible) }));
    t.appendChild(el('td', { class: 'num', text: String(p.n_impossible),
                             style: p.n_impossible > 0 ? { color: 'var(--bad)' } : {} }));
    const prev = p.perInv.slice(0, 5).map(pi =>
      pi.inv + ': ' + pi.focal_kt + '×' + pi.partner_kt
        + (pi.status === 'guaranteed' ? ' ✓✓'
            : pi.status === 'possible' ? ' ~'
            : pi.status === 'impossible' ? ' ✗'
            : ' ?')
    ).join('   ');
    t.appendChild(el('td', { text: prev,
      style: { fontSize: '9px', color: 'var(--ink-dim)' } }));
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  resSlot.appendChild(tbl);

  if (n_ideal > 0) {
    resSlot.appendChild(el('div', {
      class: 'ie-conclusion tier-strong',
      style: { marginTop: '12px' },
      html: `<div class="verdict">${n_ideal} IDEAL PARTNER${n_ideal>1?'S':''}</div>`
          + `Crossing <b>${r.focal}</b> with any of the IDEAL-tier partners `
          + `produces the <b>${r.target}</b> target with 100% certainty across all `
          + `${r.invSet.length} tested inversion(s). These are the recommended crosses.`
    }));
  } else if (n_good > 0) {
    resSlot.appendChild(el('div', {
      class: 'ie-conclusion tier-moderate',
      style: { marginTop: '12px' },
      html: `<div class="verdict">${n_good} GOOD PARTNER${n_good>1?'S':''}</div>`
          + `These produce the target with probability 1.0 for some inversions and `
          + `> 0 for others (no rejections). Pick based on which inversions you want `
          + `guaranteed vs. possible.`
    }));
  } else if (n_poss > 0) {
    resSlot.appendChild(el('div', {
      class: 'ie-conclusion tier-weak',
      style: { marginTop: '12px' },
      html: '<div class="verdict">NO IDEAL PARTNERS</div>'
          + `Only "possible" partners exist (target reachable with probability `
          + `< 1.0). Crossing in numbers may yield the target by chance, but no `
          + `partner guarantees it.`
    }));
  } else {
    resSlot.appendChild(el('div', {
      class: 'ie-conclusion tier-conflict',
      style: { marginTop: '12px' },
      html: '<div class="verdict">NO COMPATIBLE PARTNERS</div>'
          + `Every candidate produced an impossible cross for at least one tested `
          + `inversion. Try relaxing the inversion scope or the target karyotype.`
    }));
  }
}

function exportCompatibilityTsv() {
  const r = state.compat.last_results;
  if (!r) { alert('Run a compatibility search first.'); return; }
  const cols = ['partner_id','partner_sex','verdict','n_guaranteed','n_possible','n_impossible','n_unknown'];
  const lines = [
    '# Compatibility search',
    '# Focal: ' + r.focal + '  Sex: ' + ((DEMO.sex || {})[r.focal] || '?'),
    '# Target offspring karyotype: ' + r.target,
    '# Inversion set: ' + r.invSet.length + ' candidate(s)',
    '# Sex-aware: ' + state.compat.sex_aware
      + (state.compat.sex_aware && !r.sex_data_available
          ? ' (no sex data — fallback to non-sex-aware)' : ''),
    '# Exclude close kin: ' + state.compat.exclude_kin,
    '#',
    cols.join('\t'),
  ];
  r.results.forEach(p => {
    lines.push([p.partner_id, (DEMO.sex || {})[p.partner_id] || '?',
                p.verdict, p.n_guaranteed, p.n_possible,
                p.n_impossible, p.n_unknown].join('\t'));
  });
  lines.push('');
  lines.push('# Per-inversion detail');
  lines.push(['partner_id','inv_id','focal_kt','partner_kt','prob_target','status'].join('\t'));
  r.results.forEach(p => {
    p.perInv.forEach(pi => {
      lines.push([p.partner_id, pi.inv, pi.focal_kt, pi.partner_kt,
                  pi.prob_target === null ? '' : pi.prob_target.toFixed(3),
                  pi.status].join('\t'));
    });
  });
  downloadTsv('compatibility_' + r.focal + '_' + r.target.replace('/','-')
              + '_' + Date.now() + '.tsv',
              lines.join('\n') + '\n');
}

function downloadTsv(filename, content) {
  const blob = new Blob([content], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function populateCompatSelectors() {
  const focalSel = $('#compatFocal');
  focalSel.innerHTML = '';
  DEMO.individuals.forEach(i => focalSel.appendChild(el('option', { value: i, text: i })));
  const invSingleSel = $('#compatInvSingle');
  invSingleSel.innerHTML = '';
  DEMO.inversion_candidates_full.slice(0, 50).forEach(i =>
    invSingleSel.appendChild(el('option', { value: i.candidate,
      text: i.candidate + ' — ' + i.chromosome + ' ' + i.start_mb.toFixed(1)
            + '-' + i.end_mb.toFixed(1) + 'Mb' })));
  const chromSel = $('#compatChrom');
  chromSel.innerHTML = '';
  DEMO.chromosomes.forEach(c => chromSel.appendChild(el('option', { value: c, text: c })));
  chromSel.value = state.compat.chrom || 'Chr28';
}

function updateCompatScopeUI() {
  const scope = $('#compatInvScope').value;
  $('#compatSingleRow').style.display = (scope === 'single') ? '' : 'none';
  $('#compatChromRow').style.display  = (scope === 'chrom')  ? '' : 'none';
}

function wireCompatibility() {
  $('#compatInvScope').addEventListener('change', updateCompatScopeUI);
  $('#compatRunBtn').addEventListener('click', runCompatibilitySearch);
  $('#compatResetBtn').addEventListener('click', () => {
    state.compat.last_results = null;
    $('#compatSummary').innerHTML = '';
    $('#compatResultSlot').innerHTML = '';
  });
  $('#compatExportBtn').addEventListener('click', exportCompatibilityTsv);
}

// ─── Envelope-aware data source detection (2026-05-14) ──────────────────
// Probes the atlas-core action pipeline for the latest normalized
// ngsrelate_pairs envelope. When one exists, the page advertises it
// above the planner — the "Exclude close kin (PO/FS)" filter could
// eventually consult those pairs instead of demo data.

async function _findRelatednessEnvelope(atlasState) {
  const dataset_id = (atlasState && atlasState.cohort) || undefined;
  try {
    return await resolveLatestLayer('ngsrelate_pairs', {
      dataset_id, stage: 'normalized',
    });
  } catch (_e) { return null; }
}

function _renderDataSourceBadge(envelope) {
  const slot = $('#compatibilityDataSource');
  if (!slot) return;
  if (envelope == null) {
    slot.className = 'data-source-badge demo';
    slot.textContent =
      '◌  Close-kin filter is using DEMO data ' +
      '(no ngsrelate_pairs envelope for this cohort).';
    slot.title = 'Run normalize_relatedness against a staging_relatedness_v0 ' +
                 'envelope to make this filter use real pairwise theta.';
    return;
  }
  const n = (envelope.payload && envelope.payload.summary
              && envelope.payload.summary.n_pairs) || 0;
  slot.className = 'data-source-badge live';
  slot.textContent =
    `●  ngsrelate_pairs envelope available: ${n} pair${n === 1 ? '' : 's'} ` +
    `from ${envelope.layer_id} (close-kin filter can use this).`;
  slot.title = `Provenance: action_id=${envelope.provenance?.action_id || '?'}` +
               (envelope.provenance?.source_layer_ids
                ? `, source_layer_ids=[${envelope.provenance.source_layer_ids.join(', ')}]`
                : '');
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  populateCompatSelectors();

  // Probe the server endpoint in the background — covered by the fallback.
  isComputeAvailable(SERVER_ENDPOINT)
    .then(v => { _serverComputeAvailable = v; })
    .catch(err => console.warn('[compatibility] server probe failed:', err));

  // Envelope probe runs asynchronously after the synchronous setup so the
  // page is interactive immediately; the badge updates when the probe
  // resolves. Any failure (404, offline, CORS) silently degrades to DEMO.
  _findRelatednessEnvelope(atlasState)
    .then(_renderDataSourceBadge)
    .catch(() => _renderDataSourceBadge(null));

  // If pre-seeded by Inversions tab "→ Compatibility planner" action.
  if (state.compat.scope) $('#compatInvScope').value = state.compat.scope;
  if (state.compat.inv_single) $('#compatInvSingle').value = state.compat.inv_single;
  if (state.compat.chrom) $('#compatChrom').value = state.compat.chrom;

  updateCompatScopeUI();
  wireCompatibility();

  if (state.compat.last_results) renderCompatibilityResults();
}

export async function unmount(root) {
  _setActiveState(null);
}
