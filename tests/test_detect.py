"""Detection endpoint tests — real inference, no fakes."""

import io

import pytest

from conftest import make_image_bytes


def _detect(client, img_bytes, content_type="image/jpeg", confidence=None):
    files = {"file": ("test.jpg", img_bytes, content_type)}
    data = {}
    if confidence is not None:
        data["confidence"] = str(confidence)
    return client.post("/api/detect", files=files, data=data)


def _require_ready(client):
    if client.get("/health").json()["model_status"] != "ready":
        pytest.skip("model unavailable — skipping real-inference tests")


def test_detect_blank_image_returns_empty(client):
    _require_ready(client)
    r = _detect(client, make_image_bytes())
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["image_width"] == 640
    assert body["image_height"] == 480
    assert body["detections"] == []
    assert body["model_status"] == "ready"
    assert body["annotated_image"].startswith("data:image/jpeg;base64,")


def test_detect_response_schema(client):
    _require_ready(client)
    r = _detect(client, make_image_bytes(w=320, h=240), confidence=0.9)
    assert r.status_code == 200
    body = r.json()
    for det in body["detections"]:
        assert set(det.keys()) >= {"class_id", "class_name", "confidence", "bbox"}
        assert set(det["bbox"].keys()) == {"x1", "y1", "x2", "y2"}
        assert 0.0 <= det["confidence"] <= 1.0
        assert det["bbox"]["x2"] > det["bbox"]["x1"]
        assert det["bbox"]["y2"] > det["bbox"]["y1"]
        # coordinates must lie within the ORIGINAL image dimensions
        assert det["bbox"]["x2"] <= body["image_width"]
        assert det["bbox"]["y2"] <= body["image_height"]
    assert body["inference_ms"] >= 0


def test_detect_real_objects_in_coco_image(client):
    """A real photograph with common objects must produce real detections."""
    _require_ready(client)
    try:
        from ultralytics.utils import ASSETS
        from PIL import Image
    except Exception:
        pytest.skip("ultralytics assets unavailable")
    bus_path = ASSETS / "bus.jpg"
    if not bus_path.exists():
        pytest.skip("ultralytics sample image missing")
    img_bytes = bus_path.read_bytes()
    r = _detect(client, img_bytes, content_type="image/jpeg")
    assert r.status_code == 200
    body = r.json()
    names = {d["class_name"] for d in body["detections"]}
    assert len(body["detections"]) > 0, "expected real detections in bus.jpg"
    # bus.jpg is the canonical ultralytics sample: bus + people
    assert "bus" in names and "person" in names, f"got {names}"
    for d in body["detections"]:
        assert d["confidence"] >= 0.25


def test_detect_class_names_come_from_model(client):
    """Cross-check class_name against the model's own names dict."""
    _require_ready(client)
    from ultralytics import YOLO

    yolo = YOLO("yolov8n")
    expected = {int(k): str(v) for k, v in yolo.names.items()}
    info = client.get("/api/model-info").json()
    for c in info["classes"]:
        assert expected[c["id"]] == c["name"]
    assert expected[0] == "person"


def test_invalid_file_type_rejected(client):
    r = _detect(client, b"hello, this is not an image", content_type="text/plain")
    assert r.status_code == 400
    assert "unsupported" in r.json()["detail"].lower()


def test_corrupt_image_rejected(client):
    bad_jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 64  # truncated header
    r = _detect(client, bad_jpeg, content_type="image/jpeg")
    assert r.status_code == 400


def test_empty_file_rejected(client):
    r = _detect(client, b"", content_type="image/jpeg")
    assert r.status_code == 400


def test_oversized_file_rejected(client, monkeypatch):
    from app.api import routes

    monkeypatch.setattr(routes, "get_settings", lambda: type(
        "S", (), {"MAX_UPLOAD_MB": 0, "MAX_VIDEO_MB": 100, "MAX_VIDEO_SECONDS": 60,
                  "VIDEO_FRAME_STRIDE": 5, "DEFAULT_CONFIDENCE": 0.25,
                  "FRONTEND_ORIGIN": "http://localhost:5173", "PORT": 8000,
                  "MODEL_PATH": "yolov8n", "DEVICE": "cpu"}))
    r = _detect(client, make_image_bytes())
    assert r.status_code == 413


def test_bad_confidence_rejected(client):
    r = _detect(client, make_image_bytes(), confidence=1.5)
    assert r.status_code == 400


def test_model_unavailable_returns_503(client, monkeypatch):
    from app.api import routes

    class DeadDetector:
        available = False
        error = "simulated load failure"

    monkeypatch.setattr(routes, "get_detector", lambda: DeadDetector())
    r = _detect(client, make_image_bytes())
    assert r.status_code == 503
    assert "unavailable" in r.json()["detail"].lower()
