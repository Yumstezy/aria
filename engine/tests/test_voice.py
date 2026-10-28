"""Talk to Muse: the recording is converted to what Muse Voice Transcribe accepts, and its words come back."""
import io
import json
from types import SimpleNamespace

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from aria_engine import voice
from aria_engine.app import app


def wav(seconds=1.0, rate=44100, channels=2, subtype="FLOAT"):
    t = np.arange(int(seconds * rate)) / rate
    x = 0.3 * np.sin(2 * np.pi * 220 * t)            # a test tone, never app data
    out = io.BytesIO()
    sf.write(out, np.stack([x] * channels, axis=1), rate, format="WAV", subtype=subtype)
    return out.getvalue()


def test_any_recording_becomes_16_khz_mono_16_bit():
    info = sf.info(io.BytesIO(voice.to_api_wav(wav(rate=48000))))
    assert (info.samplerate, info.channels, info.subtype) == (16000, 1, "PCM_16")


def test_too_short_or_too_long_says_so():
    for seconds, words in ((0.1, "too short"), (31, "under 30")):
        try:
            voice.to_api_wav(wav(seconds, rate=16000, channels=1))
            assert False
        except voice.VoiceError as e:
            assert words in str(e)


def test_transcribe_sends_the_request_and_reads_the_words(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "k")
    seen = {}

    def post(url, headers, timeout, files):
        seen.update(url=url, request=json.loads(files["request"][1]), audio=files["audio"][1])
        return SimpleNamespace(status_code=200, json=lambda: {"turns": [{"transcript": "cut the mud"}, {"transcript": "on the bass"}]})

    assert voice.transcribe(wav(), client=SimpleNamespace(post=post)) == "cut the mud on the bass"
    assert seen["url"].endswith("/asr/transcribe") and seen["request"]["model"] == "muse-voice-transcribe-1.0"
    assert sf.info(io.BytesIO(seen["audio"])).samplerate == 16000


def test_no_key_and_no_words_are_plain_errors(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    res = TestClient(app).post("/voice/transcribe", content=wav(), headers={"Content-Type": "audio/wav"})
    assert res.status_code == 400 and "MODEL_API_KEY" in res.json()["detail"]
    monkeypatch.setenv("MODEL_API_KEY", "k")
    silent = SimpleNamespace(post=lambda *a, **k: SimpleNamespace(status_code=200, json=lambda: {"transcript": ""}))
    try:
        voice.transcribe(wav(), client=silent)
        assert False
    except voice.VoiceError as e:
        assert "didn't catch any words" in str(e)
