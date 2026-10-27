"""Clarity tests on generated noise. Test signals stay in tests and never reach the app.

Pink noise is the 'clean' case: smooth, balanced, nothing sticking out.
Each test plants one known problem and checks it's found where it was planted.
"""
import numpy as np
import pytest
from scipy.signal import butter, sosfilt

from aria_engine import clarity

RATE = 44100
TEMPO = 120.0            # 2 s per 4/4 bar
BAR_SEC = 2.0


def pink(seconds, seed=0):
    rng = np.random.default_rng(seed)
    n = int(seconds * RATE)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / RATE)
    spec[1:] /= np.sqrt(f[1:])
    spec[0] = 0
    x = np.fft.irfft(spec, n)
    return 0.1 * x / np.std(x)


def peak_eq(x, hz, gain_db, q=8.0):
    """Narrow bell boost: add a band-passed copy."""
    lo, hi = hz * 2 ** (-0.5 / q * 2), hz * 2 ** (0.5 / q * 2)
    band = sosfilt(butter(2, [lo, hi], btype="band", fs=RATE, output="sos"), x)
    return x + (10 ** (gain_db / 20) - 1) * band


def run(x, **kw):
    stereo = np.column_stack([x, x])
    return clarity.analyze(stereo, RATE, tempo=TEMPO, start_beat=0.0, **kw)["findings"]


def octaves_apart(a, b):
    return abs(np.log2(a / b))


def test_clean_pink_noise_has_no_findings():
    assert run(pink(16)) == []


def test_planted_resonance_is_found_first():
    found = run(peak_eq(pink(16), 340, 12))
    assert found and found[0]["kind"] == "resonance"
    assert octaves_apart(found[0]["hz"], 340) <= 1 / 6
    assert found[0]["share"] >= 0.6


def test_buildup_from_a_known_bar_is_found():
    x = pink(16)
    t = np.arange(len(x)) / RATE
    low_mid = sosfilt(butter(4, [200, 400], btype="band", fs=RATE, output="sos"), pink(16, seed=1))
    x = x + np.where(t >= 4 * BAR_SEC, 4.0, 0.0) * low_mid     # enters at bar 5
    assert not [f for f in run(x) if f["kind"] == "buildup"], "build-ups are off by default"
    found = [f for f in run(x, include_buildups=True) if f["kind"] == "buildup"]
    assert found, "buildup not found"
    b = found[0]
    assert abs(b["bars"][0] - 5) <= 1
    assert b["hz_range"][0] < 400 and b["hz_range"][1] > 200


def test_harsh_bursts_are_found():
    x = pink(16)
    t = np.arange(len(x)) / RATE
    tone = np.sin(2 * np.pi * 3500 * t)
    gate = ((t % 0.5) < 0.04).astype(float)                    # a short hit every half second
    found = [f for f in run(x + 0.08 * tone * gate) if f["kind"] == "harsh"]
    assert found, "harsh bursts not found"
    assert octaves_apart(found[0]["hz"], 3500) <= 1 / 6
    assert found[0]["bursts_per_bar"] >= 2


def test_sustained_bass_note_is_not_a_resonance():
    t = np.arange(16 * RATE) / RATE
    assert run(pink(16) + 0.3 * np.sin(2 * np.pi * 110 * t)) == []


def test_too_short_says_why():
    out = clarity.analyze(np.zeros((1000, 2)), RATE)
    assert out["findings"] == [] and "too short" in out["unmeasured"]
