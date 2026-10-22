# models/

Model weights are **never committed** (`models/*.pt` is gitignored).

How the backend gets its checkpoint:

1. **Baseline (default):** `MODEL_PATH=yolov8n` — Ultralytics downloads
   `yolov8n.pt` (~6 MB, COCO-pretrained, 80 classes incl. `knife`) on first
   run into the Ultralytics cache. Internet access required once.
2. **Custom-trained:** place your trained checkpoint here (e.g.
   `models/best.pt` produced by `training/train.py`) and set
   `MODEL_PATH=models/best.pt` (absolute path recommended in production).

The backend validates the checkpoint at startup; if loading fails the API
reports `model_status: "unavailable"` and detection endpoints return 503.
