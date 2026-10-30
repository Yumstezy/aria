"""Meta's Audiobox Aesthetics scores for every rated mix (Oct 30, Ian: "can we try the audio box").

Usage:  engine/.venv/bin/python ml/aesthetics.py <folder with good/ mid/ bad/ subfolders> ml/data/aesthetics.csv

Audiobox Aesthetics (facebookresearch/audiobox-aesthetics, CC-BY 4.0) is a model Meta trained on a large amount of
rated audio. It scores audio on four axes: Production Quality (PQ), Production Complexity (PC), Content Enjoyment (CE)
and Content Usefulness (CU). Each mix is scored on the same loudest 60 s that extract.py measures, so the scores sit
beside the other measurements. Numbers only; no audio is saved.

Audio is read with soundfile and handed over as a tensor, because the package's own reader needs torchcodec.
About half a second per minute of audio on a Mac's CPU.
"""
import csv
import sys
from pathlib import Path

import soundfile as sf
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import TIERS  # noqa: E402
from extract import AUDIO, excluded, loudest_excerpt  # noqa: E402

AXES = ["PQ", "PC", "CE", "CU"]


def main(root, out):
    from audiobox_aesthetics.infer import initialize_predictor
    root = Path(root).expanduser().resolve()
    folders = {d.name.lower(): d for d in root.iterdir() if d.is_dir()}
    skip = excluded(out)
    files = [(p, t) for t in TIERS if t in folders for p in sorted(folders[t].rglob("*"))
             if p.is_file() and p.suffix.lower() in AUDIO and p.name not in skip]
    if not files:
        sys.exit(f"No audio found in {root}/good, {root}/mid or {root}/bad")
    predictor = initialize_predictor()
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "label", *[f"abx_{a.lower()}" for a in AXES]])
        for i, (path, tier) in enumerate(files, 1):
            try:
                audio, rate = sf.read(str(path), always_2d=True, dtype="float32")
                _, excerpt = loudest_excerpt(audio, rate)
                score = predictor.forward([{"path": torch.from_numpy(excerpt.T.copy()), "sample_rate": rate}])[0]
                w.writerow([path.name, tier, *[round(float(score[a]), 3) for a in AXES]])
                print(f"[{i}/{len(files)}] {tier:4} PQ {score['PQ']:.2f}  {path.name}", flush=True)
            except Exception as e:  # one unreadable file shouldn't stop the batch
                print(f"[{i}/{len(files)}] SKIPPED {path.name}: {e}", flush=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
