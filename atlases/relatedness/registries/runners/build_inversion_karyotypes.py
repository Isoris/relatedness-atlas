#!/usr/bin/env python3
"""Build the relatedness atlas's inversion_karyotypes.tsv (+ inversion_catalogue.tsv)
from the inversion atlas's arrangement_calls_v1.json export.

This is the data join that flips the relatedness Mendelian page from DEMO to
LIVE: atlas-core/server/relatedness_compute.py reads
<out>/inversion_karyotypes.tsv to run the dyad/triad Mendelian tests, but no
producer wrote that file. The inversion atlas's band-tracking step emits, per
chromosome, an arrangement_calls_v1.json (see inversion-atlas
specs_done/SPEC_arrangement_color_mode_and_arrangement_calls_v1.md §3). This
transformer reads those JSONs and emits the long-form karyotype TSV the
relatedness loader + server compute expect.

INPUT — arrangement_calls_v1.json (one per chromosome):
    { "chrom": "...", "n_samples": N,
      "candidates": { "<cand_id>": {
          "candidate_id", "start_bp", "end_bp",
          "n_arrangements": K,
          "arrangement_per_sample": [arr_id per SAMPLE INDEX; -1 = uncalled],
          "arrangement_sizes": [...]   # optional, for allele-frequency
      }, ... } }

  Sample order: arrangement_per_sample is indexed by sample index, so a
  sample-id list IN THAT ORDER is required (--samples; the inversion precomp
  sample order, e.g. /mnt/e/results_inversions/sample_map.json).

MAPPING — arrangement id -> karyotype genotype. Arrangement ids are PC1-
ascending (SPEC §7), the SAME convention assignKaryotypes uses (label 0 =
lowest PC1 = HOM_REF, 1 = HET, 2 = HOM_INV). So for the standard diploid
inversion (K=3): 0 -> '0/0', 1 -> '0/1', 2 -> '1/1'. K=2 -> two homozygote
classes ('0/0','1/1'); K=1 -> monomorphic ('0/0'); K>3 (nested/complex) and
-1 (uncalled) -> 'NA' (biallelic Mendelian model doesn't apply).

OUTPUT (long form, under each --out dir):
    inversion_karyotypes.tsv   sample_id, candidate, karyotype, quality
    inversion_catalogue.tsv    candidate, chromosome, start_mb, end_mb,
                               length_mb, frequency, status, notes

Stdlib only (matches build_cohort226_relatedness.py — no pandas).
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def arrangement_to_genotype(arr_id: Any, n_arr: Optional[int]) -> str:
    """Map a PC1-ascending arrangement id to a biallelic karyotype genotype.

    Mirrors the assignKaryotypes convention (0=HOM_REF, 1=HET, 2=HOM_INV).
    Returns 'NA' for uncalled (-1/None), >3-arrangement (non-biallelic), or
    out-of-range ids.
    """
    if arr_id is None:
        return "NA"
    try:
        a = int(arr_id)
    except (TypeError, ValueError):
        return "NA"
    if a < 0:
        return "NA"
    if n_arr == 1:
        return "0/0" if a == 0 else "NA"
    if n_arr == 2:
        return {0: "0/0", 1: "1/1"}.get(a, "NA")
    if n_arr == 3:
        return {0: "0/0", 1: "0/1", 2: "1/1"}.get(a, "NA")
    return "NA"   # >3 arrangements (nested/complex) or unknown K


def load_sample_ids(path: Path, id_field: str = "cga") -> List[str]:
    """Sample ids in arrangement-index order.

    .json  -> sample_map (array of {cga, ind, ...} or {samples:[...]} or object);
              uses id_field, then 'cga', then 'ind', then s<idx>.
    other  -> one id per line (no header), order preserved.
    """
    if path.suffix.lower() == ".json":
        doc = json.loads(path.read_text(encoding="utf-8"))
        rows = doc.get("samples", doc) if isinstance(doc, dict) else doc
        if not isinstance(rows, list):
            raise ValueError(f"{path}: expected a JSON array (or {{samples:[...]}})")
        out: List[str] = []
        for i, s in enumerate(rows):
            if isinstance(s, str):
                out.append(s)
            elif isinstance(s, dict):
                out.append(str(s.get(id_field) or s.get("cga") or s.get("ind") or f"s{i}"))
            else:
                out.append(f"s{i}")
        return out
    return [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def _inv_allele_frequency(sizes: Optional[List[Any]], n_arr: Optional[int]) -> str:
    """INV allele frequency from arrangement_sizes for the K=3 case
    (freq = (n_het + 2*n_hom_inv) / (2 * n_called)). 'NA' otherwise."""
    if n_arr != 3 or not isinstance(sizes, list) or len(sizes) < 3:
        return "NA"
    try:
        n0, n1, n2 = float(sizes[0]), float(sizes[1]), float(sizes[2])
    except (TypeError, ValueError):
        return "NA"
    n_called = n0 + n1 + n2
    if n_called <= 0:
        return "NA"
    return f"{(n1 + 2 * n2) / (2 * n_called):.4f}"


def build(arrangement_json_paths: List[Path], sample_ids: List[str]
          ) -> Tuple[List[List[str]], List[List[str]]]:
    """Returns (karyotype_rows, catalogue_rows). Headers added by the writer."""
    kt_rows: List[List[str]] = []
    cat_rows: List[List[str]] = []
    seen_candidates: set = set()
    for path in arrangement_json_paths:
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
        chrom = doc.get("chrom") or "?"
        candidates = doc.get("candidates") or {}
        for cid, c in candidates.items():
            cand = c.get("candidate_id") or cid
            if cand in seen_candidates:
                continue
            seen_candidates.add(cand)
            n_arr = c.get("n_arrangements")
            aps = c.get("arrangement_per_sample") or []
            for si, arr in enumerate(aps):
                if si >= len(sample_ids):
                    break
                kt_rows.append([sample_ids[si], cand,
                                arrangement_to_genotype(arr, n_arr), "high"])
            sb, eb = c.get("start_bp"), c.get("end_bp")
            start_mb = f"{sb / 1e6:.6f}" if isinstance(sb, (int, float)) else "NA"
            end_mb = f"{eb / 1e6:.6f}" if isinstance(eb, (int, float)) else "NA"
            length_mb = (f"{(eb - sb) / 1e6:.6f}"
                         if isinstance(sb, (int, float)) and isinstance(eb, (int, float))
                         else "NA")
            cat_rows.append([
                cand, chrom, start_mb, end_mb, length_mb,
                _inv_allele_frequency(c.get("arrangement_sizes"), n_arr),
                str(c.get("consensus_class") or "pass"),
                str(c.get("reasoning_summary") or ""),
            ])
    return kt_rows, cat_rows


def write_outputs(outs: List[Path], kt_rows: List[List[str]], cat_rows: List[List[str]]) -> None:
    kt_header = ["sample_id", "candidate", "karyotype", "quality"]
    cat_header = ["candidate", "chromosome", "start_mb", "end_mb",
                  "length_mb", "frequency", "status", "notes"]
    for d in outs:
        d.mkdir(parents=True, exist_ok=True)
        for name, header, rows in (
            ("inversion_karyotypes.tsv", kt_header, kt_rows),
            ("inversion_catalogue.tsv", cat_header, cat_rows),
        ):
            p = d / name
            with p.open("w", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh, delimiter="\t", lineterminator="\n")
                w.writerow(header)
                w.writerows(rows)
            print(f"  wrote {p}  ({len(rows)} rows)")


def collect_arrangement_jsons(arrangements_dir: Optional[Path],
                              arrangement_files: Optional[List[Path]]) -> List[Path]:
    paths: List[Path] = []
    if arrangements_dir:
        paths += [Path(p) for p in sorted(glob.glob(str(arrangements_dir / "*.json")))]
    if arrangement_files:
        paths += list(arrangement_files)
    return paths


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--arrangements-dir", type=Path,
                   help="dir of per-chrom arrangement_calls_v1.json")
    g.add_argument("--arrangements", nargs="+", type=Path,
                   help="explicit arrangement_calls_v1.json file(s)")
    ap.add_argument("--samples", required=True, type=Path,
                    help="sample ids in arrangement-index order (one per line, or sample_map.json)")
    ap.add_argument("--id-field", default="cga",
                    help="sample-id field when --samples is sample_map.json (default cga)")
    ap.add_argument("--out", required=True, action="append", type=Path,
                    help="output dir (repeatable)")
    args = ap.parse_args()

    paths = collect_arrangement_jsons(args.arrangements_dir, args.arrangements)
    if not paths:
        print("ERROR: no arrangement_calls JSON found", file=sys.stderr)
        return 2
    sample_ids = load_sample_ids(args.samples, args.id_field)
    if not sample_ids:
        print(f"ERROR: no sample ids in {args.samples}", file=sys.stderr)
        return 2

    print(f"== inversion_karyotypes.tsv ==  ({len(paths)} chrom file(s), {len(sample_ids)} samples)")
    kt_rows, cat_rows = build(paths, sample_ids)
    write_outputs(args.out, kt_rows, cat_rows)
    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
