// Smoke tests for the network page's envelope-aware data-source badge.
//
// Exercises mount()'s envelope-probe + badge-render path with a stubbed
// DOM + mocked fetch. Confirms the migration is fail-soft:
//   - envelope present → badge advertises layer_id + n_pairs + created_at
//   - envelope absent  → badge shows DEMO fallback message
//   - fetch error      → badge silently falls back to DEMO (no throw)
//
// Run from the relatedness-atlas root:
//   node atlases/relatedness/pages/hub/test_network_data_source.js
//
// The test imports the api_client surface directly (the function the
// migrated page uses) rather than loading network.js — that module
// imports from ../../shared/state.js et al. which are browser-coupled.
// What we're verifying is the contract between network.js and
// api_client.js + the badge-rendering shape.
import { resolveLatestLayer } from '../../shared/api_client.js';

// ----- fake DOM ---------------------------------------------------------
class FakeEl {
  constructor() { this.className = ''; this.textContent = ''; this.title = ''; }
}

// ----- fetch mock -------------------------------------------------------
const _routes = [];
const _calls  = [];
function _route(p, fn) { _routes.push({ p, fn }); }
function _reset()      { _routes.length = 0; _calls.length = 0; }
globalThis.fetch = async (url, init) => {
  _calls.push({ url, init });
  for (const r of _routes) if (r.p(url, init)) return _make(await r.fn(url, init));
  return _make({ status: 404, body: { error: 'no route', url } });
};
function _make({ status = 200, body = null, text = null } = {}) {
  const ok = status >= 200 && status < 300;
  const t = text ?? (body == null ? '' : JSON.stringify(body));
  return {
    ok, status,
    async json() { return body != null ? body : JSON.parse(t); },
    async text() { return t; },
  };
}

function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error(`FAIL: ${msg}\n  expected: ${JSON.stringify(b)}\n  got: ${JSON.stringify(a)}`);
    process.exit(1);
  }
  console.log(`  ok: ${msg}`);
}

// ----- mirror the network.js logic (the inline helpers are not
// exported; we mirror them here, byte-equivalent to what runs in the
// browser. Diverging this from network.js means the migration broke and
// the test should be updated). ------------------------------------------

async function _findEnvelope(dataset_id) {
  try {
    return await resolveLatestLayer('ngsrelate_pairs', {
      dataset_id, stage: 'normalized',
    });
  } catch (_e) { return null; }
}

function _renderBadge(slot, envelope) {
  if (slot == null) return;
  if (envelope == null) {
    slot.className = 'data-source-badge demo';
    slot.textContent = '◌  Showing DEMO network (no ngsrelate_pairs envelope for this cohort).';
    slot.title = 'Submit a normalize_relatedness action to promote ' +
                 'staging_relatedness_v0 → ngsrelate_pairs_v1.';
    return;
  }
  const n = (envelope.payload && envelope.payload.summary
              && envelope.payload.summary.n_pairs) || 0;
  slot.className = 'data-source-badge live';
  slot.textContent =
    `●  ngsrelate_pairs envelope: ${envelope.layer_id}  ` +
    `· ${n} pair${n === 1 ? '' : 's'}  ` +
    `· created ${envelope.created_at || '?'}`;
  slot.title = `Provenance: action_id=${envelope.provenance?.action_id || '?'}` +
               (envelope.provenance?.source_layer_ids
                ? `, source_layer_ids=[${envelope.provenance.source_layer_ids.join(', ')}]`
                : '');
}

// ----- tests ------------------------------------------------------------

