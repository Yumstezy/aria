"""Side experiment (planned Nov 2, before running; Ian's request of Nov 2): does adding six stereo and clarity
measurements to the shape-only model separate good from bad better, without bringing loudness back in?

The plan, the two sets and the bar are in ml/README.md ("Planned before running: shape plus stereo and clarity").
This script does exactly that and nothing else. It reuses experiments/shape.py for the 13 shape measurements, the
model and the splits, so both sets are measured and split the same way. It never touches data/shape-model.json.

Run from the repo root:
    engine/.venv/bin/python ml/experiments/shape_plus.py ml/data/curves.csv ml/data/features.csv
Writes ml/results/shape-plus-experiment.md.
"""
import csv
import sys
from datetime import date
from pathlib import Path

import numpy as np
import sklearn

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shape as S   # noqa: E402

ML = Path(__file__).resolve().parent.parent
NEW = ["width_mids", "width_treble", "width_low", "lr_correlation", "harsh_share", "resonance_db"]
NEW_WORDS = {"width_mids": "stereo width of the mids", "width_treble": "stereo width of the highs",
             "width_low": "stereo width of the low end (30-150 Hz)", "lr_correlation": "left/right correlation (mono-safe)",
             "harsh_share": "share of moments with harsh bursts", "resonance_db": "the strongest ringing peak"}
SHUFFLES, WIN_SHARE = 500, 0.80


def main(curves_csv, features_csv):
    feats = {Path(r["file"]).name: r for r in csv.DictReader(open(features_csv, encoding="utf-8"))}
    rows = []
    for r in csv.DictReader(open(curves_csv, encoding="utf-8")):   # the same rows, in the same order, as shape.py
        hz = [k for k in r if k.startswith("hz_")]
        curve = np.array([float(r[k]) if r[k] != "" else np.nan for k in hz])
        if len(curve) != len(S.CENTRES) or np.isnan(curve).any() or r["file"] not in feats:
            continue
        f = feats[r["file"]]
        rows.append({"label": r["label"], "song": f["song"], "lufs": float(f["integrated_lufs"]),
                     **S.shape_features(curve), **{k: float(f[k]) for k in NEW}})
    gb = [r for r in rows if r["label"] in ("good", "bad")]
    mids = [r for r in rows if r["label"] == "mid"]
    y = np.array([1 if r["label"] == "good" else 0 for r in gb])
    groups = np.array([r["song"] for r in gb])
    shape_cols, plus_cols = S.SETS["both"], S.SETS["both"] + NEW
    X13 = np.array([[r[c] for c in shape_cols] for r in gb])
    X19 = np.array([[r[c] for c in plus_cols] for r in gb])
    folds = S.splits(y, groups, S.REPEATS)

    a13, a19 = S.cv(S.lr, X13, y, folds), S.cv(S.lr, X19, y, folds, keep_coef=True)
    loud = S.cv(S.lr, np.array([[r["lufs"]] for r in gb]), y, folds)
    gain = a19["acc"] - a13["acc"]
    wins = int(np.sum(a19["rounds"] > a13["rounds"]))
    rounds = len(a19["rounds"])

    # Shuffle test: the six new columns moved together across mixes, each mix keeping its own shape
    rng = np.random.default_rng(12)
    beats = 0
    for _ in range(SHUFFLES):
        Xs = X19.copy()
        Xs[:, len(shape_cols):] = Xs[rng.permutation(len(y)), len(shape_cols):]
        if S.cv(S.lr, Xs, y, folds)["acc"] - a13["acc"] >= gain:
            beats += 1
    p = (beats + 1) / (SHUFFLES + 1)
    passes = gain > 0 and wins >= WIN_SHARE * rounds and p < 0.05

    # Directions on all 63, and how stable each sign is across the 50 rounds
    full = S.lr().fit(X19, y)
    w = full[-1].coef_[0]
    same = (np.sign(a19["coefs"]) == np.sign(w)).sum(axis=0)
    good_med, bad_med = np.median(X19[y == 1], axis=0), np.median(X19[y == 0], axis=0)
    mid_p = full.predict_proba(np.array([[r[c] for c in plus_cols] for r in mids]))[:, 1].mean() if mids else None
    corr_loud = float(np.corrcoef(a19["proba"], [r["lufs"] for r in gb])[0, 1])

    L = [f"# Side experiment: shape plus stereo and clarity ({date.today().isoformat()})", "",
         "**Not the official result.** Planned in `ml/README.md` (\"Planned before running: shape plus stereo and clarity\") "
         "before running, at Ian's request of Nov 2 (can the shape model reach 0.80?). Reported whatever it shows.", "",
         f"- Data: {int(y.sum())} good and {int(len(y) - y.sum())} bad mixes in {len(set(groups))} song and producer groups, "
         f"the same rows and splits as `experiments/shape.py` (scikit-learn {sklearn.__version__}). Mid ({len(mids)}) left out of training.",
         "- Model: logistic regression (L2, C = 0.3), standardized inside each training fold. No tuning.", "",
         "| Set | Held-out balanced accuracy |", "|---|---|",
         f"| shape (13), rerun here | {a13['acc']:.2f} ± {a13['sd']:.2f} |",
         f"| shape + stereo + clarity (19) | {a19['acc']:.2f} ± {a19['sd']:.2f} |",
         f"| loudness only (reference) | {loud['acc']:.2f} ± {loud['sd']:.2f} |", "",
         f"Gain from the six new measurements: **{gain:+.3f}**. The 19 beat the 13 in **{wins} of {rounds}** rounds "
         f"(ties don't count; the bar is {int(WIN_SHARE * rounds)}). Shuffle test (the six columns moved together across mixes, "
         f"{SHUFFLES} times): **p = {p:.3f}**.", "",
         f"Reaches 0.80: **{'yes' if a19['acc'] >= 0.80 else 'no'}** ({a19['acc']:.2f}).", "",
         f"How much the 19's held-out score tracks loudness: correlation {corr_loud:+.2f}.", "",
         f"**Result: {'PASSES. The 19 are proposed in place of the 13 (directions below decide what may be shown).' if passes else 'does not pass. The app keeps the 13-measurement shape model; nothing changes.'}**", "",
         "## The new measurements (logistic regression on all 63 mixes)", "",
         "| Measurement | Weight | Same sign in | Stable | Good median | Bad median | Weight and medians agree |",
         "|---|---|---|---|---|---|---|"]
    for i, c in enumerate(plus_cols):
        if c not in NEW:
            continue
        d = good_med[i] - bad_med[i]
        agree = np.sign(d) == np.sign(w[i]) and d != 0
        L.append(f"| {NEW_WORDS[c]} | {w[i]:+.2f} | {same[i]} of {rounds} | {'yes' if same[i] >= S.STABLE_ROUNDS else 'no'} | "
                 f"{good_med[i]:.3f} | {bad_med[i]:.3f} | {'yes' if agree else 'no'} |")
    if mid_p is not None:
        L += ["", f"Mid sanity check: average chance of \"good\" for mid mixes {mid_p:.2f}, from the model trained on all good and bad."]
    out = ML / "results" / "shape-plus-experiment.md"
    out.write_text("\n".join(L) + "\n")
    print("\n".join(L))


if __name__ == "__main__":
    main(*sys.argv[1:3])
