from fastapi.testclient import TestClient

import numpy as np

from aria_engine import muse, split
from aria_engine.app import app
from tones import sine, write

client = TestClient(app)


def test_analyze_returns_measurements_and_says_why_no_advice(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    res = client.post("/mix/analyze", json={"mix_path": path, "tempo": 124.0, "bars": 8, "start_beat": 0.0})
    assert res.status_code == 200
    body = res.json()
    assert body["reference"] is None
    assert body["measured"]["true_peak_dbtp"] is not None
    assert body["advice"] is None and "MODEL_API_KEY" in body["advice_error"]


def test_analyze_passes_measurements_to_muse(tmp_path, monkeypatch):
    seen = {}

    def fake_advise(measured, context, findings=None):
        seen.update(measured=measured, context=context, findings=findings)
        return {"summary": "ok", "notes": []}, None

    monkeypatch.setattr(muse, "advise", fake_advise)
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    body = client.post("/mix/analyze", json={"mix_path": path, "tempo": 150.0, "bars": 8}).json()
    assert body["advice_by"] == "Muse Spark"
    assert seen["context"] == {"bars": 8, "tempo": 150.0}
    assert seen["measured"] == body["measured"]
    assert seen["findings"] == body["clarity"]["findings"]
    assert body["clarity"]["mode"] == "master"


def test_silent_recording_skips_muse(tmp_path, monkeypatch):
    monkeypatch.setattr(muse, "advise", lambda *a: (_ for _ in ()).throw(AssertionError("called Muse")))
    path = write(tmp_path / "s.wav", sine(1000, 0.0), sine(1000, 0.0))
    body = client.post("/mix/analyze", json={"mix_path": path}).json()
    assert body["advice"] is None and "silent" in body["advice_error"]


def test_missing_file_is_a_clear_400():
    res = client.post("/mix/analyze", json={"mix_path": "/nope/mix.wav"})
    assert res.status_code == 400 and "No file" in res.json()["detail"]


def test_non_audio_path_is_refused():
    res = client.post("/mix/analyze", json={"mix_path": "/etc/passwd"})
    assert res.status_code == 400


def test_a_reference_is_compared_not_ignored(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    body = client.post("/mix/analyze", json={"mix_path": path, "reference_path": path, "reference_name": "My Song.wav"}).json()
    assert body["reference"]["name"] == "My Song.wav"
    assert all(abs(b["diff_db"]) < 0.1 for b in body["reference"]["bands"] if b["diff_db"] is not None)


def test_a_missing_reference_is_a_clear_400(tmp_path):
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    res = client.post("/mix/analyze", json={"mix_path": path, "reference_path": "/nope/ref.mp3"})
    assert res.status_code == 400 and "reference" in res.json()["detail"].lower()


def test_split_mode_puts_stem_findings_first(tmp_path, monkeypatch):
    rng = np.random.default_rng(0)
    rate = 44100
    def band(seed, lo, hi, db):
        from scipy.signal import butter, sosfilt
        x = sosfilt(butter(4, [lo, hi], btype="band", fs=rate, output="sos"), np.random.default_rng(seed).standard_normal(rate * 16))
        return np.column_stack([x, x]) / np.std(x) * 10 ** (db / 20)
    fake_stems = {"vocals": band(1, 800, 3500, -30), "drums": band(2, 1000, 4000, -20),
                  "bass": band(3, 40, 140, -15), "other": band(4, 160, 380, -22)}
    monkeypatch.setattr(split, "available", lambda: True)
    monkeypatch.setattr(split, "separate", lambda audio, r: (fake_stems, rate))
    monkeypatch.setattr(muse, "advise", lambda *a, **k: (None, "skipped in test"))
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    body = client.post("/mix/analyze", json={"mix_path": path, "tempo": 120.0, "start_beat": 0.0}).json()
    assert body["clarity"]["mode"] == "split"
    assert body["clarity"]["findings"][0]["kind"] == "masking"
    assert body["clarity"]["findings"][0]["masked"] == "vocals"
    assert set(body["clarity"]["stems"]) == {"vocals", "drums", "bass", "other"}
    assert body["clarity"]["space"]["vocals"]["presence"]["vs_rest_db"] < 0


def test_a_reference_window_compares_with_just_that_part(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    ref = write(tmp_path / "ref.wav", np.concatenate([sine(200, 0.5), sine(1000, 0.5)]), np.concatenate([sine(200, 0.5), sine(1000, 0.5)]))
    whole = client.post("/mix/analyze", json={"mix_path": path, "reference_path": ref}).json()["reference"]
    part = client.post("/mix/analyze", json={"mix_path": path, "reference_path": ref, "reference_window": [3.0, 6.0], "reference_part": "Drop"}).json()["reference"]
    assert part["part"] == "Drop" and whole["part"] is None
    mids = lambda r: next(b["diff_db"] for b in r["bands"] if b["name"] == "Mids")
    assert abs(mids(part)) < abs(mids(whole))   # the matching stretch is the same tone, the whole song isn't


def test_without_a_reference_nothing_is_compared(tmp_path, monkeypatch):
    """Ian, Oct 30: the "good mixes" comparison is out. With no reference song, only the clarity rules speak."""
    monkeypatch.setenv("MODEL_API_KEY", "")
    path = write(tmp_path / "mix.wav", sine(3000, 0.5), sine(3000, 0.5))
    body = client.post("/mix/analyze", json={"mix_path": path}).json()
    assert body["reference"] is None and "typical" not in body
    assert all(f["kind"] != "reference" for f in body["clarity"]["findings"])
