#!/usr/bin/env node
// scripts/build_static.mjs
// =============================================================================
// Build-time static snapshot generator. Wraps scripts/build_bundle.mjs to
// emit two timestamped artefacts AND a `latest.*` pair under
// static/snapshots/, so the atlas can offer a pre-built download without
// the visitor clicking Build.
//
// Usage:
//
//   node scripts/build_static.mjs                          # default: TSV + JSON
//   node scripts/build_static.mjs --top-n 10 --perm 1000   # tune
//   node scripts/build_static.mjs --no-json                # TSV only
//   npm run snapshot
//
// Outputs:
//   static/snapshots/<YYYY-MM-DD>.tsv         (timestamped)
//   static/snapshots/<YYYY-MM-DD>.json        (timestamped, unless --no-json)
//   static/snapshots/latest.tsv               (overwritten each run)
//   static/snapshots/latest.json
//   static/snapshots/index.json               (manifest of available snapshots)
// =============================================================================

import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle, bundleToTsv, bundleToJson } from
  '../atlases/relatedness/shared/export_bundle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO     = resolve(__dirname, '..');
const STATIC_DIR = resolve(REPO, 'static', 'snapshots');

function _parseArgs(argv) {
  const opts = { top_n: 5, n_perm: 200, emit_json: true, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--top-n') opts.top_n = parseInt(argv[++i], 10);
    else if (a === '--perm')  opts.n_perm = parseInt(argv[++i], 10);
    else if (a === '--no-json') opts.emit_json = false;
  }
  return opts;
}

const opts = _parseArgs(process.argv);
if (opts.help) {
  process.stderr.write(`
Static snapshot generator.

Options:
  --top-n N        top-N priority candidates (default 5)
  --perm N         focal-scan permutation count (default 200)
  --no-json        TSV only (skip JSON)
  -h, --help       this message

Outputs:
  static/snapshots/<YYYY-MM-DD>.tsv
  static/snapshots/<YYYY-MM-DD>.json
  static/snapshots/latest.tsv
  static/snapshots/latest.json
  static/snapshots/index.json (manifest)
`);
  process.exit(0);
}

mkdirSync(STATIC_DIR, { recursive: true });

const t0 = Date.now();
const bundle = buildBundle({ top_n: opts.top_n, focal_n_perm: opts.n_perm });
const date = new Date().toISOString().slice(0, 10);

const tsv = bundleToTsv(bundle);
writeFileSync(resolve(STATIC_DIR, date + '.tsv'), tsv);
writeFileSync(resolve(STATIC_DIR, 'latest.tsv'), tsv);

if (opts.emit_json) {
  const json = bundleToJson(bundle);
  writeFileSync(resolve(STATIC_DIR, date + '.json'), json);
  writeFileSync(resolve(STATIC_DIR, 'latest.json'), json);
}

// Rebuild the manifest (index.json) — small index of every snapshot in
// the dir, sorted newest-first, so the atlas page can show a history.
const files = readdirSync(STATIC_DIR)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.(tsv|json)$/.test(f))
  .sort()
  .reverse();
const byDate = {};
for (const f of files) {
  const [d, ext] = f.split('.');
  byDate[d] = byDate[d] || { date: d };
  byDate[d][ext] = f;
}
const index = {
  atlas: 'relatedness',
  built_at: new Date().toISOString(),
  latest: {
    tsv:  'latest.tsv',
    json: opts.emit_json ? 'latest.json' : null,
    date,
  },
  snapshots: Object.values(byDate).sort((a, b) => (a.date < b.date ? 1 : -1)),
  meta: {
    top_n: opts.top_n,
    n_perm: opts.n_perm,
    note: bundle.meta.note,
  },
};
writeFileSync(resolve(STATIC_DIR, 'index.json'), JSON.stringify(index, null, 2));

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
process.stderr.write(`Static snapshot written to ${STATIC_DIR}\n`);
process.stderr.write(`  date:       ${date}\n`);
process.stderr.write(`  TSV bytes:  ${tsv.length}\n`);
process.stderr.write(`  JSON:       ${opts.emit_json ? 'yes' : 'no'}\n`);
process.stderr.write(`  files:      ${date}.tsv, latest.tsv${opts.emit_json ? ', ' + date + '.json, latest.json' : ''}, index.json\n`);
process.stderr.write(`  snapshots:  ${index.snapshots.length}\n`);
process.stderr.write(`  time:       ${elapsed} s\n`);
