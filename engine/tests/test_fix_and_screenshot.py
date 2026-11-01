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
