"""Evaluate a trained checkpoint on the held-out test split.

Writes training/evaluation/reports/metrics.json with:
precision, recall, F1, mAP@0.50, mAP@0.50:0.95, per-class AP,
inference latency — ONLY from real runs. Never fabricate.

Usage:
    python training/evaluate.py --weights models/best.pt --data training/data.yaml
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "training" / "evaluation" / "reports"


def main() -> int:
    ap = argparse.ArgumentParser(description="Evaluate YOLO checkpoint")
    ap.add_argument("--weights", required=True, help="path to .pt checkpoint")
    ap.add_argument("--data", required=True, help="path to data.yaml")
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default="auto")
    args = ap.parse_args()

    weights = Path(args.weights)
    if not weights.exists():
        print(f"Checkpoint not found: {weights}", file=sys.stderr)
        return 2

    from ultralytics import YOLO
    import torch

    device = args.device
    if device == "auto":
        device = "0" if torch.cuda.is_available() else "cpu"
    print(f"Evaluating {weights} on device {device} ...")

    model = YOLO(str(weights))
    names = {int(k): str(v) for k, v in model.names.items()}

    # Latency probe on a blank frame (sanity check, reported separately)
    import numpy as np

    probe = np.zeros((args.imgsz, args.imgsz, 3), dtype=np.uint8)
    latencies: list[float] = []
    with torch.no_grad():
        for _ in range(10):
            t0 = time.perf_counter()
            model.predict(probe, device=device, verbose=False)
            latencies.append((time.perf_counter() - t0) * 1000)
    latency_ms = float(np.median(latencies))

    metrics = model.val(
        data=args.data, imgsz=args.imgsz, batch=args.batch, device=device, verbose=False
    )

    mp, mr = metrics.box.map50, metrics.box.map
    # metrics.box.maps -> per-class AP50-95; mp_all etc. give per-class P/R
    per_class: list[dict] = []
    ap5095 = getattr(metrics.box, "maps", None)
    ap50 = getattr(metrics.box, "ap50", None)
    prec = getattr(metrics.box, "p", None)
    rec = getattr(metrics.box, "r", None)
    n_classes = len(names)
    for cid in range(n_classes):
        entry = {
            "class_id": cid,
            "class_name": names.get(cid, f"class_{cid}"),
            "ap50_95": float(ap5095[cid]) if ap5095 is not None and cid < len(ap5095) else None,
            "ap50": float(ap50[cid]) if ap50 is not None and cid < len(ap50) else None,
            "precision": float(prec[cid]) if prec is not None and cid < len(prec) else None,
            "recall": float(rec[cid]) if rec is not None and cid < len(rec) else None,
        }
        per_class.append(entry)

    # F1 from mean precision/recall
    mean_p = float(getattr(metrics.box, "mp", 0.0))
    mean_r = float(getattr(metrics.box, "mr", 0.0))
    f1 = 2 * mean_p * mean_r / (mean_p + mean_r) if (mean_p + mean_r) > 0 else 0.0

    report = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "checkpoint": str(weights),
        "data": str(args.data),
        "device": device,
        "imgsz": args.imgsz,
        "precision": round(mean_p, 4),
        "recall": round(mean_r, 4),
        "f1": round(f1, 4),
        "map50": round(float(mp), 4),
        "map50_95": round(float(mr), 4),
        "per_class": per_class,
        "inference_latency_ms_median": round(latency_ms, 2),
        "note": (
            "Object-detection metrics: precision/recall here are computed over "
            "detections matched by IoU>=0.5, not per-image classification. mAP@0.50 "
            "averages AP at IoU 0.50; mAP@0.50:0.95 averages over IoU 0.50..0.95."
        ),
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORT_DIR / "metrics.json"
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "per_class"}, indent=2))
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
