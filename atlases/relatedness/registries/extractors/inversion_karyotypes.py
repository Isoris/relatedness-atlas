"""extractor: inversion_karyotypes_v1 — per-sample × per-inversion karyotype.

Long-format TSV from the Inversion Atlas catalogue export. Drives the
Karyotypes tab, the Mendelian tester, and the four-stage scoring on
Inversions.

Expected columns: sample_id, inversion_id, karyotype ('0/0'|'0/1'|'1/1'|'NA'),
optional quality.

Emit:
    { records: [...], n_records, n_samples, n_inversions,
      karyotype_counts: { '0/0', '0/1', '1/1', 'NA' },
      _provenance: {...} }
"""
from __future__ import annotations
import collections
import pathlib
from typing import Any, Dict
from . import _tsv as _t


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["file_path"])
    _, rows = _t.read_tsv(path, has_header=True, infer_types=False,
                          max_rows=int(params.get("max_rows") or 0))

    samples = set()
    inversions = set()
    karyo_counts: Dict[str, int] = collections.Counter()
    records = []
    for r in rows:
        sid = r.get("sample_id") or r.get("sample") or r.get("id")
        inv = r.get("inversion_id") or r.get("candidate_id") or r.get("inv_id")
        if sid is None or inv is None:
            continue
        k = r.get("karyotype") or r.get("genotype")
        out = {"sample_id": str(sid), "inversion_id": str(inv), "karyotype": k}
        if "quality" in r: out["quality"] = r["quality"]
        records.append(out)
        samples.add(str(sid))
        inversions.add(str(inv))
        karyo_counts[str(k) if k is not None else "NA"] += 1

    return {
        "records":           records,
        "n_records":         len(records),
        "n_samples":         len(samples),
        "n_inversions":      len(inversions),
        "karyotype_counts":  dict(karyo_counts),
        "_provenance":       _t.provenance(raw_outputs, path, row_count=len(records)),
    }
