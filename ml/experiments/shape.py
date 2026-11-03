"""Side experiment (planned Nov 2, before running; Ian's request of Oct 31): does the spectral SHAPE of a mix,
with loudness taken out, separate the good-rated mixes from the bad-rated ones, and in which direction?

The plan, the sets, the models and the bar are written in ml/README.md ("Planned before running: shape-only good
vs bad"). This script does exactly that and nothing else. NOT the official 3-tier result (that's ml/train.py).

Data: good and bad rows of ml/data/curves.csv (twelfth-octave curve, 31.5 Hz to 16 kHz, dB against the mix's own
loudness, loudest 60 s). Groups from ml/data/features.csv, matched by file name. Mid is only scored afterwards.

Run from the repo root:
    engine/.venv/bin/python ml/experiments/shape.py ml/data/curves.csv ml/data/features.csv
Writes ml/results/shape-experiment.md, and ml/data/shape-model.json only if the bar is met.
"""
import csv
import json
import sys
import warnings
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore", category=UserWarning)
ML = Path(__file__).resolve().parent.parent

CENTRES = 1000 * 2 ** (np.arange(-60, 49) / 12)       # same grid as engine/aria_engine/reference.py FINE
BANDS = {"sub": (30, 60), "low": (60, 120), "lowmid": (120, 400), "mid": (400, 1000),
         "himid": (1000, 2500), "presence": (2500, 5000), "brilliance": (5000, 10000), "air": (10000, 16000)}
BAND_WORDS = {"sub": "sub (30-60 Hz)", "low": "bass (60-120 Hz)", "lowmid": "low mids (120-400 Hz)",
              "mid": "mids (400 Hz-1 kHz)", "himid": "upper mids (1-2.5 kHz)", "presence": "presence (2.5-5 kHz)",
              "brilliance": "highs (5-10 kHz)", "air": "air (10-16 kHz)"}
HYPOTHESIS = ["low_power_db", "mid_bumpiness_db", "lowmid_buildup_db", "tilt_db_per_oct", "top_spread_db"]
HYP_WORDS = {"low_power_db": "low end (30-120 Hz) against the 200 Hz-2 kHz average",
             "mid_bumpiness_db": "bumpiness of the 200 Hz-2 kHz curve",
             "lowmid_buildup_db": "low-mid build-up (200-500 Hz against its neighbours)",
             "tilt_db_per_oct": "overall tilt (dB per octave)",
             "top_spread_db": "how far the top end (above 2 kHz) strays from the tilt line"}
DEFINITIONS = {
    **{f"band_{b}_db": {"kind": "mean_db", "lo_hz": lo, "hi_hz": hi} for b, (lo, hi) in BANDS.items()},
    "low_power_db": {"kind": "mean_db_minus_mean_db", "a_hz": [30, 120], "b_hz": [200, 2000]},
    "mid_bumpiness_db": {"kind": "std_of_curve_minus_1_octave_moving_average", "lo_hz": 200, "hi_hz": 2000,
                         "window_points": 13},
    "lowmid_buildup_db": {"kind": "mean_db_minus_neighbours", "band_hz": [200, 500], "neighbours_hz": [[100, 200], [500, 1000]]},
    "tilt_db_per_oct": {"kind": "slope_of_line_fit_db_vs_log2_hz", "lo_hz": 31.5, "hi_hz": 16000},
    "top_spread_db": {"kind": "rms_of_curve_minus_tilt_line", "lo_hz": 2000, "hi_hz": 16000},
}
SETS = {"bands": [f"band_{b}_db" for b in BANDS], "hypothesis": HYPOTHESIS,
        "both": [f"band_{b}_db" for b in BANDS] + HYPOTHESIS}
PLAIN = {  # (when good is higher, when good is lower)
    "low_power_db": ("a stronger low end (30-120 Hz) against the mids", "a weaker low end (30-120 Hz) against the mids"),
    "mid_bumpiness_db": ("bumpier mids (200 Hz-2 kHz)", "smoother mids (200 Hz-2 kHz)"),
    "lowmid_buildup_db": ("more low-mid build-up (200-500 Hz)", "less low-mid build-up (200-500 Hz)"),
    "tilt_db_per_oct": ("a flatter tilt from lows to highs", "a steeper downward tilt from lows to highs"),
    "top_spread_db": ("a bumpier top end (above 2 kHz)", "a smoother top end (above 2 kHz)"),
}
EXPECTED = {"low_power_db": +1, "mid_bumpiness_db": -1, "lowmid_buildup_db": -1}   # Ian's hypothesis: good minus bad
K, REPEATS, SHUFFLES, STABLE_ROUNDS = 5, 10, 500, 40
C = 0.3


