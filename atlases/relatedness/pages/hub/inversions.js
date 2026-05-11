// atlases/relatedness/pages/hub/inversions.js
// =============================================================================
// Inversions page — sub-tab #3. The full paginated table of all inversion
// candidates, with click-to-expand family-inheritance roster (Stages 1-4 of
// the four-stage scoring).
//
// Extracted verbatim from legacy Relatedness_atlas.js §8 (lines 988-1928),
// with three changes:
//   1. ES-module imports for DEMO / state / utils / binomial / sex pill.
//   2. The Mendelian-tab navigation in runMendelianFromInversion() now goes
//      via window.location.hash (atlas-router) instead of clicking the legacy
//      #subTabBar button.
//   3. Likewise for openCompatibilityForInversion().
//
// renderInversionTablesInline is exported so the Network page can render the
// 4-row preview at the top of its tab.
// =============================================================================

import { $, el } from '../../shared/utils.js';
import { DEMO } from '../../shared/demo_data.js';
import { state } from '../../shared/state.js';
import { binomialPValueTwoSided } from '../../shared/stats.js';
import { sexBadgeHtml } from '../../shared/sex_badge.js';
import { on } from '../../shared/page_hooks.js';
import { _setActiveState } from './inversions/_state.js';

// ─── §8 verbatim body ────────────────────────────────────────────────────

function getFilteredInversions() {
  let inv = DEMO.inversion_candidates_full;
  if (state.selected_chromosome && state.selected_chromosome !== 'all') {
    inv = inv.filter(i => i.chromosome === state.selected_chromosome);
  }
  return inv;
}

const MENDEL_RULES = (() => {
  const rules = {};
  function add(p1, p2, allowed) {
    const k = [p1, p2].sort().join('|');
    rules[k] = allowed;
  }
  add('0/0','0/0', ['0/0']);
  add('1/1','1/1', ['1/1']);
  add('0/0','1/1', ['0/1']);
  add('0/0','0/1', ['0/0','0/1']);
  add('1/1','0/1', ['0/1','1/1']);
  add('0/1','0/1', ['0/0','0/1','1/1']);
  return rules;
})();

function isDiagnosticParents(p1, p2) {
  const k = [p1, p2].sort().join('|');
  return ['0/0|0/0', '1/1|1/1', '0/0|1/1'].includes(k);
}

function expectedOffspring(p1, p2) {
  if (!p1 || !p2 || p1 === 'NA' || p2 === 'NA') return null;
  return MENDEL_RULES[[p1, p2].sort().join('|')] || null;
}

function classifyFamilyForInversion(triad, invId) {
  const p1 = (DEMO.karyotype_matrix[triad.parent_a] || {})[invId];
  const p2 = (DEMO.karyotype_matrix[triad.parent_b] || {})[invId];
  const o  = (DEMO.karyotype_matrix[triad.offspring]  || {})[invId];
  const q1 = (DEMO.karyotype_quality[triad.parent_a] || {})[invId] || 'high';
  const q2 = (DEMO.karyotype_quality[triad.parent_b] || {})[invId] || 'high';
  const qo = (DEMO.karyotype_quality[triad.offspring]  || {})[invId] || 'high';
  const anyLowConf = (q1 === 'low' || q2 === 'low' || qo === 'low');

  const qc = DEMO.trio_qc[triad.id] || { valid: true, gw_mend_error: 0, anc_dist: 0 };
  const family_valid = qc.valid !== false;

  if (!p1 || !p2 || !o || p1 === 'NA' || p2 === 'NA' || o === 'NA') {
    return {
      family_id: triad.id, parent_a: triad.parent_a, parent_b: triad.parent_b,
      offspring: triad.offspring,
      p1_kt: p1 || 'NA', p2_kt: p2 || 'NA', o_kt: o || 'NA',
      expected: null, status: 'not_informative',
      diagnostic: false, family_valid, qc,
    };
  }
  const expected = expectedOffspring(p1, p2);
  const diagnostic = isDiagnosticParents(p1, p2);
  const compatible = expected && expected.includes(o);
  let status;
  if (!compatible) status = family_valid ? 'fail' : 'family_warn';
  else if (anyLowConf) status = 'warn';
  else status = 'pass';
  return {
    family_id: triad.id,
    parent_a: triad.parent_a, parent_b: triad.parent_b,
    offspring: triad.offspring,
    p1_kt: p1, p2_kt: p2, o_kt: o,
    expected, status, diagnostic, anyLowConf,
    family_valid, qc,
  };
}

