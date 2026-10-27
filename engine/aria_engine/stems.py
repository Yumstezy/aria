"""Which sound covers which: masking between separate sounds, plus clicks on the bass.

Works on any named set of mono or stereo signals of equal length. Split mode passes
Demucs stems (vocals, drums, bass, other). Key tracks mode (Aria Ear) will pass the
producer's own tracks by name.

  masking    a sound is covered when another sound is at least COVER_DB louder in a
             range that matters to it, for most of the time it plays there
  bass_click sharp high-frequency bursts at bass note starts that don't land on a
             drum hit (to rule out kick bleed into the bass)

Everything is measured inside this mix, so no reference is needed. Near-silent
stretches are ignored. Nothing is reported unless it clears the thresholds.
"""
import numpy as np
from scipy.signal import stft

RANGES = {
    "low": (30.0, 150.0),
    "low-mid": (150.0, 400.0),
    "mid": (400.0, 1000.0),
    "presence": (1000.0, 4000.0),
}
# Air (4 to 12 kHz) is left out: hi-hats own it in every EDM mix, good or bad.

# For Demucs stems, the relationships that decide clarity. Checked on Ian's muddy mix
# against BRILL x 4times4 (a good mix): drums over "other" in the presence range showed
# up in both at similar levels, so it isn't a problem by itself.
SPLIT_RELEVANT = {
    "vocals": {"mid", "presence"},          # the vocal has to come through
    "other": {"low-mid"},                   # bass piling onto synths and pads: mud
    "bass": {"low", "low-mid"},             # the bass buried under synths or drums
}
N_FFT, HOP = 4096, 2048
QUIET_DB = 40.0        # frames this far under the loudest frame of the mix are ignored
ACTIVE_DB = 30.0       # a sound plays in a range when within this of its own loudest there
MATTERS_DB = 6.0       # a range matters to a sound when within this of its strongest range
AUDIBLE_DB = 20.0      # a sound counts as present when within this of the whole mix in that range.
                       # Further under, it's absent (or separation bleed), not buried.
COVER_DB = 3.0         # another sound at least this much louder covers it
MIN_SHARE = 0.5        # covered for at least this share of the time it plays there
TOP_N = 3

CLICK_HOP = 256
CLICK_ONSET_DB = 6.0   # low end jumps this much: a bass note starts
CLICK_BURST_DB = 10.0  # top end at the start jumps this much over the bass's usual top end
CLICK_AUDIBLE_DB = 50.0  # and is within this of the note's own low end. Measured on Demucs bass stems:
                         # real bass starts sit about 40 dB under the note in both the muddy and the
                         # good mix; a test sine's 5 ms fade splatter sits at -67 dB. What separates
                         # the muddy mix is consistency (CLICK_MIN_SHARE), not level.
CLICK_MIN_STARTS = 4
CLICK_MIN_SHARE = 0.85   # muddy mix: 98% of starts in every window; good mix: 79% in one window


def _mono(x):
    x = np.asarray(x, dtype=np.float64)
    return x.mean(axis=1) if x.ndim == 2 else x


def _frame_bars(times, tempo, start_beat, beats_per_bar):
    if tempo and start_beat is not None:
        return np.floor((start_beat + times * tempo / 60.0) / beats_per_bar).astype(int) + 1
    return np.floor(times).astype(int) + 1


def _range_levels(sig, rate, n_fft, hop):
    f, t, z = stft(sig, fs=rate, nperseg=n_fft, noverlap=n_fft - hop, boundary=None, padded=False)
    p = np.abs(z) ** 2
    levels = {name: 10 * np.log10(p[(f >= lo) & (f < hi)].sum(axis=0) + 1e-12) for name, (lo, hi) in RANGES.items()}
    return t, levels, 10 * np.log10(p.sum(axis=0) + 1e-12)


