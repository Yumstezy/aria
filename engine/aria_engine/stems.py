"""Which sound covers which: masking between separate sounds, plus clicks on the bass.

Works on any named set of mono or stereo signals of equal length. Split mode passes
Demucs stems (vocals, drums, bass, other). Key tracks mode (Aria Ear) will pass the
producer's own tracks by name.

  masking    a sound is covered when another sound is at least COVER_DB louder in a
             range that matters to it, for most of the time it plays there
  bass_click sharp high-frequency bursts at bass note starts that don't land on a
             drum hit (to rule out kick bleed into the bass)
  clash      two sounds both play strongly in the same narrow band at the same moments,
             within CLASH_DB of each other, so neither stands clear (key tracks mode, step 4)

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
PRESENT_DB = 20.0      # and overall within this of the whole mix, or it isn't in this part of the song.
                       # Ian's new track has no vocal there: Demucs' vocals stem sat 24.5 dB under the
                       # mix, faint synth bleed, and was reported "buried". Real vocals in the muddy and
                       # good mixes sat 4 to 16 dB under.
COVER_DB = 3.0         # another sound at least this much louder covers it
TRACK_AUDIBLE_DB = 60.0  # the producer's own tracks have no bleed: a quiet vocal still plays in its range
SILENT_DBFS = -60.0    # the producer's own tracks (relative=False): only this quiet counts as silent (Ian, Oct 29: a
                       # quiet vocal 20 dB under the mix was called "silent" and never checked for being buried)


def _present(name, sound, own_level, mix_level, relative, playing):
    """Is this sound really in this part of the song? Live's word first (clips playing in these bars), then: split
    mode, within PRESENT_DB of the mix (fainter is Demucs bleed); the producer's own tracks, anything above silence."""
    if playing and playing.get(name) is not None:
        return bool(playing[name])
    if relative:
        return own_level >= mix_level - PRESENT_DB
    x = np.asarray(sound, dtype=np.float64)
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12) > SILENT_DBFS
MIN_SHARE = 0.5        # covered for at least this share of the time it plays there
TOP_N = 3

CLICK_HOP = 256
CLICK_ONSET_DB = 6.0   # low end jumps this much: a bass note starts
CLICK_BURST_DB = 10.0  # top end at the start jumps this much over the bass's usual top end
CLICK_AUDIBLE_DB = 50.0  # and is within this of the note's own low end. Measured on Demucs bass stems:
                         # real bass starts sit about 40 dB under the note in both the muddy and the
                         # good mix; a test sine's 5 ms fade splatter sits at -67 dB. What separates
                         # the muddy mix is consistency (CLICK_MIN_SHARE), not level.
CLICK_MIN_STARTS = 8      # fewer clean note starts is too little evidence (Ian's new track: 4)
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


def masking(sounds, rate, tempo=None, start_beat=None, beats_per_bar=4.0, relevant=None, relative=True, playing=None):
    """sounds: {name: signal}. relevant: {name: set of ranges} to check, or None for all.
    Returns findings, strongest first."""
    names = list(sounds)
    if len(names) < 2:
        return []
    levels, levels_total, totals, times = {}, {}, [], None
    for n in names:
        times, levels[n], levels_total[n] = _range_levels(_mono(sounds[n]), rate, N_FFT, HOP)
        totals.append(10 ** (levels_total[n] / 10))
    mix_total = 10 * np.log10(np.sum(totals, axis=0) + 1e-12)
    mix_range = {r: 10 * np.log10(sum(10 ** (levels[n][r] / 10) for n in names) + 1e-12) for r in RANGES}
    loud = mix_total >= mix_total.max() - QUIET_DB
    mix_level = 10 * np.log10(np.mean(np.sum(totals, axis=0)[loud]) + 1e-12)
    bars = _frame_bars(times, tempo, start_beat, beats_per_bar)

    findings = []
    for victim in names:
        own_level = 10 * np.log10(np.mean(10 ** (levels_total[victim][loud] / 10)) + 1e-12)
        if not _present(victim, sounds[victim], own_level, mix_level, relative, playing):
            continue  # not in this part of the song (or only bleed from other sounds)
        typical = {r: np.median(levels[victim][r][loud]) for r in RANGES}
        strongest = max(typical.values())
        for r, (lo, hi) in RANGES.items():
            if relevant is not None and r not in relevant.get(victim, set()):
                continue
            if typical[r] < strongest - MATTERS_DB:
                continue  # this range isn't where this sound lives
            mine = levels[victim][r]
            plays = loud & (mine >= mine[loud].max() - ACTIVE_DB) & (mine >= mix_range[r] - (AUDIBLE_DB if relative else TRACK_AUDIBLE_DB))
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


