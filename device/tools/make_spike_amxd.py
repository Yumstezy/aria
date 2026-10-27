"""Build device/spike/Aria Spike.amxd without opening the Max editor.

A .amxd is a small binary header plus the patch as JSON. We start from the blank
Max Audio Effect that ships with Live, so every setting matches what Live expects,
then replace its boxes and wires with the Step 1 test boxes.

Run:  python3.11 device/tools/make_spike_amxd.py
"""
import json
import struct
import sys
from pathlib import Path

TEMPLATE = Path("/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Misc/Max Devices/Max Audio Effect.amxd")
OUT = Path(__file__).resolve().parent.parent / "spike" / "Aria Spike.amxd"
FONT = {"fontname": "Arial Bold", "fontsize": 10.0}


def read_amxd(path):
    data = path.read_bytes()
    chunks, i = {}, 0
    assert data[:4] == b"ampf", "not a Max for Live device"
    chunks["type"] = data[8:12]
    i = 12
    while i < len(data):
        tag, n = data[i:i + 4], struct.unpack("<I", data[i + 4:i + 8])[0]
        chunks[tag] = data[i + 8:i + 8 + n]
        i += 8 + n
    return chunks


def write_amxd(path, device_type, meta, patch):
    body = json.dumps(patch, indent="\t").encode() + b"\n\x00"
    out = b"ampf" + struct.pack("<I", 4) + device_type
    out += b"meta" + struct.pack("<I", len(meta)) + meta
    out += b"ptch" + struct.pack("<I", len(body)) + body
    path.write_bytes(out)


def obj(id_, text, rect, inlets, outlets, outlettype=None):
    return {"box": {**FONT, "id": id_, "maxclass": "newobj", "text": text, "patching_rect": rect,
                    "numinlets": inlets, "numoutlets": outlets, "outlettype": outlettype or [""] * outlets}}


def msg(id_, text, rect):
    return {"box": {**FONT, "id": id_, "maxclass": "message", "text": text, "patching_rect": rect,
                    "numinlets": 2, "numoutlets": 1, "outlettype": [""]}}


def wire(src, dst, outlet=0, inlet=0):
    return {"patchline": {"source": [src, outlet], "destination": [dst, inlet]}}


def build():
    chunks = read_amxd(TEMPLATE)
    patch = json.loads(chunks[b"ptch"].rstrip(b"\x00").decode())

    tests = [("health", 46), ("state", 40), ("jump 17", 50), ("marker 9 Verse", 86), ("clippath", 52), ("makeclip", 56)]
    boxes, x = [], 8.0
    for i, (text, w) in enumerate(tests):
        boxes.append(msg(f"test-{i}", text, [x, 8.0, w, 22.0]))
        x += w + 8

    boxes += [
        obj("bridge", "node.script bridge_spike.js @autostart 1 @watch 1", [8.0, 40.0, 222.0, 22.0], 1, 2),
        obj("live", "v8 live_spike.js", [240.0, 40.0, 100.0, 22.0], 1, 1),
        obj("prepend", "prepend set", [8.0, 72.0, 70.0, 22.0], 2, 1),
        msg("results", "Click a test above. Results show here and in the Max Console.", [8.0, 102.0, 470.0, 52.0]),
        obj("in", "plugin~", [500.0, 8.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("out", "plugout~", [500.0, 134.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
    ]

    lines = [wire("test-0", "bridge")]
    lines += [wire(f"test-{i}", "live") for i in range(1, len(tests))]
    lines += [
        wire("bridge", "prepend"), wire("live", "prepend"), wire("prepend", "results"),
        wire("in", "out", 0, 0), wire("in", "out", 1, 1),
    ]

    patch["patcher"]["boxes"] = boxes
    patch["patcher"]["lines"] = lines
    patch["patcher"]["devicewidth"] = 570.0
    write_amxd(OUT, chunks["type"], chunks[b"meta"], patch)
    return OUT


if __name__ == "__main__":
    if not TEMPLATE.exists():
        sys.exit(f"Live's blank Max Audio Effect not found at {TEMPLATE}")
    print(f"Wrote {build()}")
