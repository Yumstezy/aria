"""Comparing the producer's mix with a reference song they pick (build step 8, Oct 29).

Both are loudness matched (integrated LUFS, which already skips quiet parts), then compared in third
octaves over the moments each one is playing. Two kinds of difference count:

- a stretch that stands out louder than the difference curve around it, like a bass boosted at 180 Hz or
  a synth at 4 kHz: at least BUMP_DB above its surroundings and BUMP_MIN_DB above the reference
- a whole named band above or below the reference: at least BAND_DB (the only way a missing range counts)

Differences smaller than that are normal between two songs, or two parts of one song, and aren't
flagged (on Ian's song the intro has about 3 dB more sub than the next 16 bars). Numbers only; Muse
words them. The reference's audio is kept on this Mac only, under STORE.
"""
import hashlib
import os
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import stft

STORE = Path(os.path.expanduser("~/Library/Application Support/Aria/references"))
EXTENSIONS = {".wav", ".aif", ".aiff", ".flac", ".mp3", ".ogg"}

CENTRES = 1000 * 2 ** (np.arange(-15, 13) / 3)   # third octaves, 31.5 Hz to 16 kHz: what's compared
FINE = 1000 * 2 ** (np.arange(-30, 25) / 6)      # sixth octaves, 31.5 Hz to 16 kHz: the two curves for the picture
N_FFT, HOP = 8192, 2048
PLAYING_DB = 15        # frames within this of the loudest count as playing
BUMP_DB = 2.0          # a stretch this far above the curve around it
BUMP_MIN_DB = 1.5      # and at least this far from the reference itself
BAND_DB = 3.0          # a whole band this far from the reference
MAX_FINDINGS = 2       # the comparison leads the list, it shouldn't fill it (Ian, Oct 29)

# The window's seven ranges (ui/src/lib/problems.ts BANDS), so words and pictures agree
BANDS = [("Sub", 20, 60), ("Bass", 60, 150), ("Low mids", 150, 400), ("Mids", 400, 1000),
         ("Upper mids", 1000, 4000), ("Highs", 4000, 10000), ("Air", 10000, 20000)]


