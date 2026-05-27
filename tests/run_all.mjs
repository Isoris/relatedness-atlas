#!/usr/bin/env node
// tests/run_all.mjs
// =============================================================================
// Meta-runner: runs every smoke test file in tests/ and the legacy
// per-page tests in atlases/relatedness/. Fails fast on any non-zero
// exit; prints a per-file PASS/FAIL summary at the end.
//
// Run:
//   node tests/run_all.mjs
// or:
//   npm test
// =============================================================================

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO     = resolve(__dirname, '..');

// New round-2 tests live in tests/.
const newTests = readdirSync(__dirname)
  .filter(f => f.startsWith('smoke_') && f.endsWith('.mjs'))
  .sort()
  .map(f => resolve(__dirname, f));

// Legacy round-1 tests live next to the page modules.
const legacyTests = [
  'atlases/relatedness/shared/test_api_client.js',
  'atlases/relatedness/pages/hub/test_network_data_source.js',
  'atlases/relatedness/pages/hub/test_compatibility_data_source.js',
].map(p => resolve(REPO, p)).filter(p => existsSync(p));

const all = [...newTests, ...legacyTests];

console.log('Relatedness Atlas — test runner');
console.log('================================');
console.log(`  tests found: ${all.length}\n`);

const t0 = Date.now();
const results = [];
for (const f of all) {
  const rel = f.replace(REPO + '/', '');
  console.log(`▶ ${rel}`);
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit', cwd: REPO });
  const ok = r.status === 0;
  results.push({ rel, ok });
  console.log(ok ? '✓ PASS' : '✗ FAIL', '\n');
  if (!ok) {
    console.error(`Aborting: ${rel} exited with status ${r.status}`);
    _summary(results, t0);
    process.exit(1);
  }
}
_summary(results, t0);

function _summary(results, t0) {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('================================');
  console.log(`Summary: ${results.filter(r => r.ok).length}/${results.length} passed in ${elapsed}s`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.rel}`);
  }
}
