// shared/loaders/family_hub_roster.js
// =============================================================================
// Loads ngsPedigree Stage 1's family_hub_roster.tsv — one row per individual
// with its assigned family + hub + role (hub, member, forced_parent,
// parent_a, parent_b, ambiguous, unassigned).
//
// Drives the Population Browser tree (shared/pop_tree.js) and seeds the
// DEMO.families / DEMO.individuals / DEMO.ambiguous_clusters / DEMO.unassigned
// shapes used by every page.
//
// Extract-schema:
//   {
//     "schema":       "family_hub_roster_v1",
//     "produced_by":  "ngsPedigree Stage 1",
//     "individuals":  string[],
//     "families":     Array<{ family_id, hub_individual, members, n }>,
//     "ambiguous_clusters": Array<{ id, members }>,
//     "unassigned":   string[],
//     "by_individual": Object<sample_id → { family_id, role }>,
//   }
// =============================================================================

import { readTsv } from '../api_client.js';

export async function loadFamilyHubRoster(args, { fetcher = null } = {}) {
  const { roster_path } = args || {};
  if (!roster_path) throw new Error('loadFamilyHubRoster: roster_path is required');

  const { rows } = fetcher ? fetcher(roster_path) : await readTsv(roster_path);

  const individuals = [];
  const familyMap = new Map();        // family_id → { hub, members:Set }
  const ambig = new Map();             // cluster_id → Set
  const unassigned = [];
  const by_individual = {};

  for (const r of rows) {
    const sample_id = r.sample_id || r.individual_id || r.id;
    if (!sample_id) continue;
    individuals.push(sample_id);
    by_individual[sample_id] = { family_id: r.family_id || null, role: r.role || null };

    if (r.family_id && r.family_id !== '' && r.family_id !== 'NA') {
      if (!familyMap.has(r.family_id)) {
        familyMap.set(r.family_id, { hub: null, members: new Set() });
      }
      const fam = familyMap.get(r.family_id);
      fam.members.add(sample_id);
      if (r.role === 'hub' || r.role === 'forced_parent') fam.hub = sample_id;
    } else if (r.cluster_id && r.cluster_id !== '' && r.cluster_id !== 'NA') {
      if (!ambig.has(r.cluster_id)) ambig.set(r.cluster_id, new Set());
      ambig.get(r.cluster_id).add(sample_id);
    } else {
      unassigned.push(sample_id);
    }
  }

  const families = Array.from(familyMap.entries()).map(([family_id, v]) => ({
    family_id,
    hub_individual: v.hub,
    members: Array.from(v.members),
    n: v.members.size,
  }));

  const ambiguous_clusters = Array.from(ambig.entries()).map(([id, members]) => ({
    id, members: Array.from(members),
  }));

  return {
    schema:       'family_hub_roster_v1',
    produced_by:  'ngsPedigree Stage 1',
    produced_at:  new Date().toISOString(),
    individuals,
    families,
    ambiguous_clusters,
    unassigned,
    by_individual,
  };
}
