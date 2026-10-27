"""Muse Spark client. Turns measurements into advice JSON, or says why it can't.

Muse Spark gets measured numbers only. Its reply is validated, and any note that
breaks the rules is dropped. If there's no key, the call fails, or nothing valid
comes back, advice is None with the reason. There is no canned fallback text.
"""
import json
import os
import re

from openai import OpenAI, OpenAIError

ASPECTS = {"loudness", "true_peak", "bass", "mids", "treble", "width"}
TIMEOUT_SEC = 20
MAX_TOKENS = 1500

# Without a reference there is nothing to compare against, so these verdicts are off limits.
COMPARISON = re.compile(r"\btoo (bright|dark|dull|quiet|loud|wide|narrow|thin|muddy|harsh|boomy|light|heavy)\b", re.I)
# Numbers the advice may cite besides measured values: 0 dBTP, band edges in Hz and kHz.
CONSTANTS = {0.0, 250.0, 2.0, 2000.0}

PROMPT_NO_REFERENCE = """You are Aria, a calm co-producer inside Ableton Live, talking to a music producer.
You get measurements of a few bars of their mix as JSON. Use only those numbers. Never invent a number.
A field that is null was not measured. Don't guess it.

There is no reference track yet, so you can't judge the mix against anything:
- Never say anything is too bright, too quiet, too wide or similar.
- You may describe what was measured in plain words: which band carries the most energy, whether the mix is mostly centred or spread wide (width 0 is mono, 1 is all side).
- You may flag what is objectively true without a reference: a true peak above 0 dBTP will clip on export.

How to write:
- Producer words, not engineer words: Bass, Mids, Treble, Loudness, Width.
- Plain words first, then the number as detail, written with its sign and unit like -9.1 LUFS or 0.4 dBTP.
- Short sentences. No emojis, no exclamation marks, no em dashes.
- The summary is the one most useful thing to know. If nothing is wrong objectively, say so and suggest loading a track they want to sound like, so Aria can compare.
- One note per aspect at most, and skip aspects with nothing useful to say.

Answer with JSON only, in this shape:
{"summary": "one sentence", "notes": [{"aspect": "loudness|true_peak|bass|mids|treble|width", "text": "one sentence", "uses": ["measured field names you relied on"]}]}"""


def _numbers(text):
    return [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", text)]


def _allowed_numbers(measured, context):
    allowed = set(CONSTANTS)

    def add(v):
        if isinstance(v, (int, float)):
            for x in (v, abs(v)):
                allowed.update({round(x, 2), round(x, 1), float(round(x))})

    for k, v in measured.items():
        if isinstance(v, dict):
            for vv in v.values():
                add(vv)
        else:
            add(v)
    for v in context.values():
        add(v)
    return allowed


def validate(raw, measured, context, has_reference):
    """Return (advice, error). Drops any note that cites a number we didn't measure."""
    try:
        data = json.loads(raw or "")
    except json.JSONDecodeError:
        return None, "Muse Spark's reply wasn't valid JSON."
    if not isinstance(data, dict) or not isinstance(data.get("summary"), str) or not data["summary"].strip():
        return None, "Muse Spark's reply had no summary."

    allowed = _allowed_numbers(measured, context)

    def ok(text):
        if any(round(n, 2) not in allowed for n in _numbers(text)):
            return False
        return has_reference or not COMPARISON.search(text)

    if not ok(data["summary"]):
        return None, "Muse Spark's summary used a number or a comparison we didn't measure."

    notes = []
    for n in data.get("notes") or []:
        if not isinstance(n, dict) or n.get("aspect") not in ASPECTS or not isinstance(n.get("text"), str):
            continue
        if not ok(n["text"]):
            continue
        notes.append({"aspect": n["aspect"], "text": n["text"].strip(),
                      "uses": [u for u in n.get("uses") or [] if isinstance(u, str)]})
    return {"summary": data["summary"].strip(), "notes": notes}, None


def advise(measured, context, client=None):
    """Ask Muse Spark for advice on measured numbers. Returns (advice, error)."""
    key = os.environ.get("MODEL_API_KEY", "").strip()
    if client is None and not key:
        return None, "No Muse Spark key. Add MODEL_API_KEY to engine/.env and restart the engine."

    if client is None:
        client = OpenAI(api_key=key, base_url=os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1"),
                        timeout=TIMEOUT_SEC, max_retries=1)
    model = os.environ.get("MUSE_MODEL", "muse-spark-1.3")
    payload = {**context, "reference": None, "measured": {k: v for k, v in measured.items() if k != "unmeasured"},
               "not_measured": measured.get("unmeasured", {})}

    try:
        res = client.chat.completions.create(
            model=model, max_tokens=MAX_TOKENS, reasoning_effort="minimal",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": PROMPT_NO_REFERENCE},
                      {"role": "user", "content": json.dumps(payload)}])
    except OpenAIError as e:
        return None, f"Muse Spark is unavailable right now ({type(e).__name__})."

    raw = res.choices[0].message.content if res.choices else None
    if not raw:
        return None, "Muse Spark returned an empty reply."
    return validate(raw, measured, context, has_reference=False)
