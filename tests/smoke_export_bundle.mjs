#!/usr/bin/env node
// tests/smoke_export_bundle.mjs
// =============================================================================
// Bundle-builder smoke test. Exercises shared/export_bundle.js end-to-end:
//   - all 7 sections present
//   - row counts are sane (n_samples / n_candidates / n_families align with DEMO)
//   - meta header populated
//   - TSV emitter produces well-formed multi-section output
//   - JSON emitter produces valid JSON
// =============================================================================

import { eq, truthy, geq, inRange, isFn, section, done }
  from './_assert.mjs';

section('shared/export_bundle.js');
{
  const eb = await import('../atlases/relatedness/shared/export_bundle.js');
  isFn(eb.buildBundle,   'buildBundle exported');
  isFn(eb.bundleToTsv,   'bundleToTsv exported');
  isFn(eb.bundleToJson,  'bundleToJson exported');

  const b = eb.buildBundle({ top_n: 5, focal_n_perm: 50 });
  truthy(b && b.meta && b.sections, 'bundle has meta + sections');

  // Sections present.
  const expected = ['cohort_overview','per_individual','per_candidate','per_family',
                    'inversion_priority','marker_designs','focal_meiosis_scans'];
  eq(Object.keys(b.sections).sort(), expected.slice().sort(),
    'sections are exactly the 7 declared');

  // Row counts align with DEMO.
  const demo = (await import('../atlases/relatedness/shared/demo_data.js')).DEMO;
  eq(b.sections.cohort_overview.length, 1,
    'cohort_overview has 1 row');
  eq(b.sections.per_individual.length, demo.individuals.length,
    'per_individual row count = DEMO.individuals.length');
  eq(b.sections.per_candidate.length, demo.inversion_candidates_full.length,
    'per_candidate row count = n_candidates');
  eq(b.sections.per_family.length, demo.families.length,
    'per_family row count = n_families');
  eq(b.sections.inversion_priority.length, demo.inversion_candidates_full.length,
    'inversion_priority row count = n_candidates (every candidate ranked)');

  // Meta sanity.
  truthy(b.meta.atlas === 'relatedness',          'meta.atlas == relatedness');
  truthy(typeof b.meta.date_iso === 'string',      'meta.date_iso is a string');
  truthy(b.meta.n_samples > 0,                     'meta.n_samples > 0');
  truthy(b.meta.n_candidates > 0,                  'meta.n_candidates > 0');
  truthy(typeof b.meta.note === 'string'
         && b.meta.note.includes('GATED'),
    'meta.note flags the meiosis-stack gating');

  // First row of per_candidate has expected keys.
  const r0 = b.sections.per_candidate[0];
  for (const k of ['candidate','chromosome','status','frequency',
                   'n_typed','allele_freq','hwe_p','top_hub_share',
                   'mendel_test_a_p','marker_ready']) {
    truthy(k in r0, `per_candidate row has key ${k}`);
  }

  // TSV format check.
  const tsv = eb.bundleToTsv(b);
  truthy(tsv.startsWith('# Relatedness Atlas — bundle export'),
    'TSV starts with the bundle header');
  truthy(tsv.includes('# === cohort_overview ==='),
    'TSV has cohort_overview section marker');
  truthy(tsv.includes('# === per_candidate ==='),
    'TSV has per_candidate section marker');
  truthy(tsv.includes('# === focal_meiosis_scans ==='),
    'TSV has focal_meiosis_scans section marker');
  geq(tsv.split('\n').length, demo.inversion_candidates_full.length + 50,
    'TSV has at least n_candidates + overhead lines');

  // JSON parses.
  const json = eb.bundleToJson(b);
  let parsed;
  try { parsed = JSON.parse(json); }
  catch (e) {
    console.error('  FAIL · bundleToJson produced invalid JSON');
    console.error('  ', e);
    process.exit(1);
  }
  truthy(parsed.meta && parsed.sections, 'JSON round-trips with meta + sections');
  eq(parsed.sections.per_individual.length, b.sections.per_individual.length,
    'JSON per_individual row count matches');

  // Tuning options work.
  const small = eb.buildBundle({ top_n: 3, focal_n_perm: 20 });
  truthy(small.meta.top_n_priority_for_marker_and_focal === 3,
    'top_n=3 reflected in meta');
  truthy(small.sections.marker_designs.length
       < b.sections.marker_designs.length,
    'top_n=3 produces fewer marker_designs rows than top_n=5');
}

done();
