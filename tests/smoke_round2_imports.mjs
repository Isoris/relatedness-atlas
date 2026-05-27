#!/usr/bin/env node
// tests/smoke_round2_imports.mjs
// =============================================================================
// Import-graph smoke test. For each round-2 page module (the 18 sub-tabs
// added after the round-1 migration), verify that:
//   1. The module loads in Node ESM without throwing.
//   2. It exports `mount` and `unmount` as functions.
//   3. The module's import dependency graph resolves (no broken paths).
//
// Page modules use $/$$/el from shared/utils which call DOM APIs at
// mount() time but NOT at import time, so loading the module itself is
// safe in Node. We don't try to mount — that needs jsdom, which is a new
// npm dep we don't want.
//
// Run:
//   node tests/smoke_round2_imports.mjs
// =============================================================================

import { isFn, section, done, truthy } from './_assert.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO     = resolve(__dirname, '..');

// Exactly the round-2 pages — 5 round-1 pages (network, karyotypes,
// inversions, mendelian, compatibility) are excluded because they're
// loaded by the legacy Relatedness_atlas.js, not the ES-module bootstrap.
const ROUND2_PAGES = [
  'bdmi',                   'regimes',
  'meiosis',                'eligibility',
  'resolution',             'coincidence',
  'inversion_signature',    'focal_meiosis_scan',
  'inversion_priority',     'marker_test_designer',
  'family_hub_detail',      'catalogue_handshake',
  'individual_portrait',    'inversion_dossier',
  'cohort_summary',         'cross_planner',
  'inversion_compare',      'export_bundle',
];

section('round-2 page modules · import + lifecycle exports');

for (const id of ROUND2_PAGES) {
  const path = `${REPO}/atlases/relatedness/pages/hub/${id}.js`;
  let mod;
  try {
    mod = await import(path);
  } catch (err) {
    console.error(`  FAIL · ${id}.js failed to import`);
    console.error(`    ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  }
  truthy(mod,           `${id}.js imports cleanly`);
  isFn(mod.mount,       `${id}.js exports mount()`);
  isFn(mod.unmount,     `${id}.js exports unmount()`);
}

done();
