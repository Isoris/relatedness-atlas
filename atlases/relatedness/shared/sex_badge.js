// atlases/relatedness/shared/sex_badge.js
// =============================================================================
// Sex pill renderer — small <span class="sex-pill female|male|unk"> badge.
// Extracted from legacy Relatedness_atlas.js §9b (line 2853).
// Used by the Inversions expand panel and the Compatibility partner list.
// =============================================================================

import { DEMO } from './demo_data.js';

export function sexBadgeHtml(ind) {
  const s = (DEMO.sex || {})[ind] || '?';
  const cls = s === 'F' ? 'female' : s === 'M' ? 'male' : 'unk';
  return '<span class="sex-pill ' + cls + '">' + s + '</span>';
}
