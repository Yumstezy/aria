"""The song's parts, for Arrangement (build step 8b, Oct 29): where the intro, the build, the drop start and stop.

Each bar gets a few numbers: how loud it is, its low, mid and high balance, how busy it is (onsets), and which notes
are playing (chroma). A part starts where the bars before and after differ most (a checkerboard over the bar-by-bar
similarity, Foote 2000), on a 4-bar line, at least MIN_BARS from the last edge. Parts that sound alike get one
label, A, B, C, by their notes and tone balance, not their loudness, so a louder repeat of the intro stays the intro.

Bars come from Live's tempo when it's known (the producer's song). For a reference file the tempo and the first beat
are estimated from the audio. Numbers only; Muse names the parts (muse.name_sections).
"""
import numpy as np
import pyloudnorm as pyln
from scipy.signal import stft

N_FFT, HOP = 4096, 1024
MIN_BARS = 8          # a part is at least this long
GRID = 4              # edges fall on 4-bar lines, counted from bar 1
KERNEL = 4            # bars each side the checkerboard looks at
SAME_PART = 0.86      # how alike two parts' notes and tone must be to share a label
SILENT_LUFS = -70
TAIL_DB = 45          # a bar this far under the loudest one is silence
TEMPO_RANGE = (95.0, 190.0)   # EDM: a half-speed reading (82 for 165) is the common mistake
MAX_BARS = 32         # a longer part is split at its strongest 4-bar line


def _mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def _spectrum(mono, rate):
    freqs, _, z = stft(mono, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    return freqs, np.abs(z)


def _chroma_matrix(freqs):
    """Which pitch class (C to B) each FFT bin belongs to, from 55 Hz to 5 kHz."""
    m = np.zeros((12, len(freqs)))
    ok = (freqs >= 55) & (freqs <= 5000)
    pc = np.round(12 * np.log2(freqs[ok] / 440.0)).astype(int) % 12
    m[pc, np.flatnonzero(ok)] = 1.0
    return m


def estimate_tempo(mono, rate):
    """(tempo, first beat in seconds) from the onset envelope: autocorrelation for the tempo, then the beat phase
    that lands on the most onsets."""
    freqs, mag = _spectrum(mono, rate)
    flux = np.maximum(0.0, np.diff(np.log1p(mag * 100), axis=1)).sum(axis=0)
    flux = flux - flux.mean()
    fps = rate / HOP
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    ok = (bpm >= TEMPO_RANGE[0]) & (bpm <= TEMPO_RANGE[1])
    lag = lags[ok][np.argmax(ac[ok])]
    # refine with the neighbours (parabolic peak)
    if 1 <= lag < len(ac) - 1:
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
        lag = lag + 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) else lag
    period = float(lag)
    phases = np.arange(int(period))
    score = [flux[int(p)::max(1, int(round(period)))].sum() for p in phases]
    first = phases[int(np.argmax(score))] / fps
    return 60 * fps / period, float(first)


def _bars(n_samples, rate, tempo, start_beat, bpb):
    """Song bars wholly inside the recording: [(bar number, start sample, end sample)]."""
    spb = 60.0 / tempo * rate          # samples per beat
    # A recording that starts a hair after a bar line (Live starts it a few ms late) still counts that bar
    first = int(np.ceil(start_beat / bpb - 0.1)) + 1
    out = []
    bar = first
    while True:
        s = ((bar - 1) * bpb - start_beat) * spb
        e = s + bpb * spb
        if e > n_samples + 1:
            break
        out.append((bar, max(0, int(round(s))), int(round(min(e, n_samples)))))
        bar += 1
    return out


def _features(mono, rate, bars):
    freqs, mag = _spectrum(mono, rate)
    power = mag ** 2
    chroma_m = _chroma_matrix(freqs)
    bands = [(20, 250), (250, 2000), (2000, 16000)]
    flux = np.maximum(0.0, np.diff(np.log1p(mag * 100), axis=1)).sum(axis=0)
    rows = []
    for _, s, e in bars:
        f0, f1 = s // HOP, max(s // HOP + 1, e // HOP)
        p = power[:, f0:f1].mean(axis=1)
        total = p.sum() + 1e-12
        level = 10 * np.log10(total)
        balance = [10 * np.log10(p[(freqs >= lo) & (freqs < hi)].sum() / total + 1e-12) for lo, hi in bands]
        ch = chroma_m @ p
        ch = ch / (np.linalg.norm(ch) + 1e-12)
        busy = float(np.log1p(flux[f0:min(f1, len(flux))].mean())) if f1 <= len(flux) else 0.0
        rows.append({"level": level, "balance": balance, "chroma": ch, "busy": busy})
    return rows


def _novelty(F):
    """How different the KERNEL bars after each bar line are from the KERNEL bars before it."""
    Z = (F - F.mean(axis=0)) / (F.std(axis=0) + 1e-9)
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-9)
    S = Z @ Z.T
    n = len(F)
    nov = np.zeros(n)
    for i in range(1, n):
        k = min(KERNEL, i, n - i)
        a, b = S[i - k:i, i - k:i], S[i:i + k, i:i + k]
        cross = S[i - k:i, i:i + k]
        nov[i] = (a.mean() + b.mean()) / 2 - cross.mean()
    return nov


