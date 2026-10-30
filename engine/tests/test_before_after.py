"""Before and after (Oct 30): the same bars after a fix, lined up beat for beat and loudness matched.
Test tones stay in tests."""
import numpy as np
from fastapi.testclient import TestClient

from aria_engine.app import app
from tones import write

RATE, TEMPO = 48000, 120.0          # 2 s a bar
client = TestClient(app)


def mix(boost=1.0, seconds=34.0, seed=0):
    rng = np.random.default_rng(seed)
    n = int(seconds * RATE)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / RATE)
    spec /= np.maximum(f, 20) ** 0.5                          # pink-ish
    spec[(f > 3000) & (f < 4000)] *= boost                    # the harsh stretch
    x = np.fft.irfft(spec, n)
    return 0.2 * x / np.abs(x).max()


def test_a_cut_in_the_problem_range_shows_as_a_drop_there(tmp_path):
    before = write(tmp_path / "before.wav", mix(boost=3.0), mix(boost=3.0))
    after_audio = mix(boost=1.5)
    after = write(tmp_path / "after.wav", after_audio, after_audio)
    finding = {"kind": "harsh", "hz": 3500, "hz_range": [3000, 4000], "size_db": 7.0, "bars": [1, 16]}
    body = client.post("/mix/before-after", json={"before": {"path": before, "start_beat": 0.0}, "after": {"path": after, "start_beat": 0.0},
                                                  "tempo": TEMPO, "bars": 16, "findings": [finding]}).json()
    change = body["problems"][0]["change_db"]
    assert -8 < change < -3, body["problems"]                # 3.0 -> 1.5 is about -6 dB
    assert len(body["curve"]["mine"]) == len(body["curve"]["ref"]) > 50


def test_the_after_take_is_lined_up_on_the_beat(tmp_path):
    audio = mix(boost=2.0)
    before = write(tmp_path / "before.wav", audio[RATE:], audio[RATE:])       # started a beat into bar 1 (beat 2)
    after = write(tmp_path / "after.wav", audio, audio)                       # started on bar 1 (beat 0)
    finding = {"kind": "harsh", "hz": 3500, "hz_range": [3000, 4000], "bars": [1, 16]}
    body = client.post("/mix/before-after", json={"before": {"path": before, "start_beat": 2.0}, "after": {"path": after, "start_beat": 0.0},
                                                  "tempo": TEMPO, "bars": 16, "findings": [finding]}).json()
    assert abs(body["problems"][0]["change_db"]) < 0.5        # the same audio, lined up: nothing changed
    assert abs(body["seconds"] - 32.0) < 1.0
