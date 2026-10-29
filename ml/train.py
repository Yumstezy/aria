"""Train the three-tier mix model (bad < mid < good) on ml/data/features.csv and report honestly.

Compares against two dumb baselines, so a number only counts if it beats them:
  always-majority  predicts whichever tier is most common
  loudness-only    a one-feature model on integrated loudness

Real models:
  logistic regression  treats the tiers as three separate classes
  ordinal logistic     uses the order: one step "better than bad?", one step "good?" (docs/ml-plan.md)
  gradient boosting    small trees, for anything the straight-line models miss

Ship rule, fixed before seeing results: the best real model must beat the best baseline on
balanced accuracy overall AND in at least SHIP_MIN_FOLD_WINS of the folds. A win on the average
alone can be one lucky fold.

Run from the repo root:
    engine/.venv/bin/python ml/train.py ml/data/features.csv
Writes ml/results/train-report.md and, if a model passes the ship rule, ml/models/mix_score.joblib.
"""
import sys
from datetime import date
from pathlib import Path

import joblib
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common import FEATURES, TIERS, check_enough, load, song_folds, tier_index

ROOT = Path(__file__).resolve().parent
LOUDNESS = FEATURES.index("integrated_lufs")
SHIP_MIN_FOLD_WINS = 4          # out of 5 folds
BASELINES = ("always-majority", "loudness-only")
REAL = ("logistic regression", "ordinal logistic", "gradient boosting")


class OrdinalLogistic(BaseEstimator, ClassifierMixin):
    """Frank and Hall (2001): one yes/no model per step up the ladder (above bad? above mid?).
    Uses the fact that bad < mid < good, which a plain three-class model ignores."""

    def __init__(self, C=0.5):
        self.C = C

    def fit(self, X, y):
        self.classes_ = np.arange(len(TIERS))
        self.scaler_ = StandardScaler().fit(X)
        Xs = self.scaler_.transform(X)
        self.steps_ = [LogisticRegression(C=self.C, max_iter=1000).fit(Xs, (y > k).astype(int))
                       for k in range(len(TIERS) - 1)]
        return self

    def predict_proba(self, X):
        Xs = self.scaler_.transform(X)
        above = np.column_stack([m.predict_proba(Xs)[:, 1] for m in self.steps_])
        above = np.minimum.accumulate(above, axis=1)   # "good" can't be likelier than "above bad"
        p = np.column_stack([1 - above[:, 0], above[:, 0] - above[:, 1], above[:, 1]])
        return np.clip(p, 0, 1)

    def predict(self, X):
        return self.predict_proba(X).argmax(axis=1)


MODELS = {
    "always-majority": lambda: DummyClassifier(strategy="most_frequent"),
    "loudness-only": lambda: make_pipeline(StandardScaler(), LogisticRegression()),
    "logistic regression": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=1000)),
    "ordinal logistic": lambda: OrdinalLogistic(C=0.5),
    "gradient boosting": lambda: GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05),
}


def evaluate(name, X, y, folds):
    preds = np.empty_like(y)
    for train, test in folds:
        cols = [LOUDNESS] if name == "loudness-only" else slice(None)
        model = MODELS[name]().fit(X[train][:, cols], y[train])
        preds[test] = model.predict(X[test][:, cols])
    per_fold = np.array([balanced_accuracy_score(y[test], preds[test]) for _, test in folds])
    return {
        "acc": balanced_accuracy_score(y, preds),
        "per_fold": per_fold,
        "mae": float(np.mean(np.abs(preds - y))),               # average tiers off, 0 to 2
        "two_off": int(np.sum(np.abs(preds - y) == 2)),          # good called bad, or bad called good
        "cm": confusion_matrix(y, preds, labels=[2, 1, 0]),      # rows and columns: good, mid, bad
    }


