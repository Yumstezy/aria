from fastapi.testclient import TestClient

from aria_engine import muse
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

    def fake_advise(measured, context):
        seen.update(measured=measured, context=context)
        return {"summary": "ok", "notes": []}, None

    monkeypatch.setattr(muse, "advise", fake_advise)
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    body = client.post("/mix/analyze", json={"mix_path": path, "tempo": 150.0, "bars": 8}).json()
    assert body["advice_by"] == "Muse Spark"
    assert seen["context"] == {"bars": 8, "tempo": 150.0}
    assert seen["measured"] == body["measured"]


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


def test_reference_is_not_silently_ignored(tmp_path):
    path = write(tmp_path / "mix.wav", sine(1000, 0.5), sine(1000, 0.5))
    res = client.post("/mix/analyze", json={"mix_path": path, "reference_path": path})
    assert res.status_code == 501
