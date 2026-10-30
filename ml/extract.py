"""Measure every mix in a training folder and write one row of numbers per mix.

Audio stays where it is. Only the measurements (about 2 KB per mix) are written,
so the dataset fits in the repo. See docs/ml-plan.md.

Folder layout (the folder is the tier, the file name before " - " is the song):
    <root>/good/Song A - final.wav
    <root>/mid/Song B.wav
    <root>/bad/Song A - rough.wav
A tier prefix in the file name (GOOD_, MID_, BAD_) is ignored when naming the song.

Run from the repo root:
    engine/.venv/bin/python ml/extract.py "~/Music/Aria Training" ml/data/features.csv
"""
import csv
import hashlib
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from aria_engine import analysis  # noqa: E402  (same measurements as Mix check)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from detail import DETAIL_FIELDS, measure as measure_detail  # noqa: E402

TIERS = ("good", "mid", "bad")
AUDIO = {".wav", ".aif", ".aiff", ".flac", ".mp3"}   # mp3 via libsndfile 1.1+; m4a/aac is not readable and shows SKIPPED
LOSSY = {".mp3"}
EXCERPT_SEC = 60.0       # docs/ml-plan.md: the most important 30 to 90 s
WINDOW_SEC = 3.0         # short-term loudness window (EBU R128)

FIELDS = ["mix_id", "song", "label", "file", "file_format", "excerpt_start_sec", "excerpt_sec",
          "integrated_lufs", "true_peak_dbtp", "crest_db", "short_term_spread_lu",
          "bass_db", "mids_db", "treble_db", "bass_rel_db", "mids_rel_db", "treble_rel_db", "tilt_db",
          "width_bass", "width_mids", "width_treble", *DETAIL_FIELDS, "unmeasured"]
TIER_PREFIX = re.compile(r"^(good|mid|bad)[_\s-]+", re.IGNORECASE)


def loudest_excerpt(audio, rate):
    """Start of the loudest EXCERPT_SEC, by short-term loudness. Usually the drop or chorus."""
    n = int(EXCERPT_SEC * rate)
    if len(audio) <= n:
        return 0, audio
    meter, hop = pyloudnorm.Meter(rate, block_size=WINDOW_SEC), int(WINDOW_SEC * rate)
    starts = range(0, len(audio) - n + 1, hop)
    best = max(starts, key=lambda s: _safe_lufs(meter, audio[s:s + n]))
    return best / rate, audio[best:best + n]


def _safe_lufs(meter, x):
    v = meter.integrated_loudness(x)
    return v if np.isfinite(v) else -np.inf


def short_term_spread(audio, rate):
    """Spread of 3 s loudness across the excerpt, in LU (95th minus 10th percentile)."""
    meter, hop = pyloudnorm.Meter(rate, block_size=WINDOW_SEC), int(1.0 * rate)
    vals = [meter.integrated_loudness(audio[s:s + int(WINDOW_SEC * rate)])
            for s in range(0, len(audio) - int(WINDOW_SEC * rate) + 1, hop)]
    vals = [v for v in vals if np.isfinite(v)]
    return round(float(np.percentile(vals, 95) - np.percentile(vals, 10)), 1) if len(vals) >= 3 else None


def song_name(path):
    """The group a mix belongs to for the train/test split: the name before " - ".
    For "Song A - final" that's the song. For "Artist - Title" it's the artist, which keeps every
    track by one producer on the same side of the split (docs/ml-plan.md: split by song and producer).
    Underscores count as spaces, capitals are ignored, and the tier prefix (GOOD_, MID_, BAD_) is dropped first."""
    name = TIER_PREFIX.sub("", path.stem).replace("_", " ")
    return " ".join(name.split(" - ")[0].split()).lower()


def relative_bands(bands):
    """Each band's level minus the total of all three, in dB. None if any band is unmeasured."""
    if None in bands.values():
        return {k: None for k in bands}
    total = 10 * np.log10(sum(10 ** (v / 10) for v in bands.values()))
    return {k: round(float(v - total), 1) for k, v in bands.items()}


