"""Ask Muse: the producer types a request, Muse Spark picks tools from Aria's action menu.

Muse never touches Live itself. This returns the tool calls, checked against the menu and
its limits (docs/contracts.md), and the device applies them with Undo. Calls Muse makes
on its own initiative come back as suggestions, which wait for the producer's yes.
"""
import json
import os
import re

from openai import OpenAI, OpenAIError

from aria_engine import guides

TIMEOUT_SEC = 20
MAX_TOKENS = 1200
MAX_NAME = 32
MAX_WHY = 160
DEFAULT_Q = 1.0   # a broad bell when the producer doesn't say how wide
CUT_Q = 0.71      # a plain cut with no bump at the corner
SHAPES = ["bell", "low_cut", "high_cut", "low_shelf", "high_shelf", "notch"]
NO_GAIN = ("low_cut", "high_cut", "notch")
RECENT = 3        # earlier exchanges Muse sees, so "it" and "that" make sense
MAX_SETTINGS = 8

# Live's stock devices Aria can add or adjust (beside EQ Eight, which has its own tools), with the
# knobs Muse uses most. Names are Live's own (its control-surface bank definitions); units are what
# Live displays: dB, % , Hz, and times in ms.
STOCK = {
    "EQ Eight": "add it here only with no settings (a plain EQ Eight); set its bands with track_eq or eq_band",
    "Compressor": "Threshold (dB), Ratio (n for n:1), Attack (ms), Release (ms), Knee (dB), Output (dB), Makeup (On/Off), Dry/Wet (%)",
    "Glue Compressor": "Threshold (dB), Ratio (2, 4 or 10), Attack (ms: 0.01 to 30), Release (menu, as an option: 0.1 s, 0.2 s, 0.4 s, 0.6 s, 0.8 s, 1.2 s or Auto), Makeup (dB), Range (dB), Dry/Wet (%)",
    "Multiband Dynamics": "Amount (%), Output (dB), Above Threshold (Low/Mid/High) (dB), Above Ratio (Low/Mid/High), Low-Mid Crossover (Hz), Mid-High Crossover (Hz)",
    "Limiter": "Input Gain (dB), Ceiling (dB), Release (ms), Lookahead (menu)",
    "Gate": "Threshold (dB), Return (dB), Attack (ms), Hold (ms), Release (ms), Floor (dB)",
    "Reverb": "Decay Time (ms), Predelay (ms), Room Size, Stereo Image (degrees), Diffusion, Dry/Wet (%)",
    "Hybrid Reverb": "Decay (ms), Size (%), Predelay (ms), Width (%), Damping (%), Blend (%), Dry/Wet (%)",
    "Delay": "L 16th / R 16th (menu: 1 to 16 sixteenths), L Time / R Time (ms when not synced), Feedback (%), Ping Pong (On/Off), Filter Freq (Hz), Dry/Wet (%)",
    "Echo": "L 16th (menu), Feedback (%), HP Freq (Hz), LP Freq (Hz), Reverb Level (%), Stereo Width (%), Dry Wet (%)",
    "Saturator": "Drive (dB), Type (menu: Analog Clip, Soft Sine, Medium Curve, Hard Curve, Sinoid Fold, Digital Clip), Output (dB), Dry/Wet (%)",
    "Overdrive": "Drive (%), Tone (%), Filter Freq (Hz), Dry/Wet (%)",
    "Roar": "Drive (dB), Shaper 1 Amt (%), Comp Amt (%), Output (dB), Dry/Wet (%)",
    "Drum Buss": "Drive (%), Crunch (%), Boom Amt (%), Boom Freq (Hz), Transients, Damping Freq (Hz), Output (dB), Dry/Wet (%)",
    "Utility": "Gain (dB), Stereo Width (%: 0 mono, 100 normal, up to 400), Mono (On/Off), Bass Mono (On/Off), Bass Freq (Hz), Balance (pan)",
    "Auto Filter": "Filter Type (menu: Lowpass, Highpass, Bandpass, Notch), Frequency (Hz), Resonance (%), Drive (dB), LFO Amount (%), Dry/Wet (%)",
    "Auto Pan": "Amount (%), Frequency (Hz) or Sync Rate (menu), Phase (degrees)",
    "Chorus-Ensemble": "Rate (Hz), Amount (%), Feedback (%), Width (%), Dry/Wet (%)",
    "Phaser-Flanger": "Mode (menu: Phaser, Flanger, Doubler), Amount (%), Feedback (%), Mod Freq (Hz), Dry/Wet (%)",
    "Redux": "Sample Rate (Hz), Bit Depth, Dry/Wet (%)",
    "Channel EQ": "Highpass On (On/Off), Low Gain (dB), Mid Gain (dB), Mid Freq (Hz), High Gain (dB), Output (dB)",
}
GAIN_KNOB = re.compile(r"gain|output|volume|makeup|ceiling", re.I)

