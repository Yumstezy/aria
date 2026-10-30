"""Vocal sync (Groove match, Oct 30): a vocal's tempo and its beat 1, and the warp markers that put it on the song's grid."""
import numpy as np
from fastapi.testclient import TestClient

from aria_engine import vocal
from aria_engine.app import app
from tones import RATE, syllables, write

client = TestClient(app)


def phrase(tempo, start, bars=8):
    """Syllables on the 8ths of each bar's first two beats and on beat 4, louder on the bar's first beat, from start."""
    beat = 60 / tempo
    times, accents = [], []
    for b in range(bars):
        for x in (0, 0.5, 1, 1.5, 3):
            if x == 0:
                accents.append(len(times))
            times.append(start + (b * 4 + x) * beat)
    return times, accents


def test_tempo_from_the_file_name():
    assert vocal.tempo_from_name("Vox 124bpm Am") == 124
    assert vocal.tempo_from_name("acapella_128_BPM") == 128
    assert vocal.tempo_from_name("Hook 87.5 bpm") == 87.5
    assert vocal.tempo_from_name("Lead vocal take 3") is None
    assert vocal.tempo_from_name("Vox 2024 bpm") is None          # not a tempo


def test_tempo_and_beat_one_are_measured(tmp_path):
    times, accents = phrase(128, 0.47)
    path = write(tmp_path / "Lead vocal.wav", syllables(times, 18, accents=accents))
    out = vocal.analyze(path, song_tempo=128)
    assert out["tempo_source"] == "measured" and abs(out["tempo"] - 128) < 1.5
    assert abs(out["first_beat_sec"] - 0.47) < 0.03
    assert out["picture"]["levels_db"] and out["picture"]["start_sec"] <= out["first_beat_sec"]


def test_the_producer_can_move_beat_one(tmp_path):
    times, accents = phrase(128, 0.47)
    path = write(tmp_path / "Vox 128bpm.wav", syllables(times, 18, accents=accents))
    a, b = vocal.analyze(path, 128), vocal.analyze(path, 128, beat_shift=1)
    assert abs((b["first_beat_sec"] - a["first_beat_sec"]) - 60 / 128) < 1e-3
    assert vocal.analyze(path, 128, tempo=127)["tempo_source"] == "you"


def test_half_tempo_vocal_is_counted_double(tmp_path):
    times, accents = phrase(82, 0.2, bars=6)
    path = write(tmp_path / "Hook 82bpm.wav", syllables(times, 20, accents=accents))
    out = vocal.analyze(path, song_tempo=165)
    assert out["tempo"] == 82 and out["tempo_source"] == "file name" and out["beats_tempo"] == 164


def test_warp_markers_put_beat_one_on_a_bar(tmp_path):
    times, accents = phrase(128, 0.47)
    path = write(tmp_path / "Vox 128bpm.wav", syllables(times, 18, accents=accents))
    out = vocal.analyze(path, song_tempo=150)
    m = out["warp"]["markers"]
    assert m[0]["sample_time"] == out["first_beat_sec"] and m[0]["beat_time"] % 4 == 0
    # 128 beats a minute in the file: the second marker is that many seconds per beat further on
    beats = m[1]["beat_time"] - m[0]["beat_time"]
    assert abs((m[1]["sample_time"] - m[0]["sample_time"]) - beats * 60 / 128) < 1e-6
    assert m[0]["beat_time"] - m[0]["sample_time"] * 128 / 60 >= 0     # the file's start isn't before the clip's


def test_endpoint(tmp_path):
    times, accents = phrase(128, 0.47)
    path = write(tmp_path / "Vox 128bpm.wav", syllables(times, 18, accents=accents))
    body = client.post("/groove/vocal", json={"path": path, "song_tempo": 150}).json()
    assert body["tempo"] == 128 and body["warp"]["markers"]
    assert client.post("/groove/vocal", json={"path": str(tmp_path / "none.wav"), "song_tempo": 150}).status_code == 400


def test_key_from_the_notes(tmp_path):
    """A phrase sung on A minor's notes (A C E, then D F, G E) reads as A minor."""
    rate = RATE
    t = np.arange(int(0.4 * rate)) / rate
    hz = {"A": 220.0, "C": 261.63, "D": 293.66, "E": 329.63, "F": 349.23, "G": 392.0, "B": 246.94}
    notes = "A C E A E C A D F A G E A C E A".split()
    tone = lambda f: sum(np.sin(2 * np.pi * f * h * t) / h for h in (1, 2, 3)) * np.minimum(1, t / 0.02) * np.exp(-t / 0.5) * 0.2
    x = np.concatenate([tone(hz[n]) for n in notes])
    path = write(tmp_path / "Hook.wav", x)
    assert vocal.key_of(*__import__("soundfile").read(path)) ["key"] == "A minor"


def test_beat_one_lands_on_the_kick(tmp_path):
    """The kick in the song sits 12 ms after Live's grid (its sample starts late): beat 1 goes on the kick, not the grid."""
    from tones import hits
    tempo, late = 128.0, 0.012
    beat = 60 / tempo
    kick = write(tmp_path / "Kick.wav", hits([k * beat + late for k in range(16)], 16 * beat + 0.2))
    times, accents = phrase(128, 0.47)
    path = write(tmp_path / "Vox 128bpm.wav", syllables(times, 18, accents=accents))
    # Kick clip at bar 9 (beat 32), the vocal clip at beat 31.5 (half a beat before bar 9)
    out = vocal.analyze(path, 128, kick={"path": kick, "start_beat": 32.0, "start_marker": 0.0}, place={"start_beat": 31.5, "beats_per_bar": 4})
    m = out["warp"]["markers"][0]
    song_beat = 31.5 + m["beat_time"]              # where the vocal's beat 1 plays in the song
    assert out["sync"]["kick_found"] and abs(out["sync"]["kick_offset_ms"] - 12) < 2
    assert abs((song_beat - round(song_beat)) * beat * 1000 - 12) < 2    # on the kick, 12 ms after the bar line
    assert round(song_beat) % 4 == 0                                      # at a bar line
