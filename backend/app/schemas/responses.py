"""Pydantic v2 response schemas — shared API contract with the frontend."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    model_status: str  # "ready" | "unavailable"
    model_name: str = "yolov8n"
    device: str = "cpu"
    version: str = "1.0.0"


class ClassInfo(BaseModel):
    id: int
    name: str


class ModelInfoResponse(BaseModel):
    model_family: str = "YOLOv8"
    checkpoint: str = "yolov8n.pt"
    checkpoint_status: str  # "loaded" | "missing"
    classes: list[ClassInfo]
    input_size: int = 640
    default_confidence: float = 0.25
    device: str = "cpu"
    loaded: bool
    last_health_check: str | None = None
    error: str | None = None


class BoundingBox(BaseModel):
    x1: int = Field(ge=0)
    y1: int = Field(ge=0)
    x2: int = Field(ge=0)
    y2: int = Field(ge=0)


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BoundingBox


class DetectResponse(BaseModel):
    success: bool = True
    image_width: int
    image_height: int
    detections: list[Detection]
    inference_ms: float
    model_status: str = "ready"
    annotated_image: str  # data:image/jpeg;base64,...


class MetricsResponse(BaseModel):
    available: bool
    message: str | None = None

    model_config = {"extra": "allow"}  # real metric payloads pass through verbatim


class VideoDetectResponse(BaseModel):
    success: bool = True
    annotated_video_url: str
    frames_processed: int
    frames_total: int
    detections_total: int
    inference_ms: float
    model_status: str = "ready"
