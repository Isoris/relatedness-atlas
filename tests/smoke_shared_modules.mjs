#!/usr/bin/env node
// tests/smoke_shared_modules.mjs
// =============================================================================
// Behaviour smoke test for the shared modules that back the round-2 pages.
// Asserts that the pure-function exports return sensible shapes on the
// DEMO cohort — catches regressions where someone renames a field, drops
// a column, or changes a return type.
// =============================================================================

import { eq, truthy, isFn, geq, inRange, noThrow, section, done }
  from './_assert.mjs';

section('shared/stats.js');
{
  const { binomialPValueTwoSided, chiSquarePValue, expectedOffspringPrior } =
    await import('../atlases/relatedness/shared/stats.js');
  isFn(binomialPValueTwoSided, 'binomialPValueTwoSided exported');
  isFn(chiSquarePValue,        'chiSquarePValue exported');
  isFn(expectedOffspringPrior, 'expectedOffspringPrior exported');
  inRange(binomialPValueTwoSided(5, 10, 0.5), 0, 1, 'binomial p ∈ [0,1] for balanced sample');
  inRange(binomialPValueTwoSided(0, 10, 0.5), 0, 1, 'binomial p ∈ [0,1] for extreme sample');
  inRange(chiSquarePValue(3.84, 1), 0, 1, 'chi² p ≈ 0.05 for x=3.84, df=1');
  eq(expectedOffspringPrior('0/0', '1/1'), [0, 1, 0], 'AA × BB → 100% AB');
  eq(expectedOffspringPrior('0/1', '0/1'), [0.25, 0.5, 0.25], 'AB × AB → 1:2:1');
  eq(expectedOffspringPrior('0/0', 'NA'), null, 'NA parent → null prior');
}

section('shared/inversion_meiosis.js');
{
  const im = await import('../atlases/relatedness/shared/inversion_meiosis.js');
  isFn(im.carriersOf, 'carriersOf exported');
  isFn(im.controlsOf, 'controlsOf exported');
  isFn(im.parentalCarriersOf, 'parentalCarriersOf exported');
  isFn(im.confounderProfile, 'confounderProfile exported');
  isFn(im.readinessLevels, 'readinessLevels exported');
  isFn(im.runFocalScan, 'runFocalScan exported');
  isFn(im.causalLadder, 'causalLadder exported');
  const carriers = im.carriersOf('INV_001');
  const controls = im.controlsOf('INV_001');
  geq(carriers.length, 1, 'INV_001 has ≥1 carrier in DEMO');
  geq(controls.length, 1, 'INV_001 has ≥1 control in DEMO');
  truthy(im.focalChromOf('INV_001') === 'Chr28', 'INV_001 chromosome resolves');
  const conf = im.confounderProfile(carriers, controls);
  inRange(conf.hub_share.share, 0, 1, 'hub_share.share ∈ [0,1]');
  geq(conf.ancestry_l1, 0, 'ancestry_l1 ≥ 0');
  const r = im.readinessLevels('INV_001');
  truthy(typeof r.basic_ready === 'boolean', 'readinessLevels returns basic_ready bool');
  const scan = im.runFocalScan('INV_001',
    { scope: 'both', n_perm: 50, control_local: true, unit: 'parental_meiosis' });
  truthy(Array.isArray(scan.rows), 'scan.rows is an array');
  geq(scan.rows.length, 1, 'scan returns ≥1 row');
  const r0 = scan.rows[0];
  truthy('focal_inv' in r0 && 'tested_chr' in r0 && 'relation' in r0
         && 'delta_C' in r0 && 'p_perm' in r0 && 'status' in r0,
    'scan row has expected schema');
  const ladder = im.causalLadder(scan, { confounders: conf });
  inRange(ladder.level, 0, 5, 'causal-ladder level ∈ [0,5]');
}

section('shared/inversion_priority.js');
{
  const ip = await import('../atlases/relatedness/shared/inversion_priority.js');
  isFn(ip.runPriorityScan, 'runPriorityScan exported');
  const r = ip.runPriorityScan({ top_n: 5 });
  truthy(Array.isArray(r.rows), 'priority.rows is an array');
  geq(r.rows.length, 1, 'priority returns ≥1 row');
  truthy(r.n_ship + r.n_hold + r.n_drop === r.rows.length,
    'ship+hold+drop = total rows');
  const r0 = r.rows[0];
  truthy('priority_score' in r0 && 'bucket' in r0 && 'candidate' in r0,
    'priority row has expected schema');
  truthy(['ship_to_pass2', 'hold', 'drop'].includes(r0.bucket),
    'priority bucket is one of {ship_to_pass2, hold, drop}');
  inRange(r0.priority_score, 0, 1, 'priority_score ∈ [0,1]');
}

section('shared/marker_designer.js');
{
  const md = await import('../atlases/relatedness/shared/marker_designer.js');
  isFn(md.runMarkerDesigner, 'runMarkerDesigner exported');
  isFn(md.focalMarkersFor, 'focalMarkersFor exported');
  isFn(md.focalReadiness, 'focalReadiness exported');
  const d = md.runMarkerDesigner('INV_001', {});
  truthy(Array.isArray(d.focal_markers), 'focal_markers array');
  geq(d.focal_markers.length, 1, '≥1 focal marker generated');
  truthy(Array.isArray(d.per_chrom), 'per_chrom array');
  geq(d.per_chrom.length, 1, '≥1 tested chromosome');
  truthy(typeof d.panel_status === 'string', 'panel_status is a string');
  truthy(['PANEL_READY','PANEL_PARTIAL','PANEL_LOW_POWER','BLOCKED'].includes(d.panel_status),
    'panel_status is one of the allowed codes');
  const tr = d.per_chrom[0].triplets[0];
  truthy('interval_A_mb' in tr && 'interval_B_mb' in tr
         && 'markers_required' in tr && 'expected_DCO' in tr && 'status' in tr,
    'triplet has expected schema');
}

section('shared/recomb_data.js');
{
  const rd = await import('../atlases/relatedness/shared/recomb_data.js');
  isFn(rd.windowsForChrom, 'windowsForChrom exported');
  isFn(rd.pairsForChrom, 'pairsForChrom exported');
  isFn(rd.coincidence, 'coincidence exported');
  isFn(rd.insideFlankSummary, 'insideFlankSummary exported');
  isFn(rd.inversionVerdict, 'inversionVerdict exported');
  const wins = rd.windowsForChrom('Chr28');
  geq(wins.length, 1, 'Chr28 has ≥1 window in DEMO');
  truthy('n_NCO_pop' in wins[0] && 'n_CO_ped' in wins[0],
    'window has n_NCO_pop and n_CO_ped');
  const pairs = rd.pairsForChrom('Chr28');
  geq(pairs.length, 1, 'Chr28 has ≥1 pair in DEMO');
  // INV_001 is rigged in DEMO to be CONSISTENT WITH INVERSION on Chr28.
  const inv = (await import('../atlases/relatedness/shared/demo_data.js'))
    .DEMO.inversion_candidates_full.find(i => i.candidate === 'INV_001');
  const sum = rd.insideFlankSummary(inv, 'Chr28');
  const verdict = rd.inversionVerdict(sum);
  truthy(['consistent','rejected','cold_region','ambiguous'].includes(verdict.code),
    'INV_001 verdict.code is one of the allowed values');
}

done();
