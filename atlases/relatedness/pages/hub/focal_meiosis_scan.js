// atlases/relatedness/pages/hub/focal_meiosis_scan.js
// =============================================================================
// Focal inversion × meiosis coincidence scan — sub-tab #13.
//
// Page is intentionally thin: it wires the picker / scope / n-perm controls
// to shared/inversion_meiosis.js::runFocalScan and renders the rows. All
// math (carriers, baseline C, carrier effect, permutation null, readiness)
// lives in the shared module so it can migrate to the Meiosis Atlas
// without page-side changes.
//
// Architecture pointer (per the user's summary):
//   Inversion Atlas      → inversion candidates / boundaries / karyotypes
//   Relatedness Atlas    → family hubs / parent-offspring edges / valid dyads
//   ngsPedigree/ngsTract → inheritance tracts / SCO+DCO counts / coincidence
//   Meiosis Atlas        → this analysis once that atlas is created
// =============================================================================

import { $, el, fmt } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { on } from '../../shared/page_hooks.js';
import { renderKaryotypeTable } from '../../shared/karyotype_table.js';
import {
  runFocalScan, readinessLevels, STATUS_LABEL,
  carriersOf, controlsOf, focalChromOf, carrierHubShare,
} from '../../shared/inversion_meiosis.js';
import { _setActiveState } from './focal_meiosis_scan/_state.js';

// ─── Pickers ────────────────────────────────────────────────────────────

function _populateFocalPicker() {
  const sel = $('#fmsFocal');
  sel.innerHTML = '';
  // Prefer pass / warn candidates first, then everything else.
  const order = (c) =>
    (c.status === 'pass' ? 0 : c.status === 'warn' ? 1 : c.status === 'fail' ? 2 : 3);
  const cands = (DEMO.inversion_candidates_full || []).slice()
    .sort((a, b) => order(a) - order(b));
  for (const inv of cands) {
    sel.appendChild(el('option', {
      value: inv.candidate,
      text: `${inv.candidate} · ${inv.chromosome} ${inv.start_mb}-${inv.end_mb} Mb · ${inv.status}`,
    }));
  }
  sel.value = state.focal_meiosis.focal_inv || (cands[0] && cands[0].candidate);
  state.focal_meiosis.focal_inv = sel.value;
}

// ─── Readiness ──────────────────────────────────────────────────────────

const READINESS_LABELS = {
  basic_ready:        'basic — carriers vs non-carriers possible',
  family_ready:       'family — hubs available for permutation null',
  controlled_ready:   'controlled — other inv karyotypes for local control',
  interaction_ready:  'interaction — N enough for inv × inv tests',
  phenotype_ready:    'phenotype — survival / fertility table loaded',
};

function _renderReadiness() {
  const slot = $('#fmsReadiness');
  slot.innerHTML = '';
  const r = readinessLevels(state.focal_meiosis.focal_inv);
  const order = ['basic_ready','family_ready','controlled_ready','interaction_ready','phenotype_ready'];
  for (const k of order) {
    const ok = !!r[k];
    const row = el('div', { class: 'fms-readiness-row' },
      el('span', {
        class: 'fms-readiness-pill ' + (ok ? 'ready' : 'blocked'),
        text: ok ? '✓ ready' : '✗ blocked',
      }),
      el('span', { class: 'fms-readiness-label', text: READINESS_LABELS[k] }),
    );
    slot.appendChild(row);
  }
  // counts footer
  slot.appendChild(el('div', { class: 'fms-readiness-footer',
    text: `n_carriers=${r.n_carriers} · n_controls=${r.n_controls}`
        + ` · n_hubs(carriers)=${r.n_hubs} · n_other_invs=${r.n_other_invs}`
  }));
}

// ─── Summary cells (carriers / controls / hub share) ───────────────────

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
  const slot = $('#fmsSummary');
  slot.innerHTML = '';
  const f = state.focal_meiosis.focal_inv;
  const carriers = carriersOf(f);
  const controls = controlsOf(f);
  const hub = carrierHubShare(carriers);
  slot.appendChild(_sumCell('focal',            f));
  slot.appendChild(_sumCell('focal chrom',      focalChromOf(f) || '—'));
  slot.appendChild(_sumCell('carriers',         carriers.length,
    carriers.length === 0 ? 'fail' : null));
  slot.appendChild(_sumCell('controls',         controls.length,
    controls.length === 0 ? 'fail' : null));
  slot.appendChild(_sumCell('top hub share',    (hub.share * 100).toFixed(0) + '%',
    hub.share >= 0.80 ? 'fail' : (hub.share >= 0.60 ? 'warn' : null),
    hub.hub ? `${hub.count} / ${carriers.length} carriers in ${hub.hub}` : ''));
}

// ─── Results table ──────────────────────────────────────────────────────

const STATUS_TIER = {
  strong_effect:     'fail',
  moderate_effect:   'warn',
  weak_effect:       'warn',
  no_effect:         null,
  family_confounded: 'fail',
  no_data:           null,
};

