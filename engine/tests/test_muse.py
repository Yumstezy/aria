import json
from types import SimpleNamespace

from aria_engine import muse

MEASURED = {
    "integrated_lufs": -6.6,
    "true_peak_dbtp": 1.0,
    "bands_db": {"bass": -10.3, "mids": -17.2, "treble": -16.9},
    "width": {"bass": 0.0, "mids": 0.14, "treble": 0.19},
    "unmeasured": {},
}
CONTEXT = {"bars": 8, "tempo": 150.0}
FINDINGS = [
    {"kind": "resonance", "hz": 339, "hz_range": [329, 349], "size_db": 9.7, "share": 0.97, "bars": [93, 108]},
    {"kind": "harsh", "hz": 2153, "hz_range": [2091, 2216], "size_db": 7.9, "bursts_per_bar": 1.2, "bars": [98, 108], "share": 0.05},
]


def reply(obj):
    content = obj if isinstance(obj, str) else json.dumps(obj)
    msg = SimpleNamespace(content=content)
    create = lambda **kw: SimpleNamespace(choices=[SimpleNamespace(message=msg)])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def advise(obj):
    return muse.advise(MEASURED, CONTEXT, findings=FINDINGS, client=reply(obj))


def test_no_key_says_why(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    advice, error = muse.advise(MEASURED, CONTEXT, findings=FINDINGS)
    assert advice is None and "MODEL_API_KEY" in error


def test_valid_clarity_advice_with_fix_passes():
    advice, error = advise({
        "summary": "A note around 339 Hz rings through bars 93 to 108.",
        "notes": [{"finding": 0, "kind": "resonance",
                   "text": "It stands 9.7 dB above the frequencies around it 97 percent of the time. Try a narrow cut of 3 dB.",
                   "fix": {"type": "eq_band", "freq_hz": 339, "gain_db": -3, "q": 6}}],
    })
    assert error is None
    assert advice["notes"][0]["fix"] == {"type": "eq_band", "freq_hz": 339, "gain_db": -3.0, "q": 6.0}


def test_khz_wording_of_a_measured_frequency_is_allowed():
    advice, _ = advise({"summary": "Hits around 2.2 kHz poke out.",
                        "notes": [{"finding": 1, "kind": "harsh", "text": "Bursts at 2.2 kHz jump 7.9 dB.", "fix": None}]})
    assert advice and len(advice["notes"]) == 1


def test_note_with_an_invented_number_is_dropped():
    advice, _ = advise({"summary": "A note around 339 Hz rings.",
                        "notes": [{"finding": 0, "kind": "resonance", "text": "It is 4 dB louder than most mixes.", "fix": None}]})
    assert advice["notes"] == []


def test_fix_outside_the_finding_or_the_limits_is_dropped():
    advice, _ = advise({"summary": "A note around 339 Hz rings.",
                        "notes": [{"finding": 0, "kind": "resonance", "text": "Cut it.",
                                   "fix": {"type": "eq_band", "freq_hz": 1000, "gain_db": -3, "q": 4}},
                                  {"finding": 0, "kind": "resonance", "text": "Cut it hard.",
                                   "fix": {"type": "eq_band", "freq_hz": 339, "gain_db": -12, "q": 4}}]})
    assert [n["fix"] for n in advice["notes"]] == [None, None]


def test_note_pointing_at_a_missing_finding_is_dropped():
    advice, _ = advise({"summary": "A note around 339 Hz rings.",
                        "notes": [{"finding": 5, "kind": "buildup", "text": "Something builds up.", "fix": None}]})
    assert advice["notes"] == []


def test_comparison_without_a_reference_is_dropped():
    advice, _ = advise({"summary": "A note around 339 Hz rings.",
                        "notes": [{"finding": 1, "kind": "harsh", "text": "The top end is too harsh.", "fix": None}]})
    assert advice["notes"] == []


def test_bad_json_is_no_advice():
    advice, error = advise("not json")
    assert advice is None and "JSON" in error


def test_empty_reply_is_no_advice():
    advice, error = advise("")
    assert advice is None and "empty" in error


def test_summary_with_invented_number_is_no_advice():
    advice, error = advise({"summary": "Your mix is 4 dB too hot.", "notes": []})
    assert advice is None and error


def test_rounded_frequency_from_a_finding_is_allowed():
    advice, error = advise({"summary": "A ringing note around 340 Hz sticks out most.", "notes": []})
    assert error is None and advice["summary"].startswith("A ringing note around 340 Hz")


def test_frequency_outside_every_finding_is_still_dropped():
    advice, error = advise({"summary": "Something at 800 Hz sticks out.", "notes": []})
    assert advice is None and error
