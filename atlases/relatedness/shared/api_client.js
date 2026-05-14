// atlases/relatedness/shared/api_client.js
// =============================================================================
// Thin wrapper around the atlas-core unified server (atlas_server.py).
// One module so every page / loader hits the server through the same code
// path — easy to mock in tests and easy to swap out when we move from
// localhost to a hosted server.
//
// Endpoints this wraps (all already in atlas_server.py — see
// SERVER_README.md and server/RELATEDNESS_ENDPOINTS.md):
//
//   GET  /file/{path:path}      — sandboxed file read (PROJECT_ROOT)
//   POST /file/{path:path}      — sandboxed file write (allowlisted prefixes)
//   POST /compute/{name}        — dispatch to the server's COMPUTE_REGISTRY
//   GET  /api/jobs/{job_id}     — poll long-running compute job status
//   GET  /api/health            — server health (probe / startup check)
//
// Static fetches (`fetch('atlases/relatedness/data/foo.tsv')`) hit the
// server's static mount directly and bypass /file/* — that's the fast path
// for read-only data already inside the assembled workspace. Use
// {sandboxed:true} on readJson/readText if you specifically want to go
// through the /file/ endpoint (e.g. for paths outside the workspace that
// the file endpoint understands via the /mnt/e/... mirror).
//
// Round 1 (2026-05-11): the Mendelian + Compatibility pages compute
// entirely in-browser, so this module is staged but not yet called from
// any page. Round 2 wires `compute('relatedness_cohort_mendelian_scan', …)`
// once the server-side handler is registered (see
// atlases/relatedness/server/RELATEDNESS_ENDPOINTS.md for the contract).
// =============================================================================

const BASE = '';                                 // same origin as the served workspace
const JOB_POLL_INTERVAL_MS = 500;
const JOB_POLL_TIMEOUT_MS  = 5 * 60 * 1000;       // 5 minutes max wait

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function readText(path, { sandboxed = false } = {}) {
  const url = sandboxed ? `${BASE}/file/${_strip(path)}` : `${BASE}/${_strip(path)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new ApiError(resp.status, url, await _safeText(resp));
  return resp.text();
}

export async function readJson(path, { sandboxed = false } = {}) {
  const url = sandboxed ? `${BASE}/file/${_strip(path)}` : `${BASE}/${_strip(path)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new ApiError(resp.status, url, await _safeText(resp));
  return resp.json();
}

// Read a TSV and parse it into { header: string[], rows: object[] }.
// First row is the header; columns become object keys. Lines starting with
// '#' are skipped (per the ngsPedigree convention for metadata banners).
export async function readTsv(path, { sandboxed = false } = {}) {
  const text = await readText(path, { sandboxed });
  return parseTsv(text);
}

export function parseTsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split('\t');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = parts[j];
    rows.push(row);
  }
  return { header, rows };
}

// ---------------------------------------------------------------------------
// Writes (allowlisted server-side; see file_post in atlas_server.py)
// ---------------------------------------------------------------------------

export async function writeFile(path, body, { contentType = 'application/octet-stream' } = {}) {
  const url = `${BASE}/file/${_strip(path)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!resp.ok) throw new ApiError(resp.status, url, await _safeText(resp));
  return resp.json();
}

export async function writeJson(path, obj) {
  return writeFile(path, JSON.stringify(obj), { contentType: 'application/json' });
}

// ---------------------------------------------------------------------------
// Compute (synchronous + job-based)
// ---------------------------------------------------------------------------

// POST /compute/<name>. Returns the server's `result` payload directly.
// For long-running jobs the server returns { ok:true, result: { job_id, … } };
// callers that want to wait should use computeAndWait() instead.
export async function compute(name, args = {}) {
  const url = `${BASE}/compute/${encodeURIComponent(name)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!resp.ok) {
    const body = await _safeText(resp);
    if (resp.status === 404) {
      throw new ComputeNotRegistered(name, body);
    }
    throw new ApiError(resp.status, url, body);
  }
  const payload = await resp.json();
  return payload.result;
}

// POST /compute/<name>; if the response contains a job_id, poll
// /api/jobs/<id> until done. Returns the final result payload.
export async function computeAndWait(name, args = {}, opts = {}) {
  const result = await compute(name, args);
  if (result && typeof result === 'object' && result.job_id && result.status !== 'done') {
    return waitForJob(result.job_id, opts);
  }
  return result;
}

export async function waitForJob(job_id, { intervalMs = JOB_POLL_INTERVAL_MS,
                                            timeoutMs = JOB_POLL_TIMEOUT_MS,
                                            onProgress = null } = {}) {
  const t0 = Date.now();
  while (true) {
    const resp = await fetch(`${BASE}/api/jobs/${encodeURIComponent(job_id)}?include_result=1`);
    if (!resp.ok) throw new ApiError(resp.status, `/api/jobs/${job_id}`, await _safeText(resp));
    const payload = await resp.json();
    if (payload.status === 'done')   return payload.result;
    if (payload.status === 'failed') throw new ApiError(500, `/api/jobs/${job_id}`,
                                                         payload.error || 'job failed');
    if (onProgress) try { onProgress(payload); } catch (_) {}
    if (Date.now() - t0 > timeoutMs) {
      throw new ApiError(408, `/api/jobs/${job_id}`,
                          `job ${job_id} did not finish within ${timeoutMs}ms`);
    }
    await _sleep(intervalMs);
  }
}

// ---------------------------------------------------------------------------
// Health / capability probes
// ---------------------------------------------------------------------------

// Returns the server's /api/health payload, or null if the server is
// unreachable (e.g. opening Relatedness_atlas.html directly off disk).
// Pages use this to decide whether to enable the "Run on server" button.
export async function probeHealth() {
  try {
    const resp = await fetch(`${BASE}/api/health`);
    if (!resp.ok) return null;
    return resp.json();
  } catch (_) {
    return null;
  }
}

// Is a specific compute registered on the server? Cheap probe — POSTs an
// empty body and inspects the error shape. Pages cache the result so they
// don't re-probe on every interaction.
const _computeAvailability = new Map();
export async function isComputeAvailable(name) {
  if (_computeAvailability.has(name)) return _computeAvailability.get(name);
  let available = false;
  try {
    // The server returns 404 with { error, registered: [...] } when a
    // compute is unknown. A registered compute may return 500 (bad args)
    // — that still proves it exists.
    const resp = await fetch(`${BASE}/compute/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (resp.status !== 404) {
      available = true;
    } else {
      // Confirm by reading the registered list when present.
      try {
        const body = await resp.json();
        if (body && Array.isArray(body.registered)) {
          available = body.registered.includes(name);
        }
      } catch (_) {}
    }
  } catch (_) {
    available = false;
  }
  _computeAvailability.set(name, available);
  return available;
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, url, body) {
    super(`[atlas-server] ${status} ${url}: ${body}`);
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export class ComputeNotRegistered extends ApiError {
  constructor(name, body) {
    super(404, `/compute/${name}`, body);
    this.computeName = name;
    this.name = 'ComputeNotRegistered';
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _strip(path) { return String(path || '').replace(/^\/+/, ''); }
function _sleep(ms)   { return new Promise(r => setTimeout(r, ms)); }
async function _safeText(resp) { try { return await resp.text(); } catch (_) { return ''; } }
