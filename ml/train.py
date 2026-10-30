"""Train the three-tier mix model (bad < mid < good) on ml/data/features.csv and report honestly.

Everything below was fixed before looking at the results of this version (Oct 29):

Two measurement sets
  basic     the 11 numbers from extract.py
  detailed  basic plus 18 from detail.py (8-band balance, mud, harshness, resonance, punch,
            stereo, clipping, whole-song dynamics)

Baselines (a number only counts if it beats them)
  always-majority  predicts whichever tier is most common
  loudness-only    a one-feature model on integrated loudness

Real models, fixed settings, no tuning on the held-out songs
  logistic regression  three separate classes
  ordinal logistic     uses the order: "better than bad?" then "good?" (docs/ml-plan.md)
  gradient boosting    small trees
  random forest        many small trees, steady on small data

Evaluation
  5-fold cross-validation grouped by song and producer, repeated REPEATS times with different
  shuffles, so one lucky split can't decide anything. Every model sees the same splits.

Ship rule
  The best real model must beat the best baseline on average AND in at least SHIP_FOLD_SHARE of
  all the test rounds (same strictness as 4 of 5 folds). It must also pass a shuffle test that
  repeats the whole pick-the-best-of-8 step on shuffled tiers, so picking the best of several
  can't make luck look like skill.

Run from the repo root:
    engine/.venv/bin/python ml/train.py ml/data/features.csv
Writes ml/results/train-report.md and, if a model passes, ml/models/mix_score.joblib.
"""
import sys
import warnings
from datetime import date
from pathlib import Path

import joblib
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common import FEATURES, TIERS, check_enough, tier_index

warnings.filterwarnings("ignore", category=UserWarning)

ROOT = Path(__file__).resolve().parent
BASIC = list(FEATURES)   # the 11 from extract.py, shared with muse_rater.py through common.py
DETAILED = BASIC + ["bal_sub_db", "bal_low_db", "bal_lowmid_db", "bal_mid_db", "bal_himid_db", "bal_presence_db",
                    "bal_brilliance_db", "bal_air_db", "mud_db", "harsh_share", "resonance_db", "punch_low_db",
                    "punch_high_db", "lr_correlation", "width_low", "clip_share_pct", "song_range_lu", "drop_lift_lu"]
FEATURE_SETS = {"basic": BASIC, "detailed": DETAILED}
REPEATS = 10
K = 5
SHIP_FOLD_SHARE = 0.8
SHUFFLES = 100          # for the shuffle test
SHUFFLE_REPEATS = 2     # repeats per shuffle (the full 10 would take hours)


class OrdinalLogistic(BaseEstimator, ClassifierMixin):
    """Frank and Hall (2001): one yes/no model per step up the ladder (above bad? above mid?)."""

    def __init__(self, C=0.3):
        self.C = C

    def fit(self, X, y):
        self.classes_ = np.arange(len(TIERS))
        self.scaler_ = StandardScaler().fit(X)
        Xs = self.scaler_.transform(X)
        self.steps_ = [LogisticRegression(C=self.C, max_iter=2000).fit(Xs, (y > k).astype(int))
                       for k in range(len(TIERS) - 1)]
        return self

    def predict_proba(self, X):
        Xs = self.scaler_.transform(X)
        above = np.column_stack([m.predict_proba(Xs)[:, 1] for m in self.steps_])
        above = np.minimum.accumulate(above, axis=1)
        return np.clip(np.column_stack([1 - above[:, 0], above[:, 0] - above[:, 1], above[:, 1]]), 0, 1)

    def predict(self, X):
        return self.predict_proba(X).argmax(axis=1)


BASELINES = {
    "always-majority": lambda: DummyClassifier(strategy="most_frequent"),
    "loudness-only": lambda: make_pipeline(StandardScaler(), LogisticRegression()),
}
REAL = {
    "logistic regression": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=2000)),
    "ordinal logistic": lambda: OrdinalLogistic(C=0.3),
    "gradient boosting": lambda: GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05,
                                                            subsample=0.8, random_state=0),
    "random forest": lambda: RandomForestClassifier(n_estimators=300, min_samples_leaf=3, max_features="sqrt",
                                                    class_weight="balanced", random_state=0, n_jobs=-1),
}


