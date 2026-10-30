"""Groove match (build step 9): hits found to the millisecond, moved onto the grid or another loop, measured again."""
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from aria_engine import groove
from aria_engine.app import app
from tones import RATE, hits, write

client = TestClient(app)
TEMPO = 120.0                     # a 16th is 125 ms
STEP = 60 / TEMPO / 4
BARS_SEC = 2 * 4 * 60 / TEMPO     # two bars


def sixteenths(offsets=None):
    """A 16th-note hat loop over two bars; offsets maps a 16th's index to how late it is, in seconds."""
    offsets = offsets or {}
    return [k * STEP + offsets.get(k, 0.0) for k in range(32)]


LATE = {1: 0.018, 5: 0.022, 9: -0.015, 13: 0.020, 21: 0.019, 30: -0.021}   # the flam: some hits 15 to 22 ms off


def test_hits_are_found_to_the_millisecond():
    times = sixteenths(LATE)
    found = groove.onsets(hits(times, BARS_SEC), RATE)
    assert len(found) == len(times)
    assert max(abs(f - t) for f, t in zip(found, times)) < 0.002


def test_straight_grid_puts_every_hit_in_time(tmp_path):
    path = write(tmp_path / "Hat loop.wav", hits(sixteenths(LATE), BARS_SEC))
    out = groove.match(path, anchor={"kind": "straight"}, tempo=TEMPO, out_dir=tmp_path)
    assert out["before"]["max_ms"] > 15
    assert out["after"]["max_ms"] <= 5 and out["in_time"]
    assert out["hits_moved"] == len(LATE)
    assert len(out["after"]["hits"]) == len(out["before"]["hits"]) and all(abs(h["offset_ms"]) <= 5 for h in out["after"]["hits"])
    audio, rate = sf.read(out["out_path"])
    assert rate == RATE and len(audio) == int(BARS_SEC * RATE)
    assert sf.read(path)[0].shape == audio.shape    # the original stays as it was, next to the new file


def test_half_strength_moves_hits_half_way(tmp_path):
    path = write(tmp_path / "Hat loop.wav", hits(sixteenths(LATE), BARS_SEC))
    out = groove.match(path, anchor={"kind": "straight"}, tempo=TEMPO, strength=0.5, out_dir=tmp_path)
    assert 8 <= out["after"]["max_ms"] <= 13 and not out["in_time"]


def test_follow_another_loop_takes_its_swing(tmp_path):
    swing = {k: 0.025 for k in range(1, 32, 2)}            # the anchor's off 16ths sit 25 ms late
    anchor = write(tmp_path / "Perc loop.wav", hits(sixteenths(swing), BARS_SEC, seed=1))
    moving = write(tmp_path / "Hat loop.wav", hits(sixteenths(), BARS_SEC))
    out = groove.match(moving, anchor={"kind": "loop", "path": anchor}, tempo=TEMPO, out_dir=tmp_path)
    assert out["before"]["max_ms"] > 20 and out["after"]["max_ms"] <= 5 and out["in_time"]
    moved = groove.onsets(sf.read(out["out_path"])[0], RATE)
    assert abs((moved[1] - STEP) - 0.025) < 0.003       # the hat's off 16ths now swing like the perc


def test_endpoint(tmp_path):
    path = write(tmp_path / "Hat loop.wav", hits(sixteenths(LATE), BARS_SEC))
    body = client.post("/groove/match", json={"moving_path": path, "anchor": {"kind": "straight"}, "tempo": TEMPO, "out_dir": str(tmp_path)}).json()
    assert body["in_time"] and body["out_path"].endswith("Hat loop (matched).wav")
    bad = client.post("/groove/match", json={"moving_path": str(tmp_path / "none.wav"), "anchor": {"kind": "straight"}, "tempo": TEMPO, "out_dir": str(tmp_path)})
    assert bad.status_code == 400
