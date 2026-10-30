"""Detailed measurements for the mix model, on top of the 11 basic ones in extract.py.

Everything is measured from the audio, relative to the same mix, and stops at 16 kHz so lossy
files (mp3 cuts the top end) don't look different from WAVs. Uses the engine's clarity grid
(engine/aria_engine/clarity.py) so the model and Mix check read the same kind of numbers.

Grouped by what a producer would listen for:
  balance   8 bands, each relative to the whole mix (sub up to air)
  mud       low mids against their neighbours
  harsh     how often 2 to 6 kHz jumps out
  resonance the strongest ringing peak
  punch     how hard the low end and the top end hit (loud frames against typical frames)
  stereo    left/right correlation, and how wide the low end is
  clipping  share of samples sitting at the ceiling
  dynamics  how much the whole song moves, and how much the drop lifts above the rest
"""
import sys
from pathlib import Path

import numpy as np
import pyloudnorm
from scipy.signal import stft

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from aria_engine import clarity  # noqa: E402

BALANCE = {"sub": (30, 60), "low": (60, 120), "lowmid": (120, 400), "mid": (400, 1000),
           "himid": (1000, 2500), "presence": (2500, 5000), "brilliance": (5000, 10000), "air": (10000, 16000)}
DETAIL_FIELDS = ([f"bal_{b}_db" for b in BALANCE]
                 + ["mud_db", "harsh_share", "resonance_db", "punch_low_db", "punch_high_db",
                    "lr_correlation", "width_low", "clip_share_pct", "song_range_lu", "drop_lift_lu"])
N_FFT, HOP = 4096, 1024


def _band_power(power, freqs, lo, hi):
    idx = (freqs >= lo) & (freqs < hi)
    return power[idx].sum(axis=0) if np.any(idx) else None


def measure(audio, rate, excerpt):
    """audio: whole song, excerpt: its loudest 60 s. Both (samples, channels). Returns a dict;
    a value that can't be measured is None (never filled in)."""
    out = {k: None for k in DETAIL_FIELDS}
    left = excerpt[:, 0]
    right = excerpt[:, 1] if excerpt.shape[1] > 1 else left
    mono, side = (left + right) / 2, (left - right) / 2

    freqs, _, z = stft(mono, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    power = np.abs(z) ** 2                                          # (bins, frames)
    loud = 10 * np.log10(power.sum(axis=0) + 1e-20)
    power = power[:, loud >= loud.max() - clarity.QUIET_DB]         # skip near-silent frames

    # Balance: each band's share of the 30 Hz to 16 kHz total, in dB
    total = _band_power(power, freqs, 30, min(16000, rate / 2)).sum()
    for name, (lo, hi) in BALANCE.items():
        if hi > rate / 2:
            continue
        p = _band_power(power, freqs, lo, hi)
        if p is not None and p.sum() > 0:
            out[f"bal_{name}_db"] = round(float(10 * np.log10(p.sum() / total)), 2)

    # Mud: low mids (120 to 400 Hz) per octave, against the octave below and the mid band above
    per_oct = lambda lo, hi: _band_power(power, freqs, lo, hi).sum() / np.log2(hi / lo)
    out["mud_db"] = round(float(10 * np.log10(per_oct(120, 400) / np.sqrt(per_oct(60, 120) * per_oct(400, 1000)))), 2)

    # Harsh and resonance, on the engine's 1/12-octave grid
    centres, edges = clarity._bands(rate)
    db = clarity._band_db(power, freqs, edges)
    rel = db - clarity._smooth(db, axis=0)                          # each band above its own neighbourhood
    h = (centres >= clarity.HARSH_RANGE[0]) & (centres <= clarity.HARSH_RANGE[1])
    out["harsh_share"] = round(float(np.mean(rel[h].max(axis=0) > clarity.HARSH_BURST_DB)), 3)
    r = (centres >= clarity.RESONANCE_RANGE[0]) & (centres <= clarity.RESONANCE_RANGE[1])
    out["resonance_db"] = round(float(rel[r].mean(axis=1).max()), 2)

    # Punch: loud frames (95th percentile) against typical frames (median), per region
    for key, (lo, hi) in (("punch_low_db", (40, 150)), ("punch_high_db", (5000, 16000))):
        if hi <= rate / 2:
            e = 10 * np.log10(_band_power(power, freqs, lo, hi) + 1e-20)
            out[key] = round(float(np.percentile(e, 95) - np.percentile(e, 50)), 2)

    # Stereo
    if excerpt.shape[1] > 1 and np.std(left) > 0 and np.std(right) > 0:
        out["lr_correlation"] = round(float(np.corrcoef(left, right)[0, 1]), 3)
        f2, _, zs = stft(side, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
        _, _, zm = stft(mono, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
        lo_idx = (f2 >= 30) & (f2 < 150)
        ps, pm = (np.abs(zs[lo_idx]) ** 2).sum(), (np.abs(zm[lo_idx]) ** 2).sum()
        out["width_low"] = round(float(ps / (ps + pm)), 4) if ps + pm > 0 else None

    # Clipping: samples within 0.1 dB of the excerpt's own peak, in runs of 3 or more
    a = np.abs(excerpt).max(axis=1)
    at_top = a >= a.max() * 10 ** (-0.1 / 20)
    runs = np.convolve(at_top.astype(int), np.ones(3, int), mode="same") >= 3
    out["clip_share_pct"] = round(float(100 * np.mean(runs)), 4)

    # Dynamics across the whole song (3 s loudness every 1 s)
    meter, win, hop = pyloudnorm.Meter(rate, block_size=3.0), int(3 * rate), int(rate)
    vals = np.array([meter.integrated_loudness(audio[s:s + win]) for s in range(0, len(audio) - win + 1, hop)])
    vals = vals[np.isfinite(vals)]
    if len(vals) >= 10:
        out["song_range_lu"] = round(float(np.percentile(vals, 95) - np.percentile(vals, 10)), 2)
        out["drop_lift_lu"] = round(float(np.percentile(vals, 90) - np.median(vals)), 2)
    return out
