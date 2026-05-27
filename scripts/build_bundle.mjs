#!/usr/bin/env node
// scripts/build_bundle.mjs
// =============================================================================
// CLI version of the atlas-wide export bundle (sub-tab #23 Export bundle).
// Calls the same shared/export_bundle.js::buildBundle() that the browser
// uses, no DOM, no atlas-core, no http server. Suitable for Snakemake
// rules, CI snapshots, pre-baked static deployments.
//
// Usage:
//
//   node scripts/build_bundle.mjs                              # → bundle.tsv (default)
//   node scripts/build_bundle.mjs --json                       # → bundle.json
//   node scripts/build_bundle.mjs --top-n 10 --perm 1000       # tune defaults
//   node scripts/build_bundle.mjs --out path/to/file.tsv       # explicit output
//   node scripts/build_bundle.mjs --stdout                     # emit to stdout
//   node scripts/build_bundle.mjs --help
//
// Same 7 sections as the browser page, same row counts on DEMO data.
// =============================================================================

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle, bundleToTsv, bundleToJson } from
  '../atlases/relatedness/shared/export_bundle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = resolve(__dirname, '..');

function _parseArgs(argv) {
  const opts = {
    top_n: 5, n_perm: 200,
    format: 'tsv',
    out: null,
    stdout: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.format = 'json';
    else if (a === '--tsv') opts.format = 'tsv';
    else if (a === '--stdout') opts.stdout = true;
    else if (a === '--top-n') opts.top_n = parseInt(argv[++i], 10);
    else if (a === '--perm')  opts.n_perm = parseInt(argv[++i], 10);
    else if (a === '--out')   opts.out = argv[++i];
    else {
      console.error('Unknown argument:', a);
      opts.help = true;
    }
  }
  return opts;
}

function _help() {
  process.stderr.write(`
Relatedness Atlas — bundle build script

Usage: node scripts/build_bundle.mjs [options]

Options:
  --tsv                  output TSV (default)
  --json                 output JSON instead
  --top-n N              top-N priority candidates for marker_designs + focal_meiosis_scans (default 5)
  --perm N               focal-scan permutation count (default 200)
  --out PATH             write to PATH (default: ./bundle.<format>)
  --stdout               write to stdout instead of a file
  -h, --help             this message

Sections emitted:
  1. cohort_overview     (1 row)
  2. per_individual      (n_samples rows)
  3. per_candidate       (n_candidates rows · HWE + Mendelian Test A + hub share)
  4. per_family          (n_families rows)
  5. inversion_priority  (full priority scan · SHIP/HOLD/DROP)
  6. marker_designs      (top-N × tested chrom × interval triplet) [GATED]
  7. focal_meiosis_scans (top-N × every tested chrom) [GATED]

Sections 5-7 use the meiosis stack which is gated on a real ngsTracts
CO-call adapter — see _handoff_docs/AUDIT_2026-05-15_meiosis_stack.md.
The bundle marks this in its meta header.
`);
}

const opts = _parseArgs(process.argv);
if (opts.help) { _help(); process.exit(0); }

const t0 = Date.now();
const bundle = buildBundle({ top_n: opts.top_n, focal_n_perm: opts.n_perm });
const content = opts.format === 'json' ? bundleToJson(bundle) : bundleToTsv(bundle);
const elapsed_ms = Date.now() - t0;

if (opts.stdout) {
  process.stdout.write(content);
  // Diagnostics go to stderr so stdout stays clean for piping.
  process.stderr.write(`# built in ${elapsed_ms} ms · ${content.length} bytes\n`);
} else {
  const outPath = opts.out
    ? resolve(opts.out)
    : resolve(REPO_ROOT, 'bundle.' + opts.format);
  writeFileSync(outPath, content);
  // Section row counts go to stderr.
  process.stderr.write(`Bundle written: ${outPath}\n`);
  process.stderr.write(`  format: ${opts.format}\n`);
  process.stderr.write(`  size:   ${content.length} bytes\n`);
  process.stderr.write(`  time:   ${elapsed_ms} ms\n`);
  process.stderr.write(`  top_n: ${opts.top_n}  n_perm: ${opts.n_perm}\n`);
  process.stderr.write('  sections:\n');
  for (const [k, rows] of Object.entries(bundle.sections)) {
    process.stderr.write(`    ${k.padEnd(24)} ${String(rows.length).padStart(5)} rows\n`);
  }
}
