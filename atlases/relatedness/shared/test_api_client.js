// Smoke tests for shared/api_client.js — the action-pipeline methods.
//
// Boots a tiny mock fetch (no server needed; mirrors what
// atlas-core/tests/test_layer_api.js does). The relatedness atlas's
// api_client is self-contained — no atlas-core import — so this test
// runs against pure stdlib + the module under test.
//
// Run from the atlas root:
//   node atlases/relatedness/shared/test_api_client.js

import {
  listLayers, getLayer, resolveLatestLayer,
  submitAction, getActionLog, newActionId,
  ApiError,
} from './api_client.js';

// ---- fetch mock --------------------------------------------------------
const _routes = [];
const _calls  = [];

function _route(predicate, respFn) { _routes.push({ predicate, respFn }); }
function _resetMock() { _routes.length = 0; _calls.length = 0; }

globalThis.fetch = async (url, init) => {
  _calls.push({ url, init });
  for (const r of _routes) {
    if (r.predicate(url, init)) {
      return _makeResp(await r.respFn(url, init));
    }
  }
  return _makeResp({ status: 404, body: { error: 'no mock route', url } });
};

function _makeResp({ status = 200, body = null, text = null } = {}) {
  const okStatus = status >= 200 && status < 300;
  const bodyText = text !== null
    ? text
    : (body === null ? '' : JSON.stringify(body));
  return {
    ok: okStatus,
    status,
    async json() { return body !== null ? body : JSON.parse(bodyText); },
    async text() { return bodyText; },
  };
}

function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error(`FAIL: ${msg}`);
    console.error(`  expected: ${JSON.stringify(b)}`);
    console.error(`  got:      ${JSON.stringify(a)}`);
    process.exit(1);
  }
  console.log(`  ok: ${msg}`);
}

async function rejects(fn, frag, label) {
  try { await fn(); } catch (e) {
    if (!String(e.message).includes(frag)) {
      console.error(`FAIL: ${label} — wrong error: ${e.message}`);
      process.exit(1);
    }
    console.log(`  ok: ${label}`);
    return;
  }
  console.error(`FAIL: ${label} — did not throw`);
  process.exit(1);
}

// ---- tests -------------------------------------------------------------

console.log('listLayers:');
{
  _resetMock();
  _route(
    (url) => url.startsWith('/api/layers') && !url.includes('/api/layers/'),
    () => ({ body: { layers: [], n: 0, total: 0 } }),
  );
  await listLayers({});
  eq(_calls[0].url, '/api/layers', 'no filters → bare path');

  _resetMock();
  _route(
    (url) => url.startsWith('/api/layers'),
    () => ({ body: { layers: [], n: 0, total: 0 } }),
  );
  await listLayers({
    layer_type: 'ngsrelate_pairs',
    dataset_id: 'main_226_hatchery',
    stage:      'normalized',
    limit:      25,
  });
  const u = new URL('http://x' + _calls[0].url);
  eq(u.searchParams.get('layer_type'), 'ngsrelate_pairs', 'layer_type forwarded');
  eq(u.searchParams.get('dataset_id'), 'main_226_hatchery', 'dataset_id forwarded');
  eq(u.searchParams.get('stage'),      'normalized', 'stage forwarded');
  eq(u.searchParams.get('limit'),      '25', 'limit forwarded');

  _resetMock();
  _route(() => true, () => ({ status: 500, text: 'engine down' }));
  await rejects(
    () => listLayers({}),
    '500',
    '5xx surfaces as ApiError',
  );
}

console.log('getLayer:');
{
  await rejects(() => getLayer(''), 'layer_id required', 'empty layer_id rejected');

  _resetMock();
  const env = {
    layer_id: 'ngsrelate_pairs_main_226_hatchery_abc',
    layer_type: 'ngsrelate_pairs',
    schema_version: 'ngsrelate_pairs_v1',
    stage: 'normalized',
    payload: { pairs: [], summary: { n_pairs: 0 } },
  };
  _route(
    (url) => url === '/api/layers/ngsrelate_pairs_main_226_hatchery_abc',
    () => ({ body: env }),
  );
  const fetched = await getLayer('ngsrelate_pairs_main_226_hatchery_abc');
  eq(fetched.layer_type, 'ngsrelate_pairs', 'returned envelope');

  _resetMock();
  _route(() => true, () => ({ status: 404, text: 'not found' }));
  await rejects(() => getLayer('missing'), '404', '404 surfaces');
}

