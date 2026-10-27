"""Measure a mix from a wav file. Numbers only, all from the audio.

Anything we can't measure is None, with the reason in `unmeasured`.
We never fill in a plausible value.
"""
import numpy as np
import pyloudnorm
import soundfile as sf
from scipy.signal import resample_poly, welch

# Everyday band names from DESIGN.md: Bass below 250 Hz, Mids 250 Hz to 2 kHz, Treble above 2 kHz.
BANDS = {"bass": (20.0, 250.0), "mids": (250.0, 2000.0), "treble": (2000.0, 20000.0)}

MIN_LOUDNESS_SEC = 0.4      # pyloudnorm's shortest gating block
SILENCE_DBFS = -90.0        # below this a band or the whole file has no content
TRUE_PEAK_OVERSAMPLE = 4    # ITU-R BS.1770 true peak uses 4x oversampling


class AnalysisError(Exception):
    """The file can't be read as audio."""


def _db(power):
    return 10.0 * np.log10(power) if power > 0 else float("-inf")


def _round(x, digits=1):
    return None if x is None else round(float(x), digits)


def measure(path):
    try:
        audio, rate = sf.read(path, always_2d=True, dtype="float64")
    except (RuntimeError, sf.LibsndfileError) as e:
        raise AnalysisError(f"Can't read {path} as audio: {e}") from e

    channels = audio.shape[1]
    duration = audio.shape[0] / rate
    out = {
        "duration_sec": _round(duration, 2),
        "sample_rate": int(rate),
        "channels": int(channels),
        "integrated_lufs": None,
        "true_peak_dbtp": None,
        "bands_db": {name: None for name in BANDS},
        "width": {name: None for name in BANDS},
        "unmeasured": {},
    }

    if audio.shape[0] == 0 or np.max(np.abs(audio)) == 0 or 20 * np.log10(np.max(np.abs(audio))) < SILENCE_DBFS:
        out["unmeasured"]["all"] = "The recording is silent. Is the song playing?"
        return out

    # Loudness (LUFS, ITU-R BS.1770 via pyloudnorm)
    if duration < MIN_LOUDNESS_SEC:
        out["unmeasured"]["integrated_lufs"] = f"Too short to measure loudness (under {MIN_LOUDNESS_SEC} s)."
    else:
        lufs = pyloudnorm.Meter(rate).integrated_loudness(audio)
        if np.isfinite(lufs):
            out["integrated_lufs"] = _round(lufs)
        else:
            out["unmeasured"]["integrated_lufs"] = "Too quiet to measure loudness."

    # True peak: highest sample after 4x oversampling
    peak = max(np.max(np.abs(resample_poly(audio[:, c], TRUE_PEAK_OVERSAMPLE, 1))) for c in range(channels))
    out["true_peak_dbtp"] = _round(20 * np.log10(peak))

    # Bands and width, from mid and side power spectra
    left = audio[:, 0]
    right = audio[:, 1] if channels > 1 else audio[:, 0]
    mid, side = (left + right) / 2, (left - right) / 2
    nperseg = min(8192, len(mid))
    freqs, p_mid = welch(mid, fs=rate, nperseg=nperseg)
    _, p_side = welch(side, fs=rate, nperseg=nperseg)
    df = freqs[1] - freqs[0]

    for name, (lo, hi) in BANDS.items():
        in_band = (freqs >= lo) & (freqs < min(hi, rate / 2))
        if not np.any(in_band):
            out["unmeasured"][f"bands_db.{name}"] = "The sample rate is too low for this band."
            continue
        pm, ps = np.sum(p_mid[in_band]) * df, np.sum(p_side[in_band]) * df
        level = _db(pm + ps)
        if level < SILENCE_DBFS:
            out["unmeasured"][f"bands_db.{name}"] = "Nothing playing in this band."
            continue
        out["bands_db"][name] = _round(level)
        if channels < 2:
            out["unmeasured"][f"width.{name}"] = "The recording is mono."
        else:
            out["width"][name] = _round(ps / (pm + ps), 2)

    return out
