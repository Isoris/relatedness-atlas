"""extractor: ancestry_q_v1 — cohort NGSadmix Q matrix (TSV layout).

Distinct from the population-atlas's `ngsadmix_q_v1` (which reads a JSON
{samples, Q, K}). Here the input is a sample_id × K columns TSV.

Emit:
    { K, samples: [sample_id, ...], Q: [[q_0, ...], ...],
      top_per_sample: [{sample_id, top_k, top_q}],
      _provenance: {...} }
"""
from __future__ import annotations
import pathlib
import re
from typing import Any, Dict, List
from . import _tsv as _t


_K_COL_RE = re.compile(r"^(?:K|q|Q)[_ ]?(\d+)$")


def _detect_q_columns(columns: List[str]) -> List[str]:
    """Pick Q-bearing columns from the header. Order them by their numeric
    suffix. Falls back to all columns except `sample_id` if no K-pattern matches."""
    matches = []
    for c in columns:
        m = _K_COL_RE.match(c)
        if m:
            matches.append((int(m.group(1)), c))
    if matches:
        matches.sort()
        return [c for _, c in matches]
    return [c for c in columns if c not in ("sample_id", "sample", "id")]


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["file_path"])
    cols, rows = _t.read_tsv(path, has_header=True, infer_types=True,
                             max_rows=int(params.get("max_rows") or 0))
    q_cols = _detect_q_columns(cols)
    if not q_cols:
        raise ValueError(f"ancestry_q: no Q columns found in {cols}")

    samples: List[str] = []
    Q: List[List[float]] = []
    top_per_sample = []
    for r in rows:
        sid = r.get("sample_id") or r.get("sample") or r.get("id")
        if sid is None:
            continue
        row_vals = [r.get(c) for c in q_cols]
        if not all(isinstance(v, (int, float)) for v in row_vals):
            continue
        samples.append(str(sid))
        Q.append([float(v) for v in row_vals])
        top_idx, top_q = max(enumerate(row_vals), key=lambda kv: kv[1])
        top_per_sample.append({"sample_id": str(sid), "top_k": top_idx, "top_q": float(top_q)})

    return {
        "K":              len(q_cols),
        "samples":        samples,
        "Q":              Q,
        "top_per_sample": top_per_sample,
        "_provenance":    _t.provenance(raw_outputs, path, row_count=len(samples)),
    }