# One EQ Eight band, shared by eq_band and track_eq
EQ_PROPS = {
    "shape": {"type": "string", "enum": SHAPES,
              "description": "bell (boost or dip around a frequency), low_cut (remove everything below freq_hz, a high-pass), "
                             "high_cut (remove everything above, a low-pass), low_shelf / high_shelf (lift or lower everything "
                             "below / above), notch (remove one narrow note). Default bell."},
    "freq_hz": {"type": "number", "minimum": 20, "maximum": 20000},
    "gain_db": {"type": "number", "minimum": -6, "maximum": 6, "description": "For bell and shelves only. Negative cuts."},
    "steep": {"type": "boolean", "description": "Cuts only: true for a hard 48 dB/oct cut, false for a gentle 12 dB/oct one."},
    "q": {"type": "number", "minimum": 0.3, "maximum": 12, "description": "Width. Leave out for the default; 4 to 8 for a narrow ringing note."},
}

# The action menu Muse may use today, with the limits the device enforces too.
SETTING_ITEM = {"type": "object", "properties": {
    "param": {"type": "string", "description": "The knob's name, as listed for the device."},
    "value": {"type": "number", "description": "Set it to this, in the units listed (dB, %, Hz, ms)."},
    "option": {"type": "string", "description": "For a menu or switch: the item, like Analog Clip, On or Off."},
    "change": {"type": "number", "description": "Move it by this much from where it is now (\"raise it by 0.4 dB\")."}},
    "required": ["param"]}

