"""HTTP routes. No model code here — everything goes through services.Detector."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import get_settings
from ..schemas.responses import (
    DetectResponse,
    HealthResponse,
    MetricsResponse,
    ModelInfoResponse,
    VideoDetectResponse,
)
from ..services.detector import Detector, pil_from_bytes

logger = logging.getLogger(__name__)
router = APIRouter()

APP_VERSION = "1.0.0"

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
}
ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/avi": ".avi",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
}

_detector: Detector | None = None


def get_detector() -> Detector:
    global _detector
    if _detector is None:
        s = get_settings()
        _detector = Detector(
            model_path=s.MODEL_PATH,
            device=s.DEVICE,
            default_confidence=s.DEFAULT_CONFIDENCE,
        )
    return _detector


def _settings():
    return get_settings()


# ── health / info ──────────────────────────────────────────────────
@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    det = get_detector()
    return HealthResponse(
        status="ok",
        model_status="ready" if det.available else "unavailable",
        model_name=Path(det.model_path).name,
        device=det.device,
        version=APP_VERSION,
    )


@router.get("/api/model-info", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    det = get_detector()
    s = _settings()
    return ModelInfoResponse(
        model_family="YOLOv8",
        checkpoint=Path(det.model_path).name,
        checkpoint_status=det.checkpoint_status,
        classes=[{"id": c["id"], "name": c["name"]} for c in det.class_list]
        if det.available
        else [],
        input_size=640,
        default_confidence=s.DEFAULT_CONFIDENCE,
        device=det.device,
        loaded=det.available,
        last_health_check=det.last_health_check,
        error=det.error if not det.available else None,
    )


@router.get("/api/metrics", response_model=MetricsResponse)
def metrics() -> MetricsResponse:
    metrics_path = (
        Path(__file__).resolve().parents[3] / "training" / "evaluation" / "reports" / "metrics.json"
    )
    if metrics_path.exists():
        try:
            payload = json.loads(metrics_path.read_text())
            payload.pop("available", None)  # endpoint owns this flag; the report may carry it too
            return MetricsResponse(available=True, **payload)
        except Exception as exc:  # corrupt report → report honestly
            return MetricsResponse(
                available=False,
                message=f"Evaluation report exists but could not be parsed: {exc}",
            )
    return MetricsResponse(available=False, message="Evaluation not available yet.")


# ── image detection ────────────────────────────────────────────────
@router.post("/api/detect", response_model=DetectResponse)
async def detect(
    file: UploadFile = File(...),
    confidence: float | None = Form(None),
) -> DetectResponse:
    det = get_detector()
    if not det.available:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model unavailable. "
                + (det.error or "The checkpoint could not be loaded. "
                   "Set MODEL_PATH to a valid .pt file or allow network access "
                   "so the baseline yolov8n.pt can be downloaded.")
            ),
        )

    s = _settings()
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. "
            f"Allowed: jpeg, png, webp, bmp.",
        )

    max_bytes = s.MAX_UPLOAD_MB * 1024 * 1024
    raw = await file.read()
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(raw) / 1e6:.1f} MB). Limit is {s.MAX_UPLOAD_MB} MB.",
        )
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        image = pil_from_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if confidence is not None and not (0.0 < confidence <= 1.0):
        raise HTTPException(
            status_code=400, detail="confidence must be in (0, 1]."
        )

    try:
        result = det.detect_image(image, confidence=confidence)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return DetectResponse(**result)


# ── video detection ────────────────────────────────────────────────
_TMP_VIDEO_DIR = Path(tempfile.gettempdir()) / "weapondetect_videos"
_TMP_VIDEO_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/api/detect-video", response_model=VideoDetectResponse)
async def detect_video(
    file: UploadFile = File(...),
    confidence: float | None = Form(None),
) -> VideoDetectResponse:
    det = get_detector()
    if not det.available:
        raise HTTPException(status_code=503, detail="Model unavailable.")

    s = _settings()
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type '{file.content_type}'. Allowed: mp4, avi, mov.",
        )

    max_bytes = s.MAX_VIDEO_MB * 1024 * 1024
    raw = await file.read()
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Video too large. Limit is {s.MAX_VIDEO_MB} MB.",
        )
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    job_id = uuid.uuid4().hex
    src_path = _TMP_VIDEO_DIR / f"{job_id}_input.mp4"
    out_rel: str | None = None
    try:
        src_path.write_bytes(raw)
        # Duration limit (reasonable cap per spec; checked before heavy work).
        import cv2

        probe = cv2.VideoCapture(str(src_path))
        fps = probe.get(cv2.CAP_PROP_FPS) or 25.0
        frame_count = probe.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        probe.release()
        duration_s = frame_count / fps if fps else 0
        if duration_s > s.MAX_VIDEO_SECONDS:
            raise HTTPException(
                status_code=413,
                detail=f"Video too long ({duration_s:.0f}s). Limit is {s.MAX_VIDEO_SECONDS}s.",
            )
        result = det.detect_video_frames(
            str(src_path),
            frame_stride=max(1, s.VIDEO_FRAME_STRIDE),
            confidence=confidence,
        )
        out_path = Path(result["annotated_video_path"])
        out_rel = f"{job_id}.mp4"
        out_path.rename(_TMP_VIDEO_DIR / out_rel)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Video processing failed: {exc}") from exc
    finally:
        src_path.unlink(missing_ok=True)

    return VideoDetectResponse(
        success=True,
        annotated_video_url=f"/api/videos/{job_id}",
        frames_processed=result["frames_processed"],
        frames_total=result["frames_total"],
        detections_total=result["detections_total"],
        inference_ms=result["inference_ms"],
        model_status="ready",
    )


@router.get("/api/videos/{job_id}")
def download_video(job_id: str):
    path = _TMP_VIDEO_DIR / f"{job_id}.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Annotated video not found.")
    return FileResponse(path, media_type="video/mp4", filename="annotated.mp4")


@router.get("/")
def root():
    return {"service": "weapondetect-api", "version": APP_VERSION, "docs": "/docs"}
