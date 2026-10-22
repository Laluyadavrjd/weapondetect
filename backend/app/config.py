"""Application settings — everything comes from the environment."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    MODEL_PATH: str = "yolov8n"
    DEVICE: str = "auto"  # auto | cpu | cuda | cuda:0 ...
    DEFAULT_CONFIDENCE: float = 0.25
    MAX_UPLOAD_MB: int = 10
    MAX_VIDEO_MB: int = 100
    MAX_VIDEO_SECONDS: int = 60
    VIDEO_FRAME_STRIDE: int = 5
    PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
