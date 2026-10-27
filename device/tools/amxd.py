"""Read and write Max for Live .amxd files without the Max editor.

A .amxd is a small binary header plus the patch as JSON. We start from the blank
Max Audio Effect that ships with Live, so every setting matches what Live expects,
then replace its boxes and wires.
"""
import json
import struct
from pathlib import Path

TEMPLATE = Path("/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Misc/Max Devices/Max Audio Effect.amxd")
FONT = {"fontname": "Arial Bold", "fontsize": 10.0}


def read_amxd(path):
    data = Path(path).resolve().read_bytes()
    assert data[:4] == b"ampf", "not a Max for Live device"
    chunks, i = {"type": data[8:12]}, 12
    while i < len(data):
        tag, n = data[i:i + 4], struct.unpack("<I", data[i + 4:i + 8])[0]
        chunks[tag] = data[i + 8:i + 8 + n]
        i += 8 + n
    return chunks


def template_patch():
    chunks = read_amxd(TEMPLATE)
    return chunks, json.loads(chunks[b"ptch"].rstrip(b"\x00").decode())


def write_amxd(path, chunks, patch):
    body = json.dumps(patch, indent="\t").encode() + b"\n\x00"
    meta = chunks[b"meta"]
    out = b"ampf" + struct.pack("<I", 4) + chunks["type"]
    out += b"meta" + struct.pack("<I", len(meta)) + meta
    out += b"ptch" + struct.pack("<I", len(body)) + body
    Path(path).write_bytes(out)
    return path


def obj(id_, text, rect, inlets, outlets, outlettype=None, **extra):
    return {"box": {**FONT, "id": id_, "maxclass": "newobj", "text": text, "patching_rect": rect,
                    "numinlets": inlets, "numoutlets": outlets, "outlettype": outlettype or [""] * outlets, **extra}}


def msg(id_, text, rect):
    return {"box": {**FONT, "id": id_, "maxclass": "message", "text": text, "patching_rect": rect,
                    "numinlets": 2, "numoutlets": 1, "outlettype": [""]}}


def wire(src, dst, outlet=0, inlet=0):
    return {"patchline": {"source": [src, outlet], "destination": [dst, inlet]}}
