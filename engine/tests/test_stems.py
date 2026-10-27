"""Masking and bass click tests on generated signals. They stay in tests and never reach the app."""
import numpy as np
from scipy.signal import butter, sosfilt

from aria_engine import stems

RATE = 44100
SECONDS = 16
TIMING = dict(tempo=120.0, start_beat=0.0, beats_per_bar=4.0)   # 2 s per bar


def noise(lo, hi, level_db, seed):
    x = np.random.default_rng(seed).standard_normal(SECONDS * RATE)
    x = sosfilt(butter(4, [lo, hi], btype="band", fs=RATE, output="sos"), x)
    return x / np.std(x) * 10 ** (level_db / 20)


def test_vocal_buried_in_its_own_range_is_found():
    sounds = {
        "vocals": noise(800, 3500, -30, 1),     # lives in mid and presence
        "drums": noise(1000, 4000, -20, 2),     # 10 dB louder right on top of it
        "bass": noise(40, 140, -15, 3),
    }
    found = stems.masking(sounds, RATE, relevant=stems.SPLIT_RELEVANT, **TIMING)
    assert found and found[0]["masked"] == "vocals"
    assert found[0]["gap_db"] <= -6
    assert found[0]["range"] in ("presence", "mid")


def test_sounds_in_their_own_ranges_are_clear():
    sounds = {
        "vocals": noise(1000, 3500, -20, 1),
        "drums": noise(5000, 11000, -20, 2),    # hats, above the vocal
        "bass": noise(40, 140, -15, 3),
        "other": noise(160, 380, -22, 4),
    }
    assert stems.masking(sounds, RATE, relevant=stems.SPLIT_RELEVANT, **TIMING) == []


def test_absent_sound_is_not_called_buried():
    sounds = {
        "vocals": noise(1000, 3500, -75, 1),    # just bleed, 55 dB under: absent, not buried
        "drums": noise(1000, 4000, -20, 2),
        "bass": noise(40, 140, -15, 3),
    }
    assert [f for f in stems.masking(sounds, RATE, relevant=stems.SPLIT_RELEVANT, **TIMING) if f["masked"] == "vocals"] == []


def bass_notes(click):
    t = np.arange(SECONDS * RATE) / RATE
    bass = np.zeros_like(t)
    for start in np.arange(0.3, SECONDS - 0.5, 0.75):              # a note every 0.75 s
        idx = (t >= start) & (t < start + 0.5)
        note = 0.3 * np.sin(2 * np.pi * 55 * (t[idx] - start))
        if not click:
            # A real clean note fades in and out. An instant start or stop is itself a click.
            fade = int(0.005 * RATE)
            env = np.ones(len(note))
            env[:fade], env[-fade:] = np.linspace(0, 1, fade), np.linspace(1, 0, fade)
            note *= env
        bass[idx] += note
        if click:
            i = int(start * RATE)
            bass[i:i + 40] += 0.4 * np.random.default_rng(int(start * 100)).standard_normal(40)
    return bass


def test_clicks_at_bass_note_starts_are_found():
    drums = np.zeros(SECONDS * RATE)    # no drum hits, so nothing is mistaken for kick bleed
    found = stems.bass_clicks(bass_notes(click=True), drums, RATE, **TIMING)
    assert found and found[0]["kind"] == "bass_click" and found[0]["clicky_share"] >= 0.85


def test_clean_bass_notes_have_no_clicks():
    assert stems.bass_clicks(bass_notes(click=False), np.zeros(SECONDS * RATE), RATE, **TIMING) == []


def test_space_shows_who_owns_each_range():
    sounds = {"vocals": noise(1000, 3500, -30, 1), "drums": noise(1000, 4000, -20, 2), "bass": noise(40, 140, -15, 3)}
    sp = stems.space(sounds, RATE)
    assert sp["vocals"]["presence"]["lives_here"] and sp["vocals"]["presence"]["vs_rest_db"] <= -6
    assert sp["bass"]["low"]["lives_here"] and sp["bass"]["low"]["vs_rest_db"] > 0
    assert sp["bass"]["presence"] == {"vs_rest_db": None, "lives_here": False}


def test_space_marks_absent_sounds():
    sounds = {"vocals": noise(1000, 3500, -75, 1), "drums": noise(1000, 4000, -20, 2), "bass": noise(40, 140, -15, 3)}
    assert stems.space(sounds, RATE)["vocals"] is None
