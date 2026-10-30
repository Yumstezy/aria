"""Your mix against typical good mixes (Oct 30), for when no reference song is picked.

The mix model's data (ml/data/features.csv: 99 real mixes rated good, mid or bad by people) didn't make a classifier
that passes its ship rule, but its good-rated mixes show where a finished EDM mix keeps each band. So Aria measures the
checked bars exactly as ml/detail.py measures a mix (each band's share of 30 Hz to 16 kHz, near-silent frames skipped)
and says where yours falls against the good mixes' spread. A band counts as unusual only outside the range 8 in 10
good mixes sit in (10th to 90th percentile). Numbers only; Muse words them. Nothing is compared when the data is missing.
"""
import csv
from pathlib import Path

import numpy as np
from scipy.signal import stft

from aria_engine import clarity

DATA = Path(__file__).resolve().parents[2] / "ml" / "data" / "features.csv"
CURVES = Path(__file__).resolve().parents[2] / "ml" / "data" / "curves.csv"   # ml/curves.py: each rated mix's EQ curve
# The same bands, names and edges as ml/detail.py BALANCE
BANDS = [("sub", "Sub", 30, 60), ("low", "Bass", 60, 120), ("lowmid", "Low mids", 120, 400), ("mid", "Mids", 400, 1000),
         ("himid", "Upper mids", 1000, 2500), ("presence", "Presence", 2500, 5000), ("brilliance", "Highs", 5000, 10000),
         ("air", "Air", 10000, 16000)]
N_FFT, HOP = 4096, 1024
LOW_PCT, HIGH_PCT = 10, 90
MAX_FINDINGS = 2
MARGIN_DB = 0.5
FLOOR_DB = -60.0   # closer to the edge of the good range than this is noise, not a finding


def _load(path=DATA):
    """Per band, the good-rated mixes' 10th, 50th and 90th percentiles. None when the data isn't there."""
    try:
        rows = [r for r in csv.DictReader(open(path)) if r.get("label") == "good"]
    except OSError:
        return None
    out = {}
    for key, *_ in BANDS:
        v = np.array([float(r[f"bal_{key}_db"]) for r in rows if r.get(f"bal_{key}_db")])
        if len(v) >= 10:
            lo, med, hi = np.percentile(v, [LOW_PCT, 50, HIGH_PCT])
            out[key] = {"lo": round(float(lo), 1), "median": round(float(med), 1), "hi": round(float(hi), 1), "n": int(len(v))}
    return {"bands": out, "mixes": len(rows)} if out else None


GOOD = _load()


def _load_curve(path=CURVES):
    """The good-rated mixes' EQ curves (ml/curves.py), as the middle and the range 8 in 10 sit in at each twelfth
    octave. None until the curves have been measured."""
    try:
        rows = [r for r in csv.DictReader(open(path)) if r.get("label") == "good"]
    except OSError:
        return None
    cols = [c for c in (rows[0].keys() if rows else []) if c.startswith("hz_")]
    if len(rows) < 10 or not cols:
        return None
    v = np.array([[float(r[c]) if r[c] else np.nan for c in cols] for r in rows])
    lo, med, hi = np.nanpercentile(v, [LOW_PCT, 50, HIGH_PCT], axis=0)
    return {"hz": [int(c[3:]) for c in cols], "good": med.round(1).tolist(), "lo": lo.round(1).tolist(), "hi": hi.round(1).tolist(), "mixes": len(rows)}


GOOD_CURVE = _load_curve()


def balance(audio, rate):
    """Each band's share of the 30 Hz to 16 kHz total, in dB, the way ml/detail.py measures it."""
    x = np.asarray(audio, dtype=np.float64)
    left = x[:, 0] if x.ndim == 2 else x
    right = x[:, 1] if x.ndim == 2 and x.shape[1] > 1 else left
    freqs, _, z = stft((left + right) / 2, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    power = np.abs(z) ** 2
    loud = 10 * np.log10(power.sum(axis=0) + 1e-20)
    power = power[:, loud >= loud.max() - clarity.QUIET_DB]
    band = lambda lo, hi: power[(freqs >= lo) & (freqs < hi)].sum()
    total = band(30, min(16000, rate / 2))
    out = {}
    for key, _, lo, hi in BANDS:
        p = band(lo, hi) if hi <= rate / 2 else 0.0
        # Under FLOOR_DB the band is empty in practice: shown at the floor, not as a -260 dB difference
        out[key] = round(max(FLOOR_DB, float(10 * np.log10(p / total))), 2) if p > 0 and total > 0 else FLOOR_DB
    return out


def _curve(audio, rate, good_curve):
    """Your EQ curve next to the good mixes' (for the picture), measured as ml/curves.py measures them."""
    from aria_engine import reference
    spec = reference._spectrum(np.asarray(audio, dtype=np.float64), rate)
    if spec is None or not good_curve:
        return None
    mine = reference._levels(spec, np.array(good_curve["hz"], dtype=float), 12, rate)
    keep = [i for i, m in enumerate(mine) if np.isfinite(m) and np.isfinite(good_curve["good"][i])]
    return {"hz": [good_curve["hz"][i] for i in keep], "mine": [round(float(mine[i]), 1) for i in keep],
            "ref": [good_curve["good"][i] for i in keep], "lo": [good_curve["lo"][i] for i in keep], "hi": [good_curve["hi"][i] for i in keep],
            "mixes": good_curve["mixes"]}


def compare(audio, rate, bars=None, good=None, good_curve=None):
    """The checked bars against the good-rated mixes. Returns {mixes, bands, findings, curve, error}."""
    good = good or GOOD
    if not good:
        return {"mixes": 0, "bands": [], "findings": [], "error": "The rated mixes' data isn't on this Mac."}
    mine = balance(audio, rate)
    bands, findings = [], []
    for key, name, lo, hi in BANDS:
        g, v = good["bands"].get(key), mine.get(key)
        if g is None or v is None:
            continue
        outside = v > g["hi"] + MARGIN_DB or v < g["lo"] - MARGIN_DB
        bands.append({"name": name, "lo": lo, "hi": hi, "value_db": v, "median_db": g["median"], "range_db": [g["lo"], g["hi"]], "outside": outside})
        if outside:
            f = {"kind": "typical", "band": name, "hz": int(round(np.sqrt(lo * hi))), "hz_range": [lo, hi], "value_db": v,
                 "median_db": g["median"], "range_db": [g["lo"], g["hi"]], "diff_db": round(v - g["median"], 1),
                 "outside_db": round(v - g["hi"] if v > g["hi"] else v - g["lo"], 1), "mixes": good["mixes"]}
            if bars:
                f["bars"] = bars
            findings.append(f)
    findings.sort(key=lambda f: (f["outside_db"] < 0, -abs(f["outside_db"])))   # louder than good mixes first
    return {"mixes": good["mixes"], "bands": bands, "findings": findings[:MAX_FINDINGS], "error": None,
            "curve": _curve(audio, rate, good_curve or GOOD_CURVE)}