console.log('resolveLatestLayer:');
{
  _resetMock();
  _route(
    (url) => url.startsWith('/api/layers?'),
    () => ({ body: { layers: [
      { layer_id: 'L_old' },
      { layer_id: 'L_new' },
    ], n: 2, total: 2 } }),
  );
  _route(
    (url) => url === '/api/layers/L_new',
    () => ({ body: { layer_id: 'L_new', stage: 'normalized' } }),
  );
  const env = await resolveLatestLayer('ngsrelate_pairs', { dataset_id: 'c1' });
  eq(env.layer_id, 'L_new', 'tail of list returned');

  _resetMock();
  _route(() => true, () => ({ body: { layers: [], n: 0, total: 0 } }));
  const none = await resolveLatestLayer('ngsrelate_pairs', { dataset_id: 'x' });
  eq(none, null, 'returns null when no match');

  await rejects(
    () => resolveLatestLayer(''),
    'layer_type required',
    'empty layer_type rejected',
  );
}

console.log('submitAction:');
{
  await rejects(() => submitAction(null), 'manifest object required', 'null manifest rejected');

  _resetMock();
  _route(
    (url, init) => url.startsWith('/api/actions') && init && init.method === 'POST',
    () => ({ body: {
      ok: true, action_id: 'act_555_xyz',
      atlas_id: 'relatedness',
      produced_layers: ['ngsrelate_pairs_main_226_hatchery_xyz'],
    } }),
  );
  const m = {
    action_id: 'act_555_xyz', type: 'normalize_relatedness',
    dataset_id: 'main_226_hatchery', runner: 'normalize_relatedness',
    target: { source_layer_id: 'relatedness_result_main_226_hatchery_abc' },
    expected_outputs: [
      { layer_type: 'ngsrelate_pairs', schema_version: 'ngsrelate_pairs_v1' }
    ],
  };
  const res = await submitAction(m, { atlas: 'relatedness' });
  eq(_calls[0].url, '/api/actions?atlas=relatedness', 'atlas query forwarded');
  eq(_calls[0].init.method, 'POST', 'POST method');
  eq(res.produced_layers, ['ngsrelate_pairs_main_226_hatchery_xyz'], 'produced_layers echoed');
  const sentBody = JSON.parse(_calls[0].init.body);
  eq(sentBody.action_id, 'act_555_xyz', 'manifest body forwarded');
  eq(sentBody.target.source_layer_id,
     'relatedness_result_main_226_hatchery_abc',
     'lineage source_layer_id round-trips');
}

console.log('getActionLog:');
{
  await rejects(() => getActionLog(''), 'action_id required', 'empty action_id rejected');

  _resetMock();
  _route(
    (url) => url === '/api/actions/act_555_xyz',
    () => ({ body: { action_id: 'act_555_xyz', status: 'success', produced_layers: ['L_x'] } }),
  );
  const entry = await getActionLog('act_555_xyz');
  eq(entry.status, 'success', 'log entry returned');
}

console.log('newActionId:');
{
  const id = newActionId();
  if (!/^act_[A-Za-z0-9_]+$/.test(id)) {
    console.error(`FAIL: newActionId did not match regex: ${id}`);
    process.exit(1);
  }
  console.log(`  ok: schema-conformant (${id})`);

  const tagged = newActionId('rel');
  if (!tagged.endsWith('_rel')) {
    console.error(`FAIL: tagged action_id did not end with _rel: ${tagged}`);
    process.exit(1);
  }
  console.log('  ok: tag honored');
}

console.log('\nALL OK');
