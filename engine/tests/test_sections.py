"""The song's parts (build step 8b, Arrangement). A made-up song of clearly different 16-bar parts, as test tones
(they stay in tests), and Ian's song from test-pack where it's on this Mac."""
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from aria_engine import muse, sections
from aria_engine.app import app
from tones import write

RATE = 44100
TEMPO = 120.0                     # a bar of 4/4 is 2 seconds
BAR = int(RATE * 60 / TEMPO * 4)
MIXES = Path(__file__).resolve().parents[2] / "test-pack" / "mixes"
client = TestClient(app)


def part(kind, bars, gain=1.0, seed=0):
    """16 bars of one kind of sound, with a kick on every beat so there's a steady pulse."""
    n = bars * BAR
    t = np.arange(n) / RATE
    rng = np.random.default_rng(seed)
    beat = (t * TEMPO / 60) % 1.0
    kick = np.sin(2 * np.pi * 55 * t) * np.exp(-beat * 18) * 0.5
    if kind == "pad":       # A minor chord, low and soft
        x = sum(np.sin(2 * np.pi * f * t) for f in (220.0, 261.6, 329.6)) * 0.12
    elif kind == "lead":    # a bright high line on other notes
        x = sum(np.sin(2 * np.pi * f * t) for f in (1174.7, 1568.0)) * 0.2 + rng.normal(0, 0.02, n)
    else:                   # noise wash
        x = rng.normal(0, 0.15, n)
    return (x + kick) * gain


def song():
    # pad, lead, pad again but 6 dB louder, noise: edges at bars 17, 33 and 49
    return np.concatenate([part("pad", 16), part("lead", 16, seed=1), part("pad", 16, gain=2.0), part("noise", 16, seed=2)])


def test_finds_the_edges_between_parts_on_the_bar():
    out = sections.find(np.column_stack([song(), song()]), RATE, tempo=TEMPO, start_beat=0.0)
    starts = [s["start_bar"] for s in out["sections"]]
    assert starts == [1, 17, 33, 49], out["sections"]
    assert [s["bars"] for s in out["sections"]] == [16, 16, 16, 16]


def test_a_louder_repeat_is_the_same_part():
    out = sections.find(np.column_stack([song(), song()]), RATE, tempo=TEMPO, start_beat=0.0)
    labels = [s["label"] for s in out["sections"]]
    assert labels[0] == labels[2] and len(set(labels)) == 3, labels
    assert out["sections"][2]["energy_db"] > out["sections"][0]["energy_db"] + 4


def test_a_recording_that_starts_mid_bar_still_counts_bars_from_the_song():
    x = song()[BAR // 2:]                         # starts on beat 3 of bar 1
    out = sections.find(np.column_stack([x, x]), RATE, tempo=TEMPO, start_beat=2.0)
    assert [s["start_bar"] for s in out["sections"]][1:] == [17, 33, 49]


def test_tempo_is_found_when_live_cant_say():
    out = sections.find(np.column_stack([song(), song()]), RATE)
    assert abs(out["tempo"] - TEMPO) < 2, out["tempo"]
    assert len(out["sections"]) >= 3


def test_silence_says_so():
    out = sections.find(np.zeros((RATE * 20, 2)), RATE, tempo=TEMPO)
    assert out["sections"] == [] and "silent" in out["error"]


def test_endpoint_names_parts_with_muse_or_says_why(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    path = write(tmp_path / "song.wav", song(), song(), rate=RATE)
    body = client.post("/sections", json={"wav_path": path, "tempo": TEMPO, "start_beat": 0.0}).json()
    assert [s["start_bar"] for s in body["sections"]] == [1, 17, 33, 49]
    assert all(s["name"] is None for s in body["sections"]) and "MODEL_API_KEY" in body["names_error"]


def test_muse_names_are_checked_against_the_list(monkeypatch):
    found = [{"label": "A"}, {"label": "B"}, {"label": "A"}]
    names, err = muse.validate_section_names('{"names": ["Intro", "Drop", "Banana"]}', found)
    assert names is None and err
    names, err = muse.validate_section_names('{"names": ["Intro", "Drop", "Intro"]}', found)
    assert names == ["Intro", "Drop", "Outro"] and err is None


def test_a_song_opens_with_its_intro_and_closes_with_its_outro():
    found = [{"label": "A"}, {"label": "B"}, {"label": "A"}, {"label": "B"}]
    names, err = muse.validate_section_names('{"names": ["Drop", "Break", "Drop", "Break"]}', found)
    assert names == ["Intro", "Break", "Drop", "Outro"] and err is None


def test_everything_before_the_first_break_is_the_intro():
    """Ian, Oct 30: an EDM song opens with a DJ intro that runs to the first break, even when it's loud, so DJs can mix
    it in. THE WEEKEND came back Intro 1 to 8, Drop 9 to 40, Break 41: that's one Intro, bars 1 to 40."""
    found = [{"label": x} for x in "ABCDAC"]
    names, err = muse.validate_section_names('{"names": ["Intro", "Drop", "Break", "Build", "Drop", "Outro"]}', found)
    assert names == ["Intro", "Intro", "Break", "Build", "Drop", "Outro"] and err is None
    # No break at all: only the first part is the intro
    names, _ = muse.validate_section_names('{"names": ["Drop", "Build", "Drop", "Drop"]}', [{"label": x} for x in "ABAA"])
    assert names == ["Intro", "Build", "Drop", "Outro"]


def test_the_intro_parts_join_into_one():
    parts = [{"name": "Intro", "label": "A", "start_bar": 1, "bars": 8, "start_sec": 0.0, "end_sec": 12.6, "energy_db": -9.0, "rise_db_per_bar": 0.2, "confidence": 1.0},
             {"name": "Intro", "label": "B", "start_bar": 9, "bars": 32, "start_sec": 12.6, "end_sec": 63.2, "energy_db": -1.0, "rise_db_per_bar": 0.0, "confidence": 0.8},
             {"name": "Break", "label": "C", "start_bar": 41, "bars": 8, "start_sec": 63.2, "end_sec": 75.8, "energy_db": -12.0, "rise_db_per_bar": 0.0, "confidence": 0.9}]
    out = sections.join_intro(parts)
    assert [(s["name"], s["start_bar"], s["bars"]) for s in out] == [("Intro", 1, 40), ("Break", 41, 8)]
    assert out[0]["end_sec"] == 63.2 and out[0]["energy_db"] == round((-9 * 8 + -1 * 32) / 40, 1)


@pytest.mark.skipif(not (MIXES / "full.wav").exists(), reason="test-pack mixes are local only")
def test_ians_song_has_a_few_parts_on_four_bar_lines():
    x, r = sf.read(str(MIXES / "full.wav"), always_2d=True, dtype="float64")
    out = sections.find(x, r, tempo=165.0, start_beat=0.0)
    assert 2 <= len(out["sections"]) <= 8
    assert all((s["start_bar"] - 1) % 4 == 0 for s in out["sections"])


def test_silent_bars_at_the_end_are_not_a_part():
    x = np.concatenate([song(), np.zeros(BAR * 8)])          # 8 bars of nothing after the song
    out = sections.find(np.column_stack([x, x]), RATE, tempo=TEMPO, start_beat=0.0)
    last = out["sections"][-1]
    assert last["start_bar"] + last["bars"] - 1 == 64, out["sections"]


def test_a_recording_that_starts_a_hair_late_still_has_bar_1():
    out = sections.find(np.column_stack([song(), song()]), RATE, tempo=TEMPO, start_beat=0.05)
    assert out["sections"][0]["start_bar"] == 1