export function scoreInversion(invId) {
  const families = DEMO.triads.map(t => classifyFamilyForInversion(t, invId));
  const informative_families = families.filter(f => f.status !== 'not_informative');
  const valid_inf = informative_families.filter(f => f.family_valid !== false);
  const suspect_inf = informative_families.filter(f => f.family_valid === false);
  const diagnostic_families = valid_inf.filter(f => f.diagnostic);

  const n_pass = valid_inf.filter(f => f.status === 'pass').length;
  const n_warn = valid_inf.filter(f => f.status === 'warn').length;
  const n_fail = valid_inf.filter(f => f.status === 'fail').length;
  const n_inf  = valid_inf.length;
  const pass_frac = n_inf > 0 ? n_pass / n_inf : 0;

  const n_suspect_fail = suspect_inf.filter(f =>
    f.status === 'fail' || f.status === 'family_warn').length;

  let n_transmissions_0 = 0, n_transmissions_1 = 0;
  let n_het_parents_used = 0;
  const family_directions = [];
  for (const f of valid_inf) {
    let fam_t0 = 0, fam_t1 = 0;
    function tally(parent_kt, partner_kt, offspring_kt) {
      if (parent_kt !== '0/1') return null;
      if (partner_kt === '0/0') {
        if (offspring_kt === '0/0') return 0;
        if (offspring_kt === '0/1') return 1;
        return null;
      }
      if (partner_kt === '1/1') {
        if (offspring_kt === '0/1') return 0;
        if (offspring_kt === '1/1') return 1;
        return null;
      }
      if (partner_kt === '0/1') {
        if (offspring_kt === '0/0') return 0;
        if (offspring_kt === '1/1') return 1;
        return null;
      }
      return null;
    }
    const t_a = tally(f.p1_kt, f.p2_kt, f.o_kt);
    const t_b = tally(f.p2_kt, f.p1_kt, f.o_kt);
    if (t_a === 0) fam_t0++;
    if (t_a === 1) fam_t1++;
    if (t_b === 0) fam_t0++;
    if (t_b === 1) fam_t1++;
    n_transmissions_0 += fam_t0;
    n_transmissions_1 += fam_t1;
    const fam_total = fam_t0 + fam_t1;
    if (fam_total > 0) {
      n_het_parents_used += fam_total;
      const dir = fam_t1 > fam_t0 ? 'over_1' : (fam_t0 > fam_t1 ? 'over_0' : 'balanced');
      family_directions.push({ family_id: f.family_id, t0: fam_t0, t1: fam_t1, dir });
    } else {
      family_directions.push({ family_id: f.family_id, t0: 0, t1: 0, dir: 'na' });
    }
  }
  const n_total_t = n_transmissions_0 + n_transmissions_1;
  let trans_p = NaN, trans_skew_dir = 'none';
  if (n_total_t >= 4) {
    const k = Math.min(n_transmissions_0, n_transmissions_1);
    trans_p = binomialPValueTwoSided(k, n_total_t, 0.5);
    if (n_transmissions_1 > n_transmissions_0)      trans_skew_dir = 'over_1';
    else if (n_transmissions_0 > n_transmissions_1) trans_skew_dir = 'over_0';
    else                                              trans_skew_dir = 'balanced';
  }
  const concordant_families = family_directions.filter(
    d => d.dir === trans_skew_dir).length;

  let category, verdict;
  if (n_inf < 3) {
    category = 'NEEDS_CROSSES';
    verdict = 'Insufficient informative families — design crosses to validate';
  }
  else if (pass_frac < 0.70) {
    if (n_suspect_fail > n_fail) {
      category = 'WARN_FAMILY';
      verdict = 'Failures concentrated in suspect trios — review annotation';
    } else {
      category = 'LOCAL_CONFLICT';
      verdict = 'Valid families show repeated Mendelian inconsistencies at this locus';
    }
  }
  else if (n_fail >= 2) {
    category = 'LOCAL_CONFLICT';
    verdict = 'Valid families show repeated Mendelian inconsistencies at this locus';
  }
  else if (Number.isFinite(trans_p) && trans_p < 0.02
           && n_total_t >= 8 && concordant_families >= 5) {
    category = 'DRIVE_CANDIDATE';
    verdict = `Transmission distortion repeated across ${concordant_families} `
            + `independent valid families (binomial p = ${trans_p.toExponential(2)})`;
  }
  else if (Number.isFinite(trans_p) && trans_p < 0.05 && n_total_t >= 6) {
    category = 'TRANSMISSION_SKEW';
    verdict = `Heterozygous parents transmit one allele at ${(Math.max(n_transmissions_0,n_transmissions_1)/n_total_t*100).toFixed(0)}% `
            + `(binomial p = ${trans_p.toFixed(3)}); needs more families before drive call`;
  }
  else if (n_warn > 0 && n_pass + n_warn === n_inf) {
    category = 'WARN_CALL';
    verdict = 'Mendelian-compatible across all valid families, but some calls are low-confidence';
  }
  else {
    category = 'PASS';
    verdict = 'Mendelian-compatible inversion candidate';
  }

  let tier;
  if      (category === 'DRIVE_CANDIDATE')   tier = 'drive';
  else if (category === 'TRANSMISSION_SKEW') tier = 'skew';
  else if (category === 'LOCAL_CONFLICT')    tier = 'conflict';
  else if (category === 'WARN_FAMILY')       tier = 'warn_family';
  else if (category === 'NEEDS_CROSSES')     tier = 'needs_crosses';
  else if (category === 'WARN_CALL')         tier = 'moderate';
  else if (n_inf >= 5 && pass_frac >= 0.90 && n_fail === 0) tier = 'strong';
  else if (n_inf >= 3 && pass_frac >= 0.70)  tier = 'moderate';
  else                                        tier = 'weak';

  let aura_intensity = 0;
  if (tier === 'strong') {
    aura_intensity = Math.min(1.0, 0.5 + 0.5 * pass_frac
                                       + 0.05 * Math.min(n_inf - 5, 5));
    aura_intensity -= 0.05 * n_warn;
    aura_intensity = Math.max(0.4, Math.min(1.0, aura_intensity));
  } else if (tier === 'drive') {
    const skew_mag = n_total_t > 0
      ? Math.abs(n_transmissions_1 - n_transmissions_0) / n_total_t : 0;
    aura_intensity = Math.min(1.0, 0.5 + 0.5 * skew_mag);
  }

  return {
    inv_id: invId,
    n_informative: n_inf,
    n_diagnostic: diagnostic_families.length,
    n_pass, n_warn, n_fail,
    n_suspect_inf: suspect_inf.length,
    n_suspect_fail,
    pass_frac, tier,
    category, verdict,
    families,
    valid_families: valid_inf,
    suspect_families: suspect_inf,
    n_transmissions_0, n_transmissions_1, n_total_t,
    trans_p, trans_skew_dir,
    family_directions,
    concordant_families,
    aura_intensity,
  };
}

