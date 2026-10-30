"""Each rated mix's EQ curve, for Aria's "typical good mix" comparison (Ian, Oct 30: "we just want to look at the EQ of
everything").

Usage:  engine/.venv/bin/python ml/curves.py <folder with good/ mid/ bad/ subfolders> ml/data/curves.csv

For each mix: its loudest 60 s (the same excerpt extract.py measures, usually the drop), then the level of every
twelfth octave from 31.5 Hz to 16 kHz against the mix's own loudness, so loudness drops out and only the EQ shape is
left. The same measurement as a reference song in Mix check (engine/aria_engine/reference.py), so a mix and the good
mixes compare like with like. Numbers only, about 1 KB a mix; no audio is saved.
"""
import csv
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from aria_engine import reference  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import TIERS  # noqa: E402
from extract import AUDIO, excluded, loudest_excerpt, song_name  # noqa: E402

HZ = [int(round(c)) for c in reference.FINE]


def curve_for(path):
    audio, rate = sf.read(str(path), always_2d=True, dtype="float64")
    _, excerpt = loudest_excerpt(audio, rate)
    spec = reference._spectrum(excerpt, rate)
    if spec is None:
        return None
    return reference._levels(spec, reference.FINE, 12, rate)


def main(root, out):
    root = Path(root).expanduser().resolve()
    folders = {d.name.lower(): d for d in root.iterdir() if d.is_dir()}
    skip = excluded(out)
    files = [(p, t) for t in TIERS if t in folders for p in sorted(folders[t].rglob("*"))
             if p.is_file() and p.suffix.lower() in AUDIO and p.name not in skip]
    if not files:
        sys.exit(f"No audio found in {root}/good, {root}/mid or {root}/bad")
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "label", "song", *[f"hz_{h}" for h in HZ]])
        for i, (path, tier) in enumerate(files, 1):
            try:
                c = curve_for(path)
                if c is None:
                    print(f"[{i}/{len(files)}] SKIPPED {path.name}: silent", flush=True)
                    continue
                w.writerow([path.name, tier, song_name(path), *["" if not np.isfinite(v) else round(float(v), 2) for v in c]])
                print(f"[{i}/{len(files)}] {tier:4} {path.name}", flush=True)
            except Exception as e:  # one unreadable file shouldn't stop the batch
                print(f"[{i}/{len(files)}] SKIPPED {path.name}: {e}", flush=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
