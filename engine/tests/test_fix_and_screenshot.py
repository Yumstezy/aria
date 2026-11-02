"""Fix my whole mix and screenshots for Muse (Nov 1)."""
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

from aria_engine import app as app_module, ask
from aria_engine.app import app

CONTEXT = {"bars": [49, 64], "playhead_bar": 49, "tempo": 152.0, "tracks": [{"name": "BASS"}, {"name": "VOCAL"}],
           "findings": [{"kind": "harsh", "hz": 3417, "hz_range": [3318, 3519], "size_db": 6.1, "bars": [49, 60]},
                        {"kind": "masking", "masked": "vocals", "by": "other", "hz_range": [1000, 4000], "size_db": 4.2}]}
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64   # enough for Aria's type check; Muse is faked here


def call(name, **args):
    return SimpleNamespace(function=SimpleNamespace(name=name, arguments=json.dumps(args)))


def client_for(content, *calls, seen=None):
    def create(**kw):
        if seen is not None:
            seen.append(kw)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=list(calls)))])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_fix_my_whole_mix_is_one_action_that_needs_findings():
    out = ask.ask("fix my whole mix", CONTEXT, client=client_for("Fixing the strongest problems, then I'll check the same bars.", call("fix_mix")))
    assert out["actions"] == [{"type": "fix_mix", "args": {}}] and out["reply"]
    out = ask.ask("fix my whole mix", {**CONTEXT, "findings": []}, client=client_for("Fixing it.", call("fix_mix")))
    assert out["actions"] == [] and "Mix check first" in out["problems"][0]


def test_a_screenshot_goes_to_muse_and_what_it_read_comes_back():
    seen = []
    read = {"what": "FabFilter Pro-Q 3 on a vocal", "seen": ["Band 3: bell, +4.5 dB at 2.4 kHz"], "steps": ["Pull band 3 down to 0 dB"]}
    out = ask.ask("why is my vocal harsh", CONTEXT, image="data:image/png;base64,AAAA",
                  client=client_for("Band 3 is boosting 4.5 dB at 2.4 kHz, right where it's harsh.", call("screenshot_steps", **read), seen=seen))
    parts = seen[0]["messages"][1]["content"]
    assert parts[1] == {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}
    assert out["reads"] == [read]
    assert out["reply"]          # 4.5 and 2.4 were read off the screenshot, so the reply may say them
    assert out["error"] is None


def test_a_screenshot_read_without_a_screenshot_is_dropped():
    out = ask.ask("make it brighter", CONTEXT, client=client_for("", call("screenshot_steps", what="Pro-Q", steps=["Raise band 1"])))
    assert out["reads"] == [] and out["dropped"] == 1


def test_fix_round_runs_only_fixes_within_limits():
    out = ask.fix_round("fix", CONTEXT, client=client_for(
        "Cut the harsh hits on Main and lifted the vocal.",
        call("eq_band", freq_hz=3417, gain_db=-3, q=4), call("track_volume", track="VOCAL", change_db=2),
        call("jump_to", bar=3), call("eq_band", freq_hz=3417, gain_db=-20, q=4)))
    assert [a["type"] for a in out["actions"]] == ["eq_band", "track_volume"]
    assert out["error"] is None


def test_fix_report_uses_only_the_measured_results():
    results = [{"index": 0, "kind": "harsh", "hz_range": [3318, 3519], "change_db": -4.2},
               {"index": 1, "kind": "masking", "hz_range": [1000, 4000], "change_db": -1.1}]
    seen = []
    out = ask.fix_round("report", CONTEXT, results, client=client_for("The harsh hits are 4.2 dB lower, so Fixed. The vocal moved 1.1 dB.", seen=seen))
    assert out["reply"] and out["actions"] == []
    sent = json.loads(seen[0]["messages"][1]["content"])
    assert [r["fixed"] for r in sent["context"]["results"]] == [True, False]
    made_up = ask.fix_round("report", CONTEXT, results, client=client_for("Everything is 9 dB cleaner."))
    assert made_up["reply"] is None


def test_fix_round_needs_findings():
    assert "Mix check first" in ask.fix_round("fix", {**CONTEXT, "findings": []}, client=client_for("x"))["error"]


def test_screenshot_upload_and_fetch(tmp_path, monkeypatch):
    monkeypatch.setattr(app_module, "IMAGE_DIR", tmp_path)
    c = TestClient(app)
    res = c.post("/muse/image", content=PNG, headers={"Content-Type": "image/png"})
    assert res.status_code == 200
    image_id = res.json()["image_id"]
    got = c.get(f"/muse/image/{image_id}")
    assert got.status_code == 200 and got.content == PNG and got.headers["content-type"] == "image/png"
    assert c.post("/muse/image", content=b"not an image").status_code == 400
    assert c.get("/muse/image/..%2F..%2Fetc").status_code == 404
    assert c.post("/muse/ask", json={"text": "look", "image_id": "0" * 32}).status_code == 400


