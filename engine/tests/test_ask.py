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
                              {"type": "eq_band", "args": {"shape": "bell", "freq_hz": 3417, "gain_db": -3.0, "q": 4.0}}]
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
    assert out["actions"] == [{"type": "eq_band", "args": {"shape": "bell", "freq_hz": 3000, "gain_db": -3.0, "q": 1.0}}]


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
                              {"type": "track_eq", "args": {"track": "LEADS", "shape": "bell", "freq_hz": 2000, "gain_db": -3.0, "q": 1.0}}]
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


def test_eq_shapes_cuts_have_no_gain_and_a_flat_corner():
    hard = ask.check_action("track_eq", {"track": "Vocal", "shape": "low_cut", "freq_hz": 500, "steep": True}, ["Vocal"])
    assert hard == {"track": "Vocal", "shape": "low_cut", "freq_hz": 500, "gain_db": 0.0, "q": 0.71, "steep": True}
    assert ask.check_action("eq_band", {"shape": "high_shelf", "freq_hz": 8000, "gain_db": 2})["gain_db"] == 2.0
    assert ask.check_action("eq_band", {"shape": "high_shelf", "freq_hz": 8000, "gain_db": 0}) is None   # a shelf needs a gain
    assert ask.check_action("eq_band", {"shape": "tilt", "freq_hz": 800}) is None


def test_reply_never_carries_em_dashes():
    out = ask.interpret(msg("Got it — boosting that vocal.", call("track_volume", track="Vocal", change_db=2)), TRACKS, "louder")
    assert out["reply"] == "Got it, boosting that vocal."


def test_muse_sees_only_the_last_few_exchanges():
    recent = [{"asked": f"ask {i}", "did": [], "replied": None} for i in range(6)]
    assert [r["asked"] for r in ask.friendly({"recent": recent})["recent"]] == ["ask 3", "ask 4", "ask 5"]


def test_stock_devices_come_back_cleaned_on_a_track_or_main():
    out = ask.ask("compress the vocal and limit the mix", {**CONTEXT, "tracks": [{"name": "NEW VOCAL"}]}, client=client_for(msg(
        "Added a Compressor on the vocal and a Limiter on Main.",
        call("track_device", track="new vocal", device="Compressor",
             settings=[{"param": "Threshold", "value": -18}, {"param": "Makeup", "option": "On"}]),
        call("track_device", track="Main", device="Limiter", settings=[{"param": "Ceiling", "value": -1}]))))
    assert out["actions"] == [
        {"type": "track_device", "args": {"track": "NEW VOCAL", "device": "Compressor",
                                          "settings": [{"param": "Threshold", "value": -18.0}, {"param": "Makeup", "option": "On"}], "mode": "add"}},
        {"type": "track_device", "args": {"track": "Main", "device": "Limiter", "settings": [{"param": "Ceiling", "value": -1.0}], "mode": "add"}}]


def test_a_relative_change_moves_a_knob_from_where_it_is():
    out = ask.interpret(msg(None, call("track_device", track="Bass", device="Utility",
                                       settings=[{"param": "Gain", "change": 0.4}])), {"tracks": ["Bass"]}, "raise it by .4 dB")
    assert out["actions"][0]["args"]["settings"] == [{"param": "Gain", "change": 0.4}]


def test_plugins_and_big_gain_jumps_are_dropped_with_a_reason():
    ctx = {"tracks": ["Bass"]}
    out = ask.interpret(msg("Done.", call("track_device", track="Bass", device="Pro-Q 4")), ctx, "add pro q 4")
    assert out["actions"] == [] and "Live's own devices" in out["problems"][0]
    loud = ask.interpret(msg(None, call("track_device", track="Bass", device="Utility", settings=[{"param": "Gain", "value": 12}])), ctx, "louder")
    assert loud["actions"] == [] and loud["dropped"] == 1
    # A target and a move together: the target wins (Oct 30), still inside the limits
    both = ask.interpret(msg(None, call("track_device", track="Bass", device="Utility",
                                        settings=[{"param": "Gain", "value": 2, "change": 1}])), ctx, "x")
    assert both["actions"][0]["args"]["settings"] == [{"param": "Gain", "value": 2.0}]


