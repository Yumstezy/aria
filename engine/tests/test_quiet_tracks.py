"""A quiet track isn't a silent one (Ian, Oct 29: his vocal read "silent" while it played, just quietly).
For the producer's own tracks (Aria Ear), silence is a track with no clips playing (Live says) or, when Live can't
say, near-digital silence. The 20 dB-under-the-mix rule stays for split mode, where it filters Demucs bleed.
Test signals are generated here and never reach the app."""
import numpy as np

from aria_engine import stems
from test_clashes import RATE, TEMPO, band_noise


def mix_with_quiet_vocal(vocal_db=-28):
    drums = 0.8 * band_noise(60, 8000, seed=1)
    synth = 0.8 * band_noise(300, 3000, seed=2)
    vocal = 0.8 * 10 ** (vocal_db / 20) * band_noise(300, 3000, seed=3)   # under the synth, in its range
    return {"Drums": drums, "Synth": synth, "vOCAL": vocal}


def test_a_quiet_track_is_drawn_not_called_silent():
    sp = stems.spectra(mix_with_quiet_vocal(), RATE, relative=False)
    assert sp["parts"]["vOCAL"] is not None


def test_split_mode_still_drops_faint_bleed():
    sp = stems.spectra(mix_with_quiet_vocal(), RATE)
    assert sp["parts"]["vOCAL"] is None


def test_a_track_live_says_has_no_clips_is_silent():
    sp = stems.spectra(mix_with_quiet_vocal(vocal_db=-6), RATE, relative=False, playing={"vOCAL": False})
    assert sp["parts"]["vOCAL"] is None


def test_a_quiet_playing_track_buried_under_another_is_found():
    found = stems.masking(mix_with_quiet_vocal(), RATE, tempo=TEMPO, start_beat=0.0, relative=False, playing={"vOCAL": True})
    assert any(f["masked"] == "vOCAL" for f in found), found


def test_true_silence_is_still_silent():
    sounds = mix_with_quiet_vocal()
    sounds["vOCAL"] = np.zeros_like(sounds["vOCAL"])
    assert stems.spectra(sounds, RATE, relative=False)["parts"]["vOCAL"] is None


def test_a_vocal_that_sings_half_the_time_isnt_buried_where_it_has_nothing():
    """Ian, Oct 30: "vOCAL buried, 30 Hz to 1 kHz, -42.7 dB". The vocal sang in some bars only, so its typical
    level was silence in every range and the bass range counted as where it lives."""
    sounds = mix_with_quiet_vocal(vocal_db=-10)
    half = np.zeros_like(sounds["vOCAL"]); half[len(half) // 2:] = 1
    sounds["vOCAL"] = sounds["vOCAL"] * half                              # sings in the second half only, 300 Hz to 3 kHz
    sounds["Bass"] = 0.9 * band_noise(40, 150, seed=4)
    found = stems.masking(sounds, RATE, tempo=TEMPO, start_beat=0.0, relative=False, playing={"vOCAL": True})
    assert not [f for f in found if f["masked"] == "vOCAL" and f["hz_range"][1] <= 150], found
