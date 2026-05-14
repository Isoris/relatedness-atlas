// Smoke tests for the compatibility page's envelope-aware data-source
// badge. Same pattern as test_network_data_source.js but with the
// compatibility-page wording (close-kin filter context).
//
// Run from the relatedness-atlas root:
//   node atlases/relatedness/pages/hub/test_compatibility_data_source.js
import { resolveLatestLayer } from '../../shared/api_client.js';

// ----- fake DOM + fetch mock -------------------------------------------
class FakeEl {
  constructor() { this.className = ''; this.textContent = ''; this.title = ''; }
}
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
  return { ok, status, async json() { return body != null ? body : JSON.parse(t); }, async text() { return t; } };
}
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error(`FAIL: ${msg}\n  expected: ${JSON.stringify(b)}\n  got: ${JSON.stringify(a)}`);
    process.exit(1);
  }
  console.log(`  ok: ${msg}`);
}

// ----- mirror compatibility.js helpers (byte-equivalent) ----------------

async function _findEnvelope(atlasState) {
  const dataset_id = (atlasState && atlasState.cohort) || undefined;
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
    slot.textContent =
      '◌  Close-kin filter is using DEMO data ' +
      '(no ngsrelate_pairs envelope for this cohort).';
    slot.title = 'Run normalize_relatedness against a staging_relatedness_v0 ' +
                 'envelope to make this filter use real pairwise theta.';
    return;
  }
  const n = (envelope.payload && envelope.payload.summary
              && envelope.payload.summary.n_pairs) || 0;
  slot.className = 'data-source-badge live';
  slot.textContent =
    `●  ngsrelate_pairs envelope available: ${n} pair${n === 1 ? '' : 's'} ` +
    `from ${envelope.layer_id} (close-kin filter can use this).`;
  slot.title = `Provenance: action_id=${envelope.provenance?.action_id || '?'}` +
               (envelope.provenance?.source_layer_ids
                ? `, source_layer_ids=[${envelope.provenance.source_layer_ids.join(', ')}]`
                : '');
}

// ----- tests ------------------------------------------------------------

console.log('envelope found → live badge with close-kin framing:');
{
  _reset();
  _route(
    (url) => url.startsWith('/api/layers?'),
    () => ({ body: { layers: [{ layer_id: 'L_xyz' }], n: 1, total: 1 } }),
  );
  _route(
    (url) => url === '/api/layers/L_xyz',
    () => ({ body: {
      layer_id: 'L_xyz',
      provenance: { action_id: 'act_abc', source_layer_ids: ['src_1'] },
      payload: { summary: { n_pairs: 226 } },
    } }),
  );
  const env = await _findEnvelope({ cohort: 'main_226_hatchery' });
  const slot = new FakeEl();
  _renderBadge(slot, env);
  eq(slot.className, 'data-source-badge live', 'live class');
  if (!slot.textContent.includes('226 pairs')) {
    console.error(`FAIL: should advertise 226 pairs, got: ${slot.textContent}`);
    process.exit(1);
  }
  console.log('  ok: textContent advertises pair count');
  if (!slot.textContent.includes('close-kin filter can use this')) {
    console.error(`FAIL: should mention close-kin filter, got: ${slot.textContent}`);
    process.exit(1);
  }
  console.log('  ok: textContent ties to UI close-kin filter');
  if (!slot.title.includes('act_abc') || !slot.title.includes('src_1')) {
    console.error(`FAIL: title should carry action_id + source_layer_ids: ${slot.title}`);
    process.exit(1);
  }
  console.log('  ok: title carries lineage');
}

console.log('no envelope → demo badge with planner-context message:');
{
  _reset();
  _route(() => true, () => ({ body: { layers: [], n: 0, total: 0 } }));
  const env = await _findEnvelope({ cohort: 'main_226_hatchery' });
  eq(env, null, 'returns null on empty list');
  const slot = new FakeEl();
  _renderBadge(slot, env);
  eq(slot.className, 'data-source-badge demo', 'demo class');
  if (!slot.textContent.includes('Close-kin filter is using DEMO data')) {
    console.error(`FAIL: should mention close-kin filter, got: ${slot.textContent}`);
    process.exit(1);
  }
  console.log('  ok: textContent mentions close-kin DEMO context');
  if (!slot.title.includes('normalize_relatedness')) {
    console.error(`FAIL: title should hint at normalize_relatedness: ${slot.title}`);
    process.exit(1);
  }
  console.log('  ok: title hints at how to promote');
}

console.log('fetch error → demo badge (fail-soft):');
{
  _reset();
  _route(() => true, () => ({ status: 503, text: 'service unavailable' }));
  const env = await _findEnvelope({ cohort: 'main_226_hatchery' });
  eq(env, null, 'returns null on 5xx');
  const slot = new FakeEl();
  _renderBadge(slot, env);
  eq(slot.className, 'data-source-badge demo', 'demo class on server error');
  console.log('  ok: 5xx silently falls back');
}

console.log('atlasState without cohort → undefined dataset_id (still valid):');
{
  _reset();
  _route(
    (url) => url.startsWith('/api/layers?'),
    (url) => {
      // No dataset_id should mean no dataset_id= in the query string.
      const hasDataset = url.includes('dataset_id=');
      if (hasDataset) {
        console.error(`FAIL: dataset_id was unexpectedly forwarded: ${url}`);
        process.exit(1);
      }
      return { body: { layers: [], n: 0, total: 0 } };
    },
  );
  const env = await _findEnvelope(null);
  eq(env, null, 'null atlasState handled');
  console.log('  ok: undefined dataset_id is not forwarded in the query');
}

console.log('null slot → no throw:');
{
  _renderBadge(null, { layer_id: 'X', payload: { summary: { n_pairs: 5 } } });
  _renderBadge(null, null);
  console.log('  ok: null slot is a no-op');
}

console.log('\nALL OK');