def masking(sounds, rate, tempo=None, start_beat=None, beats_per_bar=4.0, relevant=None):
    """sounds: {name: signal}. relevant: {name: set of ranges} to check, or None for all.
    Returns findings, strongest first."""
    names = list(sounds)
    if len(names) < 2:
        return []
    levels, totals, times = {}, [], None
    for n in names:
        times, levels[n], total = _range_levels(_mono(sounds[n]), rate, N_FFT, HOP)
        totals.append(10 ** (total / 10))
    mix_total = 10 * np.log10(np.sum(totals, axis=0) + 1e-12)
    mix_range = {r: 10 * np.log10(sum(10 ** (levels[n][r] / 10) for n in names) + 1e-12) for r in RANGES}
    loud = mix_total >= mix_total.max() - QUIET_DB
    bars = _frame_bars(times, tempo, start_beat, beats_per_bar)

    findings = []
    for victim in names:
        typical = {r: np.median(levels[victim][r][loud]) for r in RANGES}
        strongest = max(typical.values())
        for r, (lo, hi) in RANGES.items():
            if relevant is not None and r not in relevant.get(victim, set()):
                continue
            if typical[r] < strongest - MATTERS_DB:
                continue  # this range isn't where this sound lives
            mine = levels[victim][r]
            plays = loud & (mine >= mine[loud].max() - ACTIVE_DB) & (mine >= mix_range[r] - AUDIBLE_DB)
            if plays.sum() < 4:
                continue
            best = None
            # The rest of the mix together is what a listener hears around a sound,
            # so check it as well as each other sound on its own.
            rest = 10 * np.log10(sum(10 ** (levels[o][r] / 10) for o in names if o != victim) + 1e-12)
            for other, theirs in [(o, levels[o][r]) for o in names if o != victim] + [("the rest", rest)]:
                if other == "the rest" and len(names) < 3:
                    continue  # with two sounds, the rest is just the other one
                diff = mine - theirs                           # negative: the other is louder
                covered = plays & (diff <= -COVER_DB)
                share = covered.sum() / plays.sum()
                if share < MIN_SHARE:
                    continue
                gap = float(np.median(diff[plays]))
                score = share * -gap
                if best is None or score > best["score"]:
                    hit = bars[covered]
                    best = {"kind": "masking", "masked": victim, "by": other, "range": r,
                            "hz_range": [int(lo), int(hi)], "gap_db": round(gap, 1),
                            "share": round(float(share), 2), "bars": [int(hit.min()), int(hit.max())],
                            "score": score}
            if best:
                findings.append(best)
    findings.sort(key=lambda f: f["score"], reverse=True)
    return findings


def bass_clicks(bass, drums, rate, tempo=None, start_beat=None, beats_per_bar=4.0):
    """Sharp top-end bursts at bass note starts that aren't drum hits. Returns [] or [finding]."""
    def bands(sig):
        f, t, z = stft(_mono(sig), fs=rate, nperseg=1024, noverlap=1024 - CLICK_HOP, boundary=None, padded=False)
        p = np.abs(z) ** 2
        low = 10 * np.log10(p[(f >= 30) & (f < 200)].sum(axis=0) + 1e-12)
        high = 10 * np.log10(p[(f >= 2000) & (f < 10000)].sum(axis=0) + 1e-12)
        return t, low, high

    t, b_low, b_high = bands(bass)
    _, d_low, d_high = bands(drums)
    rise = lambda x: np.diff(x, prepend=x[0])
    starts = np.flatnonzero((rise(b_low) > CLICK_ONSET_DB) & (b_low > b_low.max() - 30))
    if len(starts) == 0:
        return []
    drum_hit = (rise(d_low) > CLICK_ONSET_DB) | (rise(d_high) > CLICK_ONSET_DB)
    near_drum = np.convolve(drum_hit.astype(int), np.ones(5, int), mode="same") > 0   # within 2 frames
    clean = starts[~near_drum[starts]]
    if len(clean) < CLICK_MIN_STARTS:
        return []
    burst = b_high[clean] - np.median(b_high)
    body = np.array([b_low[i:i + 4].max() for i in clean])        # the note just after it starts
    clicky = (burst >= CLICK_BURST_DB) & (b_high[clean] >= body - CLICK_AUDIBLE_DB)
    if clicky.mean() < CLICK_MIN_SHARE:
        return []
    hit = _frame_bars(t[clean[clicky]], tempo, start_beat, beats_per_bar)
    return [{"kind": "bass_click", "starts": int(len(clean)), "clicky_share": round(float(clicky.mean()), 2),
             "size_db": round(float(np.median(burst[clicky])), 1), "hz_range": [2000, 10000],
             "bars": [int(hit.min()), int(hit.max())], "score": float(np.median(burst[clicky])) * clicky.mean()}]
