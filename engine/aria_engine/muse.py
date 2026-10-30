"""Muse Spark client. Turns clarity findings into advice JSON, or says why it can't.

Muse Spark gets measured numbers only: the clarity findings (what sticks out, where,
by how much) plus loudness as background. Advice is about clarity, never loudness.
Its reply is validated, and anything that breaks the rules is dropped. If there's no
key, the call fails, or nothing valid comes back, advice is None with the reason.
There is no canned fallback text.
"""
import json
import os
import re

from openai import OpenAI, OpenAIError

KINDS = {"resonance", "buildup", "harsh", "masking", "bass_click", "clash", "reference"}
TIMEOUT_SEC = 20
SHORT_WORDS = 12          # the one-line version shown before the full note
MAX_TOKENS = 1500
# A cut Muse may suggest, within the action menu in docs/contracts.md (eq_band gain -6 to +6 dB)
CUT_DB = (-6.0, -0.5)
Q_RANGE = (0.3, 12.0)

# Without a reference there is nothing to compare against, so these verdicts are off limits.
COMPARISON = re.compile(r"\btoo (bright|dark|dull|quiet|loud|wide|narrow|thin|muddy|harsh|boomy|light|heavy)\b", re.I)
# With a reference the comparison is the point: the no-verdicts rule becomes "compare with that song, by name".
NO_REFERENCE_RULE = """- There is no reference track. Never say "too bright", "too muddy" or similar. Say what sticks out and by how much."""
REFERENCE_RULE = """- The producer picked a reference song. Compare with it by name, in plain words first: "Your low mids are fuller than
  <name>", then "+4.3 dB from 400 to 630 Hz" as the detail. Only for differences in the JSON."""
# Numbers the advice may cite besides measured values: 0 dBTP, band edges in Hz and kHz.
CONSTANTS = {0.0, 250.0, 2.0, 2000.0}

PROMPT = """You are Aria, a calm co-producer inside Ableton Live, talking to an EDM producer.
A good mix is clear: every sound has its own space. Your job is to explain what sticks out in their mix
and how to make space. Loudness and true peak are background only. Never build advice around them.

You get JSON:
- "findings": what Aria measured sticking out in a few bars of the mix, strongest first. Each has a kind:
  - "resonance": a narrow peak at "hz" standing "size_db" above its neighbouring frequencies for "share" of the time
  - "buildup": the range "hz_range" growing "size_db" louder than its neighbours from the first of "bars"
  - "harsh": short bursts at "hz", "size_db" above that band's usual level, "bursts_per_bar" times per bar
  - "masking": the sound "masked" sits "gap_db" under "by" in the "range" ("hz_range"), for "share" of the time it plays.
    "by" may be "the rest" (everything else together). Sound names come from splitting the mix:
    "vocals"; "drums" (drums and percussion loops); "bass"; "other" (synths, pads, keys, non-drum loops).
    "other" covered in the low-mid range is muddy low-mids.
  - "bass_click": a click at the start of bass notes, on "clicky_share" of "starts" note starts,
    "size_db" above the bass's usual top end
  - "clash": two of the producer's own tracks ("tracks", by their names in Live) both play strongly in "hz_range"
    at the same moments, within "diff_db" of each other, so neither stands clear, for "share" of the time both play
    there. "louder" is the one slightly on top. Fix in words: cut one of the two in that range (usually the one that
    matters less there), sidechain one to the other, or move one in the stereo field. "fix" is null.
  - "reference" (only when the producer picked a reference song): against that song, loudness matched, the range
    "hz_range" around "hz" is "diff_db" louder (positive) or quieter (negative). "shape" "stretch" means it stands
    "stands_out_db" apart from the frequencies around it, like a boosted instrument; "band" means the whole named
    "band" is off. Fix when positive: an EQ cut inside the range ("fix" as for resonance, gain no deeper than diff_db).
    When negative: bring that range up on the part that should carry it, in words, "fix" null.
  In key tracks mode, "masked" and "by" are the producer's track names, not split sounds. Use them as they are.
  "bars" is [first, last]. "share" and "clicky_share" are fractions (0.97 means 97 percent).
- "measured": loudness and band levels, for background.
- "reference": null, or the song the producer compares with: its "name" and each band's "diff_db" against it.

Rules:
- Use only numbers from the JSON. Never invent a number.
- There is no reference track. Never say "too bright", "too muddy" or similar. Say what sticks out and by how much.
- Producer words first, numbers as detail: "a ringing note around 340 Hz", then "9.7 dB above the frequencies around it".
- Say what it means for a listener in a few words.
- For each finding, one concrete fix:
  - resonance or harsh: an EQ cut, also given as "fix": {"type": "eq_band", "freq_hz": number inside the finding's range, "gain_db": a cut from -6 to -0.5, "q": 0.3 to 12}.
  - masking: make room, in words. Bring the covered sound up, dip the covering sound in that range, or sidechain it. "fix" is null, because Aria can't change a split sound directly.
  - bass_click: in words. Check the bass sample's start, add a few milliseconds of fade-in on the bass notes, or soften the attack. "fix" is null.
- If there are no findings, say nothing stuck out in these bars, and that Key tracks mode (Aria Ear on the main tracks) can show which sounds clash.
- Short sentences. No emojis, no exclamation marks, no em dashes.
- Call sounds by everyday names: "vocals" is the vocal, "other" is the synths and keys, "the rest" is everything else.
  Never write "other" or "the rest" as if it were a name.
- For each note also write "short": what a listener notices, at most 10 words, no numbers. Example: "Words get lost under the drums".

Answer with JSON only:
{"summary": "one sentence, the most useful thing to know",
 "notes": [{"finding": 0, "kind": "resonance|buildup|harsh|masking|bass_click|clash|reference, copied from the finding", "short": "at most 10 words", "text": "one or two sentences", "fix": {"type": "eq_band", "freq_hz": 340, "gain_db": -3, "q": 4} or null}]}"""


