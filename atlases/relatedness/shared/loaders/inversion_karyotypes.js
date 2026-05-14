// shared/loaders/inversion_karyotypes.js
// =============================================================================
// Loads the per-sample × per-candidate karyotype matrix from the Inversion
// Atlas catalogue export. Expected format: long-format TSV with one row per
// (sample_id, inversion_id) plus a karyotype column ('0/0' | '0/1' | '1/1'
// | 'NA') and an optional quality column ('high' | 'low').
//
// Drives the Karyotypes page (pages/hub/karyotypes.js), the Mendelian
// tester (pages/hub/mendelian.js), and the per-row family roster on the
// Inversions page (pages/hub/inversions.js).
//
// Extract-schema:
//   {
//     "schema":             "inversion_karyotypes_v1",
//     "produced_by":        "Inversion Atlas catalogue export",
//     "samples":            string[],
//     "inversions":         Array<{ candidate, chromosome, start_mb, end_mb,
//                                    length_mb, frequency, status, notes }>,
//     "karyotype_matrix":   Object<sample_id → Object<inv_id → karyotype>>,
//     "karyotype_quality":  Object<sample_id → Object<inv_id → 'high'|'low'>>,
//   }
// =============================================================================

import { readTsv } from '../api_client.js';

export async function loadInversionKaryotypes(args, { fetcher = null } = {}) {
  const { karyotype_tsv_path, inversion_catalogue_path } = args || {};
  if (!karyotype_tsv_path) {
    throw new Error('loadInversionKaryotypes: karyotype_tsv_path is required');
  }

  const ktData = fetcher
    ? fetcher(karyotype_tsv_path)
    : await readTsv(karyotype_tsv_path);
  const ktRows = ktData.rows;

  const samples_set = new Set();
  const inv_set     = new Set();
  const karyotype_matrix  = {};
  const karyotype_quality = {};
  for (const r of ktRows) {
    const sid = r.sample_id || r.sample;
    const iid = r.candidate || r.inversion_id || r.inv_id;
    if (!sid || !iid) continue;
    samples_set.add(sid);
    inv_set.add(iid);
    if (!karyotype_matrix[sid])  karyotype_matrix[sid] = {};
    if (!karyotype_quality[sid]) karyotype_quality[sid] = {};
    karyotype_matrix[sid][iid]  = r.karyotype || 'NA';
    karyotype_quality[sid][iid] = r.quality   || 'high';
  }

  // Optional second-file: the candidate catalogue from the Inversion Atlas.
  let inversions = [];
  if (inversion_catalogue_path) {
    const cat = fetcher
      ? fetcher(inversion_catalogue_path)
      : await readTsv(inversion_catalogue_path);
    inversions = cat.rows.map(r => ({
      candidate:   r.candidate || r.inversion_id,
      chromosome:  r.chromosome || r.chrom,
      start_mb:    parseFloat(r.start_mb),
      end_mb:      parseFloat(r.end_mb),
      length_mb:   parseFloat(r.length_mb || (parseFloat(r.end_mb) - parseFloat(r.start_mb))),
      frequency:   parseFloat(r.frequency || '0'),
      status:      r.status || 'pass',
      notes:       r.notes || '',
    }));
  } else {
    // Fall back to the inv ids found in the karyotype matrix, with
    // placeholder coordinates. Pages can render the matrix but the
    // Inversions table will be sparse.
    inversions = Array.from(inv_set).sort().map(c => ({
      candidate:   c,
      chromosome:  '?',
      start_mb:    NaN, end_mb: NaN, length_mb: NaN,
      frequency:   NaN,
      status:      'unknown',
      notes:       '',
    }));
  }

  return {
    schema:            'inversion_karyotypes_v1',
    produced_by:       'Inversion Atlas catalogue export',
    produced_at:       new Date().toISOString(),
    samples:           Array.from(samples_set),
    inversions,
    karyotype_matrix,
    karyotype_quality,
  };
}
