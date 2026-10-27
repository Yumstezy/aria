import json
from types import SimpleNamespace

from aria_engine import ask

CONTEXT = {"bars": [49, 64], "playhead_bar": 49, "tempo": 152.0,
           "findings": [{"kind": "harsh", "hz": 3417, "hz_range": [3318, 3519], "size_db": 6.1, "bars": [49, 60]}]}


def call(name, **args):
    return SimpleNamespace(function=SimpleNamespace(name=name, arguments=json.dumps(args)))


def msg(content, *calls):
    return SimpleNamespace(content=content, tool_calls=list(calls))


def client_for(message):
    create = lambda **kw: SimpleNamespace(choices=[SimpleNamespace(message=message)])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_asked_actions_come_back_cleaned():
    out = ask.ask("jump to bar 17 and cut 3 dB at 3.4k", CONTEXT, client=client_for(msg(
        "Jumped to bar 17 and cut 3 dB at 3417 Hz.",
        call("jump_to", bar=17), call("eq_band", freq_hz=3417, gain_db=-3, q=4))))
    assert out["actions"] == [{"type": "jump_to", "args": {"bar": 17}},
                              {"type": "eq_band", "args": {"freq_hz": 3417, "gain_db": -3.0, "q": 4.0}}]
    assert out["reply"].startswith("Jumped") and out["error"] is None


def test_out_of_range_calls_are_dropped():
    out = ask.ask("cut a lot", CONTEXT, client=client_for(msg(
        "Done.", call("eq_band", freq_hz=3417, gain_db=-15, q=4), call("jump_to", bar=0), call("delete_track", index=2))))
    assert out["actions"] == [] and out["dropped"] == 3


def test_suggestions_wait_and_are_checked():
    out = ask.ask("jump to bar 49", CONTEXT, client=client_for(msg(
        "Jumped to bar 49. The hits at 3417 Hz poke out here.",
        call("jump_to", bar=49),
        call("suggest", action="eq_band", args={"freq_hz": 3417, "gain_db": -3, "q": 4}, why="The hits at 3417 Hz poke out."),
        call("suggest", action="eq_band", args={"freq_hz": 3417, "gain_db": -20, "q": 4}, why="Too much."))))
    assert out["actions"] == [{"type": "jump_to", "args": {"bar": 49}}]
    assert len(out["suggestions"]) == 1 and out["suggestions"][0]["args"]["gain_db"] == -3.0
    assert out["dropped"] == 1


def test_reply_with_an_invented_number_is_dropped_but_actions_stay():
    out = ask.ask("jump to the drop", CONTEXT, client=client_for(msg("Jumped to the drop, 12 dB louder than the verse.", call("jump_to", bar=49))))
    assert out["reply"] is None and out["actions"] == [{"type": "jump_to", "args": {"bar": 49}}]


def test_no_key_says_why(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    out = ask.ask("jump to bar 1", CONTEXT)
    assert out["error"] and "MODEL_API_KEY" in out["error"] and out["actions"] == []


def test_empty_request_says_so():
    assert ask.ask("  ", CONTEXT)["error"]


def test_eq_band_without_q_gets_a_broad_default():
    out = ask.ask("cut 3 dB at 3 kHz", CONTEXT, client=client_for(msg("Cut 3 dB at 3 kHz.", call("eq_band", freq_hz=3000, gain_db=-3))))
    assert out["actions"] == [{"type": "eq_band", "args": {"freq_hz": 3000, "gain_db": -3.0, "q": 1.0}}]


def test_muse_sees_everyday_part_names():
    seen = {}
    def create(**kw):
        seen["payload"] = json.loads(kw["messages"][1]["content"])
        return SimpleNamespace(choices=[SimpleNamespace(message=msg("ok"))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    ctx = {"findings": [{"kind": "masking", "masked": "other", "by": "the rest", "range": "low-mid", "hz_range": [150, 400], "gap_db": -6.2}]}
    ask.ask("fix the mud", ctx, client=client)
    f = seen["payload"]["context"]["findings"][0]
    assert f["masked"] == "synths and keys" and f["by"] == "the rest of the mix" and f["gap_db"] == -6.2


TRACKS = {**CONTEXT, "tracks": [{"name": "Vocal", "index": 9, "group": True}, {"name": "LEADS", "index": 12, "group": True}]}


def test_track_tools_need_a_real_track_name():
    out = ask.ask("make the vocal easier to hear", TRACKS, client=client_for(msg(
        "Raised Vocal 2 dB and dipped LEADS at 2 kHz.",
        call("track_volume", track="vocal", change_db=2), call("track_eq", track="LEADS", freq_hz=2000, gain_db=-3),
        call("track_volume", track="Vox Male 7", change_db=2))))
    assert out["actions"] == [{"type": "track_volume", "args": {"track": "Vocal", "change_db": 2.0}},
                              {"type": "track_eq", "args": {"track": "LEADS", "freq_hz": 2000, "gain_db": -3.0, "q": 1.0}}]
    assert out["dropped"] == 1


def test_a_near_track_name_matches_only_when_one_track_fits():
    tracks = ["Kick", "NEW VOCAL 2", "Vocal Chops", "Bass"]
    assert ask.match_track("new vocal", tracks) == "NEW VOCAL 2"
    assert ask.match_track("  bass ", tracks) == "Bass"
    assert ask.match_track("vocal", tracks) is None     # two tracks fit, so don't guess
    assert ask.match_track("Pad", tracks) is None


def test_a_dropped_call_says_why_instead_of_claiming_it_was_done():
    out = ask.ask("make the new vocal louder", TRACKS, client=client_for(msg(
        "Done, the new vocal is 2 dB louder.", call("track_volume", track="Vox Male 7", change_db=2))))
    assert out["actions"] == [] and out["reply"] is None
    assert out["problems"] and 'No track called "Vox Male 7"' in out["problems"][0]
    assert out["error"] == out["problems"][0]