def _numbers(text):
    return [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", text)]


def _allowed_numbers(measured, context, findings):
    allowed = set(CONSTANTS)

    def add(v):
        if isinstance(v, bool):
            return
        if isinstance(v, (int, float)):
            for x in (v, abs(v)):
                allowed.update({round(x, 2), round(x, 1), float(round(x))})
        elif isinstance(v, (list, tuple)):
            for x in v:
                add(x)
        elif isinstance(v, dict):
            for x in v.values():
                add(x)

    add({k: v for k, v in measured.items() if k != "unmeasured"})
    add(context)
    for f in findings:
        add(f)
        for k in ("share", "clicky_share"):
            if k in f:
                add(round(f[k] * 100))                       # 0.97 -> "97 percent"
        for hz in [f.get("hz")] + list(f.get("hz_range") or []):
            if hz:
                add(round(hz, -1))                           # 339 Hz -> "around 340 Hz"
                add(round(hz / 1000, 1))                     # 2153 Hz -> "2.2 kHz"
                add(round(hz / 1000, 2))
    return allowed


def _in_measured_range(n, findings):
    """A frequency inside a finding's measured range ("around 340 Hz" for 329 to 349 Hz)."""
    return any(f.get("hz_range") and f["hz_range"][0] <= n <= f["hz_range"][1] for f in findings)


# An EQ cut on the master only helps a problem that lives in the master itself. A buried
# vocal or a clicking bass in split mode isn't fixable by cutting the whole mix.
EQ_FIXABLE = {"resonance", "harsh", "buildup"}   # and "reference" when it's louder than the reference (a cut helps)


def _valid_fix(fix, finding):
    """An eq_band cut inside the finding's frequency range and the action menu's limits."""
    cuttable = finding.get("kind") in EQ_FIXABLE or (finding.get("kind") == "reference" and finding.get("diff_db", 0) > 0)
    if not isinstance(fix, dict) or fix.get("type") != "eq_band" or not cuttable:
        return None
    try:
        freq, gain, q = float(fix["freq_hz"]), float(fix["gain_db"]), float(fix["q"])
    except (KeyError, TypeError, ValueError):
        return None
    lo, hi = finding.get("hz_range") or [finding.get("hz"), finding.get("hz")]
    if not (lo * 0.9 <= freq <= hi * 1.1 and CUT_DB[0] <= gain <= CUT_DB[1] and Q_RANGE[0] <= q <= Q_RANGE[1]):
        return None
    return {"type": "eq_band", "freq_hz": round(freq), "gain_db": round(gain, 1), "q": round(q, 1)}


def _plain(text):
    """No em or en dashes in anything the producer reads: between numbers it's "to", elsewhere a comma."""
    text = re.sub(r"(\d)\s*[\u2013\u2014]\s*(\d)", r"\1 to \2", text)
    return re.sub(r"\s*[\u2013\u2014]\s*", ", ", text).strip()


def validate(raw, measured, context, findings, has_reference=False):
    """Return (advice, error). Drops any note that cites a number we didn't measure,
    judges without a reference, or points at a finding that doesn't exist."""
    try:
        data = json.loads(raw or "")
    except json.JSONDecodeError:
        return None, "Muse Spark's reply wasn't valid JSON."
    if not isinstance(data, dict) or not isinstance(data.get("summary"), str) or not data["summary"].strip():
        return None, "Muse Spark's reply had no summary."

    allowed = _allowed_numbers(measured, context, findings)

    def ok(text, extra=()):
        if any(round(n, 2) not in allowed | set(extra) and not _in_measured_range(n, findings) for n in _numbers(text)):
            return False
        return has_reference or not COMPARISON.search(text)

    notes = []
    for n in data.get("notes") or []:
        if not isinstance(n, dict) or not isinstance(n.get("text"), str):
            continue
        i = n.get("finding")
        if not isinstance(i, int) or not 0 <= i < len(findings) or n.get("kind") != findings[i]["kind"]:
            continue
        fix = _valid_fix(n.get("fix"), findings[i])
        extra = {round(v, 2) for v in (fix or {}).values() if isinstance(v, (int, float))}
        extra |= {round(abs(v), 2) for v in extra}
        if not ok(n["text"], extra):
            continue
        short = n.get("short")
        short = short.strip() if isinstance(short, str) and len(short.split()) <= SHORT_WORDS and ok(short) else None
        notes.append({"finding": i, "kind": n["kind"], "short": short and _plain(short), "text": _plain(n["text"]), "fix": fix})

    fix_numbers = {round(abs(v), 2) for n in notes for v in (n["fix"] or {}).values() if isinstance(v, (int, float))}
    if not ok(data["summary"], fix_numbers | {-x for x in fix_numbers}):
        return None, "Muse Spark's summary used a number or a comparison we didn't measure."
    return {"summary": _plain(data["summary"]), "notes": notes}, None


def advise(measured, context, findings=None, client=None, reference=None):
    """Ask Muse Spark for clarity advice on measured findings. Returns (advice, error).
    reference: {"name", "bands"} when the producer picked a reference song (build step 8)."""
    findings = findings or []
    key = os.environ.get("MODEL_API_KEY", "").strip()
    if client is None and not key:
        return None, "No Muse Spark key. Add MODEL_API_KEY to engine/.env and restart the engine."

    if client is None:
        client = OpenAI(api_key=key, base_url=os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1"),
                        timeout=TIMEOUT_SEC, max_retries=1)
    model = os.environ.get("MUSE_MODEL", "muse-spark-1.3")
    payload = {**context, "reference": reference, "findings": findings,
               "measured": {k: v for k, v in measured.items() if k != "unmeasured"}}

    try:
        res = client.chat.completions.create(
            model=model, max_tokens=MAX_TOKENS, reasoning_effort="minimal",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": PROMPT.replace(NO_REFERENCE_RULE, REFERENCE_RULE) if reference else PROMPT},
                      {"role": "user", "content": json.dumps(payload)}])
    except OpenAIError as e:
        return None, f"Muse Spark is unavailable right now ({type(e).__name__})."

    raw = res.choices[0].message.content if res.choices else None
    if not raw:
        return None, "Muse Spark returned an empty reply."
    if reference:   # its band differences are measured numbers the advice may cite
        return validate(raw, measured, {**context, "reference_bands": [b["diff_db"] for b in reference["bands"]]}, findings, has_reference=True)
    return validate(raw, measured, context, findings)