console.log('envelope found → live badge:');
{
  _reset();
  _route(
    (url) => url.startsWith('/api/layers?'),
    () => ({ body: { layers: [
      { layer_id: 'ngsrelate_pairs_main_226_hatchery_xyz' },
    ], n: 1, total: 1 } }),
  );
  _route(
    (url) => url === '/api/layers/ngsrelate_pairs_main_226_hatchery_xyz',
    () => ({ body: {
      layer_id: 'ngsrelate_pairs_main_226_hatchery_xyz',
      layer_type: 'ngsrelate_pairs',
      created_at: '2026-05-14T15:30:00Z',
      provenance: {
        action_id: 'act_norm_xyz',
        source_layer_ids: ['relatedness_result_main_226_hatchery_abc'],
      },
      payload: {
        pairs: [{}, {}, {}],
        summary: { n_pairs: 3, n_samples: 3, median_theta: 0.018 },
      },
    } }),
  );
  const env = await _findEnvelope('main_226_hatchery');
  eq(env != null, true, 'envelope resolved');
  const slot = new FakeEl();
  _renderBadge(slot, env);
  eq(slot.className, 'data-source-badge live', 'live class applied');
  if (!slot.textContent.includes('3 pairs')) {
    console.error(`FAIL: textContent should include "3 pairs", got: ${slot.textContent}`);
    process.exit(1);
  }
  console.log(`  ok: textContent advertises 3 pairs`);
  if (!slot.title.includes('action_id=act_norm_xyz')) {
    console.error(`FAIL: title should advertise action_id, got: ${slot.title}`);
    process.exit(1);
  }
  console.log('  ok: title carries action_id + source_layer_ids');
  if (!slot.title.includes('relatedness_result_main_226_hatchery_abc')) {
    console.error(`FAIL: title should carry source_layer_ids: ${slot.title}`);
    process.exit(1);
  }
  console.log('  ok: title carries source_layer_ids (lineage)');
}

console.log('no envelope (empty list) → demo badge:');
{
  _reset();
  _route(() => true, () => ({ body: { layers: [], n: 0, total: 0 } }));
  const env = await _findEnvelope('main_226_hatchery');
  eq(env, null, 'returns null on empty list');
  const slot = new FakeEl();
  _renderBadge(slot, env);
  eq(slot.className, 'data-source-badge demo', 'demo class applied');
  if (!slot.textContent.includes('DEMO')) {
    console.error(`FAIL: should mention DEMO: ${slot.textContent}`);
    process.exit(1);
  }
  console.log('  ok: textContent advertises DEMO fallback');
}

console.log('fetch error → demo badge (fail-soft):');
{
  _reset();
  _route(() => true, () => ({ status: 500, text: 'engine down' }));
  const env = await _findEnvelope('main_226_hatchery');
  eq(env, null, 'returns null on 5xx (caught by try/catch)');
  const slot = new FakeEl();
  _renderBadge(slot, env);
  eq(slot.className, 'data-source-badge demo', 'demo class on server error');
  console.log('  ok: 5xx silently falls back to DEMO');
}

console.log('singular "pair" vs plural "pairs":');
{
  const slot = new FakeEl();
  _renderBadge(slot, {
    layer_id: 'L1',
    created_at: '2026-05-14T00:00:00Z',
    payload: { summary: { n_pairs: 1 } },
  });
  if (!slot.textContent.includes('1 pair ')) {  // trailing space → singular
    console.error(`FAIL: should say "1 pair" (singular): ${slot.textContent}`);
    process.exit(1);
  }
  console.log('  ok: singular form for n_pairs=1');
  const slot2 = new FakeEl();
  _renderBadge(slot2, {
    layer_id: 'L2',
    created_at: '2026-05-14T00:00:00Z',
    payload: { summary: { n_pairs: 0 } },
  });
  if (!slot2.textContent.includes('0 pairs')) {
    console.error(`FAIL: should say "0 pairs" (plural for zero): ${slot2.textContent}`);
    process.exit(1);
  }
  console.log('  ok: plural form for n_pairs=0');
}

console.log('slot missing → no throw:');
{
  // The migration handles `slot == null` gracefully so the page renders
  // even if the HTML scaffold lacks the #networkDataSource div.
  _renderBadge(null, { layer_id: 'X', payload: { summary: { n_pairs: 5 } } });
  _renderBadge(null, null);
  console.log('  ok: null slot is a no-op (no throw)');
}

console.log('\nALL OK');