def _edges(nov, bar_numbers):
    """Part edges (indexes into bars) on the 4-bar grid, strongest first, at least MIN_BARS apart."""
    n = len(nov)
    cand = [i for i in range(1, n) if (bar_numbers[i] - 1) % GRID == 0 and min(i, n - i) >= MIN_BARS // 2]
    if not cand:
        return [], {}
    vals = np.array([nov[i] for i in cand])
    floor = max(0.15, float(np.median(vals) + 0.5 * vals.std()))
    chosen = []
    for i in sorted(cand, key=lambda j: -nov[j]):
        if nov[i] < floor:
            break
        if all(abs(i - j) >= MIN_BARS for j in chosen) and i >= MIN_BARS and n - i >= MIN_BARS:
            chosen.append(i)
    # No part longer than MAX_BARS: split it at its strongest line, even a weak one (a drop running into the outro)
    while True:
        bounds = [0, *sorted(chosen), n]
        long = next(((a, b) for a, b in zip(bounds, bounds[1:]) if b - a > MAX_BARS), None)
        if not long:
            break
        inside = [i for i in cand if long[0] + MIN_BARS <= i <= long[1] - MIN_BARS and i not in chosen]
        if not inside:
            break
        chosen.append(max(inside, key=lambda j: nov[j]))
    top = max([nov[i] for i in chosen], default=1.0) or 1.0
    return sorted(chosen), {i: round(float(max(nov[i], 0) / top), 2) for i in chosen}


def find(audio, rate, tempo=None, start_beat=0.0, beats_per_bar=4.0):
    """The song's parts. audio: (samples, channels). Returns {tempo, first_downbeat_sec, bars, sections, error}."""
    mono = _mono(np.asarray(audio, dtype=np.float64))
    lufs = pyln.Meter(rate).integrated_loudness(audio) if len(mono) > rate else float("-inf")
    if not np.isfinite(lufs) or lufs < SILENT_LUFS:
        return {"tempo": tempo, "first_downbeat_sec": None, "bars": 0, "sections": [], "error": "The recording is silent, so there are no parts to find."}
    first_sec = None
    if not tempo:
        tempo, first_sec = estimate_tempo(mono, rate)
        start_beat = -first_sec * tempo / 60.0      # bar 1 starts on the first beat found
    bars = _bars(len(mono), rate, tempo, start_beat, beats_per_bar)
    if len(bars) < MIN_BARS:
        return {"tempo": round(tempo, 2), "first_downbeat_sec": first_sec, "bars": len(bars), "sections": [],
                "error": f"Only {len(bars)} bars were heard. Aria needs at least {MIN_BARS} to find parts."}
    feats = _features(mono, rate, bars)
    # The song ends with its last sound (Ian): silent bars at the end, like a reverb tail Live counts, aren't a part
    loudest = max(f["level"] for f in feats)
    while len(feats) > MIN_BARS and feats[-1]["level"] < loudest - TAIL_DB:
        feats.pop()
        bars.pop()
    F = np.array([[f["level"] / 6, *f["balance"], f["busy"], *(f["chroma"] * 3)] for f in feats])
    edges, strength = _edges(_novelty(F), [b[0] for b in bars])
    bounds = [0, *edges, len(bars)]
    top_level = max(f["level"] for f in feats)
    sections, protos = [], []
    for k in range(len(bounds) - 1):
        a, b = bounds[k], bounds[k + 1]
        part = feats[a:b]
        level = np.array([f["level"] for f in part])
        # what the part sounds like, without its loudness: notes and tone balance
        sig = np.concatenate([np.mean([f["chroma"] for f in part], axis=0), np.mean([f["balance"] for f in part], axis=0) / 20])
        sig = sig / (np.linalg.norm(sig) + 1e-12)
        label = next((chr(65 + j) for j, p in enumerate(protos) if float(sig @ p) >= SAME_PART), None)
        if label is None:
            protos.append(sig)
            label = chr(64 + len(protos))
        rise = float(np.polyfit(np.arange(len(level)), level, 1)[0]) if len(level) > 2 else 0.0
        s_sample, e_sample = bars[a][1], bars[b - 1][2]
        sections.append({
            "name": None, "label": label, "start_bar": bars[a][0], "bars": b - a,
            "start_sec": round(s_sample / rate, 2), "end_sec": round(e_sample / rate, 2),
            "energy_db": round(float(level.mean() - top_level), 1),     # against the loudest bar of the song
            "rise_db_per_bar": round(rise, 2),                          # a build climbs, a drop stays up
            "confidence": 1.0 if a == 0 else strength.get(a, 0.5),
        })
    return {"tempo": round(float(tempo), 2), "first_downbeat_sec": None if first_sec is None else round(first_sec, 3),
            "bars": len(bars), "sections": sections, "error": None}


def join_intro(parts):
    """The named parts with the Intro parts at the start joined into one (muse.validate_section_names names everything
    before the first break Intro). Its loudness and rise are the bar-weighted average of the parts it's made of."""
    n = next((i for i, s in enumerate(parts) if s.get("name") != "Intro"), len(parts))
    if n < 2:
        return parts
    head, total = parts[:n], sum(s["bars"] for s in parts[:n])
    avg = lambda k: round(sum(s[k] * s["bars"] for s in head) / total, 2 if k == "rise_db_per_bar" else 1)
    intro = {**head[0], "bars": total, "end_sec": head[-1]["end_sec"], "energy_db": avg("energy_db"), "rise_db_per_bar": avg("rise_db_per_bar")}
    return [intro, *parts[n:]]
