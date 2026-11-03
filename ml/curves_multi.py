"""Each rated mix's EQ curve on its 6 loudest 20-second stretches (Nov 3, for experiments/search80b.py).

Usage:  engine/.venv/bin/python ml/curves_multi.py <folder with good/ mid/ bad/ subfolders> ml/data/curves_multi.csv

curves.py measures one loudest 60 s per mix. One stretch can be unrepresentative, so this measures several: the 6
loudest non-overlapping 20 s stretches (usually the drops and choruses), skipping any more than 10 LU quieter than
the loudest. Each is measured exactly like curves.py (engine/aria_engine/reference.py _spectrum and _levels), on the
same twelfth-octave grid, in dB against the stretch's own loudness. Numbers only; no audio is saved.
"""
import csv
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from aria_engine import reference  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import TIERS  # noqa: E402
from extract import AUDIO, excluded  # noqa: E402

CLIP_SEC, CLIPS, MAX_DROP_LU = 20.0, 6, 10.0
HZ = [int(round(c)) for c in reference.FINE]


def clips_for(path):
    audio, rate = sf.read(str(path), always_2d=True, dtype="float64")
    n = int(CLIP_SEC * rate)
    meter = pyloudnorm.Meter(rate)
    starts = list(range(0, max(1, len(audio) - n + 1), int(rate * 2)))     # candidate starts every 2 s
    loud = []
    for s in starts:
        v = meter.integrated_loudness(audio[s:s + n])
        loud.append(v if np.isfinite(v) else -np.inf)
    order = np.argsort(loud)[::-1]
    picked = []
    for i in order:
        if len(picked) == CLIPS or loud[i] < loud[order[0]] - MAX_DROP_LU:
            break
        if all(abs(starts[i] - starts[j]) >= n for j in picked):
            picked.append(i)
    out = []
    for k, i in enumerate(sorted(picked, key=lambda j: starts[j])):
        spec = reference._spectrum(audio[starts[i]:starts[i] + n], rate)
        if spec is not None:
            out.append((k, starts[i] / rate, reference._levels(spec, reference.FINE, 12, rate)))
    return out


def main(root, out):
    root = Path(root).expanduser().resolve()
    folders = {d.name.lower(): d for d in root.iterdir() if d.is_dir()}
    skip = excluded(out)
    files = [(p, t) for t in TIERS if t in folders for p in sorted(folders[t].rglob("*"))
             if p.is_file() and p.suffix.lower() in AUDIO and p.name not in skip]
    if not files:
        sys.exit(f"No audio found in {root}/good, {root}/mid or {root}/bad")
    with open(out, "w", newline="", encoding="utf-8") as f, ProcessPoolExecutor(max(1, min(4, os.cpu_count() or 1))) as pool:
        w = csv.writer(f)
        w.writerow(["file", "label", "clip", "start_sec", *[f"hz_{h}" for h in HZ]])
        jobs = [pool.submit(clips_for, p) for p, _ in files]
        for i, ((path, tier), job) in enumerate(zip(files, jobs), 1):
            try:
                clips = job.result()
                for k, start, c in clips:
                    w.writerow([path.name, tier, k, round(start, 1),
                                *["" if not np.isfinite(v) else round(float(v), 2) for v in c]])
                print(f"[{i}/{len(files)}] {tier:4} {len(clips)} clips  {path.name}", flush=True)
            except Exception as e:  # one unreadable file shouldn't stop the batch
                print(f"[{i}/{len(files)}] SKIPPED {path.name}: {e}", flush=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
