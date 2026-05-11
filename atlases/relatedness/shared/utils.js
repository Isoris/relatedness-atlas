// atlases/relatedness/shared/utils.js
// =============================================================================
// Tiny utilities used across every page module of the Relatedness Atlas.
// Extracted from the legacy single-file Relatedness_atlas.js (§2 lines 491-514).
//
// - $ / $$        — querySelector aliases
// - el(tag,attrs) — declarative DOM builder
// - fmt(n)        — fixed-3 numeric formatter (returns '—' for NaN)
// - hashStr(s)    — djb2-style deterministic hash for synthetic-data seeding
//                    (used by shared/demo_data.js to make ancestry-Q +
//                    karyotype draws reproducible)
// =============================================================================

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const fmt = n => Number.isFinite(n) ? n.toFixed(3) : '—';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    if (k === 'class')        e.className = v;
    else if (k === 'html')    e.innerHTML = v;
    else if (k === 'text')    e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function')
                              e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object')
                              Object.assign(e.style, v);
    else                      e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === 'string')      e.appendChild(document.createTextNode(c));
    else                            e.appendChild(c);
  }
  return e;
}

export function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