def _mean(curve, lo, hi):
    m = (CENTRES >= lo) & (CENTRES < hi)
    return float(np.mean(curve[m]))


def shape_features(curve):
    """All 13 measurements from one 109-point curve (dB against loudness, on CENTRES)."""
    f = {f"band_{b}_db": _mean(curve, lo, hi) for b, (lo, hi) in BANDS.items()}
    f["low_power_db"] = _mean(curve, 30, 120) - _mean(curve, 200, 2000)
    smooth = np.convolve(np.pad(curve, 6, mode="edge"), np.ones(13) / 13, mode="valid")
    mid = (CENTRES >= 200) & (CENTRES < 2000)
    f["mid_bumpiness_db"] = float(np.std(curve[mid] - smooth[mid]))
    f["lowmid_buildup_db"] = _mean(curve, 200, 500) - (_mean(curve, 100, 200) + _mean(curve, 500, 1000)) / 2
    x = np.log2(CENTRES)
    slope, icept = np.polyfit(x, curve, 1)
    f["tilt_db_per_oct"] = float(slope)
    top = CENTRES >= 2000
    f["top_spread_db"] = float(np.sqrt(np.mean((curve[top] - (slope * x[top] + icept)) ** 2)))
    return f


def lr():
    return make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=5000))


def rf():
    return RandomForestClassifier(n_estimators=300, min_samples_leaf=3, max_features="sqrt",
                                  class_weight="balanced", random_state=0, n_jobs=-1)


def splits(y, groups, repeats, seed0=0):
    return [list(StratifiedGroupKFold(n_splits=K, shuffle=True, random_state=seed0 + r).split(y, y, groups))
            for r in range(repeats)]


def cv(make, X, y, rep_folds, keep_coef=False):
    accs, rounds, coefs, proba = [], [], [], np.zeros(len(y))
    for folds in rep_folds:
        pred = np.empty_like(y)
        for tr, te in folds:
            m = make().fit(X[tr], y[tr])
            pred[te] = m.predict(X[te])
            proba[te] += m.predict_proba(X[te])[:, 1] / len(rep_folds)
            rounds.append(balanced_accuracy_score(y[te], pred[te]))
            if keep_coef:
                coefs.append(m[-1].coef_[0])
        accs.append(balanced_accuracy_score(y, pred))
    return {"acc": float(np.mean(accs)), "sd": float(np.std(accs)), "rounds": np.array(rounds),
            "coefs": np.array(coefs), "proba": proba}


