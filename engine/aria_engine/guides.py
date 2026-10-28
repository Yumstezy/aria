"""Plugin guides: Aria can't turn third-party plugins (Ian, Oct 27), so when the producer names one, Muse
shows how it should look instead. The picture comes from one of the producer's own presets for that plugin
(read from the preset catalog, presets.py), or from Muse's standard starting point when none fits.

Only the EQ curve is drawn, so only FabFilter Pro-Q text presets (Pro-Q 3 and 4) give bands. In those files:
Frequency is log2 of Hz, Gain is dB, Q is 0 to 1 on a log scale from 0.025 to 40 (0.5 is Q 1), and
Shape is a menu index. Nothing here leaves this Mac.
"""
import json
import math
import re
from functools import lru_cache
from pathlib import Path

from aria_engine import presets

CATALOG = presets.ARIA_DIR / "catalog.json"
MAX_CANDIDATES = 10
# Pro-Q's Shape menu, in order; the ones Aria can't draw are kept as None and skipped
PROQ_SHAPES = ["bell", "low_shelf", "low_cut", "high_shelf", "high_cut", "notch", None, None, None]


def _key(text):
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


@lru_cache(maxsize=1)
def catalog():
    try:
        return json.loads(CATALOG.read_text())
    except (OSError, ValueError):
        return []


def plugin_names():
    """Every plugin the catalog has presets for, like "FabFilter Pro-Q 4"."""
    return sorted({p["plugin"] for p in catalog() if p.get("source") != "live" and p.get("plugin")})


STOP = {"the", "and", "add", "can", "some", "give", "make", "with", "for", "you", "them", "how", "using", "use", "want", "please",
        "show", "should", "look", "that", "this", "what", "would", "could", "need", "just", "like", "into", "onto", "track"}


def _stem(w):
    return w[:-1] if len(w) > 3 and w.endswith("s") else w   # "vocals" and "vocal" match


def candidates(plugin, request, limit=MAX_CANDIDATES):
    """The producer's presets for this plugin that share a word with the request, best first.
    The preset's folder (like Vocals) counts double, and the plugin's own name doesn't count."""
    own = {_stem(w) for w in re.findall(r"[a-z]+", plugin.lower())}
    words = {_stem(w) for w in re.findall(r"[a-z]{3,}", (request or "").lower())} - {_stem(w) for w in STOP} - own
    out = []
    for p in catalog():
        if p.get("plugin") != plugin or p.get("format") == "binary":
            continue
        have = {_stem(w) for w in p.get("words") or []}
        folder = _stem(_key(p.get("category")))
        score = len(words & have) + (2 if folder in words else 0)
        if score:
            out.append((score, p))
    out.sort(key=lambda x: -x[0])
    return [{"name": p["name"], "folder": p.get("category"), "about": about(p), "curve": curve(p)} for _, p in out[:limit]]


def curve(entry, top=4):
    """The preset's biggest moves in a few words, so Muse picks by what it does, not only its name:
    "high_shelf +2.5 dB at 10000 Hz (moves +4 dB)"."""
    bands = sorted(preset_bands(entry), key=lambda b: -(abs(b["gain_db"]) + (3 if b["shape"].endswith("cut") else 0)))[:top]
    parts = []
    for b in bands:
        move = "" if b["shape"].endswith("cut") or b["shape"] == "notch" else f' {b["gain_db"]:+.1f} dB'
        dyn = f' (moves {b["dynamic_db"]:+.1f} dB with the music)' if b["dynamic_db"] else ""
        parts.append(f'{b["shape"]}{move} at {b["freq_hz"]} Hz{dyn}')
    return "; ".join(parts)


def about(entry):
    """The preset's own description, short, read from its file."""
    try:
        return presets.read_fabfilter(entry["path"]).get("description", "")[:160] if entry.get("source") == "fabfilter" else ""
    except (OSError, ValueError, KeyError):
        return ""


def find(plugin, name):
    for p in catalog():
        if p.get("plugin") == plugin and _key(p.get("name")) == _key(name):
            return p
    return None


def preset_bands(entry):
    """The bands a Pro-Q text preset turns on, in Aria's shapes and units. [] when it can't be drawn."""
    if not entry or "pro-q" not in entry.get("plugin", "").lower() or entry.get("format") != "text":
        return []
    try:
        values = presets.read_params(entry)
    except (OSError, ValueError):
        return []
    bands = []
    for n in range(1, 25):
        get = lambda k: values.get(f"Band {n} {k}")
        if get("Used") != 1 or get("Enabled") == 0 or get("Frequency") is None:
            continue
        shape_i = int(get("Shape") or 0)
        shape = PROQ_SHAPES[shape_i] if shape_i < len(PROQ_SHAPES) else None
        if shape is None:
            continue
        q = 0.025 * (40 / 0.025) ** float(get("Q") if get("Q") is not None else 0.5)
        bands.append({"band": n, "shape": shape, "freq_hz": round(2 ** float(get("Frequency"))),
                      "gain_db": 0.0 if shape in ("low_cut", "high_cut", "notch") else round(float(get("Gain") or 0), 1),
                      "q": round(q, 2),
                      # A dynamic band moves with the music, by up to this many dB from its gain
                      "dynamic_db": round(float(get("Dynamic Range")), 1) if get("Dynamics Enabled") != 0 and get("Dynamic Range") else 0.0})
    return bands