def test_muse_sees_every_stock_device_and_its_knobs():
    assert "{STOCK_LINES}" not in ask.PROMPT
    for name in ask.STOCK:
        assert f"- {name}: " in ask.PROMPT
    tool = next(t for t in ask.TOOLS if t["function"]["name"] == "track_device")
    assert tool["function"]["parameters"]["properties"]["device"]["enum"] == list(ask.STOCK)


INSTALLED = ["FabFilter Pro-Q 4", "FabFilter Pro-Q 3", "ValhallaRoom", "ValhallaVintageVerb", "Ozone 12 Equalizer"]


def test_plugin_names_match_how_producers_say_them():
    assert ask.match_plugin("pro q 4", INSTALLED) == "FabFilter Pro-Q 4"
    assert ask.match_plugin("Pro-Q", INSTALLED) is None              # 3 or 4: don't guess
    assert ask.mentioned_plugins("add pro q 4 and cut the lows", INSTALLED) == ["FabFilter Pro-Q 4"]
    assert ask.mentioned_plugins("put valhalla on the vocal", INSTALLED) == ["ValhallaRoom", "ValhallaVintageVerb"]
    assert ask.mentioned_plugins("add some reverb to the vocal", INSTALLED) == []
    assert ask.mentioned_plugins("add pro q to muddy loops", INSTALLED) == ["FabFilter Pro-Q 4", "FabFilter Pro-Q 3"]


FFP = """[Preset]
Signature=FQ4p
Description="Test preset.\\n"

[Parameters]
Band 1 Used=1
Band 1 Enabled=1
Band 1 Frequency=13.287712
Band 1 Gain=2.5
Band 1 Q=0.5
Band 1 Shape=3
Band 2 Used=0
Band 2 Enabled=1
Band 2 Frequency=8
Band 2 Gain=-3
Band 2 Q=0.5
Band 2 Shape=0
"""


def catalog_with(tmp_path, monkeypatch):
    path = tmp_path / "Air Test.ffp"
    path.write_text(FFP)
    entries = [{"source": "fabfilter", "plugin": f"FabFilter Pro-Q {v}", "name": "Air Test", "format": "text", "category": "Vocals",
                "words": ["air", "test"], "path": str(path)} for v in (3, 4)]
    monkeypatch.setattr(ask.guides, "catalog", lambda: entries)


def test_named_plugin_brings_its_presets_newest_version_only(tmp_path, monkeypatch):
    catalog_with(tmp_path, monkeypatch)
    ctx = ask.friendly({"plugins": ["x"], "tracks": [{"name": "Vox", "plugins": []}]}, "pro q, add air to my vocals")
    assert list(ctx["plugin_presets"]) == ["FabFilter Pro-Q 4"] and ctx["plugin_presets"]["FabFilter Pro-Q 4"][0]["name"] == "Air Test"
    assert "plugins" not in ctx and ctx["tracks"] == [{"name": "Vox"}]
    assert "plugin_presets" not in ask.friendly({}, "add some reverb")


def test_guide_draws_the_presets_real_bands(tmp_path, monkeypatch):
    catalog_with(tmp_path, monkeypatch)
    g = ask.check_guide({"plugin": "pro q 4", "preset": "Air Test", "track": "vox"}, ["Vox"])
    assert g["plugin"] == "FabFilter Pro-Q 4" and g["preset"] == "Air Test" and g["source"] == "preset" and g["track"] == "Vox"
    assert g["bands"] == [{"band": 1, "shape": "high_shelf", "freq_hz": 10000, "gain_db": 2.5, "q": 1.0, "dynamic_db": 0.0}]   # band 2 is off


def test_guide_with_musess_own_bands_is_checked(tmp_path, monkeypatch):
    catalog_with(tmp_path, monkeypatch)
    own = ask.check_guide({"plugin": "Pro-Q 4", "bands": [{"shape": "high_shelf", "freq_hz": 10000, "gain_db": 2}]})
    assert own["source"] == "aria" and own["bands"][0]["q"] == 1.0
    assert ask.check_guide({"plugin": "Pro-Q 4", "bands": [{"shape": "wobble", "freq_hz": 100}]}) is None
    assert ask.check_guide({"plugin": "Pro-Q 4", "bands": [{"shape": "bell", "freq_hz": 100, "gain_db": 30}]}) is None
    assert ask.check_guide({"plugin": "Pro-Q 4"}) is None   # nothing to draw


