"""Your mix against typical good mixes (Oct 30): the good-rated mixes in ml/data/features.csv as the comparison when
no reference song is picked. Ian's planted mixes in test-pack where they're on this Mac."""
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from aria_engine import typical
from tones import sine

ROOT = Path(__file__).resolve().parents[2]
MIXES = ROOT / "test-pack" / "mixes"
needs_mixes = pytest.mark.skipif(not (MIXES / "control.wav").exists(), reason="test-pack mixes are local only")


def test_the_good_mixes_are_loaded_from_the_model_data():
    assert typical.GOOD and typical.GOOD["mixes"] >= 20
    sub = typical.GOOD["bands"]["sub"]
    assert sub["lo"] < sub["median"] < sub["hi"]


def test_measures_exactly_like_the_mix_model():
    sys.path.insert(0, str(ROOT / "ml"))
    import detail
    rng = np.random.default_rng(0)
    x = np.column_stack([rng.normal(0, 0.2, 48000 * 4), rng.normal(0, 0.2, 48000 * 4)])
    ml, mine = detail.measure(x, 48000, x), typical.balance(x, 48000)
    assert all(abs(ml[f"bal_{k}_db"] - mine[k]) < 0.01 for k, *_ in typical.BANDS)


def test_a_mix_that_is_all_one_band_is_outside():
    x = np.column_stack([sine(3000, 0.5), sine(3000, 0.5)])
    out = typical.compare(x, 48000)
    assert out["findings"] and out["findings"][0]["band"] == "Presence" and out["findings"][0]["outside_db"] > 0


def test_without_the_data_nothing_is_compared(tmp_path):
    assert typical._load(tmp_path / "none.csv") is None


@needs_mixes
@pytest.mark.parametrize("name,band", [("A", "Low mids"), ("B", "Presence"), ("C", "Low mids")])
def test_planted_boosts_are_over_the_good_range_more_than_the_control(name, band):
    over = lambda n: next((b["value_db"] - b["range_db"][1] for b in typical.compare(*sf.read(str(MIXES / f"{n}.wav"), always_2d=True))["bands"] if b["name"] == band))
    assert over(name) > 0.5 and over(name) > over("control") + 0.5