# ---------- Naming the song's parts (Arrangement, build step 8b) ----------

SECTIONS_MAX_TOKENS = 3000
# EDM part names only (Oct 29): with Verse and Chorus on the list too, one song came back Drop, Break, Build one run
# and Chorus, Verse, Pre-chorus the next. One vocabulary keeps the names steady, so "your drop against their drop" works.
SECTION_NAMES = ["Intro", "Build", "Drop", "Break", "Bridge", "Outro"]

SECTIONS_PROMPT = """You name the parts of a producer's song in Ableton Live. You get JSON: "sections", in order, each with
"label" (parts with the same letter sound alike), "start_bar", "bars", "energy_db" (how loud the part is against the
loudest bar of the song, 0 is the loudest) and "rise_db_per_bar" (positive when it climbs). These are electronic dance
songs. They usually go Intro, Build, Drop, Break, Build, Drop, Outro, but follow the numbers: the loudest steady parts
(energy within about 3 dB of 0) are drops, a part that climbs into a drop is a build, a quieter part between drops is a
break, a quieter part that doesn't come back is a bridge, the first part is the intro unless it's already loud, and a
last part that fades or drops in energy is the outro. Parts with the same label usually share a name.
Answer with JSON only: {"names": ["...", ...]}, one name per section, in order, each one of: """ + ", ".join(SECTION_NAMES) + "."


