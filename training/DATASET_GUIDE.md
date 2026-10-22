# Dataset Guide

Weapon detection needs a **labeled, suitably licensed** dataset. The
repository ships with none — `training/validate_dataset.py` will reject an
empty/missing dataset, and `train.py` refuses to train until validation
passes.

## Where to get data

- **Roboflow Universe** hosts several public weapon-detection datasets
  (search "weapon detection", "gun detection", "knife detection").
  **Check the license on each dataset page before downloading** — many are
  research/educational use only and may not permit redistribution.
- Academic sets (e.g. versions of the "GDXray" or "SIXray" families) have
  their own access terms; request access through the official channels.

Do **not** scrape images from search engines or social media for training —
licensing is unclear and annotation quality is poor.

## Expected layout (YOLO format)

```
datasets/weapon/
  train/images/img_0001.jpg
  train/labels/img_0001.txt
  val/images/...
  val/labels/...
  test/images/...     # held out, touched only by evaluate.py
  test/labels/...
```

Each label file: one line per object

```
<class_id> <x_center> <y_center> <width> <height>
```

with coordinates **normalized to [0,1]** relative to image size.

## Class list guidance

Keep the class list small and unambiguous, e.g. `firearm`, `knife`.
Avoid overlapping labels ("gun" vs "pistol" as separate classes) unless
you have enough examples of each. Aim for **hundreds of instances per
class minimum**; heavily imbalanced classes will bias the detector.

## Workflow

1. Place the dataset under `datasets/` (gitignored) and write your own
   `data.yaml` (copy `training/data.yaml`).
2. `python training/validate_dataset.py --data <your-data.yaml>` — fix all errors.
3. `python training/train.py --config training/config.yaml` (set `data:` first).
4. `python training/evaluate.py --weights models/best.pt --data <your-data.yaml>`.
5. Point `MODEL_PATH` at `models/best.pt` to serve the trained model.

## Notes

- `datasets/` and `models/*.pt` are gitignored — never commit data or weights.
- Near-duplicate images across splits leak and inflate metrics; the
  validator warns on filename collisions.
- Training on CPU is very slow; use a GPU machine (e.g. Colab) for real runs.
