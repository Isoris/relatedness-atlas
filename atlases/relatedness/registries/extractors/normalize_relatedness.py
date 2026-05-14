"""Relatedness-atlas normalizer extractor — maps a staging payload's raw
rows to the canonical ngsrelate_pairs_v1 column set with type coercion
and a summary block.

Default column_map mirrors raw ngsRelate output. Callers can override
via manifest.params.column_map to support ngsPedigree / NAToRA outputs
that use different column names.
"""
from __future__ import annotations

import json
import math
import pathlib
import statistics
from typing import Any, Dict, List, Optional, Set


# Default mapping: raw ngsRelate column name → canonical ngsrelate_pairs_v1 name.
# Per ngsRelate output: a/b are sample column indices, but in our staging payload
# they may already be sample_ids (the relatedness_tsv extractor passes strings
# through). Both work — we coerce to str regardless.
_DEFAULT_COLUMN_MAP: Dict[str, str] = {
    "a":      "ind1",
    "b":      "ind2",
    "theta":  "theta",
    "KING":   "king",
    "R":      "rab",
    "nSites": "n_sites",
    "IBS0":   "ibs0",
    "IBS1":   "ibs1",
    "IBS2":   "ibs2",
}

# Which canonical columns are numeric vs. string.
_NUMERIC_COLS  = {"theta", "king", "rab", "ibs0", "ibs1", "ibs2"}
_INTEGER_COLS  = {"n_sites"}
_STRING_COLS   = {"ind1", "ind2"}


def _coerce_int(v: Any) -> Optional[int]:
    if v is None or v == "" or v == "NA":
        return None
    try:
        return int(float(v))   # ngsRelate sometimes emits "12345.0"
    except (TypeError, ValueError):
        return None


def _coerce_float(v: Any) -> Optional[float]:
    if v is None or v == "" or v == "NA" or v == "NaN":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    src = pathlib.Path(raw_outputs["source_envelope"])
    env = json.loads(src.read_text(encoding="utf-8"))
    payload = env.get("payload") or {}
    rows = payload.get("rows") or []

    # User-supplied column_map overrides the defaults, then we union with the
    # defaults for any keys the user didn't mention.
    user_map = dict(params.get("column_map") or {})
    column_map: Dict[str, str] = {**_DEFAULT_COLUMN_MAP, **user_map}

    pairs: List[Dict[str, Any]] = []
    samples: Set[str] = set()
    thetas: List[float] = []

    for r in rows:
        if not isinstance(r, dict):
            continue
        pair: Dict[str, Any] = {}
        for src_col, dst_col in column_map.items():
            if src_col not in r:
                continue
            val = r[src_col]
            if dst_col in _STRING_COLS:
                pair[dst_col] = str(val)
            elif dst_col in _INTEGER_COLS:
                pair[dst_col] = _coerce_int(val)
            elif dst_col in _NUMERIC_COLS:
                pair[dst_col] = _coerce_float(val)
            else:
                # Unknown canonical destination — pass through.
                pair[dst_col] = val
        # Drop rows missing the pair-identifying ind1/ind2.
        if "ind1" not in pair or "ind2" not in pair:
            continue
        samples.add(pair["ind1"])
        samples.add(pair["ind2"])
        if isinstance(pair.get("theta"), (int, float)):
            thetas.append(float(pair["theta"]))
        pairs.append(pair)

    summary: Dict[str, Any] = {
        "n_pairs":      len(pairs),
        "n_samples":    len(samples),
        "median_theta": statistics.median(thetas) if thetas else None,
    }
    return {"pairs": pairs, "summary": summary}
