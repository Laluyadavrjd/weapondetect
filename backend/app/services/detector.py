"""HTTP-free YOLO inference service.

All model work lives here; the API layer only passes bytes in and takes
structured results out. The detector degrades gracefully: if weights can
not be loaded (no network, corrupt file, …), ``available`` stays False and
the HTTP layer answers 503.
"""

from __future__ import annotations

import base64
import io
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

MODEL_FAMILY = "YOLOv8"


def _resolve_device(requested: str) -> str:
    if requested and requested != "auto":
        return requested
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:  # pragma: no cover - torch import failure is unlikely here
        return "cpu"


@dataclass
class Detector:
    model_path: str
    device: str = "auto"
    default_confidence: float = 0.25

    _model: Any = field(default=None, repr=False)
    _names: dict[int, str] = field(default_factory=dict, repr=False)
    _lock: Lock = field(default_factory=Lock, repr=False)
    _error: str | None = field(default=None, repr=False)
    _last_health_check: str | None = field(default=None, repr=False)

    def load(self) -> None:
        """Load the checkpoint once. Safe to call repeatedly."""
        with self._lock:
            if self._model is not None or self._error is not None:
                return
            resolved_device = _resolve_device(self.device)
            try:
                from ultralytics import YOLO

                model = YOLO(self.model_path)
                # Smoke-verify: names must be present and the model usable.
                names = model.names
                if not names:
                    raise RuntimeError("checkpoint loaded but exposes no class names")
                self._model = model
                self._names = {int(k): str(v) for k, v in names.items()}
                self.device = resolved_device
                self._last_health_check = datetime.now(timezone.utc).isoformat()
                logger.info(
                    "Loaded %s checkpoint %s on %s with %d classes",
                    MODEL_FAMILY,
                    self.model_path,
                    self.device,
                    len(self._names),
                )
            except Exception as exc:  # noqa: BLE001 - surface any load failure
                self._error = f"{type(exc).__name__}: {exc}"
                logger.error("Failed to load model %s: %s", self.model_path, self._error)

    @property
    def available(self) -> bool:
        self.load()
        return self._model is not None

    @property
    def error(self) -> str | None:
        return self._error

    @property
    def class_list(self) -> list[dict[str, Any]]:
        self.load()
        return [{"id": cid, "name": name} for cid, name in sorted(self._names.items())]

    @property
    def checkpoint_status(self) -> str:
        return "loaded" if self.available else "missing"

    @property
    def last_health_check(self) -> str | None:
        return self._last_health_check

    # ── image inference ────────────────────────────────────────────
    def detect_image(
        self, image: Image.Image, confidence: float | None = None
    ) -> dict[str, Any]:
        """Run inference on a PIL image. Coordinates are in ORIGINAL pixels."""
        self.load()
        if self._model is None:
            raise RuntimeError(self._error or "model unavailable")

        conf = self.default_confidence if confidence is None else confidence
        conf = max(0.0, min(1.0, float(conf)))

        orig_w, orig_h = image.size
        rgb = image.convert("RGB")

        start = time.perf_counter()
        import torch

        with torch.no_grad():
            results = self._model.predict(
                rgb, conf=conf, device=self.device, verbose=False
            )
        inference_ms = (time.perf_counter() - start) * 1000

        detections: list[dict[str, Any]] = []
        result = results[0]
        boxes = result.boxes
        if boxes is not None and len(boxes) > 0:
            xyxy = boxes.xyxy.cpu().numpy()
            cls = boxes.cls.cpu().numpy().astype(int)
            confs = boxes.conf.cpu().numpy()
            for (x1, y1, x2, y2), cid, c in zip(xyxy, cls, confs):
                cid = int(cid)
                detections.append(
                    {
                        "class_id": cid,
                        "class_name": self._names.get(cid, f"class_{cid}"),
                        "confidence": round(float(c), 4),
                        "bbox": {
                            "x1": int(round(float(x1))),
                            "y1": int(round(float(y1))),
                            "x2": int(round(float(x2))),
                            "y2": int(round(float(y2))),
                        },
                    }
                )

        annotated_data_url = self._annotate_data_url(rgb, detections)
        self._last_health_check = datetime.now(timezone.utc).isoformat()

        return {
            "success": True,
            "image_width": orig_w,
            "image_height": orig_h,
            "detections": detections,
            "inference_ms": round(inference_ms, 2),
            "model_status": "ready",
            "annotated_image": annotated_data_url,
        }

    def _annotate_data_url(self, image: Image.Image, detections: list[dict]) -> str:
        import cv2

        canvas = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        h, w = canvas.shape[:2]
        thickness = max(2, min(w, h) // 400)
        font_scale = max(0.5, min(w, h) / 900)
        for det in detections:
            b = det["bbox"]
            x1, y1, x2, y2 = b["x1"], b["y1"], b["x2"], b["y2"]
            color = (0, 255, 255)  # cyan boxes
            cv2.rectangle(canvas, (x1, y1), (x2, y2), color, thickness)
            label = f"{det['class_name']} {det['confidence']:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)
            cv2.rectangle(canvas, (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
            cv2.putText(
                canvas,
                label,
                (x1 + 4, y1 - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (0, 0, 0),
                2,
                cv2.LINE_AA,
            )
        ok, buf = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            raise RuntimeError("failed to encode annotated image")
        b64 = base64.b64encode(buf.tobytes()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"

    # ── video inference ────────────────────────────────────────────
    def detect_video_frames(
        self,
        video_path: str,
        frame_stride: int = 5,
        confidence: float | None = None,
    ) -> dict[str, Any]:
        """Sample every ``frame_stride``-th frame, annotate, write mp4."""
        import cv2

        self.load()
        if self._model is None:
            raise RuntimeError(self._error or "model unavailable")

        conf = self.default_confidence if confidence is None else confidence
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError("could not open uploaded video")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        out_path = video_path + ".annotated.mp4"
        writer = cv2.VideoWriter(
            out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
        )

        import torch

        frames_processed = 0
        detections_total = 0
        start = time.perf_counter()
        idx = 0
        try:
            with torch.no_grad():
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    if idx % frame_stride == 0:
                        rgb = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                        res = self._model.predict(
                            rgb, conf=conf, device=self.device, verbose=False
                        )[0]
                        dets: list[dict] = []
                        if res.boxes is not None and len(res.boxes) > 0:
                            xyxy = res.boxes.xyxy.cpu().numpy()
                            cls = res.boxes.cls.cpu().numpy().astype(int)
                            cfs = res.boxes.conf.cpu().numpy()
                            for (x1, y1, x2, y2), cid, c in zip(xyxy, cls, cfs):
                                cid = int(cid)
                                dets.append(
                                    {
                                        "class_id": cid,
                                        "class_name": self._names.get(cid, f"class_{cid}"),
                                        "confidence": round(float(c), 4),
                                        "bbox": {
                                            "x1": int(round(float(x1))),
                                            "y1": int(round(float(y1))),
                                            "x2": int(round(float(x2))),
                                            "y2": int(round(float(y2))),
                                        },
                                    }
                                )
                        detections_total += len(dets)
                        frames_processed += 1
                        self._draw_boxes(frame, dets)
                    writer.write(frame)
                    idx += 1
        finally:
            cap.release()
            writer.release()

        inference_ms = (time.perf_counter() - start) * 1000
        return {
            "success": True,
            "annotated_video_path": out_path,
            "frames_processed": frames_processed,
            "frames_total": total,
            "detections_total": detections_total,
            "inference_ms": round(inference_ms, 2),
            "model_status": "ready",
        }

    @staticmethod
    def _draw_boxes(frame: "np.ndarray", detections: list[dict]) -> None:
        import cv2

        for det in detections:
            b = det["bbox"]
            cv2.rectangle(
                frame, (b["x1"], b["y1"]), (b["x2"], b["y2"]), (0, 255, 255), 2
            )
            cv2.putText(
                frame,
                f"{det['class_name']} {det['confidence']:.2f}",
                (b["x1"], max(0, b["y1"] - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )


def pil_from_bytes(raw: bytes) -> Image.Image:
    """Decode uploaded bytes; raises ValueError on invalid/corrupt data."""
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()  # force decode to catch truncation
        return img
    except Exception as exc:
        raise ValueError(f"invalid or corrupt image: {exc}") from exc
