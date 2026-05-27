// tests/_assert.mjs
// =============================================================================
// Minimal assertion helpers. No dependency on node:assert so failures emit
// the message+context format the existing test_*.js files use.
// =============================================================================

export function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error(`  FAIL · ${msg}`);
    console.error(`    expected: ${JSON.stringify(b)}`);
    console.error(`    got:      ${JSON.stringify(a)}`);
    process.exit(1);
  }
  console.log(`  ok · ${msg}`);
}

export function truthy(v, msg) {
  if (!v) {
    console.error(`  FAIL · ${msg} (got ${JSON.stringify(v)})`);
    process.exit(1);
  }
  console.log(`  ok · ${msg}`);
}

export function isFn(x, msg) {
  if (typeof x !== 'function') {
    console.error(`  FAIL · ${msg} (got ${typeof x})`);
    process.exit(1);
  }
  console.log(`  ok · ${msg}`);
}

export function inRange(x, lo, hi, msg) {
  if (!Number.isFinite(x) || x < lo || x > hi) {
    console.error(`  FAIL · ${msg} (got ${x}, expected ${lo}..${hi})`);
    process.exit(1);
  }
  console.log(`  ok · ${msg} (${x})`);
}

export function geq(x, lo, msg) {
  if (!Number.isFinite(x) || x < lo) {
    console.error(`  FAIL · ${msg} (got ${x}, expected ≥ ${lo})`);
    process.exit(1);
  }
  console.log(`  ok · ${msg} (${x})`);
}

export function noThrow(fn, msg) {
  try { fn(); console.log(`  ok · ${msg}`); }
  catch (e) {
    console.error(`  FAIL · ${msg}`);
    console.error(`    threw: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
  }
}

export async function noThrowAsync(fn, msg) {
  try { await fn(); console.log(`  ok · ${msg}`); }
  catch (e) {
    console.error(`  FAIL · ${msg}`);
    console.error(`    threw: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
  }
}

export function section(title) {
  console.log('\n=== ' + title + ' ===');
}

export function done() {
  console.log('\nALL OK');
}