def main(curves_csv, features_csv):
    groups_by_name = {Path(r["file"]).name: r for r in csv.DictReader(open(features_csv, encoding="utf-8"))}
    rows = []
    for r in csv.DictReader(open(curves_csv, encoding="utf-8")):
        hz = [k for k in r if k.startswith("hz_")]
        curve = np.array([float(r[k]) if r[k] != "" else np.nan for k in hz])
        if len(curve) != len(CENTRES) or np.isnan(curve).any() or r["file"] not in groups_by_name:
            continue
        rows.append({"file": r["file"], "label": r["label"], "song": groups_by_name[r["file"]]["song"],
                     "lufs": float(groups_by_name[r["file"]]["integrated_lufs"]), **shape_features(curve)})
    gb = [r for r in rows if r["label"] in ("good", "bad")]
    mids = [r for r in rows if r["label"] == "mid"]
    y = np.array([1 if r["label"] == "good" else 0 for r in gb])
    groups = np.array([r["song"] for r in gb])
    Xs = {s: np.array([[r[f] for f in fs] for r in gb]) for s, fs in SETS.items()}
    folds = splits(y, groups, REPEATS)

    res = {s: cv(lr, Xs[s], y, folds, keep_coef=True) for s in SETS}
    checks = {s: cv(rf, Xs[s], y, folds) for s in SETS}
    loud = cv(lr, np.array([[r["lufs"]] for r in gb]), y, folds)
    best = max(SETS, key=lambda s: res[s]["acc"])

    rng = np.random.default_rng(11)
    hits = 0
    for _ in range(SHUFFLES):
        ys = rng.permutation(y)
        hits += max(cv(lr, Xs[s], ys, folds)["acc"] for s in SETS) >= res[best]["acc"]
    p = (hits + 1) / (SHUFFLES + 1)

    feats = SETS[best]
    final = lr().fit(Xs[best], y)
    w = final[-1].coef_[0]
    agree = (np.sign(res[best]["coefs"]) == np.sign(w)).sum(axis=0)
    stable = agree >= STABLE_ROUNDS
    med = {f: (float(np.median([r[f] for r in gb if r["label"] == "good"])),
               float(np.median([r[f] for r in gb if r["label"] == "bad"])),
               float(np.median([r[f] for r in mids]))) for f in SETS["both"]}
    above_chance = res[best]["acc"] > 0.5 and p < 0.05
    passes = above_chance and bool(stable.any())
    # Added after seeing the first run (Nov 2), stricter only: a stable weight whose sign disagrees with the
    # good-vs-bad medians (features overlapping each other) isn't shown as advice.
    agrees = np.array([np.sign(w[i]) == np.sign(med[f][0] - med[f][1]) for i, f in enumerate(feats)])
    show = stable & agrees

    # Mid sanity check: out-of-fold P(good) for good and bad, the all-data model for mid
    p_good = float(np.mean(res[best]["proba"][y == 1]))
    p_bad = float(np.mean(res[best]["proba"][y == 0]))
    p_mid = float(np.mean(final.predict_proba(np.array([[r[f] for f in feats] for r in mids]))[:, 1])) if mids else float("nan")

    def words(f):
        return BAND_WORDS[f[5:-3]] if f.startswith("band_") else HYP_WORDS[f]

    def plain(f, diff):
        if f.startswith("band_"):
            return f"{'more' if diff > 0 else 'less'} {BAND_WORDS[f[5:-3]]}"
        return PLAIN[f][0 if diff > 0 else 1]

    L = [f"# Side experiment: shape-only good vs bad ({date.today()})", "",
         "**Not the official result.** Planned in `ml/README.md` (\"Planned before running: shape-only good vs bad\") before "
         "running, at Ian's request of Oct 31. Reported as a follow-up whatever it shows.", "",
         f"- Data: {int(y.sum())} good and {int((1 - y).sum())} bad mixes from `data/curves.csv`, in {len(set(groups))} "
         f"song and producer groups. Mid ({len(mids)}) left out of training.",
         f"- Testing: {K}-fold splits grouped by song and producer, repeated {REPEATS} times ({K * REPEATS} rounds). "
         "Balanced accuracy on held-out songs; chance is 0.50.",
         f"- Model that would ship: logistic regression (L2, C = {C}), standardized inside each training fold. "
         "Random forest is a check only.", "",
         "| Set | Logistic regression | Random forest (check) |", "|---|---|---|"]
    for s in SETS:
        L.append(f"| {s} ({len(SETS[s])}) | {res[s]['acc']:.2f} ± {res[s]['sd']:.2f} | {checks[s]['acc']:.2f} ± {checks[s]['sd']:.2f} |")
    L += [f"| loudness only (reference, not a bar) | {loud['acc']:.2f} ± {loud['sd']:.2f} | |", "",
          f"Loudness alone scores {loud['acc']:.2f} on this same good vs bad question, so shape separates good from bad "
          "about as well as loudness, not better. What shape adds is that it's loudness-free and points to EQ moves.", "",
          f"**Best set: {best}, {res[best]['acc']:.2f}** on held-out songs (chance 0.50). It beats chance in "
          f"{np.mean(res[best]['rounds'] > 0.5):.0%} of the {K * REPEATS} rounds. "
          f"Shuffle test (the whole pick-the-best-set step on shuffled good/bad labels, {SHUFFLES} shuffles): **p = {p:.3f}**.", "",
          "## The bar (Ian, Oct 31)", "",
          f"1. Above chance with shuffle p under 0.05: **{'yes' if above_chance else 'no'}** ({res[best]['acc']:.2f}, p = {p:.3f}).",
          f"2. Direction stable (same sign in at least {STABLE_ROUNDS} of {K * REPEATS} rounds): **{int(stable.sum())} of {len(feats)} "
          f"features** ({', '.join(f for f, s_ in zip(feats, stable) if s_) or 'none'}).",
          f"3. Ian's hypothesis checked: see below.", "",
          f"**Result: {'PASSES' if passes else 'does not pass'}.** "
          + ("Only the stable features may be shown in the app." if passes else "The app shows nothing from it."), "",
          f"## Direction ({best} set, logistic regression on all {len(y)} mixes)", "",
          "+ weight means more of it goes with good. Medians are dB unless noted.", "",
          "| Measurement | Weight | Same sign in | Stable | Good median | Bad median | Good minus bad | Weight and medians agree | Mid median |",
          "|---|---|---|---|---|---|---|---|---|"]
    for i, f in enumerate(feats):
        g, b, m = med[f]
        L.append(f"| {words(f)} | {w[i]:+.2f} | {int(agree[i])} of {K * REPEATS} | {'yes' if stable[i] else 'no'} | "
                 f"{g:.2f} | {b:.2f} | {g - b:+.2f} | {'yes' if agrees[i] else 'no'} | {m:.2f} |")
    L += ["", "\"Weight and medians agree\" was added after seeing the first run (Nov 2). It only makes what the app shows "
          "stricter: a stable weight that points the other way from the good-vs-bad medians (because features overlap) "
          "isn't shown as advice.", "",
          "In plain words (stable, and the weight and medians agree):", ""]
    lines_plain = []
    for i, f in enumerate(feats):
        if show[i]:
            g, b, _ = med[f]
            lines_plain.append(f"- Good mixes have {plain(f, g - b)} than bad mixes: median {g:.2f} vs {b:.2f} ({g - b:+.2f}).")
    L += lines_plain or ["- No feature passes both checks, so there's no direction to show."]
    held = [words(f) for i, f in enumerate(feats) if stable[i] and not agrees[i]]
    if held:
        L += ["", "Stable but pointing opposite ways, so not shown: " + "; ".join(held) + "."]
    L += ["", "## Ian's hypothesis, checked", "",
          "| Claim | Good median | Bad median | Holds? |", "|---|---|---|---|"]
    claims = {"low_power_db": "Good mixes have a more powerful low end",
              "mid_bumpiness_db": "Good mixes have cleaner (less bumpy) mids",
              "lowmid_buildup_db": "Good mixes have less low-mid build-up"}
    for f, sign in EXPECTED.items():
        g, b, _ = med[f]
        holds = (g - b) * sign > 0
        L.append(f"| {claims[f]} | {g:.2f} | {b:.2f} | {'yes' if holds else 'no'} |")
    L += ["", "Medians alone don't make a finding stable; the weights and their sign agreement above do.", "",
          "## Mid sanity check", "",
          f"Average chance of \"good\" from the model: good mixes {p_good:.2f}, mid {p_mid:.2f}, bad {p_bad:.2f} "
          "(good and bad from held-out rounds, mid from the model trained on all good and bad). "
          f"Mid {'lands between good and bad' if min(p_good, p_bad) < p_mid < max(p_good, p_bad) else 'does not land between good and bad'}.", ""]

    out = ML / "results" / "shape-experiment.md"
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))

    model_path = ML / "data" / "shape-model.json"
    if passes:
        sc = final[0]
        model = {
            "what": "Shape-only good vs bad direction (ml/experiments/shape.py). Not a quality score. Show only features with show = true "
                    "(stable, and the weight agrees with the good-vs-bad medians). Words: closer to / further from the good mixes, never 'bad'.",
            "loudness_only_reference": round(loud["acc"], 3),
            "date": str(date.today()),
            "measure_like": "ml/curves.py: loudest 60 s, engine/aria_engine/reference.py _spectrum and _levels on FINE "
                            "(1000 * 2 ** (k / 12), k = -60..48), dB against the mix's own loudness",
            "set": best, "trained_on": {"good": int(y.sum()), "bad": int((1 - y).sum()), "groups": len(set(groups))},
            "heldout_balanced_accuracy": round(res[best]["acc"], 3), "shuffle_p": round(p, 3),
            "intercept": float(final[-1].intercept_[0]),
            "features": [{"name": f, "words": words(f), "definition": DEFINITIONS[f], "weight": round(float(w[i]), 4),
                          "scaler_mean": round(float(sc.mean_[i]), 4), "scaler_scale": round(float(sc.scale_[i]), 4),
                          "stable": bool(stable[i]), "same_sign_rounds": int(agree[i]), "rounds": K * REPEATS,
                          "agrees_with_medians": bool(agrees[i]), "show": bool(show[i]),
                          "good_median": round(med[f][0], 3), "bad_median": round(med[f][1], 3),
                          "good_iqr": [round(float(v), 3) for v in np.percentile([r[f] for r in gb if r["label"] == "good"], [25, 75])]}
                         for i, f in enumerate(feats)],
        }
        model_path.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
        print(f"\nWrote {model_path}")
    elif model_path.exists():
        print(f"\nThe bar isn't met; {model_path} is left as it was. Remove it by hand if it's stale.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
