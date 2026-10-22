"""Train a YOLO detector with Ultralytics.

Config-driven: reads training/config.yaml. Saves checkpoints to models/
(which is gitignored — weights are never committed).

Example:
    python training/train.py --config training/config.yaml
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def load_config(path: Path) -> dict:
    with open(path) as f:
        cfg = yaml.safe_load(f) or {}
    data_yaml = Path(cfg.get("data", "training/data.yaml"))
    if not data_yaml.is_absolute():
        data_yaml = ROOT / data_yaml
    cfg["data"] = str(data_yaml)
    cfg.setdefault("model", "yolov8n.pt")
    cfg.setdefault("imgsz", 640)
    cfg.setdefault("epochs", 100)
    cfg.setdefault("batch", 16)
    cfg.setdefault("device", "auto")
    cfg.setdefault("project", str(ROOT / "training" / "runs"))
    cfg.setdefault("name", "weapondetect-train")
    cfg.setdefault("patience", 20)
    cfg.setdefault("seed", 42)
    return cfg


def resolve_device(requested: str) -> str:
    if requested and requested != "auto":
        return requested
    try:
        import torch

        return "0" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def main() -> int:
    ap = argparse.ArgumentParser(description="Train YOLO detector")
    ap.add_argument("--config", default=str(ROOT / "training" / "config.yaml"))
    args = ap.parse_args()

    cfg = load_config(Path(args.config))

    # Validate dataset before spending compute
    from validate_dataset import validate_dataset

    ok, summary = validate_dataset(cfg["data"])
    print(summary)
    if not ok:
        print("Dataset validation FAILED — fix the issues above before training.", file=sys.stderr)
        return 2

    from ultralytics import YOLO

    device = resolve_device(cfg["device"])
    print(f"Training on device: {device}")
    model = YOLO(cfg["model"])
    results = model.train(
        data=cfg["data"],
        imgsz=cfg["imgsz"],
        epochs=cfg["epochs"],
        batch=cfg["batch"],
        device=device,
        project=cfg["project"],
        name=cfg["name"],
        patience=cfg["patience"],
        seed=cfg["seed"],
        exist_ok=False,
    )

    # Copy best checkpoint into models/ (gitignored)
    models_dir = ROOT / "models"
    models_dir.mkdir(exist_ok=True)
    best = Path(results.save_dir) / "weights" / "best.pt"
    if best.exists():
        dest = models_dir / "best.pt"
        shutil.copy2(best, dest)
        print(f"Best checkpoint copied to {dest}")
        print("Point MODEL_PATH at it to serve the trained model.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