def row_for(path, label, root):
    audio, rate = sf.read(path, always_2d=True, dtype="float64")
    start, excerpt = loudest_excerpt(audio, rate)
    m = analysis.measure_array(excerpt, rate)  # from memory, no audio is written anywhere
    rms = np.sqrt(np.mean(excerpt ** 2))
    bands = m["bands_db"]
    rel_bands = relative_bands(bands)
    rel = path.relative_to(root)
    return {
        "mix_id": hashlib.sha1(str(rel).encode()).hexdigest()[:10],
        "song": song_name(path),
        "label": label,
        "file": str(rel),
        "file_format": path.suffix.lower().lstrip("."),   # mp3 is lossy: check it doesn't predict the tier
        "excerpt_start_sec": round(start, 1),
        "excerpt_sec": round(len(excerpt) / rate, 1),
        "integrated_lufs": m["integrated_lufs"],
        "true_peak_dbtp": m["true_peak_dbtp"],
        "crest_db": round(float(20 * np.log10(np.max(np.abs(excerpt)) / rms)), 1) if rms > 0 else None,
        "short_term_spread_lu": short_term_spread(excerpt, rate),
        "bass_db": bands["bass"], "mids_db": bands["mids"], "treble_db": bands["treble"],
        "bass_rel_db": rel_bands["bass"], "mids_rel_db": rel_bands["mids"], "treble_rel_db": rel_bands["treble"],
        "tilt_db": round(bands["treble"] - bands["bass"], 1) if None not in (bands["bass"], bands["treble"]) else None,
        "width_bass": m["width"]["bass"], "width_mids": m["width"]["mids"], "width_treble": m["width"]["treble"],
        **measure_detail(audio, rate, excerpt),
        "unmeasured": "; ".join(f"{k}: {v}" for k, v in m["unmeasured"].items()),
    }


def song_overrides(out):
    """Optional ml/data/song_groups.csv (file, song, why): fixes for names the rule above gets wrong,
    for example "Title - Artist" or one producer spelled two ways. Matched by file name."""
    path = Path(out).parent / "song_groups.csv"
    if not path.exists():
        return {}
    with open(path, newline="") as f:
        return {r["file"].strip(): r["song"].strip().lower() for r in csv.DictReader(f)}


def excluded(out):
    """Optional ml/data/excluded.csv (file, why): files left out on purpose, such as exact duplicates."""
    path = Path(out).parent / "excluded.csv"
    if not path.exists():
        return {}
    with open(path, newline="") as f:
        return {r["file"].strip(): r["why"].strip() for r in csv.DictReader(f)}


def main(root, out):
    root = Path(root).expanduser().resolve()
    folders = {d.name.lower(): d for d in root.iterdir() if d.is_dir()}
    files = [(p, label) for label in TIERS if label in folders
             for p in sorted(folders[label].rglob("*")) if p.is_file() and p.suffix.lower() in AUDIO]
    others = [p.name for label in TIERS if label in folders for p in folders[label].rglob("*")
              if p.is_file() and p.suffix.lower() not in AUDIO and not p.name.startswith(".")]
    for name in others:
        print(f"SKIPPED {name}: not a format the script reads (convert it to WAV)")
    others = []  # reported above
    if not files:
        sys.exit(f"No audio found in {root}/good, {root}/mid or {root}/bad")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    overrides, skip = song_overrides(out), excluded(out)
    for path, _ in files:
        if path.name in skip:
            print(f"LEFT OUT {path.name}: {skip[path.name]}")
    files = [(p, label) for p, label in files if p.name not in skip]
    workers = max(1, min(4, os.cpu_count() or 1))
    with open(out, "w", newline="") as f, ProcessPoolExecutor(workers) as pool:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        jobs = [pool.submit(row_for, path, label, root) for path, label in files]
        for i, ((path, label), job) in enumerate(zip(files, jobs), 1):
            try:
                row = job.result()
                row["song"] = overrides.get(path.name, row["song"])
                w.writerow(row)
                print(f"[{i}/{len(files)}] {label:4} {path.name}", flush=True)
            except Exception as e:  # one unreadable file shouldn't stop the batch
                print(f"[{i}/{len(files)}] SKIPPED {path.name}: {e}", flush=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
