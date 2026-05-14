// shared/loaders/per_chrom_qc.js
// =============================================================================
// Loads ngsPedigree Stage 2's per-chromosome QC table. One row per (dyad-or-
// triad, chromosome) with PASS/WARN/FAIL conflict counts plus the genome-wide
// trio QC fields (po_a, po_b, gw_mend_error, anc_dist, valid).
//
// Drives the right-column Mendelian-check breakdown (shared/inspector.js)
// and the Stage-1 trio_qc map used by pages/hub/inversions.js for the
// FAMILY_SUSPECT branch of the four-stage scoring.
//
// Extract-schema:
//   {
//     "schema":          "per_chrom_qc_v1",
//     "produced_by":     "ngsPedigree Stage 2",
//     "rows":            Array<row>,
//     "by_triad_chrom":  Object<"triad_id|chrom" → row>,
//     "trio_qc":         Object<triad_id → { po_a, po_b, gw_mend_error,
//                                             anc_dist, valid }>,
//   }
// =============================================================================

import { readTsv } from '../api_client.js';

export async function loadPerChromQc(args, { fetcher = null } = {}) {
  const { per_chrom_qc_path } = args || {};
  if (!per_chrom_qc_path) throw new Error('loadPerChromQc: per_chrom_qc_path is required');

  const { rows } = fetcher ? fetcher(per_chrom_qc_path) : await readTsv(per_chrom_qc_path);

  const by_triad_chrom = {};
  const trio_qc = {};
  for (const r of rows) {
    const tid = r.triad_id || r.dyad_id || r.id;
    const chr = r.chrom || r.chromosome;
    const conflicts = parseInt(r.n_conflicts || r.conflicts || '0', 10);
    const status = (r.status || '').toLowerCase();
    by_triad_chrom[`${tid}|${chr}`] = {
      triad_id: tid, chrom: chr, status, conflicts,
      raw: r,
    };
    if (!trio_qc[tid]) {
      trio_qc[tid] = {
        po_a:           r.po_a   || null,
        po_b:           r.po_b   || null,
        gw_mend_error:  parseFloat(r.gw_mend_error || '0'),
        anc_dist:       parseFloat(r.anc_dist || '0'),
        valid:          (r.valid !== 'false' && r.valid !== '0'
                          && parseFloat(r.gw_mend_error || '0') < 0.01),
      };
    }
  }

  return {
    schema:        'per_chrom_qc_v1',
    produced_by:   'ngsPedigree Stage 2',
    produced_at:   new Date().toISOString(),
    rows,
    by_triad_chrom,
    trio_qc,
  };
}
