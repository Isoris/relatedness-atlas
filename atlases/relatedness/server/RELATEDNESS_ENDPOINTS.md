# Relatedness Atlas — server-side contract

**Status:** Atlas-side wiring landed 2026-05-11. Server-side handlers
**not yet registered** in `atlas-core/server/atlas_server.py` — that's the
sister chat's work. This file is the contract the server should implement.

**Do not** edit `atlas_server.py` from the relatedness-atlas session. The
atlas-side falls back to in-browser compute when an endpoint is missing
(every page module already does this — see the `isComputeAvailable` /
`computeAndWait` calls in `pages/hub/mendelian.js` and
`pages/hub/compatibility.js`), so the atlas is fully usable today without
the server-side handlers.

## What the atlas needs

### Static reads (already work today)

All four ngsPedigree-produced data files are read via the existing static
mount on `atlas_server.py` (`StaticFiles` mount at `/`, bootstrapped by
`_bootstrap_static` in atlas_server.py around line 1409). No changes
needed:

```
GET /atlases/relatedness/data/<file>           # served by StaticFiles
GET /file/atlases/relatedness/data/<file>      # sandboxed alternative
```

The loaders live in `atlases/relatedness/shared/loaders/` and call
`api_client.readTsv(path)`. Four loaders, one per planned data file:

| Loader                          | Reads                                              | Producer            |
|---------------------------------|----------------------------------------------------|---------------------|
| `loadResPairwise`               | `pairwise_relationship_classification.tsv`         | ngsPedigree Stage 1 |
| `loadFamilyHubRoster`           | `family_hub_roster.tsv`                            | ngsPedigree Stage 1 |
| `loadPerChromQc`                | per-chromosome QC TSV                              | ngsPedigree Stage 2 |
| `loadInversionKaryotypes`       | inversion karyotype TSV + candidate catalogue      | Inversion Atlas     |

### Compute endpoints (server-side, register in `COMPUTE_REGISTRY`)

Atlas-core dispatches these through `POST /compute/<name>`. The server
already has the dispatcher — only the per-name handlers need adding to
the `COMPUTE_REGISTRY` dict at the bottom of `atlas_server.py` (~ line
1735). Same handler signature as the existing `echo`/`list_files`:

```python
def _compute_<name>(args: Dict[str, Any], project_root: Path) -> Dict[str, Any]:
    # ... compute and return the result dict ...
    return result

COMPUTE_REGISTRY: Dict[str, Any] = {
    "echo":       _compute_echo,
    "list_files": _compute_list_files,
    # NEW:
    "relatedness_mendelian_dyad_test":     _compute_relatedness_mendelian_dyad_test,
    "relatedness_mendelian_triad_test":    _compute_relatedness_mendelian_triad_test,
    "relatedness_cohort_mendelian_scan":   _compute_relatedness_cohort_mendelian_scan,
    "relatedness_compatibility_search":    _compute_relatedness_compatibility_search,
}
```

Full input/output schemas live in
`atlases/relatedness/registries/data/operations.registry.json` — that
file is the source of truth for the request/response shapes. Summary:

| Endpoint                                | Sync/async | Body                                                            | Returns |
|-----------------------------------------|------------|-----------------------------------------------------------------|---------|
| `relatedness_mendelian_dyad_test`       | sync       | `{ parent_id, offspring_id, candidate_list }`                   | `{ mode:'dyad', n_total, n_consistent, n_inconsistent, n_informative, n_zero, n_one, transmission_p, consistency_p, detail }` |
| `relatedness_mendelian_triad_test`      | sync       | `{ parent1_id, parent2_id, offspring_id, candidate_list }`      | `{ mode:'triad', n_total, ..., chi2, chi2_p, chi2_df, detail }` |
| `relatedness_cohort_mendelian_scan`     | **async**  | `{ candidate_ids, triad_ids, alpha, include_suspect_trios }`    | first call: `{ job_id, status:'pending' }`; then `GET /api/jobs/<id>?include_result=1` until `status:'done'`. Final shape: `{ n_candidates, scores:[scoreInversion-shape] }` |
| `relatedness_compatibility_search`      | sync       | `{ focal_id, target_karyotype, scope, inv_single, chrom, sex_aware, exclude_kin, exclude_ambig }` | `{ focal, target, invSet, sex_data_available, sex_filter_applied, results }` |

