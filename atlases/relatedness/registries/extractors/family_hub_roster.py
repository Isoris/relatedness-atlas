"""extractor: family_hub_roster_v1 — ngsPedigree Stage 1 hub roster.

One row per individual with family_id + hub + role. Drives the Population
Browser tree.

Emit:
    { roster: [ {sample_id, family_id, hub, role, sex?} ],
      n_individuals, hubs: [hub_id, ...], families: [family_id, ...],
      _provenance: {...} }
"""
from __future__ import annotations
import pathlib
from typing import Any, Dict
from . import _tsv as _t


_SID_SYNS = ("sample_id", "id", "ind", "individual")


def _sample_id(row: Dict[str, Any]) -> Any:
    for k in _SID_SYNS:
        if k in row:
            return row[k]
    return None


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["file_path"])
    _, rows = _t.read_tsv(path, has_header=True, infer_types=True,
                          max_rows=int(params.get("max_rows") or 0))

    roster = []
    hubs = set()
    families = set()
    for r in rows:
        sid = _sample_id(r)
        if sid is None:
            continue
        item = {"sample_id": str(sid)}
        for k in ("family_id", "hub", "role", "sex"):
            if k in r:
                item[k] = r[k]
        if item.get("hub"):     hubs.add(item["hub"])
        if item.get("family_id"): families.add(item["family_id"])
        roster.append(item)

    return {
        "roster":         roster,
        "n_individuals":  len(roster),
        "hubs":           sorted(hubs),
        "families":       sorted(str(f) for f in families),
        "_provenance":    _t.provenance(raw_outputs, path, row_count=len(roster)),
    }