TOOLS = [
    {"type": "function", "function": {
        "name": "jump_to", "description": "Move Live's playhead to the start of a bar.",
        "parameters": {"type": "object", "properties": {"bar": {"type": "integer", "minimum": 1}}, "required": ["bar"]}}},
    {"type": "function", "function": {
        "name": "add_marker", "description": "Add a named marker (Live locator) at the start of a bar, or rename the one already there.",
        "parameters": {"type": "object", "properties": {
            "bar": {"type": "integer", "minimum": 1}, "name": {"type": "string", "maxLength": MAX_NAME}}, "required": ["bar", "name"]}}},
    {"type": "function", "function": {
        "name": "eq_band", "description": "Set one band on Live's EQ Eight at the end of the Main track (Aria adds one if needed). Changes the whole mix.",
        "parameters": {"type": "object", "properties": EQ_PROPS, "required": ["freq_hz"]}}},
    {"type": "function", "function": {
        "name": "track_volume", "description": "Turn one of the producer's tracks up or down by a few dB. Use the exact track name from context.tracks.",
        "parameters": {"type": "object", "properties": {
            "track": {"type": "string"}, "change_db": {"type": "number", "minimum": -6, "maximum": 6}}, "required": ["track", "change_db"]}}},
    {"type": "function", "function": {
        "name": "track_eq", "description": "Set one band on Live's EQ Eight on one of the producer's tracks (Aria adds one if needed). Use the exact track name from context.tracks.",
        "parameters": {"type": "object", "properties": {"track": {"type": "string"}, **EQ_PROPS}, "required": ["track", "freq_hz"]}}},
    {"type": "function", "function": {
        "name": "track_device",
        "description": "Add one of Live's stock devices to a track (or Main), or adjust the one already there, and set its knobs. "
                       "Aria uses the device of that kind already on the track if there is one. Use track_eq or eq_band for EQ Eight.",
        "parameters": {"type": "object", "properties": {
            "track": {"type": "string", "description": "Exact track name from context.tracks, or Main for the whole mix."},
            "device": {"type": "string", "enum": list(STOCK)},
            "settings": {"type": "array", "maxItems": MAX_SETTINGS, "description": "Knobs to set. Leave empty to add the device as it comes.",
                         "items": SETTING_ITEM}},
            "required": ["track", "device"]}}},
    {"type": "function", "function": {
        "name": "plugin_guide",
        "description": "Show the producer how a third-party plugin they named should look: Aria draws the EQ curve and lists the bands, "
                       "and they set it themselves. Aria can't add or turn third-party plugins.",
        "parameters": {"type": "object", "properties": {
            "plugin": {"type": "string", "description": "The plugin they named, like FabFilter Pro-Q 4 (the exact name from context.plugin_presets when it's there)."},
            "track": {"type": "string", "description": "The track it's for, from context.tracks, if they said."},
            "preset": {"type": "string", "description": "One of their presets from context.plugin_presets that fits. Aria reads its real bands."},
            "bands": {"type": "array", "maxItems": 8, "description": "Your own bands, only when no preset fits (standard starting points).",
                      "items": {"type": "object", "properties": {
                          "shape": {"type": "string", "enum": SHAPES}, "freq_hz": {"type": "number", "minimum": 20, "maximum": 20000},
                          "gain_db": {"type": "number", "minimum": -12, "maximum": 12}, "q": {"type": "number", "minimum": 0.1, "maximum": 12}},
                          "required": ["shape", "freq_hz"]}}},
            "required": ["plugin"]}}},
    {"type": "function", "function": {
        "name": "check_mix", "description": "Run a new Mix check: Aria records 16 bars of Main and analyzes them.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "undo", "description": "Undo the last change Aria made in Live.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "suggest", "description": "Offer a change the producer did NOT ask for. It is shown with Do it / Not now and only runs if they say yes.",
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string", "enum": ["jump_to", "add_marker", "eq_band", "track_volume", "track_eq", "track_device"]},
            "args": {"type": "object"},
            "why": {"type": "string", "maxLength": MAX_WHY}}, "required": ["action", "args", "why"]}}},
]