def test_fix_endpoint_without_a_key_says_so(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    res = TestClient(app).post("/muse/fix", json={"stage": "fix", "context": CONTEXT})
    assert res.status_code == 200 and "No Muse Spark key" in res.json()["error"]


def test_muse_sees_the_bands_aria_already_set_and_there_is_one_round():
    bands = [{"track": "BASS", "band": 4, "shape": "Bell", "freq": "1.00 kHz", "gain": "-3.00 dB", "q": "1.00"}]
    seen = []
    ask.fix_round("fix", {**CONTEXT, "aria_eq": bands}, client=client_for("Cut the bass 2 dB more at 1 kHz.",
                  call("track_eq", track="BASS", freq_hz=1000, gain_db=-2, q=1), seen=seen))
    assert json.loads(seen[0]["messages"][1]["content"])["context"]["aria_eq"] == bands
    assert "context.aria_eq" in seen[0]["messages"][0]["content"]
    assert "Unknown stage" in ask.fix_round("retry", CONTEXT, client=client_for("x"))["error"]


def test_fix_all_can_sidechain_and_load_arias_racks():
    tools = [t["function"]["name"] for t in ask.FIX_TOOLS]
    assert "sidechain" in tools and "aria_rack" in tools
    ctx = {**CONTEXT, "tracks": [{"name": "KICK"}, {"name": "BASS"}, {"name": "VOCAL"}]}
    out = ask.fix_round("fix", ctx, client=client_for(
        "Ducked the bass under the kick and gave the kick more punch.",
        call("sidechain", track="BASS", from_track="KICK"),
        call("aria_rack", track="KICK", rack="Aria Kick Mix", macros=[{"name": "GLUE", "value": 40}, {"name": "cut boxy", "value": 50}])))
    assert [a["type"] for a in out["actions"]] == ["track_device", "route_sidechain", "aria_rack"]
    assert out["actions"][0]["args"]["label"] == "Aria Sidechain"
    assert out["actions"][2]["args"] == {"track": "KICK", "rack": "Aria Kick Mix",
                                         "macros": [{"name": "GLUE", "value": 40.0}, {"name": "CUT BOXY", "value": 50.0}]}


def test_a_rack_or_macro_aria_doesnt_have_is_dropped():
    tracks = {**CONTEXT, "tracks": [{"name": "KICK"}]}
    for bad in ({"rack": "Aria Nope"}, {"rack": "Aria Kick Mix", "macros": [{"name": "Volume", "value": 50}]},
                {"rack": "Aria Kick Mix", "macros": [{"name": "GLUE", "value": 140}]}):
        out = ask.ask("punch up the kick", tracks, client=client_for("", call("aria_rack", track="KICK", **bad)))
        assert out["actions"] == [] and out["dropped"] == 1


def test_every_rack_file_is_in_the_catalog():
    from pathlib import Path
    from aria_engine import racks
    files = {p.stem for p in (Path(__file__).resolve().parents[2] / "device" / "racks").glob("*.ad[gv]")}
    assert files == set(racks.RACKS)
    assert all(f"- {name}: " in ask.PROMPT for name in racks.RACKS)


def test_a_fix_round_with_no_change_asks_again_then_says_so():
    seen = []
    out = ask.fix_round("fix", CONTEXT, client=client_for("Fixing the buried leads.", seen=seen))
    assert len(seen) == 3 and out["actions"] == [] and out["reply"] is None and "Fix all" in out["error"]


def test_a_fix_it_answered_with_words_only_asks_again_then_says_so():
    seen = []
    out = ask.ask("Fix this for the whole song: LEADS buried (150 Hz to 1 kHz).", CONTEXT, client=client_for("Fixing your leads.", seen=seen))
    assert len(seen) == 2 and out["reply"] is None and "Fix it again" in out["error"]
    seen = []
    ask.ask("what's wrong with my mix", CONTEXT, client=client_for("The harsh hits at 3.4 kHz.", seen=seen))
    assert len(seen) == 1   # a question gets words, once


def test_track_mode_findings_carry_each_tracks_loudness(tmp_path):
    import numpy as np, soundfile as sf
    from aria_engine import app as A
    rate, t = 44100, np.arange(44100 * 4) / 44100
    paths = {}
    for name, amp in (("KICK", 0.5), ("LEADS", 0.05)):   # test tones: the lead 20 dB under the kick
        p = tmp_path / f"{name}.wav"
        sf.write(p, np.stack([amp * np.sin(2 * np.pi * 300 * t)] * 2, 1), rate)
        paths[name] = str(p)
    mix = sum(sf.read(p, always_2d=True)[0] for p in paths.values())
    out = A.find_tracks(paths, rate, mix, {"tempo": 120.0, "start_beat": 0.0})
    assert out["levels_lufs"]["KICK"] - out["levels_lufs"]["LEADS"] == 20.0
    assert all(f["levels_lufs"] == out["levels_lufs"] for f in out["findings"] if f["kind"] in ("masking", "clash"))


def test_a_fader_can_be_set_to_a_level_the_producer_names():
    ctx = {**CONTEXT, "tracks": [{"name": "VOCAL", "volume_db": -6.0}, {"name": "LEADS", "volume_db": 0.0}]}
    out = ask.ask("turn the vocal down to -15 and give the leads some air", ctx, client=client_for(
        "Vocal down to -15 dB and a little air on the leads.",
        call("track_volume", track="VOCAL", to_db=-15), call("track_eq", track="LEADS", shape="high_shelf", freq_hz=10000, gain_db=2)))
    assert [a["type"] for a in out["actions"]] == ["track_volume", "track_eq"]
    assert out["actions"][0]["args"] == {"track": "VOCAL", "to_db": -15.0}
    for bad in ({"to_db": 9}, {"change_db": 0}):
        assert ask.ask("louder", ctx, client=client_for("", call("track_volume", track="VOCAL", **bad)))["actions"] == []
