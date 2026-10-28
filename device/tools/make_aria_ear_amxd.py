"""Build device/Aria Ear.amxd: a tiny device for a key track (Kick, Bass, Leads, Vocals). Build step 4.

    plugin~ ─────────────► plugout~           audio passes through untouched
       └──► sfrecord~ 2                        records this track while Check mix runs
    receive aria_ear ──► v8 ear.js ──► sfrecord~
                              └──► send aria_ear_back   ("this track is <name>, its file is <path>")

The main Aria broadcasts "record <dir> <ms> <stamp>" on aria_ear when Check mix starts; every Ear in
the set records at that moment and answers on aria_ear_back. With two or more Ears, the engine looks
for clashes between the tracks by name.

Run:  python3.11 device/tools/make_aria_ear_amxd.py
"""
from pathlib import Path

from amxd import obj, template_patch, wire, write_amxd

OUT = Path(__file__).resolve().parent.parent / "Aria Ear.amxd"
EAR_W, EAR_H = 96.0, 169.0


def build():
    chunks, patch = template_patch()
    label = {"box": {"id": "label", "maxclass": "comment", "fontname": "Arial Bold", "fontsize": 11.0,
                     "text": "Aria Ear", "numinlets": 1, "numoutlets": 0,
                     "patching_rect": [8.0, 8.0, 80.0, 20.0], "presentation": 1, "presentation_rect": [8.0, 8.0, 80.0, 20.0]}}
    hint = {"box": {"id": "hint", "maxclass": "comment", "fontname": "Arial", "fontsize": 9.5, "linecount": 4,
                    "text": "Listens to this track during Check mix, so Aria can say which tracks clash.",
                    "numinlets": 1, "numoutlets": 0,
                    "patching_rect": [8.0, 30.0, 80.0, 60.0], "presentation": 1, "presentation_rect": [8.0, 30.0, 80.0, 60.0]}}
    boxes = [
        label, hint,
        obj("in", "plugin~", [200.0, 40.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("out", "plugout~", [200.0, 200.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("rec", "sfrecord~ 2", [300.0, 200.0, 75.0, 22.0], 2, 1, ["signal"]),
        obj("listen", "receive aria_ear", [300.0, 80.0, 100.0, 22.0], 0, 1),
        obj("ear", "v8 ear.js", [300.0, 120.0, 70.0, 22.0], 1, 2),
        obj("back", "send aria_ear_back", [400.0, 160.0, 110.0, 22.0], 1, 0),
    ]
    lines = [
        wire("in", "out", 0, 0), wire("in", "out", 1, 1),
        wire("in", "rec", 0, 0), wire("in", "rec", 1, 1),
        wire("listen", "ear"),
        wire("ear", "rec", 0, 0),
        wire("ear", "back", 1, 0),
    ]
    p = patch["patcher"]
    p["boxes"], p["lines"] = boxes, lines
    p["openinpresentation"] = 1
    p["devicewidth"] = EAR_W
    return write_amxd(OUT, chunks, patch)


if __name__ == "__main__":
    print(f"Wrote {build()}")
