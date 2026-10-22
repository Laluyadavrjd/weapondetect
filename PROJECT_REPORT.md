# Project Report — AI-Based Weapon Detection System

**Project:** weapondetect (github.com/Laluyadavrjd/weapondetect)
**Team:** Anjali Singh (S24CSEU0359) · Satyam Kumar (S24CSEU0480) · Krishnanand Yadav (S24CSEU0657)
**Status as of 22 Oct 2026:** Build complete, custom model trained and wired in, fully re-verified. Remaining: GitHub push (needs the team's GitHub authorisation) and the demo itself.

---

## 1. What the project is

A full-stack web application that detects weapons and related objects in
uploaded images and short video clips. It is presented as a premium
computer-vision analytics console ("WeaponDetect Lab"): a React frontend, a
FastAPI backend running real YOLOv8 inference, and an analytics dashboard fed
by a genuine evaluation report — no simulated predictions, no invented
metrics, anywhere in the system.

## 2. What was built

### Backend (FastAPI, `backend/`)
- `GET /health` — service and model status
- `GET /api/model-info` — the loaded checkpoint, its classes, device, config
- `POST /api/detect` — image upload → real inference → bounding boxes,
  confidences, annotated image (base64), per-request latency
- `POST /api/detect-video` — video upload → annotated mp4
- `GET /api/metrics` — serves the real evaluation report
- Upload validation (format, size, video duration caps), CORS, and an honest
  503 with a clear message when weights cannot be loaded — the API never
  fabricates a detection

### Frontend (React + Vite + TypeScript, `frontend/`)
Six pages in a midnight-navy/cyan "vision lab" theme: Home, Detect
(drag-and-drop upload, confidence slider, annotated result, detection table,
download), Video, Analytics (renders only the real metrics), Model Info
(fetched live from the backend), and About (problem, methodology, team,
limitations).

### Training pipeline (`training/`)
Dataset validator, training and evaluation scripts, a dataset guide, a
Colab notebook (`training/colab/WeaponDetect_Training.ipynb`) with a
Google-Drive mirror guard against free-tier disconnects, and
`training/wire_checkpoint.py`, a validator that checks a trained checkpoint
and its metrics file before they are wired into the app.

### Documentation
README (setup, run, configuration), DEMO_DAY.md (12–15 minute run-of-show and
readiness checklist), QA_PREP.md (evaluator Q&A grounded in the real
artefacts), and this report.

## 3. The trained model

- **Base model:** YOLOv8n, fine-tuned on Colab (T4 GPU), 50 epochs,
  imgsz 640, batch 16, patience 15, seed 42
- **Dataset:** *Yolo Weapon Detection* v8 by weapon-detect-qbsiw (Roboflow
  Universe) — 10,833 images (9,471 train / 684 valid / 678 test), licence
  CC BY 4.0. The `blunt object` class (~3 annotations) was dropped as
  unlearnable, leaving 8 classes
- **Classes:** Gunmen, Rifle, knife, knife_attacker, person, pistol,
  shot-gun, submachine-gun

### Test-split results (from the run's own `metrics.json`)

| Metric | Value |
|---|---|
| Precision | 0.763 |
| Recall | 0.738 |
| F1 | 0.750 |
| mAP@0.50 | 0.783 |
| mAP@0.50:0.95 | 0.542 |
| Inference latency (Colab GPU) | 20 ms |

| Class | Precision | Recall | AP50 | AP50-95 |
|---|---|---|---|---|
| Gunmen | 0.869 | 0.908 | 0.925 | 0.702 |
| Rifle | 0.743 | 0.782 | 0.809 | 0.532 |
| knife | 0.964 | 0.955 | 0.960 | 0.532 |
| knife_attacker | 0.946 | 0.939 | 0.967 | 0.884 |
| person | 0.874 | 0.788 | 0.858 | 0.631 |
| pistol | 0.899 | 0.774 | 0.850 | 0.453 |
| shot-gun | 0.812 | 0.757 | 0.854 | 0.584 |
| submachine-gun | 0.000 | 0.000 | 0.037 | 0.020 |

`submachine-gun` is the honest weak spot: it has only ~46 annotations in the
dataset, and its scores say so. This is stated in the UI and the Q&A prep
rather than hidden.

## 4. Wiring and verification (22 Oct 2026)

The Colab artefacts (`best.pt`, `metrics.json`) were:

1. **Validated** with `training/wire_checkpoint.py` — the checkpoint loads in
   Ultralytics, its 8 class names match `metrics.json` exactly, and the
   metrics satisfy the `/api/metrics` contract
2. **Wired in** — checkpoint to `models/best.pt` (served via `MODEL_PATH` in
   `backend/.env`; weights are gitignored by design), metrics to
   `training/evaluation/reports/metrics.json`
3. **Bug found and fixed:** `/api/metrics` passed the report's own
   `available` field twice when building its response, which made any real
   report unparseable. Fixed in `backend/app/api/routes.py`; the test suite
   now covers the wired state
4. **Re-verified end to end:**
   - 13/13 backend pytest pass
   - Live API: `/api/model-info` reports `best.pt` loaded with the 8 weapon
     classes; `/api/metrics` serves the real numbers above
   - Real photos through `POST /api/detect`: a street scene returned five
     correct `person` detections (confidences 0.90, 0.86, 0.79, 0.54, 0.26)
     with no false weapon alarms
   - Frontend production build passes; UI copy (Home, About, Model Info,
     limitation notices) updated to describe the trained detector instead of
     the old COCO baseline
5. **Committed locally** — all of the above is in the local git history and the working tree is clean

### One honest limitation, found in our own testing
On a photo of two men in suits (no weapons), the model labelled them
"Gunmen" and added a low-confidence "pistol" box. In the dataset, the Gunmen
class means an armed person, and it can fire on people alone. Demo guidance:
present at confidence 0.5 or higher, prefer clear test images, and mention
this limitation before an evaluator finds it — it is already written into
QA_PREP.md.

## 5. What remains

| Item | Owner | Notes |
|---|---|---|
| Push to GitHub | Team | All work committed locally, clean tree, no remote yet. Needs the GitHub App repository selection / authorisation completed, then `git remote add origin … && git push -u origin main` |
| Demo date | Team | Still unconfirmed; DEMO_DAY.md is written untimed until it is set |
| Manual UI smoke test | Anyone (2 min) | The automated browser check could not run in the build environment. Per the README: start backend + frontend, upload a photo on the Detect page, confirm real boxes render |
| Demo media | Satyam | 2–3 strong test images + one short clip; 3-minute backup screen recording |

## 6. How to run it

```bash
# Backend (from weapondetect/backend, venv active)
uvicorn app.main:app --host 127.0.0.1 --port 8000
# Frontend (from weapondetect/frontend)
npm run dev        # → http://localhost:5173
```

`backend/.env` already points `MODEL_PATH` at `models/best.pt` on this
machine. On a fresh clone, copy `.env.example` to `backend/.env` and set
`MODEL_PATH` to the checkpoint's path (see README, "Model weights").
