"""Aria's preset catalog: every preset on this Mac that Muse may pick from, by name, words and plugin.

Reads four kinds, all plain text on disk:
- Live presets and racks (.adg, .adv): gzipped XML. Aria reads the device title, the devices inside and the macro names.
- FabFilter (.ffp): newer plugins (Pro-Q 4) write an INI file with named knobs in FabFilter's own units,
  plus Tags. Older ones write binary: a 4-letter tag, a version, a count, then that many floats, unnamed,
  in the plugin's parameter order (whether that order matches Live's list is spike S1).
- Valhalla (.vpreset): one XML element. Every knob is stored 0 to 1, Live's own scale for plugin parameters.
- iZotope Ozone (.xml): named parameters with real values, plus a Comments line.

The catalog lists presets; their knob values are read only when one is used (read_params).
Run `python -m aria_engine.presets` to write ~/Library/Application Support/Aria/presets/catalog.json.
Nothing here leaves this Mac, and no preset file goes in the repo.
"""
import configparser
import gzip
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HOME = Path.home()
ARIA_DIR = HOME / "Library" / "Application Support" / "Aria" / "presets"
ROOTS = {
    "live": [HOME / "Music" / "Ableton" / "User Library" / "Aria Presets"],
    "fabfilter": [HOME / "Documents" / "FabFilter" / "Presets"],
    "valhalla": [Path("/Library/Application Support/Valhalla DSP, LLC"), HOME / "Library" / "Application Support" / "Valhalla DSP, LLC"],
    "ozone": [Path("/Library/Application Support/iZotope/Ozone 12/Presets"), HOME / "Documents" / "iZotope" / "Ozone" / "User Presets"],
}
# Ozone keeps each module's presets in "<Module> Presets"; the plugin is "Ozone 12 <Module>"
OZONE_PLUGIN = {"Global": "Ozone 12", "EQ": "Ozone 12 Equalizer"}
LIVE_KIND = {"AudioEffectGroupDevice": "Audio Effect Rack", "InstrumentGroupDevice": "Instrument Rack",
             "MidiEffectGroupDevice": "MIDI Effect Rack", "DrumGroupDevice": "Drum Rack"}
WORD = re.compile(r"[a-z0-9]+")


def _words(*texts):
    out = []
    for t in texts:
        for w in WORD.findall(str(t).lower()):
            if w not in out:
                out.append(w)
    return out


# ---------- Live ----------

def _live_xml(path):
    raw = Path(path).read_bytes()
    try:
        raw = gzip.decompress(raw)
    except OSError:
        pass
    return ET.fromstring(raw)


def _val(node, path):
    n = node.find(path)
    return n.get("Value") if n is not None else None


def _live_devices(preset, out):
    holder = preset.find("Device")
    if holder is None or not len(holder):
        return
    out.append(holder[0].tag)
    for branch in preset.find("BranchPresets") or []:
        for p in branch.find("DevicePresets") or []:
            _live_devices(p, out)


def read_live(path):
    top = _live_xml(path)[0]
    if top.tag == "GroupDevicePreset":
        device = top.find("Device")[0]
        devices = []
        _live_devices(top, devices)
    else:
        device, devices = top, [top.tag]
    macros = []
    for i in range(16):
        name = (_val(device, f"MacroDisplayNames.{i}") or "").strip()
        if name and not re.fullmatch(r"Macro \d+", name):
            macros.append(name)
    return {"title": _val(device, "UserName") or Path(path).stem, "device": device.tag,
            "devices": devices[1:] if top.tag == "GroupDevicePreset" else devices, "macros": macros}


# ---------- FabFilter ----------

def _ffp(path):
    cp = configparser.ConfigParser(interpolation=None, strict=False)
    cp.optionxform = str
    cp.read_string(Path(path).read_text(encoding="utf-8", errors="replace"))
    return cp


def _ffp_binary(path):
    """The knob values of a binary .ffp, in order, or None if it isn't one."""
    raw = Path(path).read_bytes()
    if len(raw) < 12 or raw[:1] != b"F" or raw.startswith(b"[Preset]"):
        return None
    count = struct.unpack_from("<I", raw, 8)[0]
    if 12 + 4 * count > len(raw):
        return None
    return list(struct.unpack_from(f"<{count}f", raw, 12))


def read_fabfilter(path):
    if Path(path).read_bytes()[:8] != b"[Preset]":
        if _ffp_binary(path) is None:
            raise ValueError("not a FabFilter preset")
        return {"tags": [], "description": "", "format": "binary"}
    cp = _ffp(path)
    tags = cp.get("Preset", "Tags", fallback="").strip('"')
    return {"tags": [t.strip() for t in tags.split(",") if t.strip()], "format": "text",
            "description": cp.get("Preset", "Description", fallback="").strip('"').replace("\\n", " ").strip()}


# ---------- Valhalla ----------