export function renderInversionTablesInline() {
  renderInversionTable('#invTableSlotInline', '#invPaginationInline', 'inv_page_inline');
  const pill = $('#pillInvValue');
  if (pill) pill.textContent = String(DEMO.inversion_candidates_full.length);
}

export function renderInversionTablesFull() {
  renderInversionTable('#invTableSlotFull', '#invPaginationFull', 'inv_page_full');
  const pill = $('#pillInvValue');
  if (pill) pill.textContent = String(DEMO.inversion_candidates_full.length);
}

function renderInversionTable(slot, paginationSlot, pageStateKey) {
  const target = $(slot);
  if (!target) return;
  target.innerHTML = '';

  const all = getFilteredInversions();
  const total = all.length;
  const page = state[pageStateKey];
  const per = state.inv_per_page;
  const start = (page - 1) * per;
  const visible = all.slice(start, start + per);

  const table = el('table', { class: 'data-table' });
  const thead = el('thead');
  const headers = ['Candidate','Chrom','Start','End','Length','Freq',
                   'Inform.','PASS','WARN','FAIL','Support','Notes'];
  const tr = el('tr');
  headers.forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const inv of visible) {
    const score = scoreInversion(inv.candidate);
    const tier_cls = score.tier.replace(/_/g, '-');
    const auraStyle = score.aura_intensity > 0
      ? '--aura-intensity:' + score.aura_intensity.toFixed(2) : '';
    const r = el('tr', { class: 'clickable tier-' + tier_cls,
                          'data-inv-id': inv.candidate,
                          style: auraStyle });
    r.appendChild(el('td', { class: 'sample-id', text: inv.candidate }));
    r.appendChild(el('td', { text: inv.chromosome }));
    r.appendChild(el('td', { class: 'num', text: inv.start_mb.toFixed(1) + ' Mb' }));
    r.appendChild(el('td', { class: 'num', text: inv.end_mb.toFixed(1) + ' Mb' }));
    r.appendChild(el('td', { class: 'num', text: inv.length_mb.toFixed(1) + ' Mb' }));
    r.appendChild(el('td', { class: 'num', text: inv.frequency.toFixed(2) }));
    r.appendChild(el('td', { class: 'num',
                              text: score.n_informative + (score.n_diagnostic > 0
                                ? ' (' + score.n_diagnostic + ' diag.)' : '') }));
    r.appendChild(el('td', { class: 'num',
                              text: String(score.n_pass),
                              style: { color: score.n_pass > 0 ? 'var(--good)' : 'var(--ink-dim)' } }));
    r.appendChild(el('td', { class: 'num',
                              text: String(score.n_warn),
                              style: { color: score.n_warn > 0 ? 'var(--warn)' : 'var(--ink-dim)' } }));
    r.appendChild(el('td', { class: 'num',
                              text: String(score.n_fail),
                              style: { color: score.n_fail > 0 ? 'var(--bad)' : 'var(--ink-dim)' } }));
    {
      const td = el('td');
      const pill_cls = score.tier.replace(/_/g, '-');
      td.appendChild(el('span', {
        class: 'tier-pill ' + pill_cls,
        text: score.category.replace(/_/g, ' ').toLowerCase(),
        title: score.verdict,
      }));
      r.appendChild(td);
    }
    r.appendChild(el('td', { text: inv.notes,
                              style: { color: 'var(--ink-dim)', fontSize: '9.5px' } }));
    r.addEventListener('click', () => toggleInversionExpand(inv, score, r, tbody));
    tbody.appendChild(r);
  }
  table.appendChild(tbody);
  target.appendChild(table);

  if (paginationSlot) {
    const p = $(paginationSlot);
    if (p) renderPagination(p, total, page, per, n => {
      state[pageStateKey] = n;
      renderInversionTable(slot, paginationSlot, pageStateKey);
    });
  }
}

