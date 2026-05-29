"""Tests for build_inversion_karyotypes.py — synthetic arrangement_calls -> TSV.

Run: python -m pytest test_build_inversion_karyotypes.py   (or the stdlib driver)
"""
import csv
import json
import tempfile
from pathlib import Path

import build_inversion_karyotypes as bik


def test_arrangement_to_genotype():
    assert bik.arrangement_to_genotype(0, 3) == "0/0"
    assert bik.arrangement_to_genotype(1, 3) == "0/1"
    assert bik.arrangement_to_genotype(2, 3) == "1/1"
    assert bik.arrangement_to_genotype(-1, 3) == "NA"
    assert bik.arrangement_to_genotype(None, 3) == "NA"
    assert bik.arrangement_to_genotype(0, 2) == "0/0"
    assert bik.arrangement_to_genotype(1, 2) == "1/1"
    assert bik.arrangement_to_genotype(0, 1) == "0/0"
    assert bik.arrangement_to_genotype(3, 4) == "NA"   # >3 arrangements -> non-biallelic
    assert bik.arrangement_to_genotype(2, 2) == "NA"   # out of range for K=2


def test_inv_allele_frequency():
    # K=3 sizes [HOM_REF, HET, HOM_INV] = [2,1,1] -> (1 + 2*1)/(2*4) = 0.375
    assert bik._inv_allele_frequency([2, 1, 1], 3) == "0.3750"
    assert bik._inv_allele_frequency([2, 1], 3) == "NA"     # malformed
    assert bik._inv_allele_frequency([2, 1, 1], 2) == "NA"  # only K=3
    assert bik._inv_allele_frequency([0, 0, 0], 3) == "NA"  # no calls


def _synthetic_doc():
    return {
        "tool": "arrangement_calls_v1", "schema_version": 1, "chrom": "C_gar_LG28",
        "n_samples": 4,
        "candidates": {
            "LG28_k3": {
                "candidate_id": "LG28_k3", "start_bp": 15000000, "end_bp": 18000000,
                "n_arrangements": 3, "arrangement_per_sample": [0, 1, 2, -1],
                "arrangement_sizes": [2, 1, 1], "consensus_class": "CLEAN_PARTITION",
            },
            "LG28_k2": {
                "candidate_id": "LG28_k2", "start_bp": 22000000, "end_bp": 22500000,
                "n_arrangements": 2, "arrangement_per_sample": [0, 1, 0, 1],
            },
        },
    }


def test_build_mapping_and_catalogue():
    doc = _synthetic_doc()
    samples = ["S0", "S1", "S2", "S3"]
    with tempfile.TemporaryDirectory() as td:
        jp = Path(td) / "C_gar_LG28.json"
        jp.write_text(json.dumps(doc), encoding="utf-8")
        kt_rows, cat_rows = bik.build([jp], samples)

    kt = {(r[0], r[1]): r[2] for r in kt_rows}
    assert kt[("S0", "LG28_k3")] == "0/0"
    assert kt[("S1", "LG28_k3")] == "0/1"
    assert kt[("S2", "LG28_k3")] == "1/1"
    assert kt[("S3", "LG28_k3")] == "NA"          # uncalled
    assert kt[("S0", "LG28_k2")] == "0/0"
    assert kt[("S1", "LG28_k2")] == "1/1"
    assert len(kt_rows) == 8                       # 2 candidates x 4 samples
    cat = {r[0]: r for r in cat_rows}
    assert cat["LG28_k3"][1] == "C_gar_LG28"
    assert cat["LG28_k3"][2] == "15.000000"        # start_mb
    assert cat["LG28_k3"][5] == "0.3750"           # frequency
    assert cat["LG28_k2"][5] == "NA"               # K=2 -> no freq


def test_round_trip_into_server_matrix_shape():
    """Write the TSV, re-read it the way relatedness_compute._read_karyotype_matrix
    does (sample_id|sample, candidate|inversion_id|inv_id, karyotype), and confirm
    the matrix shape the dyad/triad test consumes."""
    doc = _synthetic_doc()
    samples = ["S0", "S1", "S2", "S3"]
    with tempfile.TemporaryDirectory() as td:
        jp = Path(td) / "C_gar_LG28.json"
        jp.write_text(json.dumps(doc), encoding="utf-8")
        kt_rows, cat_rows = bik.build([jp], samples)
        out = Path(td) / "data"
        bik.write_outputs([out], kt_rows, cat_rows)

        matrix = {}
        with (out / "inversion_karyotypes.tsv").open(encoding="utf-8") as fh:
            rd = csv.DictReader(fh, delimiter="\t")
            for r in rd:
                sid = r.get("sample_id") or r.get("sample")
                cand = r.get("candidate") or r.get("inversion_id") or r.get("inv_id")
                matrix.setdefault(sid, {})[cand] = r.get("karyotype") or "NA"

    assert matrix["S0"]["LG28_k3"] == "0/0"
    assert matrix["S2"]["LG28_k3"] == "1/1"
    assert matrix["S3"]["LG28_k3"] == "NA"
    # A dyad S0(parent 0/0) x S2(offspring 1/1) is a Mendelian error at LG28_k3 —
    # exactly what relatedness_compute._compute_relatedness_mendelian_dyad_test flags.
    assert (matrix["S0"]["LG28_k3"], matrix["S2"]["LG28_k3"]) == ("0/0", "1/1")


def test_load_sample_ids_lines_and_json():
    with tempfile.TemporaryDirectory() as td:
        lines = Path(td) / "samples.txt"
        lines.write_text("CGA009\nCGA010\n\nCGA011\n", encoding="utf-8")
        assert bik.load_sample_ids(lines) == ["CGA009", "CGA010", "CGA011"]

        smap = Path(td) / "sample_map.json"
        smap.write_text(json.dumps([
            {"ind": "Ind0", "cga": "CGA009"},
            {"ind": "Ind1", "cga": "CGA010"},
        ]), encoding="utf-8")
        assert bik.load_sample_ids(smap, "cga") == ["CGA009", "CGA010"]
        assert bik.load_sample_ids(smap, "ind") == ["Ind0", "Ind1"]
