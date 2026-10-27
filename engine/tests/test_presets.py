"""The preset catalog reads each vendor's format. The files here are tiny ones written by the tests,
in each format's layout, not real presets."""
import gzip
import json
import struct

from aria_engine import presets

RACK = """<?xml version="1.0" encoding="UTF-8"?>
<Ableton><GroupDevicePreset><Device><AudioEffectGroupDevice Id="0">
  <UserName Value="Dreamy Space Reverb" />
  <MacroControls.0><Manual Value="127" /></MacroControls.0>
  <MacroDisplayNames.0 Value="Boost" /><MacroDisplayNames.1 Value="Macro 2" />
</AudioEffectGroupDevice></Device>
<BranchPresets><AudioEffectBranchPreset Id="0"><Name Value="" /><DevicePresets>
  <DevicePreset><Device><Hybrid Id="0"><UserName Value="" /></Hybrid></Device></DevicePreset>
  <DevicePreset><Device><Chorus2 Id="0"><UserName Value="" /></Chorus2></Device></DevicePreset>
</DevicePresets></AudioEffectBranchPreset></BranchPresets></GroupDevicePreset></Ableton>"""

FFP_TEXT = """[Preset]
Signature=FQ4p
Version=4
Tags="Vocals,Bright"

[Parameters]
Band 1 Frequency=9.96578407287598
Band 1 Gain=-2.5
"""

VALHALLA = '<?xml version="1.0"?>\n<ValhallaSupermassive pluginVersion="1.2.0" presetName="Far Away" Mix="0.5" Feedback="0.4"/>'
OZONE = ('<?xml version="1.0" standalone="yes" ?><Ozone9VintageEQ Comments="Brings out extra bass">'
         '<VintageEQ Enabled="1"><Param ParamID="EQP Low Boost" Value="4.0" /></VintageEQ></Ozone9VintageEQ>')


def library(tmp_path):
    live = tmp_path / "live" / "Audio Effects"
    live.mkdir(parents=True)
    (live / "Dreamy Space Reverb.adg").write_bytes(gzip.compress(RACK.encode()))
    ff = tmp_path / "ff" / "Pro-Q 4" / "Vocals"
    ff.mkdir(parents=True)
    (ff / "Vocal Lead.ffp").write_text(FFP_TEXT)
    old = tmp_path / "ff" / "Pro-C 2" / "Drums"
    old.mkdir(parents=True)
    (old / "Kick Punch.ffp").write_bytes(b"FC2p" + struct.pack("<II3f", 2, 3, 6.0, -16.0, 0.5))
    vh = tmp_path / "vh" / "ValhallaSupermassive" / "Presets" / "Factory"
    vh.mkdir(parents=True)
    (vh / "Far Away.vpreset").write_text(VALHALLA)
    oz = tmp_path / "oz" / "Vintage EQ Presets"
    oz.mkdir(parents=True)
    (oz / "Bass Lift.xml").write_text(OZONE)
    names = tmp_path / "aria"
    names.mkdir()
    (names / "pack-imported.json").write_text(json.dumps([{"file": str(live / "Dreamy Space Reverb.adg"), "name": "Dreamy Space Reverb",
                                                             "role": "any", "words": ["spacey", "airy"]}]))
    roots = {"live": [tmp_path / "live"], "fabfilter": [tmp_path / "ff"], "valhalla": [tmp_path / "vh"], "ozone": [tmp_path / "oz"]}
    return roots, names


def test_catalog_reads_every_format(tmp_path):
    roots, names = library(tmp_path)
    entries, skipped = presets.scan(roots, names)
    assert skipped == 0
    by = {e["name"]: e for e in entries}
    assert by["Dreamy Space Reverb"]["plugin"] == "Audio Effect Rack"
    assert by["Dreamy Space Reverb"]["devices"] == ["Hybrid", "Chorus2"]
    assert by["Dreamy Space Reverb"]["macros"] == ["Boost"]
    assert by["Dreamy Space Reverb"]["words"] == ["spacey", "airy"]          # Aria's words win over the title
    assert by["Vocal Lead"]["plugin"] == "FabFilter Pro-Q 4" and "bright" in by["Vocal Lead"]["words"]
    assert by["Kick Punch"]["format"] == "binary" and by["Kick Punch"]["category"] == "Drums"
    assert by["Far Away"]["plugin"] == "ValhallaSupermassive" and by["Far Away"]["category"] == "Factory"
    assert by["Bass Lift"]["plugin"] == "Ozone 12 Vintage EQ" and "bass" in by["Bass Lift"]["words"]


def test_knob_values_are_read_as_stored(tmp_path):
    roots, names = library(tmp_path)
    by = {e["name"]: e for e in presets.scan(roots, names)[0]}
    assert presets.read_params(by["Vocal Lead"]) == {"Band 1 Frequency": 9.96578407287598, "Band 1 Gain": -2.5}
    assert presets.read_params(by["Kick Punch"]) == {"#0": 6.0, "#1": -16.0, "#2": 0.5}
    assert presets.read_params(by["Far Away"]) == {"Mix": 0.5, "Feedback": 0.4}
    assert presets.read_params(by["Bass Lift"]) == {"EQP Low Boost": 4.0}
    assert presets.read_params(by["Dreamy Space Reverb"]) == {"MacroControls.0": "127"}


def test_a_broken_file_is_skipped_not_fatal(tmp_path):
    roots, names = library(tmp_path)
    (tmp_path / "ff" / "Pro-Q 4" / "Broken.ffp").write_bytes(b"\x00\x01garbage")
    entries, skipped = presets.scan(roots, names)
    assert skipped == 1 and len(entries) == 5