function toggleInversionExpand(inv, score, parentRow, tbody) {
  const next = parentRow.nextElementSibling;
  if (next && next.classList.contains('inv-expand-row')
        && next.dataset.parent === inv.candidate) {
    next.remove();
    parentRow.classList.remove('expanded');
    return;
  }
  Array.from(tbody.querySelectorAll('.inv-expand-row')).forEach(n => n.remove());
  Array.from(tbody.querySelectorAll('tr.expanded')).forEach(n => n.classList.remove('expanded'));
  const expandTr = el('tr', { class: 'inv-expand-row',
                               'data-parent': inv.candidate });
  const expandTd = el('td', { colspan: 12 });
  expandTd.appendChild(buildInversionExpandPanel(inv, score));
  expandTr.appendChild(expandTd);
  parentRow.classList.add('expanded');
  parentRow.parentNode.insertBefore(expandTr, parentRow.nextSibling);
}

function buildInversionExpandPanel(inv, score) {
  const panel = el('div', { class: 'inv-expand-panel' });

  const titleText = inv.candidate + ' — '
                    + inv.chromosome + '  '
                    + inv.start_mb.toFixed(1) + '–' + inv.end_mb.toFixed(1) + ' Mb · '
                    + 'length ' + inv.length_mb.toFixed(1) + ' Mb · '
                    + 'freq ' + inv.frequency.toFixed(2);
  panel.appendChild(el('div', { class: 'ie-title', text: titleText }));
  panel.appendChild(el('div', { class: 'ie-subtitle',
    text: 'Four-stage scoring: (1) family validity from genome-wide trio QC, '
        + '(2) local Mendelian compatibility per valid family, '
        + '(3) aggregate "X of Y" verdict, '
        + '(4) transmission test for distortion/drive.' }));

  const stats = el('div', { class: 'ie-stats' });
  stats.appendChild(statCell('Valid informative', score.n_informative));
  stats.appendChild(statCell('Diagnostic ★', score.n_diagnostic));
  stats.appendChild(statCell('PASS', score.n_pass, 'pass'));
  stats.appendChild(statCell('WARN', score.n_warn, 'warn'));
  stats.appendChild(statCell('FAIL', score.n_fail, 'fail'));
  stats.appendChild(statCell('Pass fraction', (score.pass_frac * 100).toFixed(0) + '%'));
  if (score.n_suspect_inf > 0) {
    stats.appendChild(statCell('Suspect trios ⚐', score.n_suspect_inf, 'warn'));
  }
  panel.appendChild(stats);

  panel.appendChild(el('div', {
    style: { fontSize: '11px', fontWeight: '600', color: 'var(--ink)',
             marginTop: '14px', marginBottom: '6px' },
    text: 'Stage 1+2: per-family roster (validity from genome-wide trio QC, '
        + 'local Mendelian inheritance at this inversion)',
  }));
  const rosterTable = el('table', { class: 'ie-roster-table' });
  const thead = el('thead');
  const tr = el('tr');
  ['Family','Trio QC','Parent A','kt','Parent B','kt','Offspring','kt','Expected','Verdict']
    .forEach(h => tr.appendChild(el('th', { text: h })));
  thead.appendChild(tr); rosterTable.appendChild(thead);
  const tbody = el('tbody');
  score.families.forEach(f => {
    const r = el('tr');
    if (f.family_valid === false) r.style.opacity = '0.55';
    r.appendChild(el('td', { text: f.family_id + (f.diagnostic ? ' ★' : '') }));
    {
      const td = el('td');
      const qc = f.qc || {};
      if (f.family_valid === false) {
        td.appendChild(el('span', {
          class: 'tier-pill warn-family', text: 'SUSPECT',
          title: `gw_mend_error=${(qc.gw_mend_error*100).toFixed(1)}% · `
               + `anc_dist=${qc.anc_dist?.toFixed(2) || '?'} · `
               + `PO support: ${qc.po_a || '?'}/${qc.po_b || '?'}`,
        }));
      } else {
        td.appendChild(el('span', {
          class: 'tier-pill', text: 'OK', title: 'genome-wide trio QC passed',
          style: { background: 'rgba(95,212,154,0.14)',
                    color: 'var(--good)', borderColor: 'rgba(95,212,154,0.40)' },
        }));
      }
      r.appendChild(td);
    }
    r.appendChild(el('td', { html: f.parent_a + ' ' + sexBadgeHtml(f.parent_a) }));
    r.appendChild(el('td', null,
      el('span', { class: 'karyo-cell ' + ktClass(f.p1_kt), text: f.p1_kt })));
    r.appendChild(el('td', { html: f.parent_b + ' ' + sexBadgeHtml(f.parent_b) }));
    r.appendChild(el('td', null,
      el('span', { class: 'karyo-cell ' + ktClass(f.p2_kt), text: f.p2_kt })));
    r.appendChild(el('td', { html: f.offspring + ' ' + sexBadgeHtml(f.offspring) }));
    r.appendChild(el('td', null,
      el('span', { class: 'karyo-cell ' + ktClass(f.o_kt), text: f.o_kt })));
    r.appendChild(el('td', { class: 'expected',
      text: f.expected ? f.expected.join(' / ') : '—' }));
    const tdV = el('td', { class: 'verdict-cell' });
    if (f.status === 'not_informative') {
      tdV.appendChild(el('span', { class: 'tier-pill weak', text: 'NA' }));
    } else if (f.status === 'family_warn') {
      tdV.appendChild(el('span', { class: 'tier-pill warn-family', text: 'FAM⚐' }));
    } else {
      tdV.appendChild(el('span', {
        class: 'status-pill-cell ' + f.status,
        text: f.status.toUpperCase(),
      }));
    }
    r.appendChild(tdV);
    tbody.appendChild(r);
  });
  rosterTable.appendChild(tbody);
  panel.appendChild(rosterTable);

  panel.appendChild(el('div', {
    style: { fontSize: '9px', color: 'var(--ink-dim)',
             marginTop: '6px', fontStyle: 'italic', lineHeight: '1.5' },
    text: '★ = diagnostic family (parent karyotypes uniquely determine the offspring '
        + 'outcome — most informative evidence). SUSPECT = trio failed genome-wide '
        + 'QC (likely sample-swap / annotation error); its local result is shown '
        + 'transparently but excluded from the X-of-Y aggregate.',
  }));

  if (score.n_total_t >= 4) {
    panel.appendChild(el('div', {
      style: { fontSize: '11px', fontWeight: '600', color: 'var(--ink)',
               marginTop: '14px', marginBottom: '6px' },
      text: 'Stage 4: transmission test — heterozygous-parent gametes '
          + '(binomial against 50:50)',
    }));
    const tStats = el('div', { class: 'ie-stats' });
    tStats.appendChild(statCell('Het-parent transmissions', score.n_total_t));
    tStats.appendChild(statCell('Reference allele transmitted', score.n_transmissions_0));
    tStats.appendChild(statCell('Inverted allele transmitted', score.n_transmissions_1));
    if (Number.isFinite(score.trans_p)) {
      const skew_pct = score.n_total_t > 0
        ? (Math.max(score.n_transmissions_0, score.n_transmissions_1) /
           score.n_total_t * 100).toFixed(0)
        : '50';
      const sev = score.trans_p < 0.01 ? 'fail'
                : score.trans_p < 0.05 ? 'warn' : 'pass';
      tStats.appendChild(statCell('Skew (favored allele %)', skew_pct + '%', sev));
      tStats.appendChild(statCell('Binomial p',
        score.trans_p < 0.001
          ? score.trans_p.toExponential(2)
          : score.trans_p.toFixed(3),
        sev));
      tStats.appendChild(statCell('Concordant families',
        score.concordant_families + '/' + score.family_directions.filter(
          d => d.dir === 'over_0' || d.dir === 'over_1').length));
    } else {
      tStats.appendChild(statCell('Status', 'not enough informative gametes'));
    }
    panel.appendChild(tStats);
  } else if (score.n_informative >= 3) {
    panel.appendChild(el('div', {
      style: { fontSize: '10px', color: 'var(--ink-dim)',
               marginTop: '14px', marginBottom: '6px',
               padding: '8px 12px', background: 'var(--panel)',
               border: '1px dashed var(--rule)', borderRadius: '3px' },
      text: 'Stage 4 (transmission test): not run — fewer than 4 informative '
          + 'het-parent gametes available. Drive cannot be tested at this '
          + 'inversion without more heterozygous parents.',
    }));
  }

  const conclLabel = score.category.replace(/_/g, ' ');
  const concl = el('div', { class: 'ie-conclusion tier-' + score.tier.replace(/_/g, '-') });
  concl.appendChild(el('div', { class: 'verdict', text: conclLabel }));
  let body;
  switch (score.category) {
    case 'PASS':
      body = `Mendelian-compatible inversion candidate. ${score.n_pass} of ${score.n_informative} `
           + `valid informative families consistent with expected segregation `
           + `(${score.n_diagnostic} diagnostic), no hard conflicts. `
           + `Retain as high-confidence call.`; break;
    case 'WARN_CALL':
      body = `Inversion is Mendelian-compatible across all ${score.n_informative} valid `
           + `informative families, but ${score.n_warn} family/families had at least `
           + `one low-confidence karyotype call. Consider boundary refinement or `
           + `additional sequencing.`; break;
    case 'WARN_FAMILY':
      body = `Failures concentrated in ${score.n_suspect_inf} suspect trios with elevated `
           + `genome-wide Mendelian errors — likely an annotation error rather than a `
           + `real inversion problem. Re-examine those triads' parent assignments before `
           + `judging this inversion.`; break;
    case 'LOCAL_CONFLICT':
      body = `Valid families show ${score.n_fail} hard Mendelian conflict(s) at this `
           + `inversion specifically (genome-wide QC was OK for these trios). This is `
           + `the pattern of a real local problem: karyotyping artifact, mis-defined `
           + `boundary, or genuine biological complexity. Investigate before retaining.`; break;
    case 'TRANSMISSION_SKEW':
      body = `Valid families show no Mendelian incompatibilities, but heterozygous parents `
           + `transmit one allele at ${(Math.max(score.n_transmissions_0,score.n_transmissions_1)/score.n_total_t*100).toFixed(0)}% `
           + `(binomial p = ${score.trans_p.toFixed(3)}, n = ${score.n_total_t}). `
           + `Could indicate transmission distortion, but with only `
           + `${score.concordant_families} concordant families this is preliminary. `
           + `Add more triads before claiming drive.`; break;
    case 'DRIVE_CANDIDATE':
      body = `Strong, repeated transmission distortion across ${score.concordant_families} `
           + `independent valid families. Heterozygous parents transmit `
           + `${(Math.max(score.n_transmissions_0,score.n_transmissions_1)/score.n_total_t*100).toFixed(0)}% `
           + `of one allele (n = ${score.n_total_t}, binomial p = `
           + `${score.trans_p.toExponential(2)}). This is the signature of transmission `
           + `distortion — possibly meiotic drive, gametic competition, or genotype-`
           + `dependent viability. Controlled crosses with embryo/larval sampling are `
           + `required to distinguish these mechanisms.`; break;
    case 'NEEDS_CROSSES':
      body = `Insufficient informative families (only ${score.n_informative}). Cannot `
           + `judge Mendelian compatibility or transmission distortion from existing `
           + `data alone. Use the "Export cross design" button below to generate a `
           + `recommended experimental-cross matrix that would maximize informativeness.`; break;
    default:
      body = score.verdict;
  }
  concl.appendChild(el('div', null, body));
  panel.appendChild(concl);

  const actions = el('div', { class: 'ie-actions' });
  actions.appendChild(el('button', {
    class: 'primary', text: '→ Run formal P-value test (Mendelian tab)',
    onclick: () => runMendelianFromInversion(inv.candidate),
  }));
  actions.appendChild(el('button', {
    text: '⤓ Export inheritance roster TSV',
    onclick: () => exportInversionRosterTsv(inv, score),
  }));
  actions.appendChild(el('button', {
    text: '⤓ Export experimental cross design',
    onclick: () => exportCrossDesignTsv(inv, score),
    title: 'Generate a recommended cross matrix to validate or extend this inversion',
  }));
  actions.appendChild(el('button', {
    text: '→ Compatibility planner',
    onclick: () => openCompatibilityForInversion(inv.candidate),
  }));
  panel.appendChild(actions);

  return panel;
}

