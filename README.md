# AI-Based Weapon Detection System

A full-stack computer-vision web application: upload an image (or a short
video), get YOLO-based detections with bounding boxes, class names and
confidence scores, rendered in a premium "computer vision laboratory"
dashboard. FastAPI backend, React + Vite + TypeScript frontend.

> **Honest baseline:** the shipped detector is a COCO-pretrained YOLOv8n
> model (80 classes, including `knife`, but **no firearm-specific classes**).
> Firearm-class detection requires a labeled dataset plus the training
> pipeline provided under `training/` (a ready-to-run Colab notebook is
> included). Detections are probabilistic and can be wrong — this is a
> demonstration, not a threat-assessment system.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS v4, React Three Fiber, Framer Motion, Lucide icons, Recharts |
| Backend  | Python 3.12, FastAPI, Uvicorn, Pydantic v2, Pillow, OpenCV |
| Model    | Ultralytics YOLO (YOLOv8n baseline; custom checkpoint via `MODEL_PATH`) |
| Training | Ultralytics trainer (+ Colab notebook for GPU training) |
| Tests    | pytest, FastAPI TestClient |

## Project layout

```
weapondetect/
├── frontend/                  # React app (6 pages: Home, Detect, Video, Analytics, Model info, About)
│   └── src/{api.ts,types.ts,components,pages}
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS (HTTP layer only)
│   │   ├── api/routes.py      # /health, /api/* endpoints
│   │   ├── services/detector.py  # HTTP-free YOLO inference service
│   │   ├── schemas/responses.py  # Pydantic response models (the API contract)
│   │   └── config.py          # env-driven settings
│   ├── requirements.txt
│   └── .venv/                 # local virtualenv (gitignored; create your own)
├── training/
│   ├── train.py               # config-driven training script
│   ├── validate_dataset.py    # YOLO dataset validator
│   ├── evaluate.py            # test-set evaluation → evaluation/reports/metrics.json
│   ├── config.yaml / data.yaml# training config + dataset config template
│   ├── DATASET_GUIDE.md       # how to obtain a suitably licensed dataset
│   └── colab/WeaponDetect_Training.ipynb  # GPU training notebook (Colab)
├── models/README.md           # how weights are provided (never committed)
├── tests/                     # pytest suite (13 tests)
├── .env.example               # all settings with explanations
└── .gitignore
```

## Prerequisites

- **Backend:** Python 3.10+ (3.12 used here). ~2 GB free for the venv
  (PyTorch CPU + Ultralytics). Internet access once, to download `yolov8n.pt`
  (~6 MB) on first run.
- **Frontend:** Node.js 18+ and npm.
- **Training (optional):** a GPU (the Colab notebook uses a free T4) and a
  free Roboflow account if you use the recommended dataset.

## Setup

### 1. Backend

```bash
cd weapondetect/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env        # optional: adjust MODEL_PATH, DEVICE, limits, PORT
```

### 2. Frontend

```bash
cd weapondetect/frontend
npm install
cp .env.example .env           # set VITE_API_URL to the backend origin (default http://localhost:8000)
```

## Running

**One command (recommended)** — from the repo root, after Setup:

```bash
./run.sh        # starts backend + frontend, waits until both are healthy,
                # Ctrl+C stops both → http://localhost:5173
```

Or manually, in two terminals:

```bash
# Terminal 1 — backend (from weapondetect/backend, venv active)
uvicorn app.main:app --host 127.0.0.1 --port 8000
# Terminal 2 — frontend (from weapondetect/frontend)
npm run dev                    # → http://localhost:5173/
```

Open http://localhost:5173, go to **Detect**, upload an image, press
**Detect**. The annotated result, detection table (class, confidence,
x1/y1/x2/y2), inference time and a download button appear.

Production frontend build: `npm run build` (outputs `frontend/dist/`).

## Configuration

All backend settings come from the environment (see `.env.example`):

| Variable | Default | Meaning |
|----------|---------|---------|
| `MODEL_PATH` | `yolov8n` | Checkpoint name (auto-downloaded) or path to a custom `.pt`, e.g. `models/best.pt` |
| `DEVICE` | `auto` | `auto` (cuda if available else cpu), `cpu`, `cuda`, … |
| `DEFAULT_CONFIDENCE` | `0.25` | Confidence threshold when the client doesn't send one |
| `MAX_UPLOAD_MB` | `10` | Max image upload size |
| `MAX_VIDEO_MB` / `MAX_VIDEO_SECONDS` | `100` / `60` | Video upload caps |
| `VIDEO_FRAME_STRIDE` | `5` | Process every Nth frame |
| `PORT` | `8000` | API port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |

Frontend: `VITE_API_URL` (default `http://localhost:8000`).

## Model weights

Weights are **never committed** (`*.pt` is gitignored). Two ways to provide
them (details in `models/README.md`):

1. **Baseline (default):** `MODEL_PATH=yolov8n` — downloaded once from
   Ultralytics on first inference.
2. **Custom-trained:** train with `training/` (below), place the checkpoint
   at e.g. `models/best.pt`, set `MODEL_PATH` to it.

If weights can't be loaded, the API reports `"model_status": "unavailable"`
and detection endpoints return **503** with a clear message — never fake
detections.

## Dataset, training & evaluation

