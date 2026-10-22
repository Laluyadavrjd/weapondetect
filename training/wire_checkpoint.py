#!/usr/bin/env python3
"""Validate (and optionally wire) the Colab training artifacts for weapondetect.

The training run happens in the user's Colab notebook and produces two files:
``best.pt`` (custom checkpoint) and ``metrics.json`` (real test-split evaluation).
This script checks both files are real, complete, and mutually consistent *before*
anything is wired into the app — so a bad artifact fails loudly here instead of
silently producing wrong detections or invented dashboard numbers later.

Validate only (default)::

    backend/.venv/bin/python training/wire_checkpoint.py \
        --checkpoint /path/to/best.pt --metrics /path/to/metrics.json

Validate and copy into place::

    backend/.venv/bin/python training/wire_checkpoint.py \
        --checkpoint /path/to/best.pt --metrics /path/to/metrics.json --wire

After ``--wire``: set ``MODEL_PATH=<absolute path>/models/best.pt`` in
``backend/.env`` and restart the backend. ``GET /api/model-info`` then reports
the real weapon classes and ``GET /api/metrics`` serves the real evaluation.

Exit code 0 = every check passed, 1 = at least one check failed.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = REPO_ROOT / "models"
REPORTS_DIR = REPO_ROOT / "training" / "evaluation" / "reports"

# What the Colab notebook (cell 13, section 7) actually writes. The backend's
# /api/metrics passes everything through verbatim, so these are the keys the
# Analytics page needs to render real numbers.
REQUIRED_METRIC_KEYS = {
    "available",
    "classes",
    "precision",
    "recall",
    "f1",
    "map50",
    "map50_95",
    "per_class",
    "inference_latency_ms",
}
# Extra keys the notebook writes; warn (don't fail) if absent so the format can
# evolve without breaking validation.
EXPECTED_EXTRA_KEYS = {
    "model",
    "model_family",
    "checkpoint",
    "dataset",
    "dataset_license",
    "device",
    "trained_at",
    "notes",
}
RATIO_KEYS = ("precision", "recall", "f1", "map50", "map50_95")
PER_CLASS_KEYS = ("class", "precision", "recall", "ap50", "ap50_95")
DROPPED_CLASS = "blunt object"  # notebook drops it (unlearnable, ~3 annotations)


class CheckFailure(Exception):
    """One failed validation check."""


def fail(msg: str) -> None:
    raise CheckFailure(msg)


def check_checkpoint(path: Path) -> list[str]:
    """Load best.pt with ultralytics and return its class-name list (index order)."""
    try:
        from ultralytics import YOLO
    except ImportError:
        fail("ultralytics is not installed (run inside backend/.venv)")
    if not path.exists():
        fail(f"checkpoint not found: {path}")
    try:
        model = YOLO(str(path))
    except Exception as exc:
        fail(f"ultralytics could not load {path}: {exc}")
    names = model.names
    if not names:
        fail(f"{path} loaded but reports no class names")
    return [names[i] for i in sorted(names)]


def check_metrics(path: Path) -> dict:
    """Parse metrics.json and validate the contract the app consumes."""
    if not path.exists():
        fail(f"metrics file not found: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"metrics.json is not valid JSON: {exc}")
    if not isinstance(payload, dict):
        fail("metrics.json must be a JSON object")

    missing = REQUIRED_METRIC_KEYS - payload.keys()
    if missing:
        fail(f"metrics.json missing required keys: {sorted(missing)}")
    extras_missing = EXPECTED_EXTRA_KEYS - payload.keys()
    if extras_missing:
        print(f"  ⚠ missing optional notebook keys (format drift?): {sorted(extras_missing)}")

    if payload.get("available") is not True:
        fail('metrics.json "available" must be true for a completed training run')

    classes = payload["classes"]
    if not isinstance(classes, list) or not classes or not all(
        isinstance(c, str) and c for c in classes
    ):
        fail('"classes" must be a non-empty list of class-name strings')
    if DROPPED_CLASS in classes:
        fail(f'"{DROPPED_CLASS}" must not be in classes — the notebook drops it')

    for key in RATIO_KEYS:
        value = payload[key]
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            fail(f'"{key}" must be a number, got {value!r}')
        if not 0.0 <= float(value) <= 1.0:
            fail(f'"{key}" must be within [0, 1], got {value}')

    lat = payload["inference_latency_ms"]
    if not isinstance(lat, (int, float)) or isinstance(lat, bool) or float(lat) <= 0:
        fail(f'"inference_latency_ms" must be a positive number, got {lat!r}')

    per_class = payload["per_class"]
    if not isinstance(per_class, list) or len(per_class) != len(classes):
        fail('"per_class" must be a list with one entry per class')
    for entry, name in zip(per_class, classes):
        if not isinstance(entry, dict):
            fail(f"per_class entry for {name!r} must be an object")
        missing_pc = set(PER_CLASS_KEYS) - entry.keys()
        if missing_pc:
            fail(f"per_class entry for {name!r} missing keys: {sorted(missing_pc)}")
        if entry["class"] != name:
            fail(
                f'per_class[{name!r}] "class" field is {entry["class"]!r} — '
                "order must match metrics.classes"
            )
        for key in ("precision", "recall", "ap50", "ap50_95"):
            value = entry[key]
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                fail(f'per_class[{name!r}].{key} must be a number, got {value!r}')
            if not 0.0 <= float(value) <= 1.0:
                fail(f"per_class[{name!r}].{key} must be within [0, 1], got {value}")

    return payload


def validate(checkpoint: Path, metrics: Path) -> tuple[list[str], dict]:
    print(f"Checkpoint: {checkpoint}")
    ckpt_classes = check_checkpoint(checkpoint)
    print(f"  ✓ loads in ultralytics — {len(ckpt_classes)} classes: {ckpt_classes}")

    print(f"Metrics:    {metrics}")
    payload = check_metrics(metrics)
    print(
        "  ✓ metrics.json valid — "
        f"P={payload['precision']} R={payload['recall']} F1={payload['f1']} "
        f"mAP50={payload['map50']} mAP50-95={payload['map50_95']} "
        f"lat={payload['inference_latency_ms']}ms"
    )

    m_classes = list(payload["classes"])
    if ckpt_classes != m_classes:
        fail(
            "class mismatch: best.pt names "
            f"{ckpt_classes} != metrics.json classes {m_classes}. "
            "The Analytics per-class table would label the wrong classes."
        )
    print("  ✓ checkpoint classes match metrics.json classes exactly")

    return ckpt_classes, payload


def wire(checkpoint: Path, metrics: Path) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    dest_ckpt = MODELS_DIR / "best.pt"  # gitignored — weights never committed
    dest_metrics = REPORTS_DIR / "metrics.json"
    shutil.copy2(checkpoint, dest_ckpt)
    shutil.copy2(metrics, dest_metrics)
    print(f"  → copied checkpoint → {dest_ckpt}")
    print(f"  → copied metrics    → {dest_metrics}")
    print()
    print("Next steps:")
    print(f"  1. In backend/.env set:  MODEL_PATH={dest_ckpt.resolve()}")
    print("  2. Restart the backend.")
    print("  3. Confirm: GET /api/model-info shows the weapon classes,")
    print("     and GET /api/metrics shows the evaluation numbers above.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate (and optionally wire) weapondetect's Colab training artifacts."
    )
    parser.add_argument("--checkpoint", required=True, help="Path to best.pt from Colab")
    parser.add_argument("--metrics", required=True, help="Path to metrics.json from Colab")
    parser.add_argument(
        "--wire",
        action="store_true",
        help="Copy the files into models/ and training/evaluation/reports/ after validation",
    )
    args = parser.parse_args(argv)

    try:
        validate(Path(args.checkpoint), Path(args.metrics))
    except CheckFailure as exc:
        print(f"\n✗ FAILED: {exc}")
        return 1

    if args.wire:
        print()
        wire(Path(args.checkpoint), Path(args.metrics))

    print("\n✓ All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