def read_valhalla(path):
    el = ET.parse(path).getroot()
    return {"plugin": el.tag, "title": el.get("presetName") or Path(path).stem}


# ---------- Ozone ----------

def read_ozone(path):
    el = ET.parse(path).getroot()
    return {"comments": el.get("Comments") or "", "modules": [c.tag for c in el if c.get("Enabled") == "1"]}


# ---------- knob values, read when a preset is used ----------

def read_params(entry):
    """{knob name: value} for one catalog entry, in the file's own units (see each reader)."""
    path, kind = entry["path"], entry["source"]
    if kind == "fabfilter":
        values = _ffp_binary(path)
        if values is not None:
            return {f"#{i}": v for i, v in enumerate(values)}   # by position; names come from the plugin
        cp = _ffp(path)
        return {k: float(v) for k, v in cp.items("Parameters")} if cp.has_section("Parameters") else {}
    if kind == "valhalla":
        el = ET.parse(path).getroot()
        return {k: float(v) for k, v in el.attrib.items() if k not in ("pluginVersion", "presetName") and _number(v)}
    if kind == "ozone":
        return {p.get("ParamID"): float(p.get("Value")) for p in ET.parse(path).getroot().iter("Param") if _number(p.get("Value"))}
    if kind == "live":
        top = _live_xml(path)[0]
        device = top.find("Device")[0] if top.tag == "GroupDevicePreset" else top
        return {c.tag: c.find("Manual").get("Value") for c in device if c.find("Manual") is not None}
    return {}


def _number(v):
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


# ---------- the catalog ----------

def _names(manifest_dir):
    """Aria's names and words for imported packs (device/tools/import_presets.py manifests), by file."""
    out = {}
    for m in Path(manifest_dir).glob("*-imported.json"):
        for p in json.loads(m.read_text()):
            out[p["file"]] = p
    return out


def scan(roots=None, manifest_dir=ARIA_DIR):
    roots = roots or ROOTS
    named = _names(manifest_dir) if manifest_dir and Path(manifest_dir).exists() else {}
    out, skipped = [], 0
    for root in roots.get("live", []):
        for f in sorted(Path(root).rglob("*")):
            if f.suffix not in (".adg", ".adv"):
                continue
            try:
                info = read_live(f)
            except (ET.ParseError, OSError, IndexError):
                skipped += 1
                continue
            extra = named.get(str(f), {})
            out.append({"source": "live", "plugin": LIVE_KIND.get(info["device"], info["device"]), "name": extra.get("name", info["title"]),
                        "category": f.parent.name, "role": extra.get("role"), "devices": info["devices"],
                        "macros": info["macros"], "words": extra.get("words") or _words(info["title"], *info["macros"]),
                        "path": str(f)})
    for root in roots.get("fabfilter", []):
        for f in sorted(Path(root).rglob("*.ffp")):
            rel = f.relative_to(root).parts
            try:
                info = read_fabfilter(f)
            except (configparser.Error, OSError, UnicodeError, ValueError, struct.error):
                skipped += 1
                continue
            out.append({"source": "fabfilter", "plugin": "FabFilter " + rel[0], "name": f.stem, "format": info["format"],
                        "category": "/".join(rel[1:-1]), "words": _words(f.stem, *rel[1:-1], *info["tags"]), "path": str(f)})
    for root in roots.get("valhalla", []):
        for f in sorted(Path(root).rglob("*.vpreset")):
            try:
                info = read_valhalla(f)
            except (ET.ParseError, OSError):
                skipped += 1
                continue
            parts = f.relative_to(root).parts
            folders = parts[parts.index("Presets") + 1:-1] if "Presets" in parts else parts[1:-1]
            out.append({"source": "valhalla", "plugin": info["plugin"], "name": info["title"],
                        "category": "/".join(folders), "words": _words(info["title"], *folders), "path": str(f)})
    for root in roots.get("ozone", []):
        for f in sorted(Path(root).rglob("*.xml")):
            try:
                info = read_ozone(f)
            except (ET.ParseError, OSError):
                skipped += 1
                continue
            folder = f.relative_to(root).parts[0] if len(f.relative_to(root).parts) > 1 else "Global Presets"
            module = folder.removesuffix(" Presets")
            out.append({"source": "ozone", "plugin": OZONE_PLUGIN.get(module, f"Ozone 12 {module}"), "name": f.stem,
                        "category": folder, "words": _words(f.stem, info["comments"]), "path": str(f)})
    return out, skipped


def main():
    entries, skipped = scan()
    ARIA_DIR.mkdir(parents=True, exist_ok=True)
    (ARIA_DIR / "catalog.json").write_text(json.dumps(entries, ensure_ascii=False))
    counts = {}
    for e in entries:
        counts[e["source"]] = counts.get(e["source"], 0) + 1
    print(json.dumps({"presets": len(entries), "by_source": counts, "unreadable": skipped, "file": str(ARIA_DIR / "catalog.json")}))


if __name__ == "__main__":
    sys.exit(main())
