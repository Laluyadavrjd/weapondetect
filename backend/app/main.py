"""FastAPI application entrypoint. Routes only — model work lives in services."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import get_settings

settings = get_settings()

origins = [o.strip() for o in settings.FRONTEND_ORIGIN.split(",") if o.strip()]

app = FastAPI(
    title="WeaponDetect API",
    description="YOLO-based object detection backend (COCO-pretrained baseline).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)


if __name__ == "__main__":
    main()