PROMPT = """You are Muse, the co-producer inside Aria, an Ableton Live device. The producer talks to you in plain words.
Use the tools to do exactly what they ask, right away. Never do more than they asked: if you think something else
would help, use "suggest" for it instead, and it waits for their yes.

You get JSON context: the latest Mix check findings (what sticks out, where, by how much), the bars it covered,
the playhead bar, the tempo, the markers already in the producer's Live set (name and bar), and their tracks (name). When they name a
part of the song, like "the drop", use a marker with that name; if there isn't one, say so. Use only numbers from the context or from the producer's words. Never invent a number.
If they ask for a fix from the findings, use the finding's frequency.
EQ uses Live's own EQ Eight, which every producer has. Pick the shape from their words:
- "cut the low end", "high-pass", "remove the lows below X": shape low_cut at X. "hard", "steep" or "brick wall": steep true.
- "cut the highs", "low-pass", "darker above X": shape high_cut. "more/less bass" or "more/less air" overall: a shelf.
- "dip", "boost", "cut X dB at Y", mud, a ringing note: bell (negative gain_db cuts). A ringing note gets a narrow q of 4 to 8.
A cut with no frequency given: low_cut at 100 Hz for a vocal, 30 Hz for anything else. Say which frequency you used.

Everyday asks with no numbers: don't ask for numbers, use these standard starting points on the track they name,
and say what you used. If a Mix check finding covers that sound, use the finding's frequency instead.
- clarity, presence, "cut through", "stand out": bell +2 dB at 3000 Hz
- air, brighter, sparkle: high_shelf +2 dB at 10000 Hz
- darker, less bright: high_shelf -2 dB at 8000 Hz
- mud, muddy: bell -3 dB at 300 Hz
- boxy: bell -3 dB at 500 Hz
- harsh, sharp, piercing: bell -2 dB at 3500 Hz
- warmth, body: bell +2 dB at 200 Hz
- louder or quieter with no amount: 2 dB

eq_band sits on the Main track, so it changes every sound at once. Use it only for things that live in the
whole mix: a ringing note, harsh hits, or a frequency the producer names. Never use eq_band for a buried sound
(like a buried vocal) or mud: cutting the whole mix there cuts the buried sound too and makes it worse.

For a buried sound or mud, act on the producer's own tracks (context.tracks, by exact name):
- a buried sound (like a buried vocal): raise its track by 1 to 3 dB with track_volume, and/or dip the track
  covering it in that range with track_eq (a cut of 2 to 4 dB, broad q).
- mud: there is already too much in that range, so never raise anything there. Cut the track that crowds it,
  usually the bass or the biggest synth or pad, with track_eq in that range (2 to 4 dB, broad q).
Match parts to tracks by name: a vocal is a track named like Vocal, Vox or Voice; synths and keys are tracks
named like Synth, Keys, Pad, Lead or Chords; prefer a group track when there is one. If no track clearly
matches, don't guess: name the tracks you see and ask which one.
Other effects use Live's stock devices, which every producer has, with track_device. Knobs and units:
{STOCK_LINES}
Use the device already on the track when there is one (context.tracks lists each track's devices).
Everyday starting points when they give no numbers (say what you used):
- compress a vocal: Compressor Threshold -18 dB, Ratio 3, Attack 10 ms, Release 100 ms
- glue the drums or the mix: Glue Compressor Threshold -15 dB, Ratio 2, Attack 10 ms, Makeup 2 dB
- reverb, space, spacey: Reverb Decay Time 2500 ms (4000 ms for big or spacey), Predelay 20 ms, Dry/Wet 20%
- delay or echo: Delay L 16th 3, R 16th 4, Feedback 30%, Dry/Wet 15%
- warmth, saturation, grit: Saturator Drive 4 dB, Type Analog Clip, Dry/Wet 50%
- wider: Utility Stereo Width 130%. Mono the bass: Utility Bass Mono On, Bass Freq 120 Hz
- limit Main: Limiter Ceiling -1 dB
"Raise it by .4 dB" or "a bit more" on a knob of a device already on that track: change that knob with change.
change moves a knob from where it is now, so use it only when context.tracks shows that device on that track.
If the device isn't there yet, Aria adds a fresh one with Live's own defaults (a fresh Compressor's Threshold is
0 dB, which does nothing). So for "compress it and raise the threshold by 2 dB", start from the everyday starting
point and apply their move to it, as values (Threshold -16 dB, Ratio 3, Attack 10 ms, Release 100 ms), and say so.
Third-party plugins (FabFilter Pro-Q, Valhalla, Ozone, Serum and others): Aria can't add or turn them. When the
producer names one, show them how it should look with plugin_guide, and they set it themselves:
- context.plugin_presets lists their own presets for the plugins they named (name, folder, what it's for, and
  "curve": its biggest moves). Pick by the curve, not only the name: "air on my vocals" needs a vocal preset whose
  curve lifts the top (a high shelf or a boost above 8000 Hz). If one fits, pass it as preset; Aria draws its real
  bands. If several versions of a plugin are listed, use the newest.
- If none fits, pass your own bands instead: standard starting points (air: high_shelf +2 dB at 10000 Hz;
  clarity: bell +2 dB at 3000 Hz; mud: bell -3 dB at 300 Hz), and say they're a starting point.
- Your reply says what to do in one or two short sentences ("Here's how it should look in Pro-Q 4. Set band 1
  to a high shelf at 10 kHz and raise it about 2 dB."). Don't say Aria added or changed the plugin.
- You may also offer the same move with Live's stock tools in a "suggest", so Aria can do it for them.
Don't make up a setting they didn't ask for.
If you can't do what they ask with these tools, say so plainly and don't call a tool.

context.recent holds the last few exchanges (what they asked, what you did). Use it for "it", "that" and "again":
"it" is usually the track from the last request.

A request can ask for several things ("make it louder and cut the low end"). Call a tool for every part, in this
answer. Your reply describes only the tool calls you made in this answer: never say you did, will do or are "sorting"
something you didn't call a tool for. If you can't do a part, say which part and why.
Every change Aria makes (EQ, volume, devices) is on the track for the whole song, not only the bars a Mix check
listened to. Never say a change is limited to some bars ("in bars 55 to 70"); say what changes on which track.
A "suggest" waits for their yes, so offer it ("I can add air with EQ Eight instead"), never say it's done or happening.

Reply in one or two short sentences. No emojis, no em dashes.""".replace(
    "{STOCK_LINES}", "\n".join(f"- {name}: {knobs}" for name, knobs in STOCK.items()))


