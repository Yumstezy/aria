"""The data behind the judges' Try it demo, measured from real audio (Nov 1).

  engine/.venv/bin/python judges/scripts/make_demo_data.py <after.wav from Live>

- demo-tracks.json: each of the five sample stems as the app draws a waveform (Window.tsx, the Live analyzer): the
  level of each moment, and its color from where its sound is: the share of power below 200 Hz (red), 200 Hz to
  2 kHz (orange) and above 2 kHz (green), in sixth-octave bands tipped up 1.5 dB an octave, as the app does.
- demo-reveal.json: the same for the whole mix before and after, plus each one's average spectrum and the change in
  seven bands, with After matched to Before's loudness (BS.1770) first, so a louder mix doesn't read as a better one.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "test-pack" / "sample"
OUT = ROOT / "judges" / "src"
TRACKS = ["KICK", "DRUMS", "BASS", "LEADS", "VOCAL"]
POINTS = 512                     # across the 16 bars: 32 a bar
BANDS = 31.25 * 2 ** (np.arange(55) / 6)   # the app's analyzer bands (ANALYZER_HZ)
TILT = (4.5 - 10 * np.log10(2)) * np.log2(BANDS / 1000)   # plot.tsx tilt()
FLOOR_DB = -24                   # a moment this far under the loudest is drawn as a hairline
SEVEN = [("Sub", 20, 60), ("Bass", 60, 150), ("Low mids", 150, 400), ("Mids", 400, 1000),
         ("Upper mids", 1000, 4000), ("Highs", 4000, 10000), ("Air", 10000, 20000)]


def frames(x, n=POINTS):
    mono = x.mean(axis=1)
    return np.array_split(mono, n)


def band_power(seg, rate):
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / rate)
    lo, hi = BANDS * 2 ** (-1 / 12), BANDS * 2 ** (1 / 12)
    return np.array([spec[(f >= a) & (f < b)].sum() for a, b in zip(lo, hi)])


def color(p):
    p = p * 10 ** (TILT / 10)
    t = p.sum() or 1.0
    a, b, c = p[BANDS < 200].sum() / t, p[(BANDS >= 200) & (BANDS < 2000)].sum() / t, p[BANDS >= 2000].sum() / t
    return [round(255 * a + 255 * b + 61 * c), round(77 * a + 170 * b + 220 * c), round(77 * a + 40 * b + 132 * c)]


def wave(x, rate):
    segs = frames(x)
    peak_db = np.array([20 * np.log10(np.abs(s).max() + 1e-9) for s in segs])
    top = peak_db.max()
    heights = np.clip((peak_db - top - FLOOR_DB) / -FLOOR_DB, 0, 1)
    return {"h": [round(float(v), 3) for v in heights], "rgb": [color(band_power(s, rate)) for s in segs]}


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
        tracks.append({"name": name, **wave(x, rate)})
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
    json.dump({"source": "Before: test-pack/sample/Rough mix.wav. After: Ian's export from Live after the run, shifted "
                         f"{k} samples to line up and turned {'down' if gain_db < 0 else 'up'} {abs(gain_db):.1f} dB to Before's loudness (BS.1770).",
               "gain_db": round(gain_db, 1), "hz": [round(float(f), 1) for f in BANDS],
               "before": {**wave(before, rate), "spectrum": spectrum(before, rate)},
               "after": {**wave(after, rate), "spectrum": spectrum(after, rate)},
               "bands": [{"name": nm, "lo": a, "hi": b, "diff_db": round(float(d), 1)} for (nm, a, b), d in zip(SEVEN, diffs)]},
              open(OUT / "demo-reveal.json", "w"), separators=(",", ":"))
    print("bands after vs before (dB, same loudness):", {nm: round(float(d), 1) for (nm, _, _), d in zip(SEVEN, diffs)})


if __name__ == "__main__":
    main(sys.argv[1])
