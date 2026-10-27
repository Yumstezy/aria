"""Copy a pack of Live presets into the User Library under clearer names, for Aria and the producer.

    python3.11 device/tools/import_presets.py <pack folder> <names.json>

names.json: {"presets": [{"from": "<path in the pack>", "name": "<new name>", "role": ..., "words": [...]}]}
Copies go to "~/Music/Ableton/User Library/Aria Presets/<Audio Effects|Instruments|Clips>/<name><ext>".
The device's own title inside the preset is set to the new name too, so it shows on the track.
The pack's files are never changed. Presets stay on this Mac: third-party packs never go in the repo.
"""
import gzip
import json
import re
import sys
from pathlib import Path

USER_LIBRARY = Path.home() / "Music" / "Ableton" / "User Library"
DEST = USER_LIBRARY / "Aria Presets"
FOLDER = {".adg": None, ".adv": None, ".alc": "Clips"}
INSTRUMENT_TAGS = ("InstrumentGroupDevice", "Operator", "InstrumentVector", "Drift", "OriginalSimpler", "MultiSampler",
                   "UltraAnalog", "Meld", "Collision", "LoungeLizard", "StringStudio", "InstrumentImpulse", "DrumGroupDevice")
SAFE = re.compile(r'[/:\\*?"<>|]')


def load(path):
    raw = path.read_bytes()
    try:
        return gzip.decompress(raw).decode("utf-8"), True
    except OSError:
        return raw.decode("utf-8"), False


def retitle(xml, name):
    """Set the first device title (the preset's top device) to name."""
    escaped = name.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
    return re.sub(r'<UserName Value="[^"]*" />', f'<UserName Value="{escaped}" />', xml, count=1)


def folder_for(xml, ext):
    if FOLDER.get(ext):
        return FOLDER[ext]
    head = xml[:4000]
    return "Instruments" if any(f"<{t} " in head or f"<{t}>" in head for t in INSTRUMENT_TAGS) else "Audio Effects"


def main(pack, names_file):
    pack, names = Path(pack), json.loads(Path(names_file).read_text())
    done = []
    for p in names["presets"]:
        src = pack / p["from"]
        if not src.exists():
            print(f"missing: {p['from']}")
            continue
        xml, zipped = load(src)
        sub = folder_for(xml, src.suffix)
        if src.suffix in (".adg", ".adv"):
            xml = retitle(xml, p["name"])
        out = DEST / sub / (SAFE.sub("-", p["name"]) + src.suffix)
        out.parent.mkdir(parents=True, exist_ok=True)
        data = xml.encode("utf-8")
        out.write_bytes(gzip.compress(data) if zipped else data)
        done.append({**p, "file": str(out), "folder": sub})
        print(f"{p['from']}  ->  {sub}/{out.name}")
    manifest = Path(names_file).with_name(Path(names_file).stem + "-imported.json")
    manifest.write_text(json.dumps(done, indent=1, ensure_ascii=False))
    print(f"{len(done)} presets in {DEST}\nmanifest: {manifest}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