function _renderResults() {
  const slot = $('#fmsResultSlot');
  slot.innerHTML = '';
  const res = state.focal_meiosis.last_results;
  if (!res) return;
  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead'); const tr = el('tr');
  ['Tested','Relation','n carriers','n controls','C carrier','C control','ΔC','p_perm','Status']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody = el('tbody');
  // Sort: intra first, then by |ΔC| desc.
  const rows = res.rows.slice().sort((a, b) => {
    if (a.relation !== b.relation) return a.relation === 'intra' ? -1 : 1;
    const aD = Math.abs(a.delta_C || 0), bD = Math.abs(b.delta_C || 0);
    return bD - aD;
  });
  rows.forEach(r => {
    const t = el('tr', { class: 'clickable' });
    t.addEventListener('click', () => _renderDetail(r));
    t.appendChild(el('td', { class: 'sample-id', text: r.tested_chr }));
    const relTd = el('td');
    relTd.appendChild(el('span', {
      class: 'fms-rel-pill ' + (r.relation === 'intra' ? 'intra' : 'inter'),
      text: r.relation.toUpperCase(),
    }));
    t.appendChild(relTd);
    t.appendChild(el('td', { class: 'num', text: String(r.n_carriers) }));
    t.appendChild(el('td', { class: 'num', text: String(r.n_controls) }));
    t.appendChild(el('td', { class: 'num', text: fmt(r.C_carrier) }));
    t.appendChild(el('td', { class: 'num', text: fmt(r.C_control) }));
    const dTd = el('td', { class: 'num', text: fmt(r.delta_C) });
    if (Number.isFinite(r.delta_C)) {
      if (Math.abs(r.delta_C) >= 0.30) dTd.style.color = 'var(--bad)';
      else if (Math.abs(r.delta_C) >= 0.15) dTd.style.color = 'var(--warn)';
    }
    t.appendChild(dTd);
    const pTd = el('td', { class: 'num', text: fmt(r.p_perm) });
    if (Number.isFinite(r.p_perm) && r.p_perm < 0.05) pTd.style.color = 'var(--bad)';
    t.appendChild(pTd);
    const stTd = el('td');
    const sev = STATUS_TIER[r.status];
    stTd.appendChild(el('span', {
      class: 'status-pill-cell ' + (sev === 'fail' ? 'fail' : sev === 'warn' ? 'warn' : 'pass'),
      text: STATUS_LABEL[r.status] || r.status,
    }));
    t.appendChild(stTd);
    tbody.appendChild(t);
  });
  tbl.appendChild(tbody);
  slot.appendChild(tbl);
  // Auto-open the highest-effect row.
  if (rows.length) _renderDetail(rows[0]);
}

function _renderDetail(r) {
  const slot = $('#fmsDetailSlot');
  slot.innerHTML = '';
  const tier = STATUS_TIER[r.status] === 'fail' ? 'tier-conflict'
             : STATUS_TIER[r.status] === 'warn' ? 'tier-warn-family'
             : 'tier-weak';
  const body = `<b>${r.focal_inv}</b> on <b>${r.focal_chr}</b> &times; tested <b>${r.tested_chr}</b> `
    + `(${r.relation}). `
    + `n_carriers=${r.n_carriers}, n_controls=${r.n_controls}, n_pairs=${r.n_pairs}.<br/>`
    + `C carrier = ${fmt(r.C_carrier)}, C control = ${fmt(r.C_control)}, `
    + `ΔC = ${fmt(r.delta_C)}, family-aware p_perm = ${fmt(r.p_perm)}.<br/>`
    + `Top-hub carrier share = ${(r.carrier_share_in_hub * 100).toFixed(0)}% `
    + `&nbsp;·&nbsp; local-inv control: ${r.local_inv_controlled ? 'on (badge-only in demo)' : 'off'}.`
    + `<br/><br/>`
    + _interpretRow(r);
  slot.appendChild(el('div', {
    class: 'ie-conclusion ' + tier,
    style: { marginTop: '12px' },
    html: '<div class="verdict">' + (STATUS_LABEL[r.status] || r.status) + '</div>' + body
  }));
}

function _interpretRow(r) {
  switch (r.status) {
    case 'strong_effect':
      return `Carriers of <b>${r.focal_inv}</b> show a large, family-controlled change in `
           + `coincidence on <b>${r.tested_chr}</b> (${r.relation === 'intra'
              ? 'intra-chromosomal — direct local effect of the inversion'
              : 'inter-chromosomal — global meiosis effect or unmodelled covariate'}). `
           + `This is the kind of signal worth pushing into the next round of validation.`;
    case 'moderate_effect':
      return `Moderate ΔC at family-aware p &lt; 0.05. Treat as a candidate; rerun with more permutations and add the local-inversion control before reporting.`;
    case 'weak_effect':
      return `Weak signal — permutation p &lt; 0.05 but the effect size is small. May not survive multiple-testing correction across all tested chromosomes.`;
    case 'no_effect':
      return `Carriers and controls indistinguishable on this tested chromosome under the family-aware null.`;
    case 'family_confounded':
      return `<b>FAMILY CONFOUNDED</b> — top-hub carrier share is &ge; 80%, so the carrier-vs-non-carrier contrast is mostly comparing one family to the rest. Recompute within the dominant hub, or with matched non-carriers from the same hub, before interpreting biologically.`;
    case 'no_data':
      return `No informative pairs for <b>${r.tested_chr}</b>.`;
    default:
      return '';
  }
}

