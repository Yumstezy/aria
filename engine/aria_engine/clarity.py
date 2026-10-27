"""Master mode clarity: find spots in a mix where one region of the spectrum sticks out.

Every finding is measured relative to the same mix, so no reference track is needed:
  resonance  a narrow peak standing above its own neighbourhood for most of the recording
  buildup    a low-mid band (120 Hz to 1 kHz) that grows louder than its own neighbours from some bar on
             (off by default in master mode, see analyze)
  harsh      short bursts in 2 to 6 kHz that jump above their neighbourhood

Each finding has a frequency range, the bars, its size in dB and how much of the time it's there.
On a smooth, balanced signal this finds nothing. It never pads the list.
"""
import numpy as np
from scipy.signal import stft

# Analysis grid
N_FFT = 8192                 # about 5.4 Hz per bin at 44.1 kHz
HOP = 2048                   # about 46 ms per frame
STEPS_PER_OCTAVE = 12        # fine log-frequency grid
F_LO, F_HI = 40.0, 16000.0
NEIGHBOURHOOD_OCT = 1.0      # smoothing width for "its neighbourhood"
FLOOR_DB = -80.0             # below this a band has no real content

# Thresholds (all in dB relative to the mix itself)
RESONANCE_MIN_DB = 6.0       # peak above its smoothed neighbourhood, averaged over time
RESONANCE_FRAME_DB = 3.0     # per-frame margin that counts towards persistence
RESONANCE_MIN_SHARE = 0.6    # must hold for this share of frames with content
RESONANCE_RANGE = (150.0, 10000.0)   # below this, narrow peaks are mostly bass notes, not resonances
BUILDUP_MIN_DB = 4.0         # lasting rise of a band against its neighbours, and of the band itself
BUILDUP_MIN_BARS = 2
BUILDUP_RANGE = (120.0, 1000.0)  # the mud zone. Sub-bass fights are key tracks mode's job.
BUILDUP_NEIGHBOUR_OCT = 1.5
HARSH_RANGE = (2000.0, 6000.0)
HARSH_BURST_DB = 6.0         # burst above that band's own typical neighbourhood margin
HARSH_MIN_BURSTS_PER_BAR = 1.0
TOP_N = 3


def _bands(rate):
    hi = min(F_HI, rate / 2 * 0.95)
    n = int(np.floor(np.log2(hi / F_LO) * STEPS_PER_OCTAVE)) + 1
    centres = F_LO * 2 ** (np.arange(n) / STEPS_PER_OCTAVE)
    edges = centres[:, None] * 2 ** (np.array([-0.5, 0.5]) / STEPS_PER_OCTAVE)
    return centres, edges


def _band_db(power, freqs, edges):
    """(bands, frames) mean power in dB for each log band."""
    out = np.empty((len(edges), power.shape[1]))
    for i, (lo, hi) in enumerate(edges):
        idx = (freqs >= lo) & (freqs < hi)
        if not np.any(idx):  # very low bands narrower than one bin: take the nearest bin
            idx = np.zeros_like(freqs, dtype=bool)
            idx[np.argmin(np.abs(freqs - (lo + hi) / 2))] = True
        out[i] = 10 * np.log10(np.mean(power[idx], axis=0) + 1e-20)
    return out


def _smooth(db, axis=0):
    """Average over +/- half an octave on the log grid: the band's neighbourhood."""
    half = int(round(NEIGHBOURHOOD_OCT * STEPS_PER_OCTAVE / 2))
    kernel = np.ones(2 * half + 1) / (2 * half + 1)
    pad = [(0, 0)] * db.ndim
    pad[axis] = (half, half)
    padded = np.pad(db, pad, mode="edge")
    return np.apply_along_axis(lambda v: np.convolve(v, kernel, mode="valid"), axis, padded)


def _hz_range(centres, i, j=None):
    j = i if j is None else j
    lo = centres[i] * 2 ** (-0.5 / STEPS_PER_OCTAVE)
    hi = centres[j] * 2 ** (0.5 / STEPS_PER_OCTAVE)
    return [round(float(lo)), round(float(hi))]