def validate_section_names(raw, sections):
    """Names from the fixed list, one per section. Returns (names, error)."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None, "Muse Spark's names weren't valid JSON."
    names = data.get("names") if isinstance(data, dict) else None
    if not isinstance(names, list) or len(names) != len(sections):
        return None, "Muse Spark didn't name every part."
    if any(n not in SECTION_NAMES for n in names):
        return None, "Muse Spark used a name that isn't one of the part names."
    return names, None


def name_sections(sections, client=None):
    """Ask Muse Spark to name the parts from their measured numbers. Returns (names, error)."""
    if not sections:
        return None, "There are no parts to name."
    key = os.environ.get("MODEL_API_KEY", "").strip()
    if client is None and not key:
        return None, "No Muse Spark key. Add MODEL_API_KEY to engine/.env and restart the engine."
    if client is None:
        client = OpenAI(api_key=key, base_url=os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1"), timeout=TIMEOUT_SEC, max_retries=1)
    payload = {"sections": [{k: s[k] for k in ("label", "start_bar", "bars", "energy_db", "rise_db_per_bar")} for s in sections]}
    # Naming a long song can take Muse most of its budget in thinking (863 of 905 tokens for 10 parts, Oct 29),
    # and when the thinking runs out of room the reply is empty: a bigger budget, and one more try
    for _ in range(2):
        try:
            res = client.chat.completions.create(
                model=os.environ.get("MUSE_MODEL", "muse-spark-1.3"), max_tokens=SECTIONS_MAX_TOKENS, reasoning_effort="minimal",
                response_format={"type": "json_object"},
                messages=[{"role": "system", "content": SECTIONS_PROMPT}, {"role": "user", "content": json.dumps(payload)}])
        except OpenAIError as e:
            return None, f"Muse Spark is unavailable right now ({type(e).__name__})."
        raw = res.choices[0].message.content if res.choices else None
        if raw:
            return validate_section_names(raw, sections)
    return None, "Muse Spark returned an empty reply."
