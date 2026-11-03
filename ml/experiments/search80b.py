"""Side experiment (planned Nov 3, before running; Raghav): more of each song, and the mid mixes, for good vs bad.

The plan is in ml/README.md ("More of each song, plus Audiobox"). Eight candidates are
compared inside a nested test, so trying eight can't inflate the headline. Second search on the same 63 good and bad
mixes; reported whatever it shows. Never touches data/shape-model.json.

Details fixed with the plan:
  - Mid mixes train as half good, half bad (two rows, weight 0.5 each); never scored. A mid mix whose song/producer
    group is in the held-out fold is left out of that round's training.
  - Every-clip candidates: each clip a row, weighted so every song counts once in total; a song's prediction is the
    average of its clips' chances of good.

Run from the repo root:
    engine/.venv/bin/python ml/experiments/search80b.py ml/data/curves.csv ml/data/curves_multi.csv \
        ml/data/features.csv ml/data/aesthetics.csv
Writes ml/results/search80b-experiment.md.
"""
import csv
import sys
import warnings
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shape as S  # noqa: E402

warnings.filterwarnings("ignore")
ML = Path(__file__).resolve().parent.parent
SHAPE = S.SETS["both"]
ABX = ["abx_pq", "abx_pc", "abx_ce", "abx_cu"]
REPEATS, SHUFFLES, SHUFFLE_REPEATS = 10, 100, 2

# name: (features, use clips as rows, use mids, words)
CANDS = {
    "A single clip": ("single", False, False, "the current shape model"),
    "B clips averaged": ("mean", False, False, "shape averaged over 6 clips"),
    "C every clip": ("clips", True, False, "each clip a training row"),
    "D single clip + mids": ("single", False, True, "A, with mid mixes in training"),
    "E clips averaged + mids": ("mean", False, True, "B, with mid mixes in training"),
    "F every clip + mids": ("clips", True, True, "C, with mid mixes in training"),
    "G E + loudness": ("mean+lufs", False, True, "E plus loudness"),
    "H E + loudness + Audiobox": ("mean+lufs+abx", False, True, "E plus loudness and Audiobox"),
}


def curves(path):
    out = defaultdict(list)
    for r in csv.DictReader(open(path, encoding="utf-8")):
        hz = [k for k in r if k.startswith("hz_")]
        c = np.array([float(r[k]) if r[k] != "" else np.nan for k in hz])
        if len(c) == len(S.CENTRES) and not np.isnan(c).any():
            out[r["file"]].append(np.array([S.shape_features(c)[f] for f in SHAPE]))
    return out


def model():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=5000))


class Data:
    def __init__(self, curves_csv, multi_csv, features_csv, abx_csv):
        feats = {Path(r["file"]).name: r for r in csv.DictReader(open(features_csv, encoding="utf-8"))}
        abx = {r["file"]: r for r in csv.DictReader(open(abx_csv, encoding="utf-8"))}
        single, multi = curves(curves_csv), curves(multi_csv)
        labels = {r["file"]: r["label"] for r in csv.DictReader(open(curves_csv, encoding="utf-8"))}
        self.files = [f for f in labels if f in single and f in multi and f in feats and f in abx]
        self.label = np.array([labels[f] for f in self.files])
        self.group = np.array([feats[f]["song"] for f in self.files])
        lufs = np.array([[float(feats[f]["integrated_lufs"])] for f in self.files])
        ab = np.array([[float(abx[f][a]) for a in ABX] for f in self.files])
        mean = np.array([np.mean(multi[f], axis=0) for f in self.files])
        self.X = {"single": np.array([single[f][0] for f in self.files]), "mean": mean,
                  "mean+lufs": np.hstack([mean, lufs]), "mean+lufs+abx": np.hstack([mean, lufs, ab])}
        self.clips = [np.array(multi[f]) for f in self.files]
        self.gb = np.where(self.label != "mid")[0]
        self.mid = np.where(self.label == "mid")[0]
        self.y_true = (self.label == "good").astype(float)   # for good/bad songs


def fit_predict(d, cand, train_songs, test_songs, target):
    """target: per song index, 1 good, 0 bad, 0.5 mid. Returns predicted 0/1 for test_songs."""
    feat, by_clip, _, _ = CANDS[cand]
    Xs, ys, ws = [], [], []
    for i in train_songs:
        rows = d.clips[i] if by_clip else d.X[feat][i][None, :]
        w = 1.0 / len(rows)
        for lab, wt in (((1, w),) if target[i] == 1 else ((0, w),) if target[i] == 0 else ((1, w / 2), (0, w / 2))):
            Xs.append(rows)
            ys += [lab] * len(rows)
            ws += [wt] * len(rows)
    m = model().fit(np.vstack(Xs), np.array(ys), logisticregression__sample_weight=np.array(ws))
    if by_clip:
        p = np.array([m.predict_proba(d.clips[i])[:, 1].mean() for i in test_songs])
    else:
        p = m.predict_proba(d.X[feat][test_songs])[:, 1]
    return (p >= 0.5).astype(int)