The repo ships with **no dataset** (see `training/DATASET_GUIDE.md` for how
to obtain a suitably licensed one and the expected YOLO layout).

**Recommended dataset (researched 2026-10-19):** *Yolo Weapon Detection* v8
by `weapon-detect-qbsiw` (Roboflow Universe) — 10,833 images @640px, classes
include pistol, rifle, shot-gun, submachine-gun, knife; **CC BY 4.0**
(attribution required). Caveats: drop `blunt object` (3 annotations);
`submachine-gun` is rare (~46 annotations).

**GPU training on Colab (recommended):**
open `training/colab/WeaponDetect_Training.ipynb` in Colab, set
**Runtime → T4 GPU**, paste a free Roboflow API key when prompted. It
downloads the dataset, validates labels, cleans the class list, trains
YOLOv8 (50 epochs), evaluates on the held-out test split and downloads
`best.pt` + `metrics.json`.

**Local training** (CPU or your own GPU):

```bash
# 1. validate the dataset first — refuses to continue on problems
python training/validate_dataset.py --data datasets/weapon/data.yaml
# 2. train (edit training/config.yaml: data path, epochs, batch, device)
python training/train.py --config training/config.yaml
# 3. evaluate on the held-out test split → training/evaluation/reports/metrics.json
python training/evaluate.py --weights models/best.pt --data datasets/weapon/data.yaml
```

`GET /api/metrics` serves `training/evaluation/reports/metrics.json` when it
exists; otherwise it returns `{"available": false, "message": "Evaluation not
available yet."}` and the Analytics page shows exactly that — metrics are
never invented.

## API reference

Base URL: `http://localhost:8000` (interactive docs at `/docs`).

| Method & path | Description |
|---------------|-------------|
| `GET /health` | `{"status":"ok","model_status":"ready","model_name":"yolov8n","device":"cpu","version":"1.0.0"}` |
| `GET /api/model-info` | Model family, checkpoint + status, verified class list, input size, confidence default, device, load status, last health check |
| `POST /api/detect` | `multipart/form-data`: `file` (jpeg/png/webp/bmp ≤ `MAX_UPLOAD_MB`), optional `confidence` float in (0,1]. Returns detections (`class_id`, `class_name`, `confidence`, `bbox{x1,y1,x2,y2}` in original-image pixels), `image_width/height`, `inference_ms`, `model_status`, and `annotated_image` as a `data:image/jpeg;base64,…` URL |
| `GET /api/metrics` | Real evaluation report if one exists, else `{"available":false,…}` |
| `POST /api/detect-video` | `multipart/form-data`: `file` (mp4/avi/mov ≤ `MAX_VIDEO_MB`, ≤ `MAX_VIDEO_SECONDS`). Samples every `VIDEO_FRAME_STRIDE`-th frame, returns `annotated_video_url` (`GET /api/videos/{job_id}` serves the mp4), `frames_processed`, `frames_total`, `detections_total`, `inference_ms` |
| `GET /api/videos/{job_id}` | Download an annotated video |

Status codes: `200` ok · `400` invalid file/type · `404` unknown video job ·
`413` over size/duration limits · `422` video processing failed ·
`503` model unavailable.

Example:

```bash
curl -X POST http://localhost:8000/api/detect \
  -F "file=@photo.jpg;type=image/jpeg" -F "confidence=0.4"
```

## Tests

```bash
cd weapondetect
./backend/.venv/bin/python -m pytest tests/ -q
```

13 tests: health, model-info schema, valid-image detection (real inference),
invalid/corrupt/oversized/empty uploads, empty-detection results,
model-unavailable path, response-schema validation. Frontend: `npm run build`
(type-check) in `frontend/`.

## Common errors

| Symptom | Cause / fix |
|---------|-------------|
| `503 Model unavailable` | No network for the first-time `yolov8n.pt` download, or bad `MODEL_PATH`. Check the `detail` message; set `MODEL_PATH` to a valid `.pt`. |
| Frontend shows "Cannot reach the backend" | Backend not running, or `VITE_API_URL` wrong. Backend default is `http://localhost:8000`. |
| CORS error in browser | `FRONTEND_ORIGIN` doesn't include the frontend's origin. |
| `413 File too large` | Over `MAX_UPLOAD_MB` (images) or `MAX_VIDEO_MB`/`MAX_VIDEO_SECONDS` (video). |
| CUDA out-of-memory (training) | Lower `batch` in `training/config.yaml` or the notebook. |
| Slow first inference | One-time model load + CPU warmup; subsequent requests are faster. |

## Limitations

- The COCO baseline knows `knife` but **no firearm classes** — it cannot
  reliably identify guns. Firearm detection needs the custom-trained model.
- Detections are probabilistic; confidence is not a guarantee. The UI states
  this on every page.
- Video analysis samples frames — it is **not** real-time CCTV monitoring.
- CPU inference is slower than GPU (a few seconds per image on CPU).
- This is a demonstration project, not a safety or security system.

## Team

- **Anjali Singh** (S24CSEU0359) — Backend, API integration, model connection
- **Satyam Kumar** (S24CSEU0480) — Frontend, user interaction, upload interface, detection-result display
- **Krishnanand Yadav** (S24CSEU0657) — Backend, AI-model integration, detection pipeline
- All members — system integration, testing, final project review