// ─── Karyotype matrix ───────────────────────────────────────────────────

function _renderKaryo() {
  const f = state.focal_meiosis.focal_inv;
  const focal_chr = focalChromOf(f);
  // Show all candidates on the focal chromosome so the user can see
  // co-inversions on the same chromosome.
  const cands = DEMO.inversion_candidates_full
    .filter(i => i.chromosome === focal_chr);
  const cols = cands.length ? cands.slice(0, 4).map(c => c.chromosome) : [focal_chr];
  renderKaryotypeTable('#fmsKaryoSlot', {
    rows: DEMO.individuals,
    columns: cols,
  });
}

// ─── Wiring ─────────────────────────────────────────────────────────────

function runScan() {
  const focal = state.focal_meiosis.focal_inv;
  const scope = $('#fmsScope').value;
  const n_perm = parseInt($('#fmsNperm').value, 10) || 1000;
  const control_local = $('#fmsControlLocal').checked;
  const res = runFocalScan(focal, { scope, n_perm, control_local });
  state.focal_meiosis.last_results = res;
  state.focal_meiosis.scope = scope;
  state.focal_meiosis.n_perm = n_perm;
  state.focal_meiosis.control_local = control_local;
  _renderResults();
}

function exportTsv() {
  const r = state.focal_meiosis.last_results;
  if (!r) { alert('Run the scan first.'); return; }
  const cols = ['focal_inv','focal_chr','tested_chr','relation',
                'n_carriers','n_controls','n_pairs',
                'C_carrier','C_control','delta_C','p_perm',
                'carrier_share_in_hub','local_inv_controlled','status'];
  const lines = [
    '# Focal inversion x meiosis coincidence scan',
    '# Date: ' + new Date().toISOString(),
    '# Focal: ' + r.focal_inv + ' on ' + r.focal_chr,
    '# Scope: ' + r.scope + '  n_perm: ' + r.n_perm
      + '  control_local: ' + r.control_local,
    '# Top hub: ' + (r.hub_share.hub || '—')
      + ' (' + r.hub_share.count + '/' + r.n_carriers + ' carriers)',
    '#',
    cols.join('\t'),
  ];
  for (const row of r.rows) {
    lines.push([
      row.focal_inv, row.focal_chr, row.tested_chr, row.relation,
      row.n_carriers, row.n_controls, row.n_pairs,
      fmt(row.C_carrier), fmt(row.C_control), fmt(row.delta_C), fmt(row.p_perm),
      row.carrier_share_in_hub.toFixed(3),
      row.local_inv_controlled ? 'yes' : 'no',
      row.status,
    ].join('\t'));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'focal_inv_meiosis_scan_' + r.focal_inv + '_' + Date.now() + '.tsv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wireFms() {
  $('#fmsFocal').addEventListener('change', e => {
    state.focal_meiosis.focal_inv = e.target.value;
    state.focal_meiosis.last_results = null;
    _renderReadiness();
    _renderSummary();
    _renderResults();
    _renderKaryo();
  });
  $('#fmsScope').addEventListener('change',         e => state.focal_meiosis.scope         = e.target.value);
  $('#fmsNperm').addEventListener('change',         e => state.focal_meiosis.n_perm        = parseInt(e.target.value, 10));
  $('#fmsControlLocal').addEventListener('change',  e => state.focal_meiosis.control_local = e.target.checked);
  $('#fmsRunBtn').addEventListener('click', runScan);
  $('#fmsResetBtn').addEventListener('click', () => {
    state.focal_meiosis.last_results = null;
    $('#fmsResultSlot').innerHTML = '';
    $('#fmsDetailSlot').innerHTML = '';
  });
  $('#fmsExportBtn').addEventListener('click', exportTsv);
}

function _restoreFromState() {
  if (state.focal_meiosis.scope)    $('#fmsScope').value         = state.focal_meiosis.scope;
  if (state.focal_meiosis.n_perm)   $('#fmsNperm').value         = String(state.focal_meiosis.n_perm);
  if (state.focal_meiosis.control_local !== undefined) {
    $('#fmsControlLocal').checked = !!state.focal_meiosis.control_local;
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────

let _unsubChr = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  _populateFocalPicker();
  _restoreFromState();
  wireFms();
  _renderReadiness();
  _renderSummary();
  _renderKaryo();
  if (state.focal_meiosis.last_results) _renderResults();
  _unsubChr = on('chromosome_changed', () => {
    // No-op for now; the focal candidate drives the chromosome.
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubChr) _unsubChr();
  _unsubChr = null;
}
