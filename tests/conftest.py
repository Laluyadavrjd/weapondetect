"""Shared fixtures for the backend test suite."""

import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="session")
def client():
    from app.main import app

    return TestClient(app)


def make_image_bytes(w=640, h=480, color=(30, 60, 120), fmt="JPEG") -> bytes:
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()