def _numbers(text):
    return [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", text)]


def _allowed(context, request, actions):
    allowed = {0.0}

    def add(v):
        if isinstance(v, bool):
            return
        if isinstance(v, (int, float)):
            for x in (v, abs(v)):
                allowed.update({round(x, 2), round(x, 1), float(round(x)), round(x, -1)})
                if x >= 1000:
                    allowed.update({round(x / 1000, 1), round(x / 1000, 2)})
        elif isinstance(v, (list, tuple)):
            for x in v:
                add(x)
        elif isinstance(v, dict):
            for x in v.values():
                add(x)

    add(context)
    for n in plugin_names(context):
        add(_numbers(n))
    for n in _numbers(request):
        add(n)
    for a in actions:
        add(a["args"])
    return allowed


def match_track(name, tracks):
    """The set's track this name means: an exact match ignoring case, else the one track
    whose name contains it or is contained in it. None when nothing or more than one fits."""
    want = " ".join(str(name or "").lower().split())
    if not want:
        return None
    for t in tracks:
        if " ".join(t.lower().split()) == want:
            return t
    near = [t for t in tracks if want in t.lower() or t.lower() in want]
    return near[0] if len(near) == 1 else None


def _track(name, tracks, main_ok=False):
    if main_ok and str(name or "").strip().lower() in ("main", "master"):
        return "Main"
    return match_track(name, tracks)


def _key(text):
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def plugin_names(context):
    """Plugins Muse may use: the installed ones it was shown, and the ones already on a track."""
    names = list(context.get("plugins") or [])
    for t in context.get("tracks") or []:
        if isinstance(t, dict):
            names += [p["name"] for p in t.get("plugins") or [] if isinstance(p, dict) and p.get("name")]
    return names


def match_plugin(name, names):
    """The plugin this name means: same letters and digits, else the one name containing it or contained in it."""
    want = _key(name)
    if not want:
        return None
    for n in names:
        if _key(n) == want:
            return n
    near = {n for n in names if _key(n) and (want in _key(n) or _key(n) in want)}
    return near.pop() if len(near) == 1 else None


def mentioned_plugins(request, names, limit=12):
    """Installed plugins the request names: "pro q 4" finds "FabFilter Pro-Q 4", "valhalla" finds ValhallaRoom.
    Named without a version ("pro q"), every version is shown and Muse picks the newest."""
    text = _key(request)
    words = [_key(w) for w in re.findall(r"[A-Za-z]{5,}", request or "")]

    def keys(n):
        parts = str(n).split()
        return [_key(n)] + ([_key(" ".join(parts[1:]))] if len(parts) > 1 else [])   # with and without the maker

    exact = [n for n in names if any(len(k) >= 4 and k in text for k in keys(n)) or any(w in _key(n) for w in words)]
    if exact:
        return exact[:limit]
    bare = [n for n in names if any(len(b) >= 4 and b in text for b in (re.sub(r"\d+$", "", k) for k in keys(n)))]
    return bare[:limit]


def _setting(st):
    """One knob setting, cleaned, or None."""
    if not isinstance(st, dict) or not str(st.get("param", "")).strip():
        return None
    param = str(st["param"]).strip()[:40]
    given = [k for k in ("value", "option", "change") if st.get(k) is not None]
    if len(given) != 1:
        return None
    k = given[0]
    if k == "option":
        return {"param": param, "option": str(st["option"]).strip()[:32]}
    v = float(st[k])
    # Loudness knobs move a few dB at a time, like track_volume
    if GAIN_KNOB.search(param) and (v > 6 if k == "value" else abs(v) > 6):
        return None
    return {"param": param, k: round(v, 2)}


def why_dropped(name, args, tracks=(), plugins=()):
    """One plain sentence on why a call was dropped, for the producer."""
    if name == "track_plugin" and isinstance(args, dict) and not match_plugin(args.get("plugin"), plugins):
        return f'Aria can\'t find "{args.get("plugin")}" in Live\'s plugin list.'
    if name == "track_device" and isinstance(args, dict) and args.get("device") not in STOCK:
        return f'Aria can add Live\'s own devices, not "{args.get("device")}" yet.'
    if name in ("track_volume", "track_eq", "track_device", "track_plugin") and isinstance(args, dict) and \
            not _track(args.get("track"), tracks, main_ok=name in ("track_device", "track_plugin")):
        shown = ", ".join(f'"{t}"' for t in tracks[:8]) or "none"
        return f'No track called "{args.get("track")}" in this set. Tracks: {shown}.'
    return f"Muse asked for {name.replace('_', ' ')} with values outside Aria's limits, so Aria skipped it."


def check_guide(args, tracks=()):
    """A plugin guide, with its bands read from the producer's preset, or None if there's nothing to draw."""
    plugin = str(args.get("plugin") or "").strip()[:60]
    if not plugin:
        return None
    known = match_plugin(plugin, guides.plugin_names())
    entry = guides.find(known, args["preset"]) if known and args.get("preset") else None
    if entry:
        bands, source = guides.preset_bands(entry), "preset"
    else:
        raw = args.get("bands") or []
        if not isinstance(raw, list) or len(raw) > 8:
            return None
        bands, source = [], "aria"
        for i, b in enumerate(raw):
            shape = b.get("shape") if isinstance(b, dict) else None
            if shape not in SHAPES:
                return None
            f, g = float(b["freq_hz"]), 0.0 if shape in NO_GAIN else float(b.get("gain_db") or 0)
            q = float(b.get("q") or (CUT_Q if shape in ("low_cut", "high_cut") else DEFAULT_Q))
            if not (20 <= f <= 20000 and -12 <= g <= 12 and 0.1 <= q <= 12):
                return None
            bands.append({"band": i + 1, "shape": shape, "freq_hz": round(f), "gain_db": round(g, 1), "q": round(q, 2), "dynamic_db": 0.0})
    if not bands:
        return None
    track = match_track(args.get("track"), tracks) if args.get("track") else None
    return {"plugin": known or plugin, "track": track, "preset": entry["name"] if entry else None,
            "about": guides.about(entry) if entry else "", "source": source, "bands": bands}


def check_action(name, args, tracks=(), plugins=()):
    """Return the cleaned args if this call is on the menu and in range, else None.
    Track tools must name a track that exists in the set; track_plugin, a plugin Muse was shown."""
    if not isinstance(args, dict):
        return None
    try:
        if name == "track_plugin":
            track, plugin = _track(args.get("track"), tracks, main_ok=True), match_plugin(args.get("plugin"), plugins)
            raw = args.get("settings") or []
            if not track or not plugin or not isinstance(raw, list) or len(raw) > MAX_SETTINGS:
                return None
            settings = [_setting(st) for st in raw]
            if any(st is None for st in settings):
                return None
            return {"track": track, "plugin": plugin, "settings": settings, "then_set": bool(args.get("then_set")) and not settings}
        if name == "track_device":
            track = _track(args.get("track"), tracks, main_ok=True)
            if not track or args.get("device") not in STOCK:
                return None
            raw = args.get("settings") or []
            if not isinstance(raw, list) or len(raw) > MAX_SETTINGS:
                return None
            settings = [_setting(st) for st in raw]
            if any(st is None for st in settings) or (args["device"] == "EQ Eight" and settings):
                return None
            return {"track": track, "device": args["device"], "settings": settings}
        if name in ("track_volume", "track_eq"):
            track = match_track(args.get("track"), tracks)
            if not track:
                return None
            if name == "track_volume":
                change = float(args["change_db"])
                return {"track": track, "change_db": round(change, 1)} if -6 <= change <= 6 and change != 0 else None
            eq = check_action("eq_band", args)
            return {"track": track, **eq} if eq else None
        if name == "jump_to":
            bar = int(args["bar"])
            return {"bar": bar} if 1 <= bar <= 9999 else None
        if name == "add_marker":
            bar, label = int(args["bar"]), str(args["name"]).strip()
            return {"bar": bar, "name": label} if 1 <= bar <= 9999 and 0 < len(label) <= MAX_NAME else None
        if name == "eq_band":
            shape = args.get("shape") or "bell"
            if shape not in SHAPES:
                return None
            f = float(args["freq_hz"])
            g = 0.0 if shape in NO_GAIN else float(args["gain_db"])
            q = float(args.get("q") or (CUT_Q if shape in ("low_cut", "high_cut") else DEFAULT_Q))
            ok = 20 <= f <= 20000 and -6 <= g <= 6 and 0.3 <= q <= 12 and (shape in NO_GAIN or g != 0)
            out = {"shape": shape, "freq_hz": round(f), "gain_db": round(g, 1), "q": round(q, 2)}
            if shape in ("low_cut", "high_cut"):
                out["steep"] = bool(args.get("steep", False))
            return out if ok else None
        if name in ("check_mix", "undo"):
            return {}
    except (KeyError, TypeError, ValueError):
        return None
    return None


def interpret(message, context, request):
    """Turn Muse's reply into {reply, actions, suggestions, dropped, problems}. Exposed for tests."""
    actions, suggestions, dropped, problems, shown = [], [], 0, [], []
    tracks = [t["name"] if isinstance(t, dict) else str(t) for t in context.get("tracks") or []]
    plugins = plugin_names(context)
    for call in getattr(message, "tool_calls", None) or []:
        name = call.function.name
        try:
            args = json.loads(call.function.arguments or "{}")
        except json.JSONDecodeError:
            dropped += 1
            continue
        if name == "plugin_guide":
            g = check_guide(args, tracks)
            if g:
                shown.append(g)
            else:
                dropped += 1
                problems.append(f'Aria has nothing to draw for {args.get("plugin") or "that plugin"} yet.')
            continue
        if name == "suggest":
            inner = check_action(args.get("action"), args.get("args"), tracks, plugins)
            why = str(args.get("why", "")).strip()[:MAX_WHY]
            if inner is not None and args.get("action") in ("jump_to", "add_marker", "eq_band", "track_volume", "track_eq", "track_device") and why:
                suggestions.append({"type": args["action"], "args": inner, "why": why})
            else:
                dropped += 1
                problems.append(why_dropped(str(args.get("action")), args.get("args"), tracks, plugins))
            continue
        cleaned = check_action(name, args, tracks, plugins)
        if cleaned is None:
            dropped += 1
            problems.append(why_dropped(name, args, tracks, plugins))
        else:
            actions.append({"type": name, "args": cleaned})

    reply = (message.content or "").strip() or None
    if reply:
        reply = re.sub(r"\s*[\u2014\u2013]\s*", ", ", reply)   # no em or en dashes in anything the producer reads
    if reply:
        allowed = _allowed(context, request, actions + [{"args": s["args"]} for s in suggestions] + [{"args": g} for g in shown])
        if any(round(n, 2) not in allowed for n in _numbers(reply)):
            reply = None   # cited a number we don't have; the actions themselves still stand
    if problems and not actions and not shown:
        reply = None   # it would say it was done, and nothing was
    return {"reply": reply, "actions": actions, "suggestions": suggestions, "guides": shown, "dropped": dropped, "problems": problems}


# Everyday names for the split parts, so Muse never says "other"
PART_NAMES = {"vocals": "vocal", "other": "synths and keys", "drums": "drums and loops", "bass": "bass", "the rest": "the rest of the mix"}


def newest(names):
    """Of several versions of one plugin (Pro-Q 2, 3 and 4), keep the newest."""
    best = {}
    for n in names:
        m = re.match(r"(.*?)(\d+)?$", n.strip())
        family, version = m.group(1).strip(), int(m.group(2) or 0)
        if family not in best or version > best[family][1]:
            best[family] = (n, version)
    return [n for n, _ in best.values()]


def friendly(context, request=""):
    """Context for Muse with everyday part names. Numbers are untouched.
    For each third-party plugin the request names, Muse sees the producer's presets that fit (plugin guides)."""
    out = dict(context)
    out.pop("plugins", None)
    out["tracks"] = [{k: v for k, v in t.items() if k != "plugins"} if isinstance(t, dict) else t for t in context.get("tracks") or []]
    named = newest(mentioned_plugins(request, guides.plugin_names()))[:2]
    if named:
        out["plugin_presets"] = {p: guides.candidates(p, request, 8) for p in named}
    out["recent"] = (context.get("recent") or [])[-RECENT:]
    out["findings"] = [{k: PART_NAMES.get(v, v) if k in ("masked", "by") else v for k, v in f.items()}
                       for f in context.get("findings") or []]
    return out


def ask(request, context, client=None):
    """Returns {reply, actions, suggestions, dropped, problems, error}."""
    request = (request or "").strip()
    context = friendly(context or {}, request)
    if not request:
        return {"reply": None, "actions": [], "suggestions": [], "guides": [], "dropped": 0, "problems": [], "error": "Say what you'd like Muse to do."}
    key = os.environ.get("MODEL_API_KEY", "").strip()
    if client is None and not key:
        return {"reply": None, "actions": [], "suggestions": [], "guides": [], "dropped": 0, "problems": [],
                "error": "No Muse Spark key. Add MODEL_API_KEY to engine/.env and restart the engine."}
    if client is None:
        client = OpenAI(api_key=key, base_url=os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1"),
                        timeout=TIMEOUT_SEC, max_retries=1)
    try:
        res = client.chat.completions.create(
            model=os.environ.get("MUSE_MODEL", "muse-spark-1.3"), max_tokens=MAX_TOKENS, reasoning_effort="minimal",
            tools=TOOLS, tool_choice="auto",
            messages=[{"role": "system", "content": PROMPT},
                      {"role": "user", "content": json.dumps({"context": context, "request": request})}])
    except OpenAIError as e:
        return {"reply": None, "actions": [], "suggestions": [], "guides": [], "dropped": 0, "problems": [],
                "error": f"Muse Spark is unavailable right now ({type(e).__name__})."}
    if not res.choices:
        return {"reply": None, "actions": [], "suggestions": [], "guides": [], "dropped": 0, "problems": [], "error": "Muse Spark returned an empty reply."}
    out = interpret(res.choices[0].message, context, request)
    out["error"] = (None if (out["reply"] or out["actions"] or out["suggestions"] or out["guides"])
                    else " ".join(out["problems"]) or "Muse Spark didn't answer that one.")
    # Local engine log only (~/Library/Logs/Aria/engine.log): what was asked and what Muse did
    print(f"ask: {request!r} -> actions={out['actions']} suggestions={len(out['suggestions'])} guides={[(g['plugin'], g['preset']) for g in out['guides']]} "
          f"dropped={out['dropped']} problems={out['problems']} reply={out['reply']!r} error={out['error']!r}", flush=True)
    return out
