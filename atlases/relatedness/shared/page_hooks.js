// atlases/relatedness/shared/page_hooks.js
// =============================================================================
// Tiny pub/sub bus used by shared modules (pop_tree, inspector) to notify the
// currently-mounted page that the global selection changed. Each page
// subscribes in its mount() and unsubscribes in its unmount(); the keys are
// well-known event names ('individual_changed', 'chromosome_changed', etc.).
//
// This exists so renderPopTree (a *shared* module) does not have to import
// every page module just to re-render whichever page is active.
//
// Round 1 (2026-05-11). Future rounds replace this with the atlas-core
// AtlasState emit/on pattern (see atlas-core/core/atlas_state.js).
// =============================================================================

const _listeners = new Map();    // event_name → Set<callback>

export function on(event, cb) {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event).add(cb);
  return () => off(event, cb);   // unsubscribe
}

export function off(event, cb) {
  const s = _listeners.get(event);
  if (s) s.delete(cb);
}

export function emit(event, payload) {
  const s = _listeners.get(event);
  if (!s) return;
  for (const cb of s) {
    try { cb(payload); }
    catch (e) { console.warn('[relatedness page_hooks] listener for', event, 'threw:', e); }
  }
}

export function clear() { _listeners.clear(); }
