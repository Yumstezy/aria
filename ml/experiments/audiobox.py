"""Side experiment (Oct 30): do Meta's Audiobox Aesthetics scores tell the tiers apart?

NOT the official result (that's ml/train.py). Planned and written down before any scores existed
(ml/README.md, "Side experiments"), and reported as a follow-up whatever it shows.

Measurement sets, on the same mixes and song-grouped splits as train.py:
  audiobox only            PQ, PC, CE, CU (4)
  audiobox + tone/stereo   those 4 and the 20 tone and stereo measurements from no_loudness.py (24)
  audiobox + detailed      those 4 and train.py's detailed set (33)
Bars: loudness-only (as in train-report.md) and the official best (random forest, detailed), on the same splits.
Shuffle test: the whole best-of step on shuffled tiers, so picking the best can't make luck look like skill.

Run from the repo root, after ml/aesthetics.py:
    engine/.venv/bin/python ml/experiments/audiobox.py ml/data/features.csv ml/data/aesthetics.csv
Writes ml/results/aesthetics-experiment.md.
"""
import csv
import sys
from datetime import date
from pathlib import Path

import numpy as np

ML = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML))
sys.path.insert(0, str(ML / "experiments"))
import train as t  # noqa: E402
from no_loudness import SETS as NL  # noqa: E402

ABX = ["abx_pq", "abx_pc", "abx_ce", "abx_cu"]
SETS = {"audiobox only": ABX, "audiobox + tone/stereo": ABX + NL["tone and stereo only"], "audiobox + detailed": ABX + t.DETAILED,
        "detailed (official best's set)": t.DETAILED, "loudness only": ["integrated_lufs"]}
MODELS = {k: t.REAL[k] for k in ("random forest", "ordinal logistic", "logistic regression")}
BARS = {"detailed (official best's set)", "loudness only"}
SHUFFLES, SHUFFLE_REPEATS = 100, 2


def main(features_csv, abx_csv):
    # Match by file name: features.csv stores "good/GOOD_x.wav", aesthetics.csv stores "GOOD_x.wav" (fix, Oct 30, before any run).
    scores = {r["file"]: r for r in csv.DictReader(open(abx_csv, encoding="utf-8"))}
    rows, dropped = t.load(features_csv, t.DETAILED)
    measured = len(rows)
    rows = [{**r, **scores[Path(r["file"]).name], "file": r["file"]} for r in rows if Path(r["file"]).name in scores]
    if len(rows) < 0.9 * measured:
        sys.exit(f"Only {len(rows)} of {measured} mixes matched between {features_csv} and {abx_csv}. Check the file names.")
    y = np.array([t.tier_index(r["label"]) for r in rows])
    groups = np.array([r["song"] for r in rows])
    Xs = {s: np.array([[float(r[f]) for f in fs] for r in rows]) for s, fs in SETS.items()}

    def run(labels, folds, sets=SETS):
        return {(m, s): t.summarize(*t.cv_predict(make, Xs[s], labels, folds), labels) for s in sets for m, make in MODELS.items()}

    res = run(y, t.splits(y, groups, t.REPEATS))
    tried = {k: v for k, v in res.items() if k[1] not in BARS}
    best = max(tried, key=lambda k: tried[k]["acc"])
    loud = max((v for k, v in res.items() if k[1] == "loudness only"), key=lambda v: v["acc"])
    official = res[("random forest", "detailed (official best's set)")]
    wins = float(np.mean(res[best]["rounds"] > loud["rounds"]))
    rng = np.random.default_rng(3)
    folds = t.splits(y, groups, SHUFFLE_REPEATS, seed0=300)
    new_sets = [s for s in SETS if s not in BARS]
    hits = sum(max(v["acc"] for v in run(rng.permutation(y), folds, new_sets).values()) >= res[best]["acc"] for _ in range(SHUFFLES))
    p = (hits + 1) / (SHUFFLES + 1)

    lines = [f"# Side experiment: Meta's Audiobox Aesthetics ({date.today()})", "",
             "**Not the official result.** Planned in `ml/README.md` before any scores existed; reported as a follow-up.", "",
             f"- Data: {len(rows)} mixes with both measurements and Audiobox scores, the same song and producer grouped splits "
             f"as `train.py` ({t.K}-fold, repeated {t.REPEATS} times).", "",
             "| Measurements | Model | Balanced accuracy | Bad vs better |", "|---|---|---|---|"]
    for (mn, s), r in sorted(res.items(), key=lambda kv: -kv[1]["acc"]):
        lines.append(f"| {s} ({len(SETS[s])}) | {mn} | {r['acc']:.2f} ± {r['acc_sd']:.2f} | {r['bad_vs_better']:.2f} |")
    med = {a: [np.median([float(r[a]) for r in rows if t.tier_index(r["label"]) == k]) for k in (2, 1, 0)] for a in ABX}
    lines += ["", f"**Best new set: {best[0]} on {best[1]} at {res[best]['acc']:.2f}**, against loudness only at {loud['acc']:.2f} "
              f"and the official best at {official['acc']:.2f}. It beats loudness in {wins:.0%} of rounds (the ship rule asks for 80%). "
              f"Shuffle test (best of {len(new_sets) * len(MODELS)} on shuffled tiers, {SHUFFLES} shuffles): p = {p:.3f}.", "",
              "Audiobox medians per tier (good, mid, bad):", ""]
    lines += [f"- {a[4:].upper()}: {m[0]:.2f}, {m[1]:.2f}, {m[2]:.2f}" for a, m in med.items()]
    out = ML / "results" / "aesthetics-experiment.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