def load(path, features):
    import csv
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    usable, dropped = [], 0
    for r in rows:
        try:
            r["x"] = [float(r[k]) for k in features]
        except (ValueError, KeyError, TypeError):
            dropped += 1
            continue
        if r.get("label") in TIERS:
            usable.append(r)
    return usable, dropped


def splits(y, groups, repeats, seed0=0):
    out = []
    for rep in range(repeats):
        out.append(list(StratifiedGroupKFold(n_splits=K, shuffle=True, random_state=seed0 + rep).split(y, y, groups)))
    return out


def cv_predict(make, X, y, rep_folds):
    """Out-of-fold predictions for every repeat: list of arrays, plus per-round balanced accuracy."""
    preds, rounds = [], []
    for folds in rep_folds:
        p = np.empty_like(y)
        for train, test in folds:
            p[test] = make().fit(X[train], y[train]).predict(X[test])
            rounds.append(balanced_accuracy_score(y[test], p[test]))
        preds.append(p)
    return preds, np.array(rounds)


def summarize(preds, rounds, y):
    accs = [balanced_accuracy_score(y, p) for p in preds]
    bad_vs_better = [balanced_accuracy_score(y == 0, p == 0) for p in preds]
    return {
        "acc": float(np.mean(accs)), "acc_sd": float(np.std(accs)), "rounds": rounds,
        "mae": float(np.mean([np.mean(np.abs(p - y)) for p in preds])),
        "two_off": float(np.mean([np.sum(np.abs(p - y) == 2) for p in preds])),
        "bad_vs_better": float(np.mean(bad_vs_better)),
        "cm": confusion_matrix(y, preds[0], labels=[2, 1, 0]),
    }


def run_all(Xs, y, loud, rep_folds):
    res = {}
    res[("always-majority", "-")] = summarize(*cv_predict(BASELINES["always-majority"], loud, y, rep_folds), y)
    res[("loudness-only", "-")] = summarize(*cv_predict(BASELINES["loudness-only"], loud, y, rep_folds), y)
    for fs, X in Xs.items():
        for name, make in REAL.items():
            res[(name, fs)] = summarize(*cv_predict(make, X, y, rep_folds), y)
    return res


def best_real(res):
    return max((k for k in res if k[1] != "-"), key=lambda k: res[k]["acc"])


def shuffle_test(Xs, y, loud, groups, observed_gap):
    """Shuffle the tiers across mixes, redo the whole thing, and count how often the
    best of 8 beats the best baseline by as much as it really did. Small = the win is real."""
    rng = np.random.default_rng(1)
    rep_folds = splits(y, groups, SHUFFLE_REPEATS, seed0=100)
    hits = 0
    for _ in range(SHUFFLES):
        ys = rng.permutation(y)
        r = run_all(Xs, ys, loud, rep_folds)
        floor = max(r[("always-majority", "-")]["acc"], r[("loudness-only", "-")]["acc"])
        hits += (r[best_real(r)]["acc"] - floor) >= observed_gap
    return (hits + 1) / (SHUFFLES + 1)


def explain(final, kind, features, X, y):
    lines = []
    if kind == "ordinal logistic":
        for step, name in zip(final.steps_, ("above bad", "good")):
            c = step.coef_[0]
            order = np.argsort(-np.abs(c))[:8]
            lines += [f"Step '{name}', strongest measurements (standardized):"]
            lines += [f"- {features[i]}: {c[i]:+.2f}" for i in order] + [""]
    else:
        from sklearn.inspection import permutation_importance
        imp = permutation_importance(final, X, y, scoring="balanced_accuracy", n_repeats=20, random_state=0)
        order = np.argsort(-imp.importances_mean)[:8]
        lines += ["Measurements the model leans on most (drop in balanced accuracy when shuffled, on training data):"]
        lines += [f"- {features[i]}: {imp.importances_mean[i]:.3f}" for i in order] + [""]
    return lines


