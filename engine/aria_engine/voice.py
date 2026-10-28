"""Talk to Muse: Meta's Muse Voice Transcribe turns a spoken request into text (build step 1.4).

The API takes only mono 16-bit PCM WAV at 16 or 24 kHz, so whatever the microphone recorded (any rate,
stereo, float) is converted to 16 kHz mono 16-bit first. The words then go to Ask Muse like typed ones.
"""
import io
import json
import os

import httpx
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

URL = "/asr/transcribe"
MODEL = "muse-voice-transcribe-1.0"
RATE = 16000
MAX_SECONDS = 30.0      # a spoken request, not a podcast
MIN_SECONDS = 0.3
TIMEOUT_SEC = 20.0


class VoiceError(Exception):
    """Something the producer can act on, in plain words."""


def to_api_wav(raw: bytes) -> bytes:
    """Any WAV or AIFF the browser or Live made, as mono 16-bit PCM WAV at 16 kHz."""
    try:
        audio, rate = sf.read(io.BytesIO(raw), always_2d=True, dtype="float64")
    except (RuntimeError, sf.LibsndfileError):
        raise VoiceError("Aria couldn't read that recording.")
    seconds = len(audio) / rate
    if seconds < MIN_SECONDS:
        raise VoiceError("That was too short. Hold the mic while you speak.")
    if seconds > MAX_SECONDS:
        raise VoiceError(f"Keep it under {int(MAX_SECONDS)} seconds.")
    mono = audio.mean(axis=1)
    peak = float(np.abs(mono).max()) if len(mono) else 0.0
    # Local engine log only: how long and how loud, for "Muse didn't hear me"
    print(f"voice: {seconds:.1f} s at {rate} Hz, peak {20 * np.log10(peak + 1e-9):.0f} dBFS")
    g = np.gcd(int(rate), RATE)
    pcm = resample_poly(mono, RATE // g, int(rate) // g)
    out = io.BytesIO()
    sf.write(out, np.clip(pcm, -1.0, 1.0), RATE, format="WAV", subtype="PCM_16")
    return out.getvalue()


def _transcript(body):
    """The words, wherever the response keeps them (a top-level transcript, or one per turn)."""
    if isinstance(body, dict):
        if isinstance(body.get("transcript"), str):
            return body["transcript"]
        parts = [_transcript(v) for v in body.values()]
    elif isinstance(body, list):
        parts = [_transcript(v) for v in body]
    else:
        return ""
    return " ".join(p for p in parts if p).strip()


def transcribe(raw: bytes, client=None) -> str:
    """The spoken request as text. Raises VoiceError with a plain reason."""
    key = os.environ.get("MODEL_API_KEY", "").strip()
    if not key:
        raise VoiceError("No Muse key. Add MODEL_API_KEY to engine/.env and restart the engine.")
    wav = to_api_wav(raw)
    base = os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1").rstrip("/")
    request = {"model": MODEL, "audioEncoding": "WAV", "mode": "PUSH_TO_TALK"}
    try:
        res = (client or httpx).post(base + URL, headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT_SEC,
                                     files={"request": (None, json.dumps(request), "application/json"),
                                            "audio": ("request.wav", wav, "audio/wav")})
    except httpx.HTTPError as e:
        raise VoiceError(f"Muse Voice is unavailable right now ({type(e).__name__}).")
    if res.status_code != 200:
        raise VoiceError(f"Muse Voice couldn't transcribe that (HTTP {res.status_code}).")
    text = _transcript(res.json())
    if not text:
        raise VoiceError("Muse didn't catch any words. Try again a little closer to the mic.")
    return text