def analyze(audio, rate, tempo=None, start_beat=None, beats_per_bar=4.0, include_buildups=False):
    """audio: (samples, channels) floats. Returns {"findings": [...], "bars": [...]}.

    Build-ups are off by default. On a good reference mix (BRILL x 4times4, scanned Oct 26)
    they fired at every arrangement change, where the drop brings the bass in, which is
    the arrangement, not mud. Without knowing which track entered, master mode can't tell
    the two apart. Key tracks mode can.
    """
    mono = audio.mean(axis=1) if audio.ndim == 2 else audio
    if len(mono) < 4 * N_FFT:
        return {"findings": [], "unmeasured": "The recording is too short for a clarity check."}
    freqs, times, z = stft(mono, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    power = np.abs(z) ** 2
    centres, edges = _bands(rate)
    db = _band_db(power, freqs, edges)                     # (bands, frames)

    # Which bar each frame falls in. Without tempo, report seconds as "bar" 1-based seconds.
    if tempo and start_beat is not None:
        beats = start_beat + times * tempo / 60.0
        frame_bar = np.floor(beats / beats_per_bar).astype(int) + 1
    else:
        frame_bar = np.floor(times).astype(int) + 1
    bars = sorted(set(frame_bar.tolist()))

    active = db > FLOOR_DB
    findings = []
    findings += _resonances(db, centres, active, frame_bar)
    if include_buildups:
        findings += _buildups(db, centres, frame_bar, bars)
    findings += _harsh(db, centres, frame_bar, bars, len(times))
    findings.sort(key=lambda f: f["score"], reverse=True)
    for f in findings:
        f.pop("score")
    return {"findings": findings[:TOP_N], "bars": [bars[0], bars[-1]] if bars else None}


def _resonances(db, centres, active, frame_bar):
    mean_db = 10 * np.log10(np.mean(10 ** (db / 10), axis=1) + 1e-20)
    residual = mean_db - _smooth(mean_db)
    frame_residual = db - _smooth(db, axis=0)
    in_range = (centres >= RESONANCE_RANGE[0]) & (centres <= RESONANCE_RANGE[1])
    out = []
    for i in range(1, len(centres) - 1):
        if not in_range[i] or residual[i] < RESONANCE_MIN_DB:
            continue
        if residual[i] < residual[i - 1] or residual[i] < residual[i + 1]:
            continue  # only the tip of each peak
        frames = active[i]
        if not np.any(frames):
            continue
        share = float(np.mean(frame_residual[i, frames] >= RESONANCE_FRAME_DB))
        if share < RESONANCE_MIN_SHARE:
            continue
        hit_bars = sorted(set(frame_bar[frames & (frame_residual[i] >= RESONANCE_FRAME_DB)].tolist()))
        out.append({
            "kind": "resonance",
            "hz": round(float(centres[i])),
            "hz_range": _hz_range(centres, i),
            "size_db": round(float(residual[i]), 1),
            "share": round(share, 2),
            "bars": [hit_bars[0], hit_bars[-1]],
            "score": float(residual[i]) * share,
        })
    return out


def _bar_means(db, frame_bar, bars):
    return np.stack([10 * np.log10(np.mean(10 ** (db[:, frame_bar == b] / 10), axis=1) + 1e-20) for b in bars], axis=1)


def _buildups(db, centres, frame_bar, bars):
    if len(bars) < BUILDUP_MIN_BARS + 1:
        return []
    third = STEPS_PER_OCTAVE // 3
    near = STEPS_PER_OCTAVE // 2                          # neighbours start half an octave away
    far = int(BUILDUP_NEIGHBOUR_OCT * STEPS_PER_OCTAVE)   # and reach this far
    per_bar = _bar_means(db, frame_bar, bars)
    power = 10 ** (per_bar / 10)

    def mean_db(lo, hi):
        lo, hi = max(lo, 0), min(hi, len(centres))
        return 10 * np.log10(np.mean(power[lo:hi], axis=0) + 1e-20) if hi > lo else None

    # 1/3-octave groups in the mud zone, each measured against its own neighbours in the
    # same bar. A drop bringing in the sub moves the whole mix but not this comparison.
    in_zone = [i for i in range(0, len(centres), third)
               if BUILDUP_RANGE[0] <= centres[i] and centres[min(i + third, len(centres)) - 1] <= BUILDUP_RANGE[1]]
    rises = []
    for lo in in_zone:
        hi = min(lo + third, len(centres))
        below, above_ = mean_db(lo - far, lo - near), mean_db(hi + near, hi + far)
        sides = [v for v in (below, above_) if v is not None]
        if not sides:
            continue
        neighbours = 10 * np.log10(np.mean([10 ** (v / 10) for v in sides], axis=0))
        own = mean_db(lo, hi)
        level = own - neighbours
        # Change point: for each start bar, the average after it against the average before it.
        # Real music moves 5 to 10 dB bar to bar in these bands, so single bars are noise.
        # Averages over several bars keep only a lasting change. The band itself must get
        # louder too, not just look louder because its neighbours went quiet.
        best = None
        for k in range(BUILDUP_MIN_BARS, len(bars) - BUILDUP_MIN_BARS + 1):
            rel = float(np.mean(level[k:]) - np.mean(level[:k]))
            gain = float(np.mean(own[k:]) - np.mean(own[:k]))
            if rel >= BUILDUP_MIN_DB and gain >= BUILDUP_MIN_DB and (best is None or rel > best[1]):
                best = (k, rel)
        if best:
            rises.append((lo, hi - 1, (best[0], len(bars)), best[1]))
    # merge neighbouring 1/3-octave groups that rise over the same bars
    out = []
    for lo, hi, (b0, b1), size in rises:
        if out and out[-1]["_hi"] + 1 >= lo and out[-1]["_run"] == (b0, b1):
            o = out[-1]
            o["_hi"], o["_sizes"] = hi, o["_sizes"] + [size]
            continue
        out.append({"_lo": lo, "_hi": hi, "_run": (b0, b1), "_sizes": [size]})
    result = []
    for o in out:
        size = float(np.mean(o["_sizes"]))
        b0, b1 = o["_run"]
        result.append({
            "kind": "buildup",
            "hz_range": _hz_range(centres, o["_lo"], o["_hi"]),
            "size_db": round(size, 1),
            "bars": [bars[b0], bars[b1 - 1]],
            "share": round((b1 - b0) / len(bars), 2),
            "score": size * (b1 - b0) / len(bars) * 1.5,
        })
    return result


def _harsh(db, centres, frame_bar, bars, n_frames):
    in_range = np.where((centres >= HARSH_RANGE[0]) & (centres <= HARSH_RANGE[1]))[0]
    if len(in_range) == 0:
        return []
    residual = db - _smooth(db, axis=0)
    out = []
    for i in in_range:
        r = residual[i]
        burst = r - np.median(r) >= HARSH_BURST_DB
        # count separate bursts (rising edges), not frames
        starts = np.flatnonzero(burst & ~np.concatenate([[False], burst[:-1]]))
        if len(starts) == 0:
            continue
        per_bar = len(starts) / max(len(bars), 1)
        if per_bar < HARSH_MIN_BURSTS_PER_BAR:
            continue
        size = float(np.median(r[burst] - np.median(r)))
        hit_bars = sorted(set(frame_bar[starts].tolist()))
        out.append({"i": i, "size": size, "per_bar": per_bar, "bars": [hit_bars[0], hit_bars[-1]],
                     "share": float(np.mean(burst))})
    if not out:
        return []
    best = max(out, key=lambda o: o["size"] * o["per_bar"])
    return [{
        "kind": "harsh",
        "hz": round(float(centres[best["i"]])),
        "hz_range": _hz_range(centres, best["i"]),
        "size_db": round(best["size"], 1),
        "bursts_per_bar": round(best["per_bar"], 1),
        "bars": best["bars"],
        "share": round(best["share"], 2),
        "score": best["size"] * min(best["per_bar"], 4) / 4,
    }]
