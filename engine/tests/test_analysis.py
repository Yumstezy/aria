import numpy as np
import pytest

from aria_engine import analysis
from tones import RATE, sine, write


def test_ebu_3341_case_1_reads_minus_23_lufs(tmp_path):
    # EBU Tech 3341 test 1: stereo 1 kHz sine at -23.0 dBFS must read -23.0 LUFS (+/- 0.1).
    tone = sine(1000, 10 ** (-23.0 / 20), seconds=20.0)
    m = analysis.measure(write(tmp_path / "ebu1.wav", tone, tone))
    assert m["integrated_lufs"] == pytest.approx(-23.0, abs=0.1)


def test_true_peak_of_half_scale_sine(tmp_path):
    tone = sine(1000, 0.5)
    m = analysis.measure(write(tmp_path / "t.wav", tone, tone))
    assert m["true_peak_dbtp"] == pytest.approx(-6.0, abs=0.1)


def test_twice_the_amplitude_is_6_db_louder(tmp_path):
    quiet = analysis.measure(write(tmp_path / "q.wav", sine(1000, 0.1), sine(1000, 0.1)))
    loud = analysis.measure(write(tmp_path / "l.wav", sine(1000, 0.2), sine(1000, 0.2)))
    assert loud["integrated_lufs"] - quiet["integrated_lufs"] == pytest.approx(6.0, abs=0.1)


def test_bass_tone_lands_in_bass(tmp_path):
    tone = sine(80, 0.5)
    m = analysis.measure(write(tmp_path / "b.wav", tone, tone))
    assert m["bands_db"]["bass"] > -10
    assert m["bands_db"]["mids"] is None or m["bands_db"]["mids"] < m["bands_db"]["bass"] - 30
    assert m["bands_db"]["treble"] is None or m["bands_db"]["treble"] < m["bands_db"]["bass"] - 30


def test_identical_channels_have_no_width(tmp_path):
    tone = sine(1000, 0.5)
    m = analysis.measure(write(tmp_path / "mono.wav", tone, tone))
    assert m["width"]["mids"] == 0.0


def test_opposite_channels_are_all_side(tmp_path):
    tone = sine(1000, 0.5)
    m = analysis.measure(write(tmp_path / "wide.wav", tone, -tone))
    assert m["width"]["mids"] == 1.0


def test_silence_is_reported_not_filled_in(tmp_path):
    zeros = np.zeros(RATE * 2)
    m = analysis.measure(write(tmp_path / "s.wav", zeros, zeros))
    assert m["integrated_lufs"] is None and m["true_peak_dbtp"] is None
    assert all(v is None for v in m["bands_db"].values())
    assert "silent" in m["unmeasured"]["all"]


def test_mono_file_has_no_width_and_says_why(tmp_path):
    m = analysis.measure(write(tmp_path / "m.wav", sine(1000, 0.5)))
    assert m["width"]["mids"] is None
    assert m["unmeasured"]["width.mids"] == "The recording is mono."


def test_unreadable_file_raises(tmp_path):
    bad = tmp_path / "bad.wav"
    bad.write_bytes(b"not audio")
    with pytest.raises(analysis.AnalysisError):
        analysis.measure(str(bad))
