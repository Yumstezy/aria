"""Where a mix lands against the rated mixes (Nov 2). The model and the rated mixes' curves are real (ml/data); the
mixes in test-pack are Ian's song. Test tones only check the no-measurement cases."""
import csv
import json
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from aria_engine import goodmix
from tones import sine

ROOT = Path(__file__).resolve().parents[2]
CURVES = ROOT / "ml" / "data" / "curves.csv"
SAMPLE = ROOT / "test-pack" / "sample"
needs_sample = pytest.mark.skipif(not (SAMPLE / "Rough mix.wav").exists(), reason="test-pack audio is local only")
MODEL = goodmix.load_model()


def rated_curves():
    rows = []
    for r in csv.DictReader(open(CURVES, encoding="utf-8")):
        curve = np.array([float(r[k]) if r[k] != "" else np.nan for k in r if k.startswith("hz_")])
        if len(curve) == len(goodmix.CENTRES) and np.isfinite(curve).all():
            rows.append((r["label"], curve))
    return rows


def test_the_engine_ships_the_same_model_as_ml():
    assert json.loads((ROOT / "ml" / "data" / "shape-model.json").read_text()) == MODEL


def test_measurements_match_the_experiment_on_every_rated_mix():
    pytest.importorskip("sklearn")
    sys.path.insert(0, str(ROOT / "ml" / "experiments"))
    from shape import shape_features
    rows = rated_curves()
    assert len(rows) > 90
    for _, curve in rows:
        ours, theirs = goodmix.features(curve, MODEL), shape_features(curve)
        assert ours.keys() == theirs.keys()
        for k in ours:
            assert ours[k] == pytest.approx(theirs[k], abs=1e-9), k


def test_the_lean_puts_good_rated_mixes_above_bad_ones():
    rows = rated_curves()
    p = {lab: np.mean([goodmix.lean(goodmix.features(c, MODEL), MODEL) for l, c in rows if l == lab])
         for lab in ("good", "mid", "bad")}
    assert p["good"] > p["mid"] > p["bad"]


def test_too_short_or_silent_says_why_with_no_numbers():
    short = goodmix.compare(np.stack([sine(1000, 0.5, seconds=2)] * 2, axis=1), 44100)
    assert short["lean"] is None and short["features"] == [] and "too short" in short["error"]
    silent = goodmix.compare(np.zeros((44100 * 8, 2)), 44100)
    assert silent["lean"] is None and silent["findings"] == [] and "silent" in silent["error"]


@needs_sample
def test_mono_lands_where_the_same_sound_in_stereo_does():
    audio, rate = sf.read(str(SAMPLE / "Rough mix.wav"), always_2d=True, dtype="float64")
    left = audio[:, :1]
    assert goodmix.compare(left, rate)["lean"] == goodmix.compare(np.repeat(left, 2, axis=1), rate)["lean"]


def test_a_missing_model_says_so(tmp_path):
    assert goodmix.load_model(tmp_path / "nope.json") is None


@needs_sample
@pytest.mark.parametrize("name", ["Rough mix.wav", "Finished mix (reference).wav"])
def test_a_real_mix_gets_a_lean_and_only_the_stable_directions(name):
    audio, rate = sf.read(str(SAMPLE / name), always_2d=True, dtype="float64")
    out = goodmix.compare(audio, rate, bars=[1, 8])
    assert out["error"] is None and 0 < out["lean"] < 1
    assert out["lean_word"] in ("closer", "between", "further")
    assert [f["name"] for f in out["features"]] == [f["name"] for f in MODEL["features"] if f["show"]]
    assert len(out["findings"]) <= goodmix.MAX_FINDINGS
    for f in out["findings"]:
        assert f["kind"] == "good_mix" and f["bars"] == [1, 8]
        assert np.sign(f["diff_db"]) == -f["toward"]   # a problem only on the far side from the good mixes
        assert next(x for x in out["features"] if x["name"] == f["feature"])["off"]
