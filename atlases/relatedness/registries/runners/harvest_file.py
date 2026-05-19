"""Relatedness-atlas IN-side runner — harvest one layer file through the
files.registry.json indirection.

Each entry in layers.registry.json carries a `source_file` key pointing
at files.registry.json, which in turn carries the `path_template`. This
runner walks the two-step indirection, resolves the file under the atlas
root, and copies it into raw_results/relatedness/<action_id>/.

The dispatcher then hands the resulting path to the layer's matching
typed extractor. Pattern parallel to population-atlas's harvest_file
(direct atlas-relative paths) and diversity-atlas's harvest_file
(master_config root paths).
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
from typing import Any, Dict


_HERE = pathlib.Path(__file__).parent
_DATA_DIR = _HERE.parent / "data"
_LAYERS_REGISTRY = _DATA_DIR / "layers.registry.json"
_FILES_REGISTRY  = _DATA_DIR / "files.registry.json"
_TEMPLATE_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _project_root() -> pathlib.Path:
    root = os.environ.get("ATLAS_PROJECT_ROOT")
    return pathlib.Path(root) if root else pathlib.Path.cwd()


def _workdir(manifest: Dict[str, Any]) -> pathlib.Path:
    return _project_root() / "raw_results" / "relatedness" / manifest["action_id"]


def _lookup_layer(layer_key: str) -> Dict[str, Any]:
    doc = json.loads(_LAYERS_REGISTRY.read_text(encoding="utf-8"))
    layer = (doc.get("layers") or {}).get(layer_key)
    if not isinstance(layer, dict):
        raise KeyError(
            f"layer_key '{layer_key}' not found in layers.registry.json. "
            f"Available: {sorted((doc.get('layers') or {}).keys())}"
        )
    if layer.get("source") != "file":
        raise ValueError(
            f"layer_key '{layer_key}' has source='{layer.get('source')}', expected 'file'."
        )
    return layer


def _lookup_file(file_key: str) -> Dict[str, Any]:
    doc = json.loads(_FILES_REGISTRY.read_text(encoding="utf-8"))
    entry = (doc.get("files") or {}).get(file_key)
    if not isinstance(entry, dict):
        raise KeyError(
            f"source_file key '{file_key}' not found in files.registry.json. "
            f"Available: {sorted((doc.get('files') or {}).keys())}"
        )
    return entry


def _fill_template(template: str, args: Dict[str, Any]) -> str:
    needed = list(dict.fromkeys(_TEMPLATE_RE.findall(template)))
    missing = [k for k in needed if k not in args]
    if missing:
        raise ValueError(
            f"target.args missing placeholders for layer template '{template}': {missing}"
        )
    return _TEMPLATE_RE.sub(lambda m: str(args[m.group(1)]), template)


def harvest_file(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    """Resolve target.layer_key → files.registry → path_template → file copy."""
    target = manifest["target"]
    layer_key = target["layer_key"]
    args = target.get("args") or {}

    layer = _lookup_layer(layer_key)
    file_key = layer.get("source_file")
    if not file_key:
        raise ValueError(
            f"layer_key '{layer_key}' has no source_file (cannot resolve to files.registry)."
        )
    file_entry = _lookup_file(file_key)
    template = file_entry.get("path_template")
    if not template:
        raise ValueError(f"files.registry entry '{file_key}' has no path_template")
    rel = _fill_template(template, args)
    src = _project_root() / rel
    source_rel = rel

    if not src.exists():
        raise FileNotFoundError(f"resolved file does not exist: {src}")
    if not src.is_file():
        raise IsADirectoryError(f"resolved path is not a file: {src}")

    out_dir = _workdir(manifest)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / src.name
    shutil.copyfile(src, out_path)

    return {
        "file_path":  str(out_path),
        "source_rel": source_rel,
        "layer_key":  layer_key,
        "source_file": file_key,
        "args_json":  json.dumps(args, sort_keys=True),
    }
