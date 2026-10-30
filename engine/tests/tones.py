"""Test tones for engine tests. They stay in tests and never reach the app."""
import numpy as np
import soundfile as sf

RATE = 48000


def sine(hz, amp, seconds=3.0, rate=RATE):
    t = np.arange(int(seconds * rate)) / rate
    return amp * np.sin(2 * np.pi * hz * t)


def write(path, left, right=None, rate=RATE):
    data = left if right is None else np.column_stack([left, right])
    sf.write(path, data, rate, subtype="PCM_24")
    return str(path)


def hits(times, seconds, rate=RATE, seed=0):
    """Short drum-like hits (a decaying noise burst) starting at the given times in seconds, for timing tests."""
    rng = np.random.default_rng(seed)
    out = np.zeros(int(seconds * rate))
    n = int(0.06 * rate)
    burst = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.012 * rate)) * 0.5
    for t in times:
        i = int(round(t * rate))
        out[i:i + n] += burst[:max(0, min(n, len(out) - i))]
    return out


def syllables(times, seconds, rate=RATE, accents=()):
    """Vocal-like syllables for timing tests: a sung tone (220 to 330 Hz with a few harmonics) with a soft 15 ms
    attack, 150 ms long, at the given times; the ones in accents are twice as loud."""
    out = np.zeros(int(seconds * rate))
    n = int(0.15 * rate)
    t = np.arange(n) / rate
    env = np.minimum(1, t / 0.015) * np.exp(-t / 0.12)
    for k, start in enumerate(times):
        f = 220 + 110 * ((k * 3) % 4) / 3
        tone = sum(np.sin(2 * np.pi * f * h * t) / h for h in (1, 2, 3)) * env * (0.5 if k in accents else 0.25)
        i = int(round(start * rate))
        out[i:i + n] += tone[:max(0, min(n, len(out) - i))]
    return out
