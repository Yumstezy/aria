"""Side experiment (Oct 29): can the model tell the tiers apart without looking at loudness?

NOT the official result. The official, pre-planned evaluation is ml/train.py and its report
ml/results/train-report.md. This idea came up AFTER seeing those results, so report it as a
follow-up experiment, never as the planned test.

Why it's worth knowing: loudness is mostly a mastering choice. If tone and stereo alone separate
the tiers, the model hears mix differences Aria can act on (EQ, width), not just level.

No re-measuring needed: band balance, width, mud, harshness, punch and clipping are all relative
to each song's own level, so turning a song up or down doesn't change them. We only drop the
measurements that are about level or dynamics.

  no loudness            detailed set minus integrated loudness and true peak
  tone and stereo only   also minus crest, punch, clipping and the dynamics numbers

The bar is chance (0.33), since loudness is removed. Shuffle test: the whole best-of-4 step on
shuffled tiers, so picking the best of several can't make luck look like skill.

Run from the repo root:
    engine/.venv/bin/python ml/experiments/no_loudness.py ml/data/features.csv
Writes ml/results/no-loudness-experiment.md. Takes about 20 minutes (most of it the shuffle test).
"""
import sys
from datetime import date
from pathlib import Path

import numpy as np

ML = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML))
import train as t  # noqa: E402

LEVEL = {"integrated_lufs", "true_peak_dbtp"}
DYNAMICS = LEVEL | {"crest_db", "short_term_spread_lu", "punch_low_db", "punch_high_db",
                    "clip_share_pct", "song_range_lu", "drop_lift_lu"}
SETS = {"no loudness": [f for f in t.DETAILED if f not in LEVEL],
        "tone and stereo only": [f for f in t.DETAILED if f not in DYNAMICS]}
MODELS = {k: t.REAL[k] for k in ("random forest", "ordinal logistic")}
SHUFFLES, SHUFFLE_REPEATS = 100, 2


def main(csv_path):
    rows, dropped = t.load(csv_path, t.DETAILED)
    y = np.array([t.tier_index(r["label"]) for r in rows])
    groups = np.array([r["song"] for r in rows])
    Xs = {s: np.array([[float(r[f]) for f in fs] for r in rows]) for s, fs in SETS.items()}

    def run(labels, folds):
        return {(m, s): t.summarize(*t.cv_predict(make, Xs[s], labels, folds), labels)
                for s in SETS for m, make in MODELS.items()}

    res = run(y, t.splits(y, groups, t.REPEATS))
    best = max(res, key=lambda k: res[k]["acc"])
    rng = np.random.default_rng(2)
    folds = t.splits(y, groups, SHUFFLE_REPEATS, seed0=200)
    hits = sum(max(v["acc"] for v in run(rng.permutation(y), folds).values()) >= res[best]["acc"]
               for _ in range(SHUFFLES))
    p = (hits + 1) / (SHUFFLES + 1)

    # Which measurements separate the tiers (ordinal logistic on tone and stereo, all data)
    fs = SETS["tone and stereo only"]
    X = Xs["tone and stereo only"]
    m = t.OrdinalLogistic().fit(X, y)
    coef = (m.steps_[0].coef_[0] + m.steps_[1].coef_[0]) / 2

    lines = [
        f"# Side experiment: tiers without loudness ({date.today()})", "",
        "**Not the official result.** The official, pre-planned evaluation is `train-report.md`. "
        "This idea came after seeing those results, so it's a follow-up experiment.", "",
        f"- Data: the same {len(rows)} mixes and the same song and producer grouped splits as `train.py` "
        f"({t.K}-fold, repeated {t.REPEATS} times).",
        "- The bar is chance, 0.33, because loudness is removed.", "",
        "| Measurements | Model | Balanced accuracy | Beats chance in | Bad vs better |",
        "|---|---|---|---|---|",
    ]
    for (mn, s), r in sorted(res.items(), key=lambda kv: -kv[1]["acc"]):
        lines.append(f"| {s} ({len(SETS[s])}) | {mn} | {r['acc']:.2f} ± {r['acc_sd']:.2f} | "
                     f"{np.mean(r['rounds'] > 1 / 3):.0%} of rounds | {r['bad_vs_better']:.2f} |")
    lines += [
        "", f"**Best: {best[0]} on {best[1]} at {res[best]['acc']:.2f}. Shuffle test (best of 4 on shuffled "
        f"tiers, {SHUFFLES} shuffles): p = {p:.3f}.** "
        f"(With {SHUFFLES} shuffles, the smallest possible p is {1 / (SHUFFLES + 1):.3f}.)", "",
        "For comparison, loudness alone scores 0.45 in `train-report.md`. Without loudness the model does about as "
        "well, using different information: how the mix is balanced, not how loud it is.", "",
        "What separates the tiers (ordinal logistic on tone and stereo, standardized; + means more of it "
        "goes with a better tier). Medians per tier:", "",
        "| Measurement | Direction | Good | Mid | Bad |", "|---|---|---|---|---|",
    ]
    for i in np.argsort(-np.abs(coef))[:6]:
        med = [np.median(X[y == k, i]) for k in (2, 1, 0)]
        lines.append(f"| {fs[i]} | {coef[i]:+.2f} | {med[0]:.2f} | {med[1]:.2f} | {med[2]:.2f} |")
    lines += ["", "How to say it honestly: \"Without looking at loudness, the model still tells the tiers apart better "
              "than chance (p = " + f"{p:.2f}" + "), from tone and stereo balance. This was a follow-up experiment.\""]

    out = ML / "results" / "no-loudness-experiment.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
