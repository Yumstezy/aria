"""Where a mix lands against the rated mixes (Nov 2): the shape-only good vs bad model of ml/experiments/shape.py.

The model was trained on 63 of our testers' mixes rated good or bad (ml/results/shape-experiment.md): 0.75 on held-out
songs, shuffle p = 0.002. It looks at the EQ shape only, loudness taken out. It points the way, it doesn't grade: the
lean is the model's own chance of "good", shown as a position, never a score out of 100.

The mix is measured exactly as the rated mixes were (ml/curves.py): its loudest 60 s, then reference._spectrum and
_levels on the twelfth-octave grid, in dB against its own loudness. shape-model.json is a copy of
ml/data/shape-model.json (a test keeps them the same).
"""
import json
from pathlib import Path

import numpy as np
import pyloudnorm as pyln

from . import reference

MODEL_PATH = Path(__file__).with_name("shape-model.json")
CENTRES = reference.FINE
EXCERPT_SEC = 60.0      # ml/extract.py: the loudest 60 s, usually the drop
WINDOW_SEC = 3.0        # short-term loudness window, as ml/extract.py
MIN_SEC = 4.0           # under this, too little of the mix to compare its shape
CLOSER, FURTHER = 0.6, 0.4   # the lean's words: on held-out songs good mixes averaged 0.64, mid 0.50, bad 0.34
MAX_FINDINGS = 2        # the clarity findings lead the list
# Measurements an EQ move can change in one range, so they can become problems to fix: the bands and the low-mid build-up
FIXABLE = {**{f"band_{b}_db": None for b in ("sub", "low", "lowmid", "mid", "himid", "presence", "brilliance", "air")},
           "lowmid_buildup_db": (200, 500)}
BAND_NAMES = {"band_sub_db": "Sub", "band_low_db": "Bass", "band_lowmid_db": "Low mids", "band_mid_db": "Mids",
              "band_himid_db": "Upper mids", "band_presence_db": "Presence", "band_brilliance_db": "Highs",
              "band_air_db": "Air", "lowmid_buildup_db": "Low-mid build-up"}


def load_model(path=MODEL_PATH):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def loudest_excerpt(audio, rate):
    """The loudest EXCERPT_SEC by short-term loudness (ml/extract.py), or all of it when shorter."""
    n = int(EXCERPT_SEC * rate)
    if len(audio) <= n:
        return audio
    meter, hop = pyln.Meter(rate, block_size=WINDOW_SEC), int(WINDOW_SEC * rate)

    def lufs(s):
        v = meter.integrated_loudness(audio[s:s + n])
        return v if np.isfinite(v) else -np.inf
    best = max(range(0, len(audio) - n + 1, hop), key=lufs)
    return audio[best:best + n]


def _mean(curve, lo, hi):
    m = (CENTRES >= lo) & (CENTRES < hi)
    return float(np.mean(curve[m]))


