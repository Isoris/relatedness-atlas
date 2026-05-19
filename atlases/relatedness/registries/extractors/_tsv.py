"""Shared TSV parsing helpers for relatedness-atlas extractors.

Stdlib only. Auto-detect tab vs whitespace, coerce NA/NaN/-inf to None
when infer_types=True, otherwise leave cells as strings.
"""
from __future__ import annotations

import csv
import math
import pathlib
import time
from typing import Any, Dict, List, Optional, Tuple


_NULL_TOKENS = {"", "NA", "na", "NaN", "nan", "-nan", "Inf", "-Inf", "inf", "-inf"}


def now_iso_z() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _coerce(cell: str, infer: bool) -> Any:
    if cell in _NULL_TOKENS:
        return None
    if not infer:
        return cell
    try:
        return int(cell)
    except ValueError:
        pass
    try:
        f = float(cell)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except ValueError:
        return cell


def read_tsv(
    path: pathlib.Path,
    has_header: bool = True,
    infer_types: bool = True,
    rename_columns: Optional[Dict[str, str]] = None,
    max_rows: int = 0,
) -> Tuple[List[str], List[Dict[str, Any]]]:
    rename = rename_columns or {}
    with path.open("r", encoding="utf-8", newline="") as fh:
        sample = fh.read(4096); fh.seek(0)
        delim = "\t" if "\t" in sample else None
        reader = (csv.reader(fh, delimiter=delim) if delim
                  else csv.reader(fh, delimiter=" ", skipinitialspace=True))
        it = iter(reader)
        if has_header:
            try:
                header = next(it)
            except StopIteration:
                return [], []
            columns = [rename.get(c.strip(), c.strip()) for c in header]
        else:
            try:
                first = next(it)
            except StopIteration:
                return [], []
            columns = [f"col{i+1}" for i in range(len(first))]
            it = iter([first] + list(it))
        rows: List[Dict[str, Any]] = []
        for i, row in enumerate(it):
            if max_rows and i >= max_rows:
                break
            if delim is None:
                row = [c for c in row if c != ""]
            obj: Dict[str, Any] = {}
            for j, cell in enumerate(row):
                key = columns[j] if j < len(columns) else f"col{j+1}"
                obj[key] = _coerce(cell, infer_types)
            rows.append(obj)
    return columns, rows


def provenance(raw_outputs: Dict[str, str], path: pathlib.Path,
               row_count: int = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "source_path": raw_outputs.get("source_rel", str(path)),
        "parsed_at":   now_iso_z(),
    }
    if row_count is not None:
        out["row_count"] = row_count
    return out