def test_track_plugin_needs_a_plugin_muse_was_shown():
    ok = ask.check_action("track_plugin", {"track": "synth test", "plugin": "pro q 4", "then_set": True}, ["SYNTH TEST"], INSTALLED)
    assert ok == {"track": "SYNTH TEST", "plugin": "FabFilter Pro-Q 4", "settings": [], "then_set": True}
    set_now = ask.check_action("track_plugin", {"track": "Main", "plugin": "ValhallaRoom",
                                                "settings": [{"param": "Mix", "value": 20}], "then_set": True}, ["SYNTH TEST"], INSTALLED)
    assert set_now["then_set"] is False                                  # knobs already given: nothing to come back for
    assert ask.check_action("track_plugin", {"track": "SYNTH TEST", "plugin": "Serum"}, ["SYNTH TEST"], INSTALLED) is None
    assert "plugin list" in ask.why_dropped("track_plugin", {"track": "SYNTH TEST", "plugin": "Serum"}, ["SYNTH TEST"], INSTALLED)


def test_a_section_gets_a_marker_at_each_end_and_the_rest_keeps_its_name():
    marks = [{"bar": 1, "name": "Intro"}, {"bar": 81, "name": "Outro"}]
    assert ask.section_markers({"name": "Drop", "first_bar": 97, "last_bar": 112}, marks) == \
        [{"bar": 97, "name": "Drop"}, {"bar": 113, "name": "Outro"}]
    assert ask.section_markers({"name": "Intro", "first_bar": 1, "last_bar": 16}, [{"bar": 17, "name": "Verse"}]) == \
        [{"bar": 1, "name": "Intro"}]                      # bar 17 is already marked
    assert ask.section_markers({"name": "Build", "first_bar": 9, "last_bar": 16}, []) == \
        [{"bar": 9, "name": "Build"}, {"bar": 17, "name": "After Build"}]
    assert ask.section_markers({"name": "Drop", "first_bar": 20, "last_bar": 10}, []) is None


def test_set_section_becomes_marker_actions():
    section = SimpleNamespace(function=SimpleNamespace(name="set_section", arguments=json.dumps({"name": "drop", "first_bar": 97, "last_bar": 112})))
    out = ask.interpret(msg("Making bars 97 to 112 the drop.", section), {"markers": [{"bar": 81, "name": "Outro"}]}, "make bars 97 to 112 the drop")
    assert out["actions"] == [{"type": "add_marker", "args": {"bar": 97, "name": "Drop"}},
                              {"type": "add_marker", "args": {"bar": 113, "name": "Outro"}}]


def test_sidechain_is_a_compressor_then_its_routing():
    sc = SimpleNamespace(function=SimpleNamespace(name="sidechain", arguments=json.dumps({"track": "high bass", "from_track": "kick"})))
    out = ask.interpret(msg("Ducking the bass under the kick.", sc), {"tracks": [{"name": "Kick"}, {"name": "High Bass"}]}, "sidechain the bass to the kick")
    assert [a["type"] for a in out["actions"]] == ["track_device", "route_sidechain"]
    assert out["actions"][0]["args"]["device"] == "Compressor" and out["actions"][0]["args"]["track"] == "High Bass"
    assert {"param": "S/C On", "option": "On"} in out["actions"][0]["args"]["settings"]
    assert out["actions"][1]["args"] == {"track": "High Bass", "from_track": "Kick"}
    bad = SimpleNamespace(function=SimpleNamespace(name="sidechain", arguments=json.dumps({"track": "Bass", "from_track": "Snare"})))
    assert ask.interpret(msg("x", bad), {"tracks": [{"name": "Bass"}]}, "x")["problems"][0].startswith('No track called "Snare"')


