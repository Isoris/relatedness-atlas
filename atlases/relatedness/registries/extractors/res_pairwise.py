"""extractor: res_pairwise_v1 — ngsRelate / ngsPedigree pairwise output.

23-column pairwise TSV from ngsPedigree Stage 1
(`pairwise_relationship_classification.tsv`). Feeds the Inspector / Stats
panel + the Network panel's edge classes.

Emit:
    { pairs: [ {...} ], n_pairs, n_samples, edge_class_counts: { PO, FS, AMBIG, MEND_CONFLICT, ... },
      _provenance: {...} }
"""
from __future__ import annotations
import collections
import pathlib
from typing import Any, Dict
from . import _tsv as _t


_PAIR_KEY_A_SYNS = ("a", "ind1", "indA", "id_a")
_PAIR_KEY_B_SYNS = ("b", "ind2", "indB", "id_b")
_EDGE_CLASS_SYNS = ("edge_class", "relationship", "rel_class")


def _first_present(row: Dict[str, Any], keys) -> Any:
    for k in keys:
        if k in row:
            return row[k]
    return None


def extract(raw_outputs: Dict[str, str], params: Dict[str, Any]) -> Dict[str, Any]:
    path = pathlib.Path(raw_outputs["file_path"])
    _, rows = _t.read_tsv(path, has_header=True, infer_types=True,
                          max_rows=int(params.get("max_rows") or 0))

    samples = set()
    edge_counts: Dict[str, int] = collections.Counter()
    for r in rows:
        a = _first_present(r, _PAIR_KEY_A_SYNS)
        b = _first_present(r, _PAIR_KEY_B_SYNS)
        if a is not None: samples.add(str(a))
        if b is not None: samples.add(str(b))
        ec = _first_present(r, _EDGE_CLASS_SYNS)
        if ec:
            edge_counts[str(ec)] += 1

    return {
        "pairs":              rows,
        "n_pairs":            len(rows),
        "n_samples":          len(samples),
        "edge_class_counts":  dict(edge_counts),
        "_provenance":        _t.provenance(raw_outputs, path, row_count=len(rows)),
    }
