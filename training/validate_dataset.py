"""Validate a YOLO-format dataset before training.

Checks:
- data.yaml parses and names/classes match
- images/ and labels/ correspondence (missing / orphan files)
- label files parse: class ids in range, boxes normalized to [0,1], nonzero area
- near-duplicate filename warnings (possible leakage across splits)

Usage:
    python training/validate_dataset.py --data training/data.yaml
Returns exit 0 if valid, 2 if problems found. Also importable:
    from validate_dataset import validate_dataset  # -> (ok: bool, summary: str)
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from pathlib import Path

import yaml

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _read_data_yaml(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f) or {}


def _split_dirs(cfg: dict, root: Path) -> dict[str, Path]:
    out = {}
    for split in ("train", "val", "test"):
        rel = cfg.get(split)
        if rel:
            out[split] = (root / rel) if not Path(rel).is_absolute() else Path(rel)
    return out


def _label_files(image_dir: Path) -> dict[str, Path]:
    """Map image stem -> image path for images under image_dir."""
    mapping = {}
    for p in sorted(image_dir.rglob("*")):
        if p.suffix.lower() in IMG_EXTS:
            mapping.setdefault(p.stem, p)
    return mapping


def validate_dataset(data_yaml: str | Path) -> tuple[bool, str]:
    data_yaml = Path(data_yaml)
    lines: list[str] = []
    problems: list[str] = []
    warnings: list[str] = []

    if not data_yaml.exists():
        return False, f"data.yaml not found: {data_yaml}"

    cfg = _read_data_yaml(data_yaml)
    names = cfg.get("names")
    nc = cfg.get("nc")
    if isinstance(names, dict):
        names = [names[i] for i in sorted(names)]
    if not names or not nc:
        problems.append("data.yaml must define 'nc' and 'names'.")
    elif len(names) != nc:
        problems.append(f"nc={nc} but {len(names)} names listed.")

    root = data_yaml.parent
    split_dirs = _split_dirs(cfg, root)
    if "train" not in split_dirs:
        problems.append("data.yaml must define a 'train' image directory.")
    if "val" not in split_dirs:
        warnings.append("No 'val' split defined — validation metrics will be unavailable.")

    stem_owners: dict[str, list[str]] = defaultdict(list)
    per_split_counts: dict[str, Counter] = {}
    total_images = 0
    total_labels = 0

    for split, img_dir in split_dirs.items():
        if not img_dir.exists():
            problems.append(f"{split}: image dir not found: {img_dir}")
            continue
        label_dir = img_dir.parent / "labels" / img_dir.name if (img_dir.parent / "labels").exists() else None
        # Standard YOLO layout: <split>/images and <split>/labels are siblings
        images = _label_files(img_dir)
        labels_dir = img_dir.parent / "labels"
        per_split_counts[split] = Counter()
        for stem, img_path in images.items():
            stem_owners[stem].append(split)
            total_images += 1
            label_path = (labels_dir / f"{stem}.txt") if labels_dir.exists() else None
            if label_path is None or not label_path.exists():
                problems.append(f"{split}: missing label for {img_path.name}")
                continue
            total_labels += 1
            for ln, raw in enumerate(label_path.read_text().splitlines(), 1):
                raw = raw.strip()
                if not raw:
                    continue
                parts = raw.split()
                if len(parts) != 5:
                    problems.append(f"{split}:{label_path.name}:{ln}: expected 5 fields, got {len(parts)}")
                    continue
                try:
                    cid = int(float(parts[0]))
                    xc, yc, w, h = (float(x) for x in parts[1:])
                except ValueError:
                    problems.append(f"{split}:{label_path.name}:{ln}: non-numeric values")
                    continue
                if nc and not (0 <= cid < nc):
                    problems.append(
                        f"{split}:{label_path.name}:{ln}: class id {cid} out of range [0, {nc})"
                    )
                    continue
                if not all(0.0 <= v <= 1.0 for v in (xc, yc, w, h)):
                    problems.append(
                        f"{split}:{label_path.name}:{ln}: box coords not normalized to [0,1]: "
                        f"{xc:.3f} {yc:.3f} {w:.3f} {h:.3f}"
                    )
                    continue
                if w <= 0 or h <= 0:
                    problems.append(f"{split}:{label_path.name}:{ln}: zero-area box")
                    continue
                per_split_counts[split][cid] += 1

        # Orphan labels (label file with no image)
        if labels_dir.exists():
            for lp in labels_dir.glob("*.txt"):
                if lp.stem not in images:
                    warnings.append(f"{split}: orphan label with no image: {lp.name}")

    duplicates = {s: o for s, o in stem_owners.items() if len(o) > 1}
    if duplicates:
        warnings.append(
            f"{len(duplicates)} near-duplicate filenames appear in multiple splits "
            "(possible data leakage, e.g. " + ", ".join(list(duplicates)[:3]) + ")"
        )

    lines.append(f"Dataset: {data_yaml}")
    lines.append(f"Classes ({nc}): {names}")
    lines.append(f"Images: {total_images}, labeled: {total_labels}")
    for split, counts in per_split_counts.items():
        dist = ", ".join(f"{names[c] if names and c < len(names) else c}:{n}" for c, n in sorted(counts.items()))
        lines.append(f"  {split}: {sum(counts.values())} boxes [{dist or 'none'}]")
    if warnings:
        lines.append("WARNINGS:")
        lines.extend(f"  - {w}" for w in warnings)
    if problems:
        lines.append(f"ERRORS ({len(problems)}):")
        lines.extend(f"  - {p}" for p in problems[:50])
        if len(problems) > 50:
            lines.append(f"  ... and {len(problems) - 50} more")

    ok = not problems
    lines.append("RESULT: VALID" if ok else "RESULT: INVALID")
    return ok, "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate a YOLO dataset")
    ap.add_argument("--data", required=True, help="path to data.yaml")
    args = ap.parse_args()
    ok, summary = validate_dataset(args.data)
    print(summary)
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