def features(curve, model):
    """The model's measurements from one curve, by each feature's definition in the model file."""
    x = np.log2(CENTRES)
    slope, icept = np.polyfit(x, curve, 1)
    out = {}
    for f in model["features"]:
        d = f["definition"]
        if d["kind"] == "mean_db":
            v = _mean(curve, d["lo_hz"], d["hi_hz"])
        elif d["kind"] == "mean_db_minus_mean_db":
            v = _mean(curve, *d["a_hz"]) - _mean(curve, *d["b_hz"])
        elif d["kind"] == "std_of_curve_minus_1_octave_moving_average":
            w = d["window_points"]
            smooth = np.convolve(np.pad(curve, w // 2, mode="edge"), np.ones(w) / w, mode="valid")
            m = (CENTRES >= d["lo_hz"]) & (CENTRES < d["hi_hz"])
            v = float(np.std(curve[m] - smooth[m]))
        elif d["kind"] == "mean_db_minus_neighbours":
            (a, b), ((c, e), (g, h)) = d["band_hz"], d["neighbours_hz"]
            v = _mean(curve, a, b) - (_mean(curve, c, e) + _mean(curve, g, h)) / 2
        elif d["kind"] == "slope_of_line_fit_db_vs_log2_hz":
            v = float(slope)
        elif d["kind"] == "rms_of_curve_minus_tilt_line":
            top = CENTRES >= d["lo_hz"]
            v = float(np.sqrt(np.mean((curve[top] - (slope * x[top] + icept)) ** 2)))
        else:
            raise ValueError(f"Unknown measurement {d['kind']!r} in the model file.")
        out[f["name"]] = v
    return out


def lean(values, model):
    """The model's chance that a mix with these measurements is one of the good-rated ones (logistic regression)."""
    z = model["intercept"] + sum(f["weight"] * (values[f["name"]] - f["scaler_mean"]) / f["scaler_scale"]
                                 for f in model["features"])
    return float(1 / (1 + np.exp(-z)))


def _hz(f):
    d = f["definition"]
    return FIXABLE.get(f["name"]) or ((d["lo_hz"], d["hi_hz"]) if d["kind"] == "mean_db" else None)


def unavailable(error):
    return {"lean": None, "lean_word": None, "mixes": None, "heldout_accuracy": None, "loudness_only_accuracy": None,
            "features": [], "findings": [], "error": error}


def compare(audio, rate, bars=None, model=None):
    """The good_mixes block of a Mix check, and its findings for the problem list. Null numbers with a reason when the
    recording can't be measured. Only the model's stable directions (show = true) are reported."""
    model = model or load_model()
    if model is None:
        return unavailable("The good mixes model isn't installed.")
    if audio.ndim == 2 and audio.shape[1] == 1:   # mono reads 3 dB off against stereo (BS.1770 sums the channels)
        audio = np.repeat(audio, 2, axis=1)
    if len(audio) < MIN_SEC * rate:
        return unavailable(f"The recording is under {MIN_SEC:.0f} seconds, too short to compare with the rated mixes.")
    spec = reference._spectrum(loudest_excerpt(audio, rate), rate)
    if spec is None:
        return unavailable("The recording is silent, so there's nothing to compare with the rated mixes.")
    curve = reference._levels(spec, CENTRES, 12, rate)
    if not np.isfinite(curve).all():
        return unavailable("The recording's sample rate is too low to measure up to 16 kHz, as the rated mixes were.")
    values = features(curve, model)
    p = lean(values, model)

    shown, findings = [], []
    for f in model["features"]:
        if not f["show"]:
            continue
        v, good = values[f["name"]], f["good_median"]
        toward = 1 if f["weight"] > 0 else -1          # +1: the good mixes have more of it
        lo, hi = f["good_iqr"]
        off = (toward > 0 and v < lo) or (toward < 0 and v > hi)   # past the middle half of the good mixes, the far way
        hz = _hz(f)
        strength = abs(f["weight"]) * abs(v - good) / f["scaler_scale"]   # how hard the model pulls on it here
        shown.append({"name": f["name"], "hz": list(hz) if hz else None, "value": round(v, 2), "good_median": good,
                      "bad_median": f["bad_median"], "good_range": [lo, hi], "toward": toward, "off": bool(off),
                      "diff": round(v - good, 2), "strength": round(strength, 3)})
        if off and f["name"] in FIXABLE:
            findings.append((strength, {
                "kind": "good_mix", "feature": f["name"], "band": BAND_NAMES[f["name"]],
                "hz": reference._nice(np.sqrt(hz[0] * hz[1])), "hz_range": list(hz),
                "diff_db": round(v - good, 1), "good_median_db": round(good, 1), "toward": toward,
                **({"bars": bars} if bars else {})}))
    findings = [f for _, f in sorted(findings, key=lambda t: -t[0])][:MAX_FINDINGS]
    return {"lean": round(p, 2), "lean_word": "closer" if p >= CLOSER else "further" if p <= FURTHER else "between",
            "mixes": model["trained_on"], "heldout_accuracy": model["heldout_balanced_accuracy"],
            "loudness_only_accuracy": model["loudness_only_reference"], "features": shown, "findings": findings,
            "error": None}
