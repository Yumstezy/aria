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