def test_mute_solo_tempo_and_delete_marker_are_checked():
    assert ask.check_action("track_mute", {"track": "kick", "on": True}, ["Kick"]) == {"track": "Kick", "on": True}
    assert ask.check_action("track_solo", {"track": "Main", "on": True}, ["Kick"]) is None     # Main has no solo or mute
    assert ask.check_action("track_mute", {"track": "Main", "on": True}, ["Kick"]) is None
    assert ask.check_action("set_tempo", {"bpm": 140}) == {"bpm": 140.0}
    assert ask.check_action("set_tempo", {"bpm": 4000}) is None
    assert ask.check_action("delete_marker", {"bar": 81}) == {"bar": 81}
    assert ask.check_action("add_marker", {"bar": 49, "name": "breakdown"}) == {"bar": 49, "name": "Breakdown"}


# ---------- from the Oct 28 review: replies stay honest, matching doesn't guess, nothing crashes ----------

def test_numbers_inside_names_and_text_are_allowed_but_invented_ones_are_not():
    ctx = {"tracks": [{"name": "808 Bass"}], "markers": [{"bar": 65, "name": "Drop 2"}],
           "recent": [{"asked": "cut 450 Hz on the bass", "did": [], "replied": None}]}
    allowed = ask._allowed(ctx, "", [{"type": "track_eq", "args": {"track": "808 Bass", "shape": "low_cut", "freq_hz": 30}}])
    assert {808.0, 2.0, 450.0, 48.0} <= allowed and 13.0 not in allowed
    assert ask._numbers("3,500 Hz in bars 97-112") == [3500.0, 97.0, 112.0]


def test_track_matching_does_not_guess():
    assert ask.match_track("it", ["Kit", "Vocal"]) is None
    assert ask.match_track("Vocal 2", ["Vocal"]) is None
    assert ask.match_track("Vocal", ["Vocal", "Vocal"]) is None
    assert ask.match_track("new vocal", ["NEW VOCAL 2", "Kick"]) == "NEW VOCAL 2"
    assert ask.match_track("the kick track", ["Kick", "Bass"]) == "Kick"
    assert ask.check_action("track_volume", {"track": "Main", "change_db": 2}, ["Main Vox", "Kick"]) == {"track": "Main", "change_db": 2.0}
    assert "Two tracks are called" in ask.why_dropped("track_volume", {"track": "Vocal", "change_db": 2}, ["Vocal", "Vocal"])


def test_a_section_takes_the_name_of_what_was_playing_and_clears_markers_inside():
    assert ask.section_markers({"name": "Drop", "first_bar": 97, "last_bar": 112}, [{"bar": 81, "name": "Build"}, {"bar": 97, "name": "Verse"}]) == \
        [{"bar": 97, "name": "Drop"}, {"bar": 113, "name": "Verse"}]
    assert ask.section_markers({"name": "Drop", "first_bar": 85, "last_bar": 100}, [{"bar": 1, "name": "Intro"}, {"bar": 90, "name": "Build"}]) == \
        [{"bar": 85, "name": "Drop"}, {"delete": 90}, {"bar": 101, "name": "Build"}]
    assert ask.section_markers({"name": "Drop", "first_bar": 1, "last_bar": 9999}, []) == [{"bar": 1, "name": "Drop"}]


def test_a_malformed_call_is_dropped_and_the_good_ones_still_run():
    bad = SimpleNamespace(function=SimpleNamespace(name="plugin_guide", arguments=json.dumps({"plugin": "Pro-Q 4", "bands": [{"shape": "bell"}]})))
    worse = SimpleNamespace(function=SimpleNamespace(name="suggest", arguments="[]"))
    out = ask.interpret(msg("Done.", bad, worse, call("jump_to", bar=17)), {}, "jump to 17")
    assert out["actions"] == [{"type": "jump_to", "args": {"bar": 17}}] and len(out["problems"]) == 2


def test_a_reply_is_dropped_when_part_of_the_request_was():
    out = ask.interpret(msg("Raised Vocal 2 dB and cut Pad 3 dB.", call("track_volume", track="Vocal", change_db=2),
                            call("track_eq", track="Pad", freq_hz=300, gain_db=-3)), {"tracks": [{"name": "Vocal"}]}, "x")
    assert out["reply"] is None and len(out["actions"]) == 1 and out["problems"]


