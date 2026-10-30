"""Comparing with a reference (build step 8). The planted mixes in test-pack/mixes are Ian's song with one
EQ boost each (test-pack/answer-key.json); control.wav is the same song's untouched first 16 bars. The audio
stays local, so these skip where it isn't."""
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from aria_engine import reference
from aria_engine.app import app
from tones import sine, write

MIXES = Path(__file__).resolve().parents[2] / "test-pack" / "mixes"
needs_mixes = pytest.mark.skipif(not (MIXES / "control.wav").exists(), reason="test-pack mixes are local only")
client = TestClient(app)


def load(name):
    return sf.read(str(MIXES / f"{name}.wav"), always_2d=True, dtype="float64")


def compare(name):
    (x, r), (ref, rr) = load(name), load("control")
    return reference.compare(x, r, ref, rr)


@needs_mixes
def test_the_reference_against_itself_finds_nothing():
    out = compare("control")
    assert out["findings"] == []
    assert all(abs(b["diff_db"]) < 0.1 for b in out["bands"])


@needs_mixes
@pytest.mark.parametrize("name,lo,hi", [("A", 150, 400), ("B", 3000, 5000), ("C", 300, 800)])
def test_each_planted_boost_stands_out_against_the_reference(name, lo, hi):
    found = compare(name)["findings"]
    hits = [f for f in found if lo <= f["hz"] <= hi and f["diff_db"] > 0]
    assert hits, f"{name}: {found}"


@needs_mixes
def test_section_changes_alone_are_not_flagged():
    # A's sub is about 3 dB under the intro's: a real difference between sections, not a problem to fix
    assert not [f for f in compare("A")["findings"] if f["hz"] < 100]


def test_a_silent_reference_says_so():
    tone = np.stack([sine(1000, 0.5), sine(1000, 0.5)], axis=1)
    out = reference.compare(tone, 44100, np.zeros_like(tone), 44100)
    assert out["findings"] == [] and "silent" in out["error"]


def test_upload_keeps_the_file_and_returns_its_path(tmp_path, monkeypatch):
    monkeypatch.setattr(reference, "STORE", tmp_path / "refs")
    src = write(tmp_path / "song.wav", sine(440, 0.5), sine(440, 0.5))
    data = Path(src).read_bytes()
    body = client.post("/reference?name=My%20Song.wav", content=data).json()
    assert body["name"] == "My Song.wav" and Path(body["path"]).read_bytes() == data
    assert body["seconds"] > 0
    # The same song twice is kept once
    assert client.post("/reference?name=again.wav", content=data).json()["path"] == body["path"]


def test_upload_that_isnt_audio_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(reference, "STORE", tmp_path / "refs")
    res = client.post("/reference?name=notes.txt", content=b"hello")
    assert res.status_code == 400
