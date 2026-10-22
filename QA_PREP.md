# Demo Q&A Prep — weapondetect

Status note (2026-10-22): custom training is **done**. The Colab run
finished, `best.pt` + `metrics.json` were validated with
`training/wire_checkpoint.py`, wired in, and the full app was
re-verified live (13/13 pytest, real detections from the trained
model). Answers below carry the real numbers.

Every answer is grounded in something testable in this repo — nothing is
invented. If you don't know, say so plainly.

## Model & training

**Q: Why YOLOv8n instead of a bigger model?**
A: YOLOv8n is the smallest, fastest member of the YOLOv8 family —
real-time friendly on a Colab T4 and on modest demo hardware. It's the
baseline; the Colab notebook has a documented upgrade path to `yolov8s`
for higher accuracy if we have the time budget. Tradeoff is deliberate:
speed for a live demo, with the door open to swap in a stronger
checkpoint via `MODEL_PATH`.

**Q: What does the model detect right now (today)?**
A: The custom-trained checkpoint (`models/best.pt`, yolov8n fine-tuned
by us) with 8 classes: Gunmen, Rifle, knife, knife_attacker, person,
pistol, shot-gun, submachine-gun. The COCO baseline (`yolov8n`) is
still available by setting `MODEL_PATH=yolov8n`, but the default
setup now serves the trained weapon model.

**Q: What data was the custom model trained on?**
A: *Yolo Weapon Detection* v8 by `weapon-detect-qbsiw` (Roboflow
Universe) — 10,833 images in YOLOv8 format (9471 train / 684 valid /
678 test), 9 raw classes, licence **CC BY 4.0** (attribution required —
credit *"Yolo Weapon Detection" by weapon-detect-qbsiw, Roboflow
Universe* in the README/About page).

**Q: How do you handle weak/rare classes?**
A: Honestly, not hidden. The notebook drops `blunt object` (~3
annotations — unlearnable) by name, remaps the rest, and flags that
`submachine-gun` is rare (~46 annotations) so we expect weaker scores
there. The final metrics report documents this instead of burying it.

**Q: How is the model actually trained?**
A: `training/colab/WeaponDetect_Training.ipynb`: GPU check → pip
install → Roboflow download (pinned v8) → dataset validation (image↔
label correspondence, class-id range, box normalization) → class
cleaning → 50 epochs of yolov8n (imgsz 640, batch 16, patience 15,
seed 42) → test-split evaluation → `best.pt` + `metrics.json`. A
Drive-mirror guard protects the run from Colab disconnects.

## Metrics & honesty

**Q: What are your accuracy numbers?**
A: From the held-out test split (678 images), written by the training
run to `training/evaluation/reports/metrics.json` and rendered
directly by the Analytics page: **precision 0.763, recall 0.738,
F1 0.750, mAP@0.50 0.783, mAP@0.50:0.95 0.542**. Strongest classes:
knife_attacker (AP50 0.967), knife (0.960), Gunmen (0.925). Weakest:
submachine-gun (AP50 0.037) — it has only ~46 annotations in the
dataset, and we say so rather than hiding it. Inference latency in
the report is 20 ms on the Colab GPU; the Detect page also shows the
real per-request latency on this machine.

**Q: What does the Analytics page show right now?**
A: Whatever `GET /api/metrics` returns — real numbers once the custom
model is wired, and no invented placeholders before that.

**Q: How do you prevent overclaiming detections?**
A: The Detect page exposes a live confidence slider, and every
`POST /api/detect` response includes per-box confidence plus
`inference_ms`. The honesty standard is written into the repo
(DEMO_DAY.md): no fake detections, no simulated predictions, no
invented metrics or charts — never claim a feature works until tested.

**Q: Does it ever get things wrong?**
A: Yes, and we can show it. In our own live test, a photo of two men
in suits was labelled "Gunmen" — in the dataset that class means an
armed person, and the model sometimes fires it on people alone. The
mitigations are the confidence threshold (demo at 0.5+), the per-class
scores in the report, and saying this limitation out loud instead of
cherry-picking only flattering examples.

## Architecture & engineering

**Q: Walk me through the system.**
A: React frontend (Detect / Video / Analytics pages) → FastAPI backend
with a real YOLOv8 inference service (`POST /api/detect`,
`POST /api/detect-video`, `GET /api/model-info`, `GET /api/metrics`,
`GET /api/videos/{job_id}`). Annotated images come back as base64
data-URLs; video returns an annotated mp4. Team split: Anjali — backend
API + model connection; Satyam — frontend upload + results display;
Krishnanand — detection pipeline; all of us on integration and testing.

**Q: How do you swap in the trained model?**
A: Already done for this checkpoint (2026-10-22). The repeatable
procedure: validate the pair with `training/wire_checkpoint.py`
(checks the checkpoint loads, its classes match `metrics.json`
exactly, and the metrics satisfy the `/api/metrics` contract), let
it copy `best.pt` to `models/` (gitignored — weights never get
committed) and `metrics.json` to
`training/evaluation/reports/metrics.json`, set `MODEL_PATH` in
`backend/.env`, restart the backend. `GET /api/model-info` then
reports the real weapon classes and the Analytics dashboard renders
the real evaluation numbers.

**Q: What testing did you actually do?**
A: 13/13 backend pytest pass (including a test that now asserts the
real evaluation numbers are served). After wiring the trained model
we re-ran the live API end to end: `/api/model-info` reports
`best.pt` loaded with the 8 weapon classes, `/api/metrics` serves
the real report, and real photos through `POST /api/detect` return
genuine detections (five `person` boxes on a street scene; the
"Gunmen" false positive above). Video endpoint and error paths were
tested during the build; frontend builds clean. The automated
browser click-through couldn't run in our environment — the
two-minute manual UI check from the README is the verified path on
the demo machine instead.

**Q: What happens when uploads break or the network drops?**
A: Uploads have enforced limits (image formats/size, video format/
size/duration) with real error paths, tested. For demo-day safety:
2–3 test images + one short clip prepared in advance, a pre-recorded
3-minute screen capture as backup, and the honest baseline fallback
locked — baseline demo with the UI disclaimers, no fabricated results.

## Training completion — status (2026-10-22)

Done and verified. The answers above were updated from the real
files:

- `GET /api/model-info` → `best.pt` loaded, 8 weapon classes
- `training/evaluation/reports/metrics.json` → P 0.763 / R 0.738 /
  F1 0.750 / mAP50 0.783 / mAP50-95 0.542, per-class AP in the file
- Latency: 20 ms `inference_latency_ms` from the Colab run; live
  per-request `inference_ms` is shown on the Detect page