function statCell(label, value, severity = '') {
  return el('div', { class: 'ie-stat' },
    el('div', { class: 'lbl', text: label }),
    el('div', { class: 'val' + (severity ? ' ' + severity : ''), text: String(value) })
  );
}

function ktClass(k) {
  if (k === '0/0') return 'k00';
  if (k === '0/1') return 'k01';
  if (k === '1/1') return 'k11';
  return 'kna';
}

function exportInversionRosterTsv(inv, score) {
  const cols = ['family_id','parent_a','parent_a_kt','parent_b','parent_b_kt',
                'offspring','offspring_kt','expected','status','diagnostic'];
  const lines = [
    '# Inversion: ' + inv.candidate,
    '# Chromosome: ' + inv.chromosome + ' ' + inv.start_mb.toFixed(1)
      + '-' + inv.end_mb.toFixed(1) + ' Mb',
    '# Frequency: ' + inv.frequency.toFixed(2),
    '# Tier: ' + score.tier + ' — ' + score.verdict,
    '# Informative: ' + score.n_informative + ' (diagnostic: ' + score.n_diagnostic + ')',
    '# PASS=' + score.n_pass + '  WARN=' + score.n_warn + '  FAIL=' + score.n_fail,
    cols.join('\t'),
  ];
  score.families.forEach(f => {
    lines.push([f.family_id, f.parent_a, f.p1_kt, f.parent_b, f.p2_kt,
                f.offspring, f.o_kt,
                f.expected ? f.expected.join('|') : '',
                f.status,
                f.diagnostic ? 'yes' : 'no'].join('\t'));
  });
  downloadTsv('inversion_inheritance_' + inv.candidate + '.tsv',
              lines.join('\n') + '\n');
}