def main(csv_path):
    rows, dropped = load(csv_path, DETAILED)
    counts, songs = check_enough(rows)
    y = np.array([tier_index(r["label"]) for r in rows])
    groups = np.array([r["song"] for r in rows])
    Xs = {fs: np.array([[float(r[f]) for f in feats] for r in rows]) for fs, feats in FEATURE_SETS.items()}
    loud = Xs["basic"][:, [BASIC.index("integrated_lufs")]]
    rep_folds = splits(y, groups, REPEATS)

    res = run_all(Xs, y, loud, rep_folds)
    best = best_real(res)
    floor_key = max([("always-majority", "-"), ("loudness-only", "-")], key=lambda k: res[k]["acc"])
    floor = res[floor_key]
    wins = float(np.mean(res[best]["rounds"] > floor["rounds"]))
    gap = res[best]["acc"] - floor["acc"]
    passes_cv = gap > 0 and wins >= SHIP_FOLD_SHARE
    p_value = shuffle_test(Xs, y, loud, groups, gap) if gap > 0 else None
    ships = passes_cv and p_value is not None and p_value < 0.05

    n_songs = len(set(groups))
    lossy = ", ".join(f"{t} {sum(r.get('file_format') == 'mp3' for r in rows if r['label'] == t)} of {counts[t]}"
                      for t in reversed(TIERS))
    lines = [
        f"# Mix model training report ({date.today()})", "",
        f"- Data: {len(rows)} mixes from {n_songs} songs/producers. "
        + ", ".join(f"{t}: {counts[t]} ({songs[t]} groups)" for t in reversed(TIERS)) + ".",
        f"- Dropped {dropped} rows with a measurement that couldn't be taken. Nothing was filled in.",
        f"- Split: {K}-fold cross-validation grouped by song and producer, repeated {REPEATS} times "
        f"({REPEATS * K} test rounds). Every model sees the same splits.",
        "- Balanced accuracy: with three tiers, 0.33 is a coin toss. The ± is the spread across repeats.",
        "- Tiers off: average distance from the true tier (0 perfect). Two off: good called bad or bad called good, per run.",
        "- Bad vs better: the same predictions read as \"bad\" or \"not bad\" (0.5 is a coin toss). "
        "Added after the first run showed bad mixes are the easiest to tell apart; no model was tuned for it.",
        f"- Lossy files (mp3) per tier: {lossy}. Measurements stop at 16 kHz, where mp3 starts cutting.", "",
        "| Model | Measurements | Balanced accuracy | Tiers off | Two off | Bad vs better |",
        "|---|---|---|---|---|---|",
    ]
    for (name, fs), r in sorted(res.items(), key=lambda kv: -kv[1]["acc"]):
        lines.append(f"| {name} | {fs} | {r['acc']:.2f} ± {r['acc_sd']:.2f} | {r['mae']:.2f} | {r['two_off']:.1f} | {r['bad_vs_better']:.2f} |")
    lines += [
        "", f"**Best: {best[0]} on {best[1]} measurements at {res[best]['acc']:.2f}, against the best baseline "
        f"({floor_key[0]}) at {floor['acc']:.2f}. It wins {wins:.0%} of the {REPEATS * K} test rounds "
        f"(the ship rule needs {SHIP_FOLD_SHARE:.0%}).**",
    ]
    if p_value is not None:
        lines += [f"Shuffle test (best of 8 on shuffled tiers, {SHUFFLES} shuffles): p = {p_value:.3f}. "
                  "Under 0.05 means the win is unlikely to be luck."]
    lines += ["", f"Confusion for the best model (first repeat), rows = truth [good, mid, bad]: {res[best]['cm'].tolist()}", ""]

    if ships:
        feats = FEATURE_SETS[best[1]]
        X = Xs[best[1]]
        final = REAL[best[0]]().fit(X, y)
        lines += explain(final, best[0], feats, X, y)
        good = X[y == 2]
        (ROOT / "models").mkdir(exist_ok=True)
        joblib.dump({"model": final, "kind": best[0], "features": feats, "tiers": list(TIERS),
                     "trained_on": len(rows), "groups": n_songs,
                     "heldout_balanced_accuracy": round(res[best]["acc"], 3),
                     "heldout_spread": round(res[best]["acc_sd"], 3), "shuffle_p": p_value,
                     "good_tier_ranges": {f: [round(float(v), 2) for v in np.percentile(good[:, i], [25, 50, 75])]
                                          for i, f in enumerate(feats)},
                     "date": str(date.today())}, ROOT / "models" / "mix_score.joblib")
        lines += ["Saved ml/models/mix_score.joblib."]
    else:
        lines += ["No model passes the ship rule, so nothing was saved. By the plan, it doesn't ship.",
                  "That's a real result. Report it as it is."]

    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / "train-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
