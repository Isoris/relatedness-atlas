// shared/karyotype_source.js
// =============================================================================
// Single source of truth for "do we have live karyotypes or are we on DEMO?".
//
// The hub has five pages that read karyotype data — mendelian, compatibility,
// regimes, inversions, bdmi — plus the karyotypes table itself. Each one
// previously called `DEMO.karyotype_matrix[id]` directly, which made every
// page silently synthetic regardless of registry state.
//
// This module:
//   1. Probes the `inversion_karyotypes` registry layer once per hub session,
//      memoized — the second / third / nth caller gets the same Promise back.
//   2. Accepts both payload shapes the registry emits — pre-merged
//      `{ karyotype_matrix }` (the loader's output) and long-format row arrays.
//   3. Exposes `karyoFor(sampleId)` and `karyoForInv(sampleId, invId)` so
//      pages can drop the `DEMO.karyotype_matrix[id]` pattern with no other
//      code change.
//   4. Exposes `getKaryotypeSource()` ('live' | 'demo' | 'loading') and a
//      `subscribeKaryotypeSource(cb)` pubsub so a page can re-render when
//      the load resolves without polling.
//
// Pages that need a status badge call `loadLiveKaryotypes(registry)` for the
// returned Promise and render the badge themselves; mendelian.js does this.
// Pages that just need the data call `karyoFor(...)` and let the shared
// load happen lazily on the first call.
// =============================================================================

import { DEMO } from './demo_data.js';
import { probeModeB, distinctCount } from '../../../core/mode_b_badge.js';

// Cached load promise — shared across pages. Reset only by
// `__resetKaryotypeSourceForTests`; production code never tears this down.
let _loadPromise = null;
let _LIVE_MATRIX = null;          // {sample_id: {inversion_id: karyotype}}
let _LIVE_QUALITY = null;         // {sample_id: {inversion_id: 'high'|'low'}}
let _LIVE_SAMPLES_LIST = null;    // string[] when known, else null
let _LIVE_INVERSIONS_LIST = null; // Array<{candidate, chromosome, ...}> when known
let _LIVE_SAMPLES = 0;
let _LIVE_INVERSIONS = 0;
let _SOURCE = 'loading';          // 'live' | 'demo' | 'loading'
let _LAST_PROBE = null;
const _subs = new Set();

function _notify() {
  for (const cb of _subs) {
    try { cb(_SOURCE); } catch (e) { console.warn('karyotype_source: subscriber threw —', e); }
  }
}

/**
 * Probe the inversion_karyotypes layer and adopt the matrix on success.
 * Idempotent — only the first call hits the registry; subsequent callers
 * get the cached Promise. Safe to call from every page that needs data.
 *
 * Returns { source, samples, inversions, probe, matrix }.
 */
export function loadLiveKaryotypes(registry) {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    if (!registry || typeof registry.resolve !== 'function') {
      _SOURCE = 'demo';
      _LAST_PROBE = { ok: false, reason: 'registry-not-injected' };
      _notify();
      return _snapshot();
    }
    let probe;
    try {
      probe = await probeModeB(registry, 'inversion_karyotypes', {});
    } catch (e) {
      console.warn('karyotype_source: probeModeB threw —', e);
      _SOURCE = 'demo';
      _LAST_PROBE = { ok: false, reason: 'probe-threw' };
      _notify();
      return _snapshot();
    }
    _LAST_PROBE = probe;
    if (!probe.ok) {
      _SOURCE = 'demo';
      _notify();
      return _snapshot();
    }

    // Two valid payload shapes:
    //   (a) { karyotype_matrix: {sid: {inv: '0/1', ...}}, samples, inversions }
    //   (b) long-format row array [{sample_id, inversion_id, karyotype}, ...]
    let matrix = null, quality = null, samplesList = null, inversionsList = null;
    let samples = 0, inversions = 0;
    const payload = probe.payload || probe.rows;
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.karyotype_matrix) {
      matrix         = payload.karyotype_matrix;
      quality        = payload.karyotype_quality || null;
      samplesList    = Array.isArray(payload.samples) ? payload.samples.slice() : Object.keys(matrix);
      inversionsList = Array.isArray(payload.inversions) ? payload.inversions.slice() : null;
      samples        = samplesList.length;
      inversions     = inversionsList ? inversionsList.length : 0;
    } else if (Array.isArray(probe.rows)) {
      matrix = {};
      quality = {};
      const sampSet = new Set();
      const invMap = new Map();   // inv_id → { candidate, chromosome }
      for (const r of probe.rows) {
        const sid = r && (r.sample_id || r.sample);
        const iid = r && (r.candidate || r.inversion_id || r.inv_id);
        if (!sid || !iid) continue;
        if (!matrix[sid])  matrix[sid]  = {};
        if (!quality[sid]) quality[sid] = {};
        matrix[sid][iid]  = r.karyotype || 'NA';
        quality[sid][iid] = r.quality   || 'high';
        sampSet.add(sid);
        if (!invMap.has(iid)) {
          invMap.set(iid, { candidate: iid, chromosome: r.chromosome || r.chrom || '?' });
        }
      }
      samplesList    = Array.from(sampSet);
      inversionsList = Array.from(invMap.values());
      samples        = samplesList.length;
      inversions     = inversionsList.length;
      // distinctCount left in for the metric — same answer, less code.
      if (!samples)    samples    = distinctCount(probe.rows, 'sample_id');
      if (!inversions) inversions = distinctCount(probe.rows, 'inversion_id');
    }

    if (matrix && Object.keys(matrix).length > 0) {
      _LIVE_MATRIX = matrix;
      _LIVE_QUALITY = quality;
      _LIVE_SAMPLES_LIST = samplesList;
      _LIVE_INVERSIONS_LIST = inversionsList;
      _LIVE_SAMPLES = samples;
      _LIVE_INVERSIONS = inversions;
      _SOURCE = 'live';
    } else {
      _SOURCE = 'demo';
    }
    _notify();
    return _snapshot();
  })();
  return _loadPromise;
}

