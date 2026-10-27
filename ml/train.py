"""Train the good vs needs-work model on ml/data/features.csv and report honestly.

Compares against two dumb baselines, so a number only counts if it beats them:
  always-majority  predicts whichever label is most common
  loudness-only    a one-feature model on integrated loudness

Run from the repo root:
    engine/.venv/bin/python ml/train.py ml/data/features.csv
Writes ml/results/train-report.md and, if the model beats both baselines, ml/models/mix_score.joblib.
"""
import sys
from datetime import date
from pathlib import Path

import joblib
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common import FEATURES, LABELS, check_enough, load, song_folds

ROOT = Path(__file__).resolve().parent
LOUDNESS = FEATURES.index("integrated_lufs")

MODELS = {
    "always-majority": lambda: DummyClassifier(strategy="most_frequent"),
    "loudness-only": lambda: make_pipeline(StandardScaler(), LogisticRegression()),
    "logistic regression": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=1000)),
    "gradient boosting": lambda: GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05),
}


def evaluate(name, X, y, folds):
    preds = np.empty_like(y)
    for train, test in folds:
        cols = [LOUDNESS] if name == "loudness-only" else slice(None)
        model = MODELS[name]().fit(X[train][:, cols], y[train])
        preds[test] = model.predict(X[test][:, cols])
    per_fold = [balanced_accuracy_score(y[test], preds[test]) for _, test in folds]
    return balanced_accuracy_score(y, preds), np.std(per_fold), confusion_matrix(y, preds, labels=[1, 0])


def main(csv_path):
    rows, dropped = load(csv_path)
    counts, songs = check_enough(rows)
    X = np.array([r["x"] for r in rows])
    y = np.array([1 if r["label"] == "good" else 0 for r in rows])
    folds = song_folds(rows)

    results = {name: evaluate(name, X, y, folds) for name in MODELS}
    best = max(["logistic regression", "gradient boosting"], key=lambda n: results[n][0])
    floor = max(results["always-majority"][0], results["loudness-only"][0])
    ships = results[best][0] > floor

    lines = [
        f"# Mix model training report ({date.today()})", "",
        f"- Data: {len(rows)} mixes from {len({r['song'] for r in rows})} songs. "
        f"good: {counts['good']} ({songs['good']} songs), needs-work: {counts['needs-work']} ({songs['needs-work']} songs).",
        f"- Dropped {dropped} rows with a feature that couldn't be measured. Nothing was filled in.",
        f"- Split: {len(folds)}-fold cross-validation grouped by song, so no song is in both training and testing.",
        "- Score: balanced accuracy on held-out songs (0.5 is a coin toss).", "",
        "| Model | Balanced accuracy | Spread across folds | Confusion [good, needs-work] rows = truth |",
        "|---|---|---|---|",
    ]
    for name, (acc, sd, cm) in results.items():
        lines.append(f"| {name} | {acc:.2f} | ± {sd:.2f} | {cm.tolist()} |")
    lines += ["", f"**Best model: {best} at {results[best][0]:.2f}, against a baseline of {floor:.2f}.**", ""]

    if ships:
        final = MODELS["logistic regression"]().fit(X, y) if best == "logistic regression" else MODELS[best]().fit(X, y)
        if best == "logistic regression":
            coefs = final[-1].coef_[0]
            order = np.argsort(-np.abs(coefs))
            lines += ["What pushes a mix toward good (+) or needs-work (-), in standardized units:", ""]
            lines += [f"- {FEATURES[i]}: {coefs[i]:+.2f}" for i in order]
        (ROOT / "models").mkdir(exist_ok=True)
        joblib.dump({"model": final, "kind": best, "features": FEATURES, "trained_on": len(rows),
                     "songs": len({r['song'] for r in rows}), "heldout_balanced_accuracy": round(results[best][0], 3),
                     "date": str(date.today())}, ROOT / "models" / "mix_score.joblib")
        lines += ["", "Saved ml/models/mix_score.joblib."]
    else:
        lines += ["The model doesn't beat the baselines, so nothing was saved. By the plan, it doesn't ship."]

    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / "train-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
