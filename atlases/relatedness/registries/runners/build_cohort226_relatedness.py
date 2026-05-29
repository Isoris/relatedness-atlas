#!/usr/bin/env python3
"""Build the Relatedness Atlas's on-disk TSVs for the real broodstock-226
cohort from the ngsRelate / NAToRA / hub-network outputs.

Source (one cohort dir, the 05_ngsrelate export):
    catfish_226_relatedness.res                         ngsRelate pairwise
    list_of_samples_one_per_line_same_bamfile_list.tsv  226-sample roster
    relatedness_hub_network_ancestry_K08_theta0.177_main.edges.tsv
    relatedness_hub_network_ancestry_K08_theta0.177_main.layout.tsv

Produces (the atlas's documented contract — see
atlases/relatedness/registries/data/files.registry.json):
    pairwise_relationship_classification.tsv   res_pairwise_v1 (Inspector/Network/compute)
    network_edges.tsv                          curated first-degree graph (render)
    network_layout.tsv                         node positions + ancestry colours (render)
    samples.tsv                                roster (one sample_id per line)

Writes each output to every target dir passed on the command line. Typical:
    python3 build_cohort226_relatedness.py \
        --src /mnt/e/results_relatedness/226_gariepinus \
        --out /mnt/c/Users/quent/Desktop/relatedness-atlas/atlases/relatedness/data/relatedness \
        --out /mnt/c/Users/quent/Desktop/atlas-workspace/atlases/relatedness/data/relatedness \
        --out /mnt/c/Users/quent/Desktop/atlas-workspace/data/relatedness

The .res `theta` column is the kinship coefficient ngsRelate reports; the
relationship_class cutoffs below mirror the NAToRA degree thresholds baked
into the source filenames (first c0.354 / second c0.177 / third c0.0884 /
fourth c0.0442) with the analysis's own 0.177 "main network" floor used as
the first-degree label boundary so the pairwise table agrees with the
curated edges.tsv the pipeline emitted.
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import sys
from pathlib import Path


def _find_one(src: Path, pattern: str) -> Path | None:
    hits = sorted(glob.glob(str(src / pattern)))
    return Path(hits[0]) if hits else None


def classify(theta: float) -> str:
    if theta != theta:            # NaN
        return "Unknown"
    if theta >= 0.45:
        return "Duplicate/MZ"
    if theta >= 0.177:
        return "First degree"
    if theta >= 0.0884:
        return "Second degree"
    if theta >= 0.0442:
        return "Third degree"
    return "Unrelated"


def build_pairwise(res_path: Path) -> tuple[list[str], list[list[str]]]:
    """Map ngsRelate .res -> res_pairwise_v1 rows.

    Jacquard -> outbred IBD probabilities: k0=J9, k1=J8, k2=J7.
    Emits both `a/b` (loadResPairwise) and `sample_a/sample_b` (Mode-B badge)
    so either consumer resolves sample ids.
    """
    out_header = [
        "a", "b", "sample_a", "sample_b",
        "kinship", "theta", "k0", "k1", "k2",
        "KING", "R0", "R1", "nSites", "relationship_class",
    ]
    rows: list[list[str]] = []
    with res_path.open() as fh:
        rd = csv.DictReader(fh, delimiter="\t")
        for r in rd:
            ida = r.get("ida") or r.get("a")
            idb = r.get("idb") or r.get("b")
            if not ida or not idb:
                continue
            try:
                theta = float(r.get("theta", "nan"))
            except ValueError:
                theta = float("nan")

            def g(k: str) -> str:
                v = r.get(k, "")
                return v if v not in (None, "") else "NA"

            rows.append([
                ida, idb, ida, idb,
                g("theta"), g("theta"), g("J9"), g("J8"), g("J7"),
                g("KING"), g("R0"), g("R1"), g("nSites"),
                classify(theta),
            ])
    return out_header, rows


def copy_tsv(src_path: Path) -> tuple[list[str], list[list[str]]]:
    with src_path.open() as fh:
        rd = csv.reader(fh, delimiter="\t")
        rows = [row for row in rd]
    if not rows:
        return [], []
    return rows[0], rows[1:]


def write_tsv(targets: list[Path], name: str, header: list[str], rows: list[list[str]]) -> None:
    for d in targets:
        d.mkdir(parents=True, exist_ok=True)
        p = d / name
        with p.open("w", newline="") as fh:
            w = csv.writer(fh, delimiter="\t", lineterminator="\n")
            if header:
                w.writerow(header)
            w.writerows(rows)
        print(f"  wrote {p}  ({len(rows)} rows)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path)
    ap.add_argument("--out", required=True, action="append", type=Path,
                    help="output dir (repeatable)")
    # Optional: also emit inversion_karyotypes.tsv (+ inversion_catalogue.tsv)
    # from the inversion atlas's arrangement_calls_v1.json export. This is the
    # data join that flips the relatedness Mendelian page from DEMO to LIVE
    # (atlas-core/server/relatedness_compute.py reads inversion_karyotypes.tsv).
    # The karyotype source is a SEPARATE dir from --src (the inversion precomp
    # output, not the relatedness cohort dir).
    ap.add_argument("--karyotypes-arrangements-dir", type=Path, default=None,
                    help="dir of per-chrom arrangement_calls_v1.json from the inversion atlas")
    ap.add_argument("--karyotypes-samples", type=Path, default=None,
                    help="sample ids in arrangement-index order (one per line, or sample_map.json)")
    ap.add_argument("--karyotypes-id-field", default="cga",
                    help="sample-id field when --karyotypes-samples is sample_map.json (default cga)")
    args = ap.parse_args()

    src: Path = args.src
    outs: list[Path] = args.out
    if not src.is_dir():
        print(f"ERROR: src not found: {src}", file=sys.stderr)
        return 2

    res = _find_one(src, "*relatedness.res")
    roster = _find_one(src, "*one_per_line*bamfile_list.tsv") or _find_one(src, "*samples*one_per_line*")
    edges = _find_one(src, "*hub_network*main.edges.tsv")
    layout = _find_one(src, "*hub_network*main.layout.tsv")

    if not res:
        print(f"ERROR: no *relatedness.res in {src}", file=sys.stderr)
        return 2

    print("== pairwise_relationship_classification.tsv ==")
    ph, pr = build_pairwise(res)
    write_tsv(outs, "pairwise_relationship_classification.tsv", ph, pr)

    if edges:
        print("== network_edges.tsv ==")
        eh, er = copy_tsv(edges)
        write_tsv(outs, "network_edges.tsv", eh, er)
    else:
        print("  ! no main.edges.tsv found — skipping network_edges.tsv")

    if layout:
        print("== network_layout.tsv ==")
        lh, lr = copy_tsv(layout)
        write_tsv(outs, "network_layout.tsv", lh, lr)
    else:
        print("  ! no main.layout.tsv found — skipping network_layout.tsv")

    if roster:
        print("== samples.tsv ==")
        ids = [line.strip() for line in roster.read_text().splitlines() if line.strip()]
        # roster file is one id per line, no header
        write_tsv(outs, "samples.tsv", ["sample_id"], [[i] for i in ids])
    else:
        print("  ! no roster found — skipping samples.tsv")

    # Optional inversion-karyotype join (separate source).
    if args.karyotypes_arrangements_dir:
        if not args.karyotypes_samples:
            print("  ! --karyotypes-arrangements-dir given without --karyotypes-samples — skipping",
                  file=sys.stderr)
        elif not args.karyotypes_arrangements_dir.is_dir():
            print(f"  ! karyotypes-arrangements-dir not found: {args.karyotypes_arrangements_dir} — skipping",
                  file=sys.stderr)
        else:
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            import build_inversion_karyotypes as bik
            paths = bik.collect_arrangement_jsons(args.karyotypes_arrangements_dir, None)
            if not paths:
                print(f"  ! no *.json in {args.karyotypes_arrangements_dir} — skipping inversion_karyotypes.tsv",
                      file=sys.stderr)
            else:
                print("== inversion_karyotypes.tsv + inversion_catalogue.tsv ==")
                sample_ids = bik.load_sample_ids(args.karyotypes_samples, args.karyotypes_id_field)
                kt_rows, cat_rows = bik.build(paths, sample_ids)
                bik.write_outputs(outs, kt_rows, cat_rows)

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