### Reference implementation (already exists in-browser)

The browser already runs every one of these computes. The Python ports
should produce **byte-identical** results — share the algorithm reference
to make sure:

| Server endpoint                       | Browser implementation                                                        |
|---------------------------------------|-------------------------------------------------------------------------------|
| `relatedness_mendelian_dyad_test`     | `pages/hub/mendelian.js::runDyadTest`                                         |
| `relatedness_mendelian_triad_test`    | `pages/hub/mendelian.js::runTriadTest`                                        |
| `relatedness_cohort_mendelian_scan`   | `pages/hub/inversions.js::scoreInversion` (called for every candidate)        |
| `relatedness_compatibility_search`    | `pages/hub/compatibility.js::runCompatibilitySearch`                          |

Statistical primitives (binomial-exact two-sided, chi-square via
Wilson-Hilferty, expected offspring prior) are in
`atlases/relatedness/shared/stats.js`. The Python port should use
`scipy.stats.binomtest` and `scipy.stats.chi2` to avoid re-deriving the
approximations.

### Async job pattern (cohort scan only)

`relatedness_cohort_mendelian_scan` is the one that needs a background
job because a real cohort × candidate matrix is ~400k cell evaluations.
The pattern is identical to the existing
`/api/popstats/groupwise` slow path:

1. Server's handler enqueues a job, immediately returns
   `{ job_id, status: 'pending' }`.
2. Browser polls `GET /api/jobs/<job_id>?include_result=1` until
   `status == 'done'` (`api_client.waitForJob` does this).
3. Server writes the final result blob to
   `_cache/server_results/<op_id>/<hash>.json` for cache hits on
   identical reruns.

The atlas-side already handles all three steps through
`api_client.computeAndWait()` — no per-page logic needed.

### Writes (not used in round 1)

No write endpoints required for round 1. Round 2 may add
`POST /file/data/relatedness/sessions/<...>` for saving review state
(parallel to the existing `data/review/inversion/sessions/` write
allowlist). Add the prefix to `_is_path_allowed_for_write` when that
lands.

## How the atlas calls these

Each page module probes availability at mount time:

```js
import { computeAndWait, isComputeAvailable } from '../../shared/api_client.js';

let _serverComputeAvailable = false;

export async function mount() {
  isComputeAvailable('relatedness_compatibility_search')
    .then(v => { _serverComputeAvailable = v; });
}

async function runSearch() {
  if (_serverComputeAvailable) {
    try { return await computeAndWait('relatedness_compatibility_search', args); }
    catch (err) { /* fall through to in-browser */ }
  }
  // ... in-browser fallback ...
}
```

`isComputeAvailable` cheaply POSTs an empty body and reads the 404
response's `registered: [...]` list — no per-call overhead after the
first probe.

## Versioning + provenance

The atlas tags every result with `produced_by` and `produced_at` strings
(see the loader outputs). Server responses should set
`produced_by: 'atlas_server.py v<X.Y.Z>'` so the manuscript can cite
which side ran each compute.

## Testing

Round-2 includes a `tests/` directory mirroring the inversion-atlas
test harness (`tests/test_<stage>_<page>.js`,
`tests/smoke_<stage>_<page>_round<R>.mjs`). Each compute endpoint gets
a smoke test that:

1. POSTs a known input to `/compute/<name>`
2. Compares the result against the in-browser reference (the same
   function the fallback path uses)
3. Asserts exact equality for p-values + counts

Equality is the right bar here because the algorithm is deterministic
and the in-browser version is the source of truth (it's what the user
sees today; the server port has to match).
