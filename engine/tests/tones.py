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