def _spectrum(audio, rate):
    """(freqs, mean power over the moments it plays, integrated LUFS), or None when silent or too short."""
    if len(audio) < rate * 0.5:
        return None
    lufs = pyln.Meter(rate).integrated_loudness(audio)
    if not np.isfinite(lufs):
        return None
    freqs, _, z = stft(audio.mean(axis=1), fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    power = np.abs(z) ** 2
    level = 10 * np.log10(power.sum(axis=0) + 1e-12)
    return freqs, power[:, level >= level.max() - PLAYING_DB].mean(axis=1), lufs


def _levels(spectrum, centres, per_octave, rate):
    """Each band's level in dB relative to the song's loudness (bands per_octave wide around centres)."""
    freqs, mean, lufs = spectrum
    half = 2 ** (0.5 / per_octave)
    out = []
    for c in centres:
        idx = (freqs >= c / half) & (freqs < c * half)
        out.append(10 * np.log10(mean[idx].sum() + 1e-12) - lufs if idx.any() and c < rate / 2 else np.nan)
    return np.array(out)


def profile(audio, rate):
    """Third-octave levels in dB relative to the song's loudness, over the moments it plays.
    None when the audio is silent or too short to measure."""
    spec = _spectrum(audio, rate)
    return None if spec is None else _levels(spec, CENTRES, 3, rate)


def _surroundings(d):
    """The difference curve around each point, skipping its nearest neighbours (a boost spans two or three
    third octaves, so they'd hide it)."""
    out = []
    for i in range(len(d)):
        near = np.r_[d[max(0, i - 4):max(0, i - 1)], d[i + 2:i + 5]]
        near = near[np.isfinite(near)]
        out.append(np.median(near) if len(near) else 0.0)
    return np.array(out)


def _edge(i, side):
    return float(CENTRES[i] * 2 ** (side / 6))


def _nice(hz):
    """Two significant figures (354 -> 350, 4490 -> 4500), so the advice can say "350 to 710 Hz" or "4.5 kHz"."""
    return int(float(f"{hz:.2g}"))


def _bumps(d):
    stand = d - _surroundings(d)
    found, used = [], set()
    for i in np.argsort(-np.abs(np.nan_to_num(stand))):
        s, v = stand[i], d[i]
        if i in used or not np.isfinite(s):
            continue
        # Only what's louder than the reference counts as a stretch: a pro track's deeper sub or extra air
        # isn't a problem in the producer's mix. Something missing shows up only as a whole band (below).
        if not (s >= BUMP_DB and v >= BUMP_MIN_DB):
            continue
        # The stretch: neighbours that stand out the same way by at least half as much
        lo = hi = i
        while lo > 0 and np.sign(stand[lo - 1]) == np.sign(s) and abs(stand[lo - 1]) >= abs(s) / 2:
            lo -= 1
        while hi < len(d) - 1 and np.sign(stand[hi + 1]) == np.sign(s) and abs(stand[hi + 1]) >= abs(s) / 2:
            hi += 1
        if used & set(range(lo, hi + 1)):
            continue
        used |= set(range(lo, hi + 1))
        found.append({"kind": "reference", "shape": "stretch", "hz": _nice(CENTRES[i]),
                      "hz_range": [_nice(_edge(lo, -1)), _nice(_edge(hi, 1))],
                      "diff_db": round(float(v), 1), "stands_out_db": round(float(s), 1)})
    return found, used


def compare(audio, rate, ref_audio, ref_rate):
    """The mix against the reference: each band's difference, both songs' curves, and what stands out."""
    spec_mine, spec_ref = _spectrum(audio, rate), _spectrum(ref_audio, ref_rate)
    if spec_ref is None:
        return {"bands": [], "curve": None, "findings": [], "error": "The reference is silent or too short to compare."}
    if spec_mine is None:
        return {"bands": [], "curve": None, "findings": [], "error": "The recording is silent, so there's nothing to compare."}
    mine, theirs = _levels(spec_mine, CENTRES, 3, rate), _levels(spec_ref, CENTRES, 3, ref_rate)
    d = mine - theirs

    bands = []
    for name, lo, hi in BANDS:
        sel = (CENTRES >= lo) & (CENTRES < hi) & np.isfinite(d)
        bands.append({"name": name, "lo": lo, "hi": hi, "diff_db": round(float(d[sel].mean()), 1) if sel.any() else None})

    findings, used = _bumps(d)
    for b in bands:
        idx = set(np.flatnonzero((CENTRES >= b["lo"]) & (CENTRES < b["hi"])))
        if b["diff_db"] is not None and abs(b["diff_db"]) >= BAND_DB and not idx & used:
            findings.append({"kind": "reference", "shape": "band", "band": b["name"], "hz": _nice(np.sqrt(b["lo"] * min(b["hi"], 16000))),
                             "hz_range": [b["lo"], b["hi"]], "diff_db": b["diff_db"]})
    findings.sort(key=lambda f: (f["diff_db"] < 0, -abs(f["diff_db"])))   # louder than the reference first
    fine_mine, fine_ref = _levels(spec_mine, FINE, 6, rate), _levels(spec_ref, FINE, 6, ref_rate)
    keep = np.isfinite(fine_mine) & np.isfinite(fine_ref)
    return {"bands": bands, "curve": {"hz": [round(float(c)) for c in FINE[keep]],
                                      "mine": [round(float(x), 1) for x in fine_mine[keep]], "ref": [round(float(x), 1) for x in fine_ref[keep]]},
            "findings": findings[:MAX_FINDINGS], "error": None}


def read(path):
    """The reference's audio, any format soundfile reads (wav, aiff, flac, mp3, ogg)."""
    return sf.read(str(path), always_2d=True, dtype="float64")


def keep(data, name):
    """Save a dropped reference under STORE, once per song (by content). Returns (path, seconds).
    Raises ValueError when it isn't audio Aria can read."""
    ext = Path(name).suffix.lower()
    if ext not in EXTENSIONS:
        raise ValueError(f"Aria reads wav, aiff, flac, mp3 and ogg files. Got {Path(name).name}.")
    STORE.mkdir(parents=True, exist_ok=True)
    path = STORE / (hashlib.sha1(data).hexdigest()[:16] + ext)
    if not path.exists():
        tmp = path.with_name(path.stem + ".part" + ext)   # keeps its extension, so mp3 is read as mp3
        tmp.write_bytes(data)
        try:
            info = sf.info(str(tmp))
        except (RuntimeError, sf.LibsndfileError):
            tmp.unlink(missing_ok=True)
            raise ValueError(f"{Path(name).name} isn't audio Aria can read.")
        tmp.rename(path)
    return path, round(sf.info(str(path)).duration, 1)