function exportCrossDesignTsv(inv, score) {
  const observedCrosses = new Set();
  score.valid_families.forEach(f => {
    observedCrosses.add([f.p1_kt, f.p2_kt].sort().join('×'));
  });

  const freq = { '0/0': 0, '0/1': 0, '1/1': 0, 'NA': 0 };
  DEMO.individuals.forEach(ind => {
    const k = (DEMO.karyotype_matrix[ind] || {})[inv.candidate];
    if (k && freq[k] !== undefined) freq[k]++;
  });
  const total_called = freq['0/0'] + freq['0/1'] + freq['1/1'];

  const recommendations = [];

  recommendations.push({
    cross_type: '0/0 × 1/1',
    parent_a_kt: '0/0', parent_b_kt: '1/1',
    expected_offspring: '100% 0/1',
    n_offspring_rec: 5,
    purpose: 'Diagnostic Mendelian witness — every offspring must be 0/1; '
           + 'any other genotype is a hard inheritance error',
    priority: 1,
    available_parents: `${freq['0/0']} hom-STD × ${freq['1/1']} hom-INV available`,
    already_done: observedCrosses.has(['0/0','1/1'].sort().join('×'))
                  ? 'YES (existing in cohort)' : 'NO',
  });

  if (score.n_total_t < 12 || score.category === 'TRANSMISSION_SKEW'
                            || score.category === 'NEEDS_CROSSES') {
    recommendations.push({
      cross_type: '0/1 ♂ × 0/0 ♀',
      parent_a_kt: '0/1', parent_b_kt: '0/0',
      expected_offspring: '50% 0/0, 50% 0/1',
      n_offspring_rec: 12,
      purpose: 'Test paternal transmission ratio. Significant deviation from '
             + '50:50 implies meiotic drive, gametic competition, or post-'
             + 'fertilization viability selection.',
      priority: 2,
      available_parents: `${freq['0/1']} het × ${freq['0/0']} hom-STD available; `
                       + `pick one of each opposite sex if known`,
      already_done: 'PARTIAL (current trios provide '
                  + score.n_total_t + ' het-parent gametes; '
                  + 'aim for ≥30 to detect modest drive)',
    });
    recommendations.push({
      cross_type: '0/1 ♀ × 0/0 ♂',
      parent_a_kt: '0/1', parent_b_kt: '0/0',
      expected_offspring: '50% 0/0, 50% 0/1',
      n_offspring_rec: 12,
      purpose: 'Test maternal transmission ratio. Compare with paternal cross '
             + 'above to determine if drive is sex-of-origin specific.',
      priority: 3,
      available_parents: `Reciprocal of above; ensure female is the 0/1 parent`,
      already_done: 'see paternal note',
    });
  }

  recommendations.push({
    cross_type: '0/1 × 0/1',
    parent_a_kt: '0/1', parent_b_kt: '0/1',
    expected_offspring: '25% 0/0, 50% 0/1, 25% 1/1',
    n_offspring_rec: 16,
    purpose: 'Test full 1:2:1 segregation. Deviation may indicate viability '
           + 'selection on a homozygous class (heterozygote advantage) or '
           + 'segregation distortion if both parents drive same direction.',
    priority: 4,
    available_parents: `${freq['0/1']} het individuals available`,
    already_done: observedCrosses.has(['0/1','0/1'].sort().join('×'))
                  ? 'YES (existing in cohort)' : 'NO',
  });

  if (freq['1/1'] >= 2) {
    recommendations.push({
      cross_type: '1/1 × 1/1',
      parent_a_kt: '1/1', parent_b_kt: '1/1',
      expected_offspring: '100% 1/1',
      n_offspring_rec: 5,
      purpose: 'Test fertility / viability of homozygous-INV genotype. If '
             + 'INV/INV pairs produce reduced clutch sizes or skewed survival, '
             + 'this is evidence the inversion carries recessive deleterious '
             + 'alleles.',
      priority: 5,
      available_parents: `${freq['1/1']} hom-INV individuals available`,
      already_done: observedCrosses.has(['1/1','1/1'].sort().join('×'))
                    ? 'YES' : 'NO',
    });
  }

  const cols = ['cross_type','parent_a_kt','parent_b_kt','expected_offspring',
                'n_offspring_recommended','purpose','priority',
                'available_parents','already_done'];
  const lines = [
    '# Experimental cross design',
    '# Inversion: ' + inv.candidate + ' (' + inv.chromosome + ' '
      + inv.start_mb.toFixed(1) + '–' + inv.end_mb.toFixed(1) + ' Mb)',
    '# Frequency: ' + inv.frequency.toFixed(2),
    '# Current category: ' + score.category + ' (' + score.tier + ')',
    '# Current evidence: ' + score.n_pass + ' PASS / ' + score.n_warn + ' WARN / '
      + score.n_fail + ' FAIL across ' + score.n_informative + ' valid families',
    '# Het-parent gametes counted: ' + score.n_total_t,
    '# Cohort karyotype availability:',
    '#   0/0: ' + freq['0/0'] + ' individuals',
    '#   0/1: ' + freq['0/1'] + ' individuals',
    '#   1/1: ' + freq['1/1'] + ' individuals',
    '#   NA:  ' + freq['NA']  + ' individuals',
    '#   total called: ' + total_called,
    '#',
    '# Design rationale:',
    '#   This table lists experimental crosses ordered by priority that would',
    '#   either confirm Mendelian inheritance (priority 1: 0/0 × 1/1 forced',
    '#   0/1) or quantify transmission distortion (priority 2-3: 0/1 × 0/0',
    '#   reciprocal crosses to test maternal vs paternal transmission ratios).',
    '#',
    cols.join('\t'),
  ];
  recommendations.forEach(r => {
    lines.push([r.cross_type, r.parent_a_kt, r.parent_b_kt, r.expected_offspring,
                r.n_offspring_rec,
                '"' + r.purpose.replace(/"/g, '""') + '"',
                r.priority, r.available_parents, r.already_done].join('\t'));
  });

  downloadTsv('cross_design_' + inv.candidate + '.tsv',
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

// Jump to the Mendelian tab pre-populated with this inversion.
// In the atlas-core era we navigate via the hash; the legacy click-the-button
// approach is no longer relevant because the sub-tabs are real pages.
function runMendelianFromInversion(invId) {
  const t0 = DEMO.triads[0];
  state.mend.parent1 = t0.parent_a;
  state.mend.parent2 = t0.parent_b;
  state.mend.offspring = t0.offspring;
  state.mend._pendingMode = 'triad';
  state.mend._pendingFromInversion = invId;
  window.location.hash = '#/relatedness/mendelian';
}

function openCompatibilityForInversion(invId) {
  state.compat.scope = 'single';
  state.compat.inv_single = invId;
  window.location.hash = '#/relatedness/compatibility';
}

function renderPagination(target, total, page, per, onPage) {
  target.innerHTML = '';
  const nPages = Math.max(1, Math.ceil(total / per));
  const start = (page - 1) * per + 1;
  const end = Math.min(page * per, total);
  target.appendChild(el('div', { text: `Showing ${start}–${end} of ${total}` }));
  const pages = el('div', { class: 'pages' });
  pages.appendChild(makePageBtn('‹', () => onPage(Math.max(1, page - 1)), page === 1));
  const wantPages = new Set();
  wantPages.add(1); wantPages.add(2); wantPages.add(3); wantPages.add(nPages);
  if (page > 3) wantPages.add(page);
  let lastShown = 0;
  Array.from(wantPages).filter(n => n <= nPages).sort((a,b)=>a-b).forEach(n => {
    if (n - lastShown > 1) pages.appendChild(el('button', { text: '…', disabled: true,
        style: { background: 'transparent', border: 'none', cursor: 'default' } }));
    pages.appendChild(makePageBtn(String(n), () => onPage(n), false, n === page));
    lastShown = n;
  });
  pages.appendChild(makePageBtn('›', () => onPage(Math.min(nPages, page + 1)), page === nPages));
  target.appendChild(pages);
}

function makePageBtn(label, onClick, disabled = false, active = false) {
  return el('button', {
    text: label,
    onclick: disabled ? null : onClick,
    class: active ? 'active' : '',
    disabled: disabled ? true : null,
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

let _unsubInd = null, _unsubChr = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  renderInversionTablesFull();
  _unsubInd = on('individual_changed', () => renderInversionTablesFull());
  _unsubChr = on('chromosome_changed', () => renderInversionTablesFull());
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  _unsubInd = _unsubChr = null;
}