function _snapshot() {
  return {
    source:     _SOURCE,
    samples:    _LIVE_SAMPLES,
    inversions: _LIVE_INVERSIONS,
    probe:      _LAST_PROBE,
    matrix:     _LIVE_MATRIX,
  };
}

/** Per-sample karyotype map — live if loaded, DEMO otherwise. */
export function karyoFor(sampleId) {
  if (_LIVE_MATRIX && _LIVE_MATRIX[sampleId]) return _LIVE_MATRIX[sampleId];
  return DEMO.karyotype_matrix[sampleId] || {};
}

/** Convenience: single (sample, inversion) lookup. */
export function karyoForInv(sampleId, invId) {
  return karyoFor(sampleId)[invId];
}

/** 'live' | 'demo' | 'loading'. */
export function getKaryotypeSource() { return _SOURCE; }

/** Sample IDs from the live payload — null when the load is pending or
 *  the registry is empty. Pages can fall back to DEMO.individuals. */
export function getLiveSamples() { return _LIVE_SAMPLES_LIST; }

/** Inversion records (candidate, chromosome, ...) from the live payload —
 *  null when the load is pending or the registry is empty. */
export function getLiveInversions() { return _LIVE_INVERSIONS_LIST; }

/** Per-cell quality ('high' | 'low'). Null when no live data. */
export function karyoQualityFor(sampleId, invId) {
  if (!_LIVE_QUALITY) return null;
  const row = _LIVE_QUALITY[sampleId];
  return row ? (row[invId] || null) : null;
}

// ───────────────────────────────────────────────────────────────────────
// Auto-rendering badge slots.
//
// Any page that drops `<span data-karyotype-badge></span>` (or div, etc.)
// into its HTML gets the live/demo/loading status painted for free.
// Pages don't have to wire anything beyond their existing
// loadLiveKaryotypes(registry) call in mount() — the renderer here
// subscribes to source transitions and repaints every present slot.
//
// Three states:
//   loading  — gray dot · "● karyotypes loading"
//   live     — green dot · "● karyotypes live N×M"
//   demo     — amber dot · "○ karyotypes demo"
// Tooltip on each chip carries the full summary (sample/inversion counts
// or stub reason from the probe).
// ───────────────────────────────────────────────────────────────────────
const _BADGE_STYLE = {
  loading: { color: '#888', glyph: '●', text: 'karyotypes loading' },
  live:    { color: '#3cc08a', glyph: '●', text: 'karyotypes live' },
  demo:    { color: '#f5a524', glyph: '○', text: 'karyotypes demo' },
};

function _paintBadgeSlots() {
  if (typeof document === 'undefined') return;
  const slots = document.querySelectorAll('[data-karyotype-badge]');
  if (!slots.length) return;
  const style = _BADGE_STYLE[_SOURCE] || _BADGE_STYLE.loading;
  let label = style.text;
  let tip;
  if (_SOURCE === 'live') {
    label = `${style.text} ${_LIVE_SAMPLES}×${_LIVE_INVERSIONS}`;
    tip = `Mendelian / compatibility / regimes / inversions / BDMI all read from the inversion-atlas export (${_LIVE_SAMPLES} samples × ${_LIVE_INVERSIONS} inversions). Tests use real data.`;
  } else if (_SOURCE === 'demo') {
    const reason = (_LAST_PROBE && _LAST_PROBE.reason) || 'no payload';
    tip = `inversion_karyotypes registry layer returned: ${reason}. Falling back to DEMO data — tests are synthetic. Drop the inversion-atlas Karyotypes TSV at the registry-templated path to flip every karyotype-aware page to live data.`;
  } else {
    tip = 'Probing the inversion_karyotypes registry layer…';
  }
  slots.forEach((slot) => {
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.style.gap = '4px';
    slot.style.fontFamily = 'ui-monospace, monospace';
    slot.style.fontSize = '10.5px';
    slot.style.padding = '2px 7px';
    slot.style.borderRadius = '10px';
    slot.style.border = `1px solid ${style.color}55`;
    slot.style.background = `${style.color}14`;
    slot.style.color = style.color;
    slot.title = tip;
    slot.textContent = `${style.glyph} ${label}`;
  });
}

// Subscribe internally so every transition paints automatically.
_subs.add(_paintBadgeSlots);

/** Force-paint any present `[data-karyotype-badge]` slots. Pages call
 *  this from mount() so the initial state shows before the load resolves. */
export function renderKaryotypeBadgeSlots() { _paintBadgeSlots(); }

/** Subscribe to source transitions. Returns an unsubscribe fn. */
export function subscribeKaryotypeSource(cb) {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** Test-only: forget the cached load so the next call re-probes. */
export function __resetKaryotypeSourceForTests() {
  _loadPromise = null;
  _LIVE_MATRIX = null;
  _LIVE_QUALITY = null;
  _LIVE_SAMPLES_LIST = null;
  _LIVE_INVERSIONS_LIST = null;
  _LIVE_SAMPLES = 0;
  _LIVE_INVERSIONS = 0;
  _SOURCE = 'loading';
  _LAST_PROBE = null;
}
