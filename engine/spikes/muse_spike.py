"""Day 1 spike (build step 1, questions 1 to 3): what Muse Spark can do for Aria.

Run from engine/:  .venv/bin/python spikes/muse_spike.py

Not app code. The measurements below are a test fixture to check the JSON
shape, and the audio is a generated test tone. Neither ever reaches the app.
"""
import base64
import io
import json
import math
import os
import struct
import sys
import time
import wave

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
client = OpenAI(api_key=os.environ["MODEL_API_KEY"], base_url=os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1"))
MODELS = sys.argv[1:] or ["muse-spark-1.1", "muse-spark-1.3"]

# Test fixture: the shape the engine will send for a mix with no reference.
FIXTURE = {
    "reference": None,
    "bars": 8,
    "tempo": 124.0,
    "measured": {
        "integrated_lufs": -9.1,
        "true_peak_dbtp": 0.4,
        "bands_db": {"bass": -14.2, "mids": -16.8, "treble": -21.5},
        "width": {"bass": 0.12, "mids": 0.41, "treble": 0.63},
    },
}

ADVICE_PROMPT = """You are Aria, a calm co-producer inside Ableton Live.
You get measurements of the producer's mix as JSON. Use only those numbers. Never invent a number.
There is no reference track, so never say anything is too bright, too quiet, too wide or similar.
Only say what is objectively true without a reference, such as a true peak above 0 dBTP clipping on export.
Plain words, short sentences, no emojis, no em dashes.
Answer with JSON only, in this shape:
{"summary": "one sentence", "notes": [{"aspect": "loudness|true_peak|bass|mids|treble|width", "text": "one sentence", "uses": ["measured field names you relied on"]}]}"""

ASPECTS = {"loudness", "true_peak", "bass", "mids", "treble", "width"}


def check_advice(raw):
    """Return (ok, reason) for an advice reply."""
    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return False, "not JSON"
    if not isinstance(data.get("summary"), str) or not isinstance(data.get("notes"), list):
        return False, "missing summary or notes"
    for n in data["notes"]:
        if n.get("aspect") not in ASPECTS or not isinstance(n.get("text"), str):
            return False, f"bad note: {n}"
    return True, "valid"


def test_tone_wav(seconds=2.0, hz=440.0, rate=44100):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * hz * i / rate))) for i in range(int(seconds * rate))))
    return base64.b64encode(buf.getvalue()).decode()


TOOLS = [
    {"type": "function", "function": {
        "name": "set_section",
        "description": "Set a section of the producer's song.",
        "parameters": {"type": "object", "properties": {
            "start_bar": {"type": "integer", "minimum": 1},
            "bars": {"type": "integer", "minimum": 1},
            "name": {"type": "string", "enum": ["Intro", "Verse", "Build", "Chorus", "Drop", "Break", "Outro"]},
        }, "required": ["start_bar", "bars", "name"]}}},
    {"type": "function", "function": {
        "name": "jump_to",
        "description": "Move Live's playhead to a bar.",
        "parameters": {"type": "object", "properties": {"bar": {"type": "integer", "minimum": 1}}, "required": ["bar"]}}},
]


def timed(fn):
    t = time.time()
    try:
        return fn(), round(time.time() - t, 1), None
    except Exception as e:  # report every failure, the spike is about finding them
        return None, round(time.time() - t, 1), f"{type(e).__name__}: {str(e)[:200]}"


for model in MODELS:
    print(f"\n=== {model}")

    # 1. Advice JSON from measurements
    for effort in [None, "minimal"]:
        extra = {"reasoning_effort": effort} if effort else {}
        res, secs, err = timed(lambda: client.chat.completions.create(
            model=model, max_tokens=2000, response_format={"type": "json_object"},
            messages=[{"role": "system", "content": ADVICE_PROMPT}, {"role": "user", "content": json.dumps(FIXTURE)}], **extra))
        label = f"advice (reasoning {effort or 'default'})"
        if err:
            print(f"{label}: FAILED in {secs}s  {err}")
            continue
        raw = res.choices[0].message.content
        ok, why = check_advice(raw)
        print(f"{label}: {why} in {secs}s, {res.usage.completion_tokens} output tokens")
        print("   ", (raw or "")[:500].replace("\n", " "))

    # 2. Audio input
    res, secs, err = timed(lambda: client.chat.completions.create(
        model=model, max_tokens=800,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": "Describe this audio in one sentence: what you hear and its pitch."},
            {"type": "input_audio", "input_audio": {"data": test_tone_wav(), "format": "wav"}}]}]))
    print(f"audio: {'FAILED ' + err if err else 'accepted'} in {secs}s")
    if res:
        print("   ", (res.choices[0].message.content or "")[:300])

    # 3. Tool calling with our action menu
    res, secs, err = timed(lambda: client.chat.completions.create(
        model=model, max_tokens=1000, tools=TOOLS,
        messages=[{"role": "system", "content": "You control Ableton Live for the producer through the tools. Use a tool when asked for a change."},
                  {"role": "user", "content": "Make bars 1 to 16 the intro."}]))
    if err:
        print(f"tools: FAILED in {secs}s  {err}")
    else:
        calls = res.choices[0].message.tool_calls or []
        print(f"tools: {len(calls)} call(s) in {secs}s")
        for c in calls:
            print(f"    {c.function.name}({c.function.arguments})")