def good_tier_ranges(rows):
    """Where the good mixes sit on each measurement (25th, 50th, 75th percentile).
    Aria uses this to say what pulls a mix down: "mids 2 dB heavier than most good mixes"."""
    good = np.array([r["x"] for r in rows if r["label"] == "good"])
    return {f: [round(float(v), 2) for v in np.percentile(good[:, i], [25, 50, 75])] for i, f in enumerate(FEATURES)}


def main(csv_path):
    rows, dropped = load(csv_path)
    counts, songs = check_enough(rows)
    X = np.array([r["x"] for r in rows])
    y = np.array([tier_index(r["label"]) for r in rows])
    folds = song_folds(rows)

    res = {name: evaluate(name, X, y, folds) for name in MODELS}
    best = max(REAL, key=lambda n: res[n]["acc"])
    floor_name = max(BASELINES, key=lambda n: res[n]["acc"])
    floor = res[floor_name]
    fold_wins = int(np.sum(res[best]["per_fold"] > floor["per_fold"]))
    need_wins = min(SHIP_MIN_FOLD_WINS, len(folds))
    ships = res[best]["acc"] > floor["acc"] and fold_wins >= need_wins

    n_songs = len({r["song"] for r in rows})
    lines = [
        f"# Mix model training report ({date.today()})", "",
        f"- Data: {len(rows)} mixes from {n_songs} songs. "
        + ", ".join(f"{t}: {counts[t]} ({songs[t]} songs)" for t in reversed(TIERS)) + ".",
        f"- Dropped {dropped} rows with a feature that couldn't be measured. Nothing was filled in.",
        f"- Split: {len(folds)}-fold cross-validation grouped by song, so no song is in both training and testing.",
        "- Score: balanced accuracy on held-out songs. With three tiers, 0.33 is a coin toss.",
        "- Tiers off: the average distance from the true tier (0 is perfect, 2 is always wrong by two).",
        "- Two off: good mixes called bad, or bad mixes called good. These are the mistakes that matter most.", "",
        "| Model | Balanced accuracy | Per fold | Tiers off | Two off | Confusion, rows = truth [good, mid, bad] |",
        "|---|---|---|---|---|---|",
    ]
    for name, r in res.items():
        folds_txt = " ".join(f"{a:.2f}" for a in r["per_fold"])
        lines.append(f"| {name} | {r['acc']:.2f} | {folds_txt} | {r['mae']:.2f} | {r['two_off']} | {r['cm'].tolist()} |")
    lines += [
        "", f"**Best model: {best} at {res[best]['acc']:.2f}, against the best baseline ({floor_name}) at {floor['acc']:.2f}. "
        f"It wins in {fold_wins} of {len(folds)} folds (the ship rule needs {need_wins}).**", "",
    ]

    if ships:
        final = MODELS[best]().fit(X, y)
        if best == "ordinal logistic":
            lines += ["What pushes a mix up a tier (+) or down (-), in standardized units:", ""]
            for step, name in zip(final.steps_, ("above bad", "good")):
                coefs = step.coef_[0]
                order = np.argsort(-np.abs(coefs))
                lines += [f"Step '{name}':"] + [f"- {FEATURES[i]}: {coefs[i]:+.2f}" for i in order] + [""]
        elif best == "logistic regression":
            coefs = final[-1].coef_[list(final[-1].classes_).index(2)]
            order = np.argsort(-np.abs(coefs))
            lines += ["What pushes a mix toward good (+) or away (-), in standardized units:", ""]
            lines += [f"- {FEATURES[i]}: {coefs[i]:+.2f}" for i in order] + [""]
        (ROOT / "models").mkdir(exist_ok=True)
        joblib.dump({"model": final, "kind": best, "features": FEATURES, "tiers": list(TIERS),
                     "trained_on": len(rows), "songs": n_songs,
                     "heldout_balanced_accuracy": round(res[best]["acc"], 3),
                     "heldout_fold_spread": round(float(np.std(res[best]["per_fold"])), 3),
                     "good_tier_ranges": good_tier_ranges(rows), "date": str(date.today())},
                    ROOT / "models" / "mix_score.joblib")
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
