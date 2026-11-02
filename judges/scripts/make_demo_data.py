"""The data behind the judges' Try it demo, measured from real audio (Nov 1).

  engine/.venv/bin/python judges/scripts/make_demo_data.py <after.wav from Live>

- demo-tracks.json: each of the five sample stems as a detailed waveform, drawn the way pro DJ and audio software
  draws one (Ian, Nov 2): COLUMNS thin columns across the 16 bars, each with its peak and its body (RMS) and a
  color from its own lows (below 200 Hz, red), mids (200 Hz to 2 kHz, pink) and highs (above 2 kHz, cyan).
- demo-reveal.json: the same for the whole mix before and after, plus each one's average spectrum and the change in
  seven bands, with After matched to Before's loudness (BS.1770) first, so a louder mix doesn't read as a better one.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, sosfilt
import base64

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "test-pack" / "sample"
OUT = ROOT / "judges" / "src"
TRACKS = ["KICK", "DRUMS", "BASS", "LEADS", "VOCAL"]
COLUMNS = 2400                   # across the 16 bars: about 12 ms each, one per screen pixel on a wide retina lane
# Each band's level is weighted before the color is mixed, so a typical mix shows all three: music has far more
# power in the lows than the highs. Weights picked by eye on the five stems, then fixed for every waveform.
BAND_WEIGHT = (1.0, 2.2, 5.0)
LOW_RGB, MID_RGB, HIGH_RGB = np.array([255, 64, 40]), np.array([240, 64, 200]), np.array([56, 196, 255])
BANDS = 31.25 * 2 ** (np.arange(55) / 6)   # the app's analyzer bands (ANALYZER_HZ)
TILT = (4.5 - 10 * np.log10(2)) * np.log2(BANDS / 1000)   # plot.tsx tilt()
SEVEN = [("Sub", 20, 60), ("Bass", 60, 150), ("Low mids", 150, 400), ("Mids", 400, 1000),
         ("Upper mids", 1000, 4000), ("Highs", 4000, 10000), ("Air", 10000, 20000)]


def band_power(seg, rate):
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / rate)
    lo, hi = BANDS * 2 ** (-1 / 12), BANDS * 2 ** (1 / 12)
    return np.array([spec[(f >= a) & (f < b)].sum() for a, b in zip(lo, hi)])


def b64(a):
    return base64.b64encode(np.asarray(a, dtype=np.uint8).tobytes()).decode()


def wave(x, rate, scale=None):
    """COLUMNS columns, each its peak and RMS (0 to 255, against scale, the loudest peak by default) and its color.
    Base64 bytes, so 2400 columns stay small: p (peak), r (RMS), c (r, g, b per column)."""
    mono = x.mean(axis=1)
    cols = np.array_split(np.arange(len(mono)), COLUMNS)
    edges = [c[0] for c in cols] + [len(mono)]
    peak = np.array([np.abs(x[a:b]).max() for a, b in zip(edges, edges[1:])])
    rms = np.array([np.sqrt(np.mean(mono[a:b] ** 2)) for a, b in zip(edges, edges[1:])])
    scale = scale or peak.max()
    bands = [sosfilt(butter(4, 200, "lowpass", fs=rate, output="sos"), mono),
             sosfilt(butter(2, [200, 2000], "bandpass", fs=rate, output="sos"), mono),
             sosfilt(butter(4, 2000, "highpass", fs=rate, output="sos"), mono)]
    lvl = np.array([[np.sqrt(np.mean(bd[a:b] ** 2)) for a, b in zip(edges, edges[1:])] for bd in bands]) * np.array(BAND_WEIGHT)[:, None]
    mix = (lvl / (lvl.sum(axis=0) + 1e-12)).T @ np.array([LOW_RGB, MID_RGB, HIGH_RGB])
    mix = mix * (255 / np.maximum(mix.max(axis=1, keepdims=True), 1))   # full brightness: the height carries the level
    return {"n": COLUMNS, "p": b64(np.round(np.clip(peak / scale, 0, 1) * 255)), "r": b64(np.round(np.clip(rms / scale, 0, 1) * 255)),
            "c": b64(np.round(mix).astype(int).ravel())}, scale


def spectrum(x, rate):
    """Average power in the sixth-octave bands over the whole 16 bars, in dB (tipped as the app draws it)."""
    segs = np.array_split(x.mean(axis=1), 120)
    p = np.mean([band_power(s, rate) for s in segs], axis=0)
    return [round(float(v), 2) for v in 10 * np.log10(p + 1e-12) + TILT]


def seven(x, rate):
    spec = np.abs(np.fft.rfft(x.mean(axis=1))) ** 2
    f = np.fft.rfftfreq(len(x), 1 / rate)
    return np.array([10 * np.log10(spec[(f >= a) & (f < b)].sum() + 1e-12) for _, a, b in SEVEN])


def main(after_path):
    tracks = []
    for name in TRACKS:
        x, rate = sf.read(SAMPLE / f"{name}.flac", always_2d=True)
        tracks.append({"name": name, **wave(x, rate)[0]})
    json.dump({"source": "the five unmixed stems in test-pack/sample, measured by judges/scripts/make_demo_data.py",
               "tempo": 128, "bars": 16, "tracks": tracks}, open(OUT / "demo-tracks.json", "w"), separators=(",", ":"))

    before, rate = sf.read(SAMPLE / "Rough mix.wav", always_2d=True)
    after, r2 = sf.read(after_path, always_2d=True)
    assert r2 == rate
    # Live's export starts a few ms late: line it up with Before, then match its loudness
    x, y = after.mean(1)[: rate * 8], before.mean(1)[: rate * 8]
    n = len(x)
    cc = np.fft.irfft(np.fft.rfft(x, 2 * n) * np.conj(np.fft.rfft(y, 2 * n)))
    k = int(np.argmax(cc)); k = k - 2 * n if k > n else k
    if k > 0:
        after = np.concatenate([after[k:], after[:k]])
    m = pyln.Meter(rate)
    gain_db = m.integrated_loudness(before) - m.integrated_loudness(after)
    after = after * 10 ** (gain_db / 20)
    diffs = seven(after, rate) - seven(before, rate)
    wb, scale = wave(before, rate)
    scale = max(scale, np.abs(after).max())   # one scale for both, so their heights compare
    wb, _ = wave(before, rate, scale)
    json.dump({"source": "Before: test-pack/sample/Rough mix.wav. After: the export from Live after the run, shifted "
                         f"{k} samples to line up and turned {'down' if gain_db < 0 else 'up'} {abs(gain_db):.1f} dB to Before's loudness (BS.1770).",
               "gain_db": round(gain_db, 1), "hz": [round(float(f), 1) for f in BANDS],
               "before": {**wb, "spectrum": spectrum(before, rate)},
               "after": {**wave(after, rate, scale)[0], "spectrum": spectrum(after, rate)},
               "bands": [{"name": nm, "lo": a, "hi": b, "diff_db": round(float(d), 1)} for (nm, a, b), d in zip(SEVEN, diffs)]},
              open(OUT / "demo-reveal.json", "w"), separators=(",", ":"))
    print("bands after vs before (dB, same loudness):", {nm: round(float(d), 1) for (nm, _, _), d in zip(SEVEN, diffs)})


if __name__ == "__main__":
    main(sys.argv[1])
