"""Shared by ml/train.py and ml/muse_rater.py: the tiers, the basic measurements, minimum data checks
and the song-grouped split (muse_rater.py uses the same split as the first of train.py's repeats).

Three tiers, in order (docs/ml-plan.md, decided Oct 28): bad < mid < good.
"""
import csv
import sys
from collections import Counter

# Band levels are relative to the whole excerpt (band minus total, in dB), so they describe the
# balance of the mix and not how loud it is. Loudness has its own feature. The absolute band
# levels stay in features.csv for Mix check, but the models don't use them.
FEATURES = ["integrated_lufs", "true_peak_dbtp", "crest_db", "short_term_spread_lu",
            "bass_rel_db", "mids_rel_db", "treble_rel_db", "tilt_db",
            "width_bass", "width_mids", "width_treble"]
TIERS = ("bad", "mid", "good")   # ordered: index 0 is worst
LABELS = TIERS                   # older name, kept so nothing else breaks
MIN_MIXES = 30                   # below this, held-out numbers for 3 tiers mean nothing
MIN_SONGS_PER_TIER = 5


def tier_index(label):
    return TIERS.index(label)


def load(path):
    """Rows with every feature measured. Rows with gaps are dropped and counted, never filled in."""
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    usable, dropped = [], 0
    for r in rows:
        try:
            r["x"] = [float(r[k]) for k in FEATURES]
        except (ValueError, KeyError, TypeError):
            dropped += 1
            continue
        if r.get("label") in TIERS:
            usable.append(r)
    return usable, dropped


def check_enough(rows):
    counts = Counter(r["label"] for r in rows)
    songs = {t: len({r["song"] for r in rows if r["label"] == t}) for t in TIERS}
    problems = []
    if len(rows) < MIN_MIXES:
        problems.append(f"only {len(rows)} usable mixes (need at least {MIN_MIXES})")
    for t in TIERS:
        if songs[t] < MIN_SONGS_PER_TIER:
            problems.append(f"only {songs[t]} songs rated {t} (need at least {MIN_SONGS_PER_TIER})")
    if problems:
        sys.exit("Not enough data to train honestly: " + "; ".join(problems) + ".")
    return counts, songs


def song_folds(rows, k=5):
    """Split by song so no song is in both training and testing.
    Otherwise the model learns the song, not the mix. Each fold keeps roughly the same mix of
    tiers as the whole dataset, so no fold tests on only one tier."""
    from sklearn.model_selection import StratifiedGroupKFold
    groups = [r["song"] for r in rows]
    y = [tier_index(r["label"]) for r in rows]
    k = min(k, len(set(groups)))
    return list(StratifiedGroupKFold(n_splits=k, shuffle=True, random_state=0).split(rows, y, groups=groups))