def train_set(d, cand, gb_train, test_groups):
    if not CANDS[cand][2]:
        return gb_train
    mids = [i for i in d.mid if d.group[i] not in test_groups]
    return np.concatenate([gb_train, np.array(mids, dtype=int)])


def score(d, cand, gb_folds, target):
    pred = np.empty(len(d.gb), dtype=int)
    for tr, te in gb_folds:
        test_groups = set(d.group[d.gb[te]])
        pred[te] = fit_predict(d, cand, train_set(d, cand, d.gb[tr], test_groups), d.gb[te], target)
    return balanced_accuracy_score(target[d.gb], pred)


def nested(d, target, repeats, seed0):
    y, g = target[d.gb].astype(int), d.group[d.gb]
    accs, picks = [], []
    for rep in range(repeats):
        pred = np.empty(len(d.gb), dtype=int)
        for tr, te in StratifiedGroupKFold(n_splits=S.K, shuffle=True, random_state=seed0 + rep).split(y, y, g):
            inner = [(tr[a], tr[b]) for a, b in StratifiedGroupKFold(n_splits=S.K, shuffle=True,
                                                                      random_state=10_000 + seed0 + rep).split(tr, y[tr], g[tr])]
            best = max(CANDS, key=lambda c: score(d, c, inner, target))
            test_groups = set(d.group[d.gb[te]])
            pred[te] = fit_predict(d, best, train_set(d, best, d.gb[tr], test_groups), d.gb[te], target)
            picks.append(best)
        accs.append(balanced_accuracy_score(y, pred))
    return np.array(accs), picks


def main(curves_csv, multi_csv, features_csv, abx_csv):
    d = Data(curves_csv, multi_csv, features_csv, abx_csv)
    target = np.where(d.label == "good", 1.0, np.where(d.label == "bad", 0.0, 0.5))
    y, g = target[d.gb].astype(int), d.group[d.gb]
    folds = [list(f) for f in (StratifiedGroupKFold(n_splits=S.K, shuffle=True, random_state=r).split(y, y, g)
                               for r in range(REPEATS))]
    plain = {c: float(np.mean([score(d, c, f, target) for f in folds])) for c in CANDS}
    accs, picks = nested(d, target, REPEATS, 0)
    obs = float(np.mean(accs))
    rng = np.random.default_rng(81)
    null = []
    for _ in range(SHUFFLES):
        t = target.copy()
        t[d.gb] = rng.permutation(target[d.gb])
        null.append(float(np.mean(nested(d, t, SHUFFLE_REPEATS, 500)[0])))
    p = (sum(n >= obs for n in null) + 1) / (SHUFFLES + 1)
    clips = [len(c) for c in d.clips]
    best_plain = max(plain, key=plain.get)

    L = [f"# Side experiment: more of each song, and the mid mixes ({date.today()})", "",
         "**Not the official result.** Planned in `ml/README.md` (\"Planned before running: more of each song, and the mid "
         "mixes\") before running. The second search on the same 63 good and bad mixes.", "",
         f"- Data: {int(y.sum())} good and {int((1 - y).sum())} bad mixes ({len(set(g))} groups); {len(d.mid)} mid mixes for "
         f"training only. Clips per mix: {min(clips)} to {max(clips)} (average {np.mean(clips):.1f}). scikit-learn {sklearn.__version__}.",
         "- Nested test: grouped 5-fold outside, 10 repeats; only the training songs pick the candidate; the pick is scored "
         "on held-out songs it never saw.", "",
         f"## Headline: **{obs:.2f} ± {np.std(accs):.2f}** on held-out songs, after the whole search (chance 0.50).", "",
         f"- Reaches 0.80: **{'yes' if obs >= 0.80 else 'no'}**.",
         f"- Shuffle test (the whole nested search on shuffled good/bad labels, {SHUFFLES} shuffles at {SHUFFLE_REPEATS} "
         f"repeats): **p = {p:.3f}** (null average {np.mean(null):.2f}).", "",
         "| Candidate | What it is | Picked | Own cross-validated score (background) |", "|---|---|---|---|"]
    for c, (_, _, _, words) in CANDS.items():
        L.append(f"| {c} | {words} | {picks.count(c)} of {len(picks)} | {plain[c]:.2f} |")
    L += ["", f"The best candidate's own score ({best_plain}, {plain[best_plain]:.2f}) is the top of eight noisy scores and "
          "is optimistic. The nested headline is the honest number.", "",
          f"**Result: {'it reaches 0.80.' if obs >= 0.80 else 'it does not reach 0.80.'}**", ""]
    out = ML / "results" / "search80b-experiment.md"
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
