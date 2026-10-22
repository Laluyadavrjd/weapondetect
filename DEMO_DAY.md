# Demo Day — Run-of-Show & Readiness Checklist

Target slot: **12–15 minutes**. Demo date: **TBD** — untimed until confirmed.

## Run-of-show

1. **The problem (2 min)**
   Frame as a live vision analytics console, not a classifier script.
   Why weapon detection on camera feeds matters.
2. **Live demo (5 min)**
   - Detect page: upload a photo, show real bounding boxes + confidence table, download the annotated image.
   - Video page: short clip → annotated mp4.
   - Move the confidence slider live to show filtering in real time.
3. **Analytics (2 min)**
   Training is done — quote the real `metrics.json` numbers: precision 0.763,
   recall 0.738, F1 0.750, mAP50 0.783, mAP50-95 0.542. Be upfront that
   submachine-gun is weak (AP50 0.037, ~46 training annotations).
4. **Model story (1–2 min)**
   The custom model is trained and served by default: yolov8n fine-tuned on
   Colab T4 with Roboflow dataset v8 (weapon-detect-qbsiw/yolo-weapon-detection,
   10,833 images, YOLOv8 format, CC BY 4.0), 8 classes. The COCO baseline
   (knows `knife`, not firearms) remains the documented fallback via
   `MODEL_PATH=yolov8n`.
5. **Architecture (2 min)**
   - Anjali: backend API + model connection
   - Satyam: frontend upload + results display
   - Krishnanand: detection pipeline
   - All: integration and testing

## Readiness checklist

- [x] Training output wired: `best.pt` + `metrics.json` in place, re-verified (done 2026-10-22 — validated, 13/13 tests, live API checked)
- [ ] 2-minute smoke test per README: start backend and frontend, upload a photo, confirm real boxes render
- [ ] Demo media: 2–3 test images + one short clip (Satyam)
- [ ] Honest fallback locked: baseline demo with the UI disclaimers if training isn't done — no fabricated results
- [ ] Backup: 3-minute screen recording in case of network hiccups (Satyam)
- [ ] Repo pushed with the link ready for evaluators
- [x] Q&A prep from real artefacts only (QA_PREP.md — updated 2026-10-22 with the real metrics)

## Honesty standard (non-negotiable)

Only real, tested, verified results. No fake detections, no simulated predictions,
no invented metrics or charts. Never claim a feature works until it has been tested.
