// shared/loaders/res_pairwise.js
// =============================================================================
// Loads ngsPedigree Stage 1 output — the 23-column pairwise relationship
// classification TSV (pairwise_relationship_classification.tsv).
//
// Activate-schema (paths the loader needs):
//   {
//     "res_pairwise_path": "data/relatedness/pairwise_relationship_classification.tsv"
//   }
//
// Extract-schema (the artifact this loader emits):
//   {
//     "schema":      "res_pairwise_v1",
//     "produced_by": "ngsPedigree Stage 1",
//     "produced_at": "<wall-clock>",
//     "n_pairs":    <int>,
//     "pairs":      Array<{ a, b, k0, k1, k2, kinship, IBS0, PO_distance,
//                            relationship_class, ... }>,
//     "by_pair":    Object<"a|b" → row>,    // sorted-key index for O(1) lookup
//   }
//
// Used by:
//   - shared/inspector.js — read pairwise_stats for the (A, B) focal pair
//   - pages/hub/network.js — color edges by relationship_class
// =============================================================================

import { readTsv } from '../api_client.js';

export async function loadResPairwise(args, { fetcher = null } = {}) {
  const { res_pairwise_path } = args || {};
  if (!res_pairwise_path) {
    throw new Error('loadResPairwise: res_pairwise_path is required');
  }

  const { header, rows } = fetcher
    ? fetcher(res_pairwise_path)
    : await readTsv(res_pairwise_path);

  const numCols = new Set(['k0','k1','k2','kinship','IBS0','PO_distance']);
  const pairs = rows.map(r => {
    const out = {};
    for (const k of header) {
      out[k] = numCols.has(k) ? parseFloat(r[k]) : r[k];
    }
    return out;
  });

  const by_pair = {};
  for (const p of pairs) {
    const key = [p.a, p.b].sort().join('|');
    by_pair[key] = p;
  }

  return {
    schema:       'res_pairwise_v1',
    produced_by:  'ngsPedigree Stage 1',
    produced_at:  new Date().toISOString(),
    n_pairs:      pairs.length,
    pairs,
    by_pair,
  };
}