def test_everyday_words_dont_name_plugins():
    names = ["FabFilter Pro-Q 4", "Soundtoys EchoBoy", "ValhallaDelay", "ValhallaRoom"]
    assert ask.mentioned_plugins("add a low cut filter to the vocal", names) == []
    assert ask.mentioned_plugins("make it sound wider", names) == []
    assert ask.mentioned_plugins("add a delay on the vocal", names) == []
    assert ask.mentioned_plugins("put valhalla room on it", names) == ["ValhallaRoom"]


def test_a_knob_move_needs_the_device_on_the_track():
    raise_it = call("track_device", track="Vocal", device="Compressor", settings=[{"param": "Threshold", "change": 2}])
    out = ask.interpret(msg("Raised it.", raise_it), {"tracks": [{"name": "Vocal", "devices": []}]}, "raise the threshold")
    assert out["actions"] == [] and "no Compressor" in out["problems"][0]
    out = ask.interpret(msg("Raised it.", raise_it), {"tracks": [{"name": "Vocal", "devices": ["Compressor"]}]}, "raise the threshold")
    assert out["actions"][0]["args"]["settings"] == [{"param": "Threshold", "change": 2.0}]


def test_add_means_a_new_device_and_a_move_means_the_one_there():
    tracks = {"tracks": [{"name": "Vocal", "devices": ["Compressor"]}]}
    add = ask.interpret(msg("Adding one.", call("track_device", track="Vocal", device="Compressor", mode="add",
                                                settings=[{"param": "Threshold", "value": -18}])), tracks, "add a compressor")
    assert add["actions"][0]["args"]["mode"] == "add"
    move = ask.interpret(msg("Raised it.", call("track_device", track="Vocal", device="Compressor",
                                                 settings=[{"param": "Threshold", "change": 2}])), tracks, "raise the threshold")
    assert move["actions"][0]["args"]["mode"] == "change"
    assert ask.sidechain_steps({"track": "Vocal", "from_track": "Kick"}, ["Vocal", "Kick"])[0]["args"]["mode"] == "add"


def test_exact_capitals_tell_two_tracks_apart():
    """Ian, Oct 30: "vOCAL" and "VOCAL" in one set; asking for "vOCAL" means that one."""
    assert ask.match_track("vOCAL", ["vOCAL", "VOCAL", "VOCAL (matched)"]) == "vOCAL"
    assert ask.match_track("VOCAL", ["vOCAL", "VOCAL"]) == "VOCAL"
    assert ask.match_track("vocal", ["vOCAL", "VOCAL"]) is None       # neither written that way: still ask


def test_knob_values_written_as_text_are_read():
    assert ask._setting({"param": "Dry/Wet", "value": "40%"}) == {"param": "Dry/Wet", "value": 40.0}
    assert ask._setting({"param": "Output", "change": "-2 dB"}) == {"param": "Output", "change": -2.0}
    assert ask._setting({"param": "Dry/Wet", "value": 30, "change": 5}) == {"param": "Dry/Wet", "value": 30.0}


def test_each_devices_units_decide_its_limits():
    """Drum Buss Drive is a percentage; Saturator Drive is dB (the refused Drum Buss change, Oct 30)."""
    assert ask._setting({"param": "Drive", "value": 20}, "Drum Buss") == {"param": "Drive", "value": 20.0}
    assert ask._setting({"param": "Drive", "value": 20}, "Saturator") is None
    assert ask._setting({"param": "Stereo Width", "value": 150}, "Utility") == {"param": "Stereo Width", "value": 150.0}


def test_utility_mono_only_when_asked():
    ctx = {"tracks": ["Bass"]}
    out = ask.interpret(msg(None, call("track_device", track="Bass", device="Utility", settings=[{"param": "Mono", "option": "On"}, {"param": "Bass Mono", "option": "On"}])), ctx, "tighten the low end")
    assert out["actions"][0]["args"]["settings"] == [{"param": "Bass Mono", "option": "On"}] and "Mono off" in out["problems"][0]
    asked = ask.interpret(msg(None, call("track_device", track="Bass", device="Utility", settings=[{"param": "Mono", "option": "On"}])), ctx, "make the bass mono")
    assert asked["actions"][0]["args"]["settings"] == [{"param": "Mono", "option": "On"}]
    assert "Dry/Wet" in ask.why_dropped("track_device", {"track": "BASS", "device": "Drum Buss", "settings": [{"param": "Dry/Wet", "value": 140}]}, ["BASS"])
