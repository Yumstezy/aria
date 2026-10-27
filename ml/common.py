"""Shared by ml/train.py and ml/muse_rater.py: load features and split them honestly."""
import csv
import sys
from collections import Counter

FEATURES = ["integrated_lufs", "true_peak_dbtp", "crest_db", "short_term_spread_lu",
            "bass_db", "mids_db", "treble_db", "tilt_db", "width_bass", "width_mids", "width_treble"]
LABELS = ("good", "needs-work")
MIN_MIXES = 20           # below this, held-out numbers mean nothing
MIN_SONGS_PER_LABEL = 3


def load(path):
    """Rows with every feature measured. Rows with gaps are dropped and counted, never filled in."""
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    usable, dropped = [], 0
    for r in rows:
        try:
            r["x"] = [float(r[k]) for k in FEATURES]
        except (ValueError, KeyError):
            dropped += 1
            continue
        if r["label"] in LABELS:
            usable.append(r)
    return usable, dropped


def check_enough(rows):
    counts = Counter(r["label"] for r in rows)
    songs = {lab: len({r["song"] for r in rows if r["label"] == lab}) for lab in LABELS}
    problems = []
    if len(rows) < MIN_MIXES:
        problems.append(f"only {len(rows)} usable mixes (need at least {MIN_MIXES})")
    for lab in LABELS:
        if songs[lab] < MIN_SONGS_PER_LABEL:
            problems.append(f"only {songs[lab]} songs labeled {lab} (need at least {MIN_SONGS_PER_LABEL})")
    if problems:
        sys.exit("Not enough data to train honestly: " + "; ".join(problems) + ".")
    return counts, songs


def song_folds(rows, k=5):
    """Split by song so no song is in both training and testing.
    Otherwise the model learns the song, not the mix."""
    from sklearn.model_selection import GroupKFold
    groups = [r["song"] for r in rows]
    k = min(k, len(set(groups)))
    return list(GroupKFold(n_splits=k).split(rows, groups=groups))