# ---------- clashes between the producer's own tracks (Aria Ear, build step 4) ----------

CLASH_DB = 3.0          # within this of each other in a band: neither stands clear
CLASH_MIN_SHARE = 0.5   # for at least this share of the time both play there
CLASH_MIN_TIME = 0.15   # and both play there for at least this share of the loud part
CLASH_BAND_DB = 24.0    # a band carries real energy for a track when within this of its strongest band
THIRD_OCTAVE = [31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000,
                1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000]


def _band_levels(sig, rate):
    f, t, z = stft(sig, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    p = np.abs(z) ** 2
    edges = [(c / 2 ** (1 / 6), c * 2 ** (1 / 6)) for c in THIRD_OCTAVE]
    return t, edges, np.array([10 * np.log10(p[(f >= lo) & (f < hi)].sum(axis=0) + 1e-12) for lo, hi in edges]), \
        10 * np.log10(p.sum(axis=0) + 1e-12)


def clashes(sounds, rate, tempo=None, start_beat=None, beats_per_bar=4.0, relative=True, playing=None):
    """Pairs of sounds that fight in the same narrow bands. Next-door bands that both clash merge
    into one range. Ranked by how long they fight and how loud they are there. Strongest first."""
    names = list(sounds)
    if len(names) < 2:
        return []
    bands, totals, times, edges = {}, {}, None, None
    for n in names:
        times, edges, bands[n], totals[n] = _band_levels(_mono(sounds[n]), rate)
    mix_total = 10 * np.log10(sum(10 ** (totals[n] / 10) for n in names) + 1e-12)
    loud = mix_total >= mix_total.max() - QUIET_DB
    mix_band = 10 * np.log10(sum(10 ** (bands[n] / 10) for n in names) + 1e-12)
    bar_of = _frame_bars(times, tempo, start_beat, beats_per_bar)

    def plays(n):
        own = bands[n]
        when_on = np.percentile(own[:, loud], 90, axis=1, keepdims=True)   # how loud each band gets when it plays
        real = when_on >= when_on.max() - CLASH_BAND_DB        # where this track lives, not its silence
        return real & loud & (own >= own[:, loud].max(axis=1, keepdims=True) - ACTIVE_DB) & (own >= mix_band - AUDIBLE_DB)

    found = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            both = plays(a) & plays(b)
            close = both & (np.abs(bands[a] - bands[b]) <= CLASH_DB)
            hits = []
            for k in range(len(edges)):
                n_both = both[k].sum()
                if n_both < max(4, CLASH_MIN_TIME * loud.sum()):
                    continue
                share = close[k].sum() / n_both
                if share >= CLASH_MIN_SHARE:
                    hits.append((k, share))
            # merge next-door bands into ranges
            run = []
            for k, share in hits + [(None, 0)]:
                if run and (k is None or k != run[-1][0] + 1):
                    ks = [x[0] for x in run]
                    sel = close[ks].any(axis=0)
                    diff = float(np.median((bands[a][ks] - bands[b][ks])[:, sel]))
                    level = float(np.median(np.maximum(bands[a][ks], bands[b][ks])[:, sel] - mix_band[ks][:, sel]))
                    hit_bars = bar_of[sel]
                    lasting = sel.sum() / loud.sum()
                    found.append({"kind": "clash", "tracks": [a, b], "louder": a if diff > 0 else b,
                                  "hz_range": [int(round(edges[ks[0]][0])), int(round(edges[ks[-1]][1]))],
                                  "diff_db": round(abs(diff), 1), "share": round(float(np.mean([x[1] for x in run])), 2),
                                  "bars": [int(hit_bars.min()), int(hit_bars.max())],
                                  "score": lasting * 10 ** (level / 20) * len(ks) ** 0.5})
                    run = []
                if k is not None:
                    run.append((k, share))
    found.sort(key=lambda f: f["score"], reverse=True)
    return found[:TOP_N]


def space(sounds, rate):
    """Who owns which space: each sound's level against the rest of the mix, per range.

    Returns {sound: {range: {"vs_rest_db": float, "lives_here": bool}} or None}. None
    when the sound isn't really in this part of the song. vs_rest_db is the median over
    the moments it plays there; lives_here is False where the sound has little energy,
    and the UI leaves those cells empty instead of showing a number."""
    names = list(sounds)
    levels, totals = {}, []
    for n in names:
        _, levels[n], total = _range_levels(_mono(sounds[n]), rate, N_FFT, HOP)
        totals.append((n, total))
    mix_total = 10 * np.log10(sum(10 ** (t / 10) for _, t in totals) + 1e-12)
    loud = mix_total >= mix_total.max() - QUIET_DB
    mix_level = 10 * np.log10(np.mean(sum(10 ** (t / 10) for _, t in totals)[loud]) + 1e-12)
    mix_range = {r: 10 * np.log10(sum(10 ** (levels[n][r] / 10) for n in names) + 1e-12) for r in RANGES}

    out = {}
    for n, total in totals:
        if not _present(n, sounds[n], 10 * np.log10(np.mean(10 ** (total[loud] / 10)) + 1e-12), mix_level, True, None):   # split mode only
            out[n] = None
            continue
        typical = {r: np.median(levels[n][r][loud]) for r in RANGES}
        strongest = max(typical.values())
        cells = {}
        for r in RANGES:
            mine = levels[n][r]
            rest = 10 * np.log10(sum(10 ** (levels[o][r] / 10) for o in names if o != n) + 1e-12)
            plays = loud & (mine >= mine[loud].max() - ACTIVE_DB) & (mine >= mix_range[r] - AUDIBLE_DB)
            lives = bool(typical[r] >= strongest - MATTERS_DB and plays.sum() >= 4)
            cells[r] = {"vs_rest_db": round(float(np.median((mine - rest)[plays])), 1) if lives else None,
                        "lives_here": lives}
        out[n] = cells
    return out


SPECTRUM_LO, SPECTRUM_HI, SPECTRUM_STEPS_PER_OCT = 30.0, 16000.0, 12   # twelfth octaves, like Pro-Q's detail (Oct 29)


def spectra(sounds, rate, relative=True, playing=None):
    """Each sound's average spectrum, for the window's picture of where every part sits.

    About 1/6-octave points from 30 Hz to 16 kHz, averaged over the moments the mix is
    playing, in dB relative to the mix's loudest point (so the top of the picture is 0).
    A sound that isn't really in this part of the song is None and isn't drawn."""
    names = list(sounds)
    power, totals, freqs = {}, [], None
    for n in names:
        freqs, _, z = stft(_mono(sounds[n]), fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
        power[n] = np.abs(z) ** 2
        totals.append(power[n].sum(axis=0))
    mix_frames = 10 * np.log10(np.sum(totals, axis=0) + 1e-12)
    loud = mix_frames >= mix_frames.max() - QUIET_DB
    mix_level = 10 * np.log10(np.mean(np.sum(totals, axis=0)[loud]) + 1e-12)

    hi = min(SPECTRUM_HI, rate / 2 * 0.95)
    count = int(np.floor(np.log2(hi / SPECTRUM_LO) * SPECTRUM_STEPS_PER_OCT)) + 1
    centres = SPECTRUM_LO * 2 ** (np.arange(count) / SPECTRUM_STEPS_PER_OCT)
    half = 2 ** (0.5 / SPECTRUM_STEPS_PER_OCT)

    def curve(p):
        mean = p[:, loud].mean(axis=1)
        out = []
        for c in centres:
            idx = (freqs >= c / half) & (freqs < c * half)
            if not np.any(idx):
                idx = np.zeros_like(freqs, dtype=bool)
                idx[np.argmin(np.abs(freqs - c))] = True
            out.append(10 * np.log10(mean[idx].sum() + 1e-12))
        return np.array(out)

    mix_curve = curve(sum(power.values()))
    top = mix_curve.max()
    parts = {}
    for n in names:
        level = 10 * np.log10(np.mean(power[n].sum(axis=0)[loud]) + 1e-12)
        parts[n] = [round(float(v - top), 1) for v in curve(power[n])] if _present(n, sounds[n], level, mix_level, relative, playing) else None
    return {"hz": [round(float(c)) for c in centres], "mix": [round(float(v - top), 1) for v in mix_curve], "parts": parts}


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
