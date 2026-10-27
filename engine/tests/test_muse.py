import json
from types import SimpleNamespace

from aria_engine import muse

MEASURED = {
    "integrated_lufs": -9.1,
    "true_peak_dbtp": 0.4,
    "bands_db": {"bass": -14.2, "mids": -16.8, "treble": -21.5},
    "width": {"bass": 0.12, "mids": 0.41, "treble": 0.63},
    "unmeasured": {},
}
CONTEXT = {"bars": 8, "tempo": 124.0}


def reply(obj):
    content = obj if isinstance(obj, str) else json.dumps(obj)
    msg = SimpleNamespace(content=content)
    create = lambda **kw: SimpleNamespace(choices=[SimpleNamespace(message=msg)])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_no_key_says_why(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    advice, error = muse.advise(MEASURED, CONTEXT)
    assert advice is None and "MODEL_API_KEY" in error


def test_valid_reply_passes():
    advice, error = muse.advise(MEASURED, CONTEXT, client=reply({
        "summary": "Over 8 bars your mix measures -9.1 LUFS.",
        "notes": [{"aspect": "true_peak", "text": "True peak is 0.4 dBTP, above 0, so it can clip on export.", "uses": ["true_peak_dbtp"]}],
    }))
    assert error is None
    assert advice["notes"][0]["aspect"] == "true_peak"


def test_note_with_an_invented_number_is_dropped():
    advice, _ = muse.advise(MEASURED, CONTEXT, client=reply({
        "summary": "Your mix measures -9.1 LUFS.",
        "notes": [{"aspect": "bass", "text": "Bass sits 3.5 dB under a typical mix.", "uses": []},
                  {"aspect": "mids", "text": "Mids measure -16.8 dB.", "uses": ["bands_db.mids"]}],
    }))
    assert [n["aspect"] for n in advice["notes"]] == ["mids"]


def test_comparison_without_a_reference_is_dropped():
    advice, _ = muse.advise(MEASURED, CONTEXT, client=reply({
        "summary": "Your mix measures -9.1 LUFS.",
        "notes": [{"aspect": "treble", "text": "The treble is too bright.", "uses": []}],
    }))
    assert advice["notes"] == []


def test_bad_json_is_no_advice():
    advice, error = muse.advise(MEASURED, CONTEXT, client=reply("not json"))
    assert advice is None and "JSON" in error


def test_empty_reply_is_no_advice():
    advice, error = muse.advise(MEASURED, CONTEXT, client=reply(""))
    assert advice is None and "empty" in error


def test_summary_with_invented_number_is_no_advice():
    advice, error = muse.advise(MEASURED, CONTEXT, client=reply({"summary": "Your mix is 4 dB too hot.", "notes": []}))
    assert advice is None and error
