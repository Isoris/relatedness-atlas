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
import {
  karyoFor, loadLiveKaryotypes, renderKaryotypeBadgeSlots,
} from '../../shared/karyotype_source.js';
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
  const focalK   = karyoFor(focalId);
  const partnerK = karyoFor(partnerId);
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

  let results = candidates.map(p => evaluatePartnership(focalId, p, invSet, targetKt));

  // Exclude partners with any NA karyotype in scope when the checkbox is
  // on. Literal "Exclude ambiguous karyotypes" interpretation — breeding
  // decisions shouldn't be made on partners with missing genotype data.
  // Default-ON; uncheck for sparse-data cohorts where most partners have
  // at least one NA.
  if (excludeAmb) {
    results = results.filter(r => r.n_unknown === 0);
  }

  const order = { ideal: 0, good: 1, possible: 2, unknown: 3, reject: 4 };
  results.sort((a, b) => {
    if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
    return b.n_guaranteed - a.n_guaranteed;
  });

  state.compat.last_results = {
    focal: focalId, target: targetKt, invSet,
    sex_data_available, sex_filter_applied,
    n_excluded_ambig: excludeAmb ? candidates.length - results.length : 0,
    results,
  };
  renderCompatibilityResults();
}

// ─── Breeding-decision overlay (2026-05-15) ──────────────────────────────
// Surfaces inheritance-side warnings on top of the basic compatibility
// verdict so the planner becomes the first stub of the breeding-AI advisor:
//   - "this pair may suppress recombination on LGxx" (heterokaryote × hom_alt)
//   - "this pair is genetically redundant"           (shared focal arrangement)
//   - "this pair is worth testing at scale"          (clean diagnostic cross)
function _renderBreedingDecisionOverlay() {
  const wrap = $('#compatBreedingOverlay');
  const body = $('#compatBreedingBody');
  if (!wrap || !body) return;
  const r = state.compat.last_results;
  if (!r || !r.results) {
    wrap.style.display = 'none';
    return;
  }
  // Score the top partner against meiosis / regime concerns.
  const top = r.results.find(p => p.verdict === 'ideal' || p.verdict === 'good')
           || r.results[0];
  if (!top) { wrap.style.display = 'none'; return; }

  const focalKtMap = karyoFor(r.focal);
  const partnerKtMap = karyoFor(top.partner_id);
  const flags = [];

  // 1. Heterokaryote × X — recombination-suppression flag inside any
  //    inversion span where the focal is het. (Heterokaryote pairing
  //    suppresses CO inside the inversion in the meiosis from the het
  //    parent.)
  const het_invs = Object.keys(focalKtMap).filter(k => focalKtMap[k] === '0/1');
  if (het_invs.length) {
    const exemplar = (DEMO.inversion_candidates_full || [])
      .find(i => i.candidate === het_invs[0]);
    flags.push({
      tone: 'warn',
      text: `<b>${r.focal}</b> is heterokaryotype at <b>${het_invs.length}</b> inversion(s) `
          + (exemplar ? `(e.g. ${exemplar.candidate} on ${exemplar.chromosome})` : '')
          + ` — meiosis from this parent will suppress CO inside the inversion span(s). `
          + `See the <b>Inversion signature</b> tab for the per-candidate verdict.`,
    });
  }

  // 2. Redundancy flag — both parents share the same arrangement at every
  //    tested inversion in the current scope. The cross can't break that
  //    haplotype block.
  const invSet = r.invSet || [];
  if (invSet.length) {
    const same = invSet.filter(i => {
      const a = focalKtMap[i.candidate], b = partnerKtMap[i.candidate];
      return a && b && a === b;
    });
    if (same.length === invSet.length && invSet.length >= 1) {
      flags.push({
        tone: 'warn',
        text: `<b>${r.focal} × ${top.partner_id}</b> share the same karyotype at every inversion `
            + `in the current scope — this cross is <b>genetically redundant</b> for these regions. `
            + `Pick a partner with at least one differing karyotype to recover useful recombinants.`,
      });
    }
  }

  // 3. Inv × meiosis link — if the partner-side scan has been run for this
  //    focal context, summarise the leading row.
  const meioRes = state.focal_meiosis && state.focal_meiosis.last_results;
  if (meioRes && meioRes.rows && meioRes.rows.length) {
    const lead = meioRes.rows.slice()
      .sort((a, b) => Math.abs(b.delta_C || 0) - Math.abs(a.delta_C || 0))[0];
    if (lead && lead.status !== 'no_effect' && lead.status !== 'no_data') {
      flags.push({
        tone: lead.status === 'family_confounded' ? 'fail' : 'warn',
        text: `Latest Inv × meiosis scan for <b>${meioRes.focal_inv}</b>: leading row `
            + `<b>${lead.tested_chr}</b> (${lead.relation}, ΔC = ${fmtSafe(lead.delta_C)}, `
            + `p_perm = ${fmtSafe(lead.p_perm)}, status: ${lead.status}). `
            + `If <b>${r.focal}</b> or <b>${top.partner_id}</b> carries ${meioRes.focal_inv}, `
            + `expect altered recombination on ${lead.tested_chr}.`,
      });
    }
  }

  // 4. Clean diagnostic cross — ideal partner + no shared redundancy.
  if (top.verdict === 'ideal' && !flags.some(f => f.tone === 'warn' || f.tone === 'fail')) {
    flags.push({
      tone: 'good',
      text: `<b>${r.focal} × ${top.partner_id}</b> is a clean diagnostic cross for the target `
          + `karyotype <b>${r.target}</b>. Worth testing at scale (Pass-2 marker validation).`,
    });
  }

  if (!flags.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  body.innerHTML = flags.map(f =>
    `<div style="font-size: 10.5px; line-height: 1.55; margin: 4px 0;
                 color: ${f.tone === 'fail' ? 'var(--bad)'
                       : f.tone === 'warn' ? 'var(--warn)'
                       : f.tone === 'good' ? 'var(--good)' : 'var(--ink)'};">`
    + (f.tone === 'good' ? '✓ ' : f.tone === 'fail' ? '✗ ' : '⚠ ')
    + f.text
    + `</div>`).join('');
}

function fmtSafe(v) {
  return Number.isFinite(v) ? v.toFixed(3) : '—';
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
  const ambigNote = (r.n_excluded_ambig && r.n_excluded_ambig > 0)
    ? ` <span style="color:var(--ink-dim);">(${r.n_excluded_ambig} partner${r.n_excluded_ambig>1?'s':''} excluded by ambiguous-karyotype filter)</span>`
    : '';
  sumSlot.appendChild(el('div', { class: 'compat-summary', html:
    `<b>${r.focal}</b> ${sexBadgeHtml(r.focal)} · target offspring `
    + `<b>${r.target}</b>${sexNote}<br/>`
    + `Tested across <b>${r.invSet.length}</b> inversion candidate(s). `
    + `<b>${n_total}</b> partners considered: `
    + `<b>${n_ideal}</b> ideal · <b>${n_good}</b> good · `
    + `<b>${n_poss}</b> possible-only · <b>${n_rej}</b> rejected.${ambigNote}`
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
  // Breeding-decision overlay — adds inheritance-side warnings on top of
  // the basic verdict (heterokaryote CO suppression, redundancy across
  // shared arrangements, inv × meiosis interactions, clean-cross flag).
  _renderBreedingDecisionOverlay();
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
  } catch (_e) {
    console.warn('[compatibility] ngsrelate_pairs envelope probe failed:', _e);
    return null;
  }
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
  // 2026-05-26: shared karyotype load — idempotent across hub pages.
  // karyoFor() returns DEMO until this resolves, then flips to live.
  loadLiveKaryotypes(registry).catch((e) =>
    console.warn('compatibility.mount: karyotype load threw —', e));
  renderKaryotypeBadgeSlots();
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

  // Restore prior selections on remount so leave-tab → return doesn't wipe
  // user state. Covers both the Inversions-tab "→ Compatibility planner"
  // pre-seed and the normal user-set-then-navigate-away case.
  if (state.compat.focal) $('#compatFocal').value = state.compat.focal;
  if (state.compat.target) $('#compatTarget').value = state.compat.target;
  if (state.compat.scope) $('#compatInvScope').value = state.compat.scope;
  if (state.compat.inv_single) $('#compatInvSingle').value = state.compat.inv_single;
  if (state.compat.chrom) $('#compatChrom').value = state.compat.chrom;
  if (typeof state.compat.sex_aware === 'boolean') $('#compatSexAware').checked = state.compat.sex_aware;
  if (typeof state.compat.exclude_kin === 'boolean') $('#compatExcludeKin').checked = state.compat.exclude_kin;
  if (typeof state.compat.exclude_amb === 'boolean') $('#compatExcludeAmbig').checked = state.compat.exclude_amb;

  updateCompatScopeUI();
  wireCompatibility();

  if (state.compat.last_results) renderCompatibilityResults();
}

export async function unmount(root) {
  _setActiveState(null);
}
