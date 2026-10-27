"""Split mode: separate a recording into vocals, drums, bass and other with Meta's Demucs.

License: Demucs code is MIT. Its author says the weights' license is unclear (trained
partly on MUSDB, which is research only). Aria uses it for the hackathon prototype only,
disclosed in the README. The weights download on first use and are never in the repo.

Runs on the CPU. Apple's GPU backend fails with htdemucs ("Output channels > 65536 not
supported at the MPS device"). On Ian's Mac, 25 s of audio takes about 10 s.
"""
import math
import threading

import numpy as np
from scipy.signal import resample_poly

MODEL_NAME = "htdemucs"
_model = None
_lock = threading.Lock()


def available():
    try:
        import demucs  # noqa: F401
        import torch  # noqa: F401
    except ImportError:
        return False
    return True


def _load():
    global _model
    with _lock:
        if _model is None:
            from demucs.pretrained import get_model
            _model = get_model(MODEL_NAME)
            _model.eval()
    return _model


def warm_up():
    """Load the model in the background so the first Check mix isn't slow."""
    if available():
        threading.Thread(target=_load, daemon=True, name="demucs-warm-up").start()


def separate(audio, rate):
    """audio: (samples, channels) floats. Returns ({stem: (samples, 2)}, rate) or (None, reason)."""
    import torch
    from demucs.apply import apply_model

    model = _load()
    x = np.asarray(audio, dtype=np.float32).T
    if x.shape[0] == 1:
        x = np.repeat(x, 2, axis=0)
    if rate != model.samplerate:
        g = math.gcd(int(rate), int(model.samplerate))
        x = resample_poly(x, model.samplerate // g, int(rate) // g, axis=1).astype(np.float32)
    wav = torch.from_numpy(x)
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std()
    if float(std) < 1e-6:
        return None, "The recording is silent."
    # Normalize like the demucs command-line tool does, then undo it.
    with torch.no_grad():
        out = apply_model(model, ((wav - mean) / std)[None], device="cpu", progress=False)[0] * std + mean
    return {name: out[i].numpy().T for i, name in enumerate(model.sources)}, model.samplerate
