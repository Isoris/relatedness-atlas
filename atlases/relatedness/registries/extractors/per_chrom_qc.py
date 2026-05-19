"""extractor: per_chrom_qc_v1 — ngsPedigree Stage 2 per-chromosome QC.

Per-chromosome PASS/WARN/FAIL conflict counts per dyad/triad +
genome-wide trio QC fields. Feeds the right-column Mendelian-check
breakdown and the trio_qc map for the four-stage scoring.

Emit:
    { rows: [...], n_rows,
      pairs_summary: { n_PASS, n_WARN, n_FAIL },
      chromosomes: [chr_id, ...],
      _provenance: {...} }
"""
from __future__ import annotations
import collections
import pathlib
from typing import Any, Dict
from . import _tsv as _t


_STATUS_SYNS = ("status", "verdict", "qc_status")


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["file_path"])
    _, rows = _t.read_tsv(path, has_header=True, infer_types=True,
                          max_rows=int(params.get("max_rows") or 0))

    chroms = set()
    status_counts: Dict[str, int] = collections.Counter()
    for r in rows:
        c = r.get("chrom") or r.get("chromosome") or r.get("Chr")
        if c is not None: chroms.add(str(c))
        for k in _STATUS_SYNS:
            if k in r and r[k] is not None:
                status_counts[str(r[k])] += 1
                break

    return {
        "rows":           rows,
        "n_rows":         len(rows),
        "pairs_summary":  {f"n_{k}": v for k, v in status_counts.items()},
        "chromosomes":    sorted(chroms),
        "_provenance":    _t.provenance(raw_outputs, path, row_count=len(rows)),
    }
