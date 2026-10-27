"""Build device/Aria.amxd, the Aria device for the Main track.

    plugin~ ──────────────► plugout~        audio passes through untouched
       └──► sfrecord~ 2                      records Main while Check mix runs
    jweb (strip UI) ──► node.script bridge.js ──► route jweb live rec
                                 ▲                 │      │     └──► sfrecord~
                                 │                 │      └──► v8 live.js
                                 │                 └──► jweb
    v8 live.js ──► route defer ──┤ (everything else)
                       └──► deferlow ──► v8 live.js   (Live API changes from notifications)
    live.thisdevice ──► v8 live.js                    (Live API ready)

Run:  python3.11 device/tools/make_aria_amxd.py
"""
from pathlib import Path

from amxd import FONT, obj, template_patch, wire, write_amxd

OUT = Path(__file__).resolve().parent.parent / "Aria.amxd"
STRIP_W, STRIP_H = 700.0, 169.0


def build():
    chunks, patch = template_patch()

    jweb = {"box": {**FONT, "id": "ui", "maxclass": "jweb", "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                    "patching_rect": [8.0, 200.0, 350.0, 85.0],
                    "presentation": 1, "presentation_rect": [0.0, 0.0, STRIP_W, STRIP_H],
                    "rendermode": 0, "url": ""}}

    boxes = [
        jweb,
        obj("bridge", "node.script bridge.js @autostart 1 @watch 1", [8.0, 300.0, 230.0, 22.0], 1, 2),
        obj("route-out", "route jweb live rec", [8.0, 340.0, 130.0, 22.0], 1, 4),
        obj("dump", "print aria-node", [250.0, 340.0, 90.0, 22.0], 1, 0),
        obj("live", "v8 live.js", [150.0, 380.0, 80.0, 22.0], 1, 1),
        obj("route-defer", "route defer", [150.0, 420.0, 70.0, 22.0], 1, 2),
        obj("deferlow", "deferlow", [150.0, 460.0, 60.0, 22.0], 1, 1),
        obj("thisdevice", "live.thisdevice", [300.0, 380.0, 90.0, 22.0], 1, 3, ["bang", "int", "int"]),
        obj("in", "plugin~", [400.0, 200.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("out", "plugout~", [400.0, 460.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("rec", "sfrecord~ 2", [480.0, 380.0, 75.0, 22.0], 2, 1, ["signal"]),
    ]

    lines = [
        # UI and Live API messages into the bridge
        wire("ui", "bridge"),
        wire("route-defer", "bridge", 1, 0),
        # bridge out to the UI, the Live API and the recorder
        wire("bridge", "route-out"),
        wire("bridge", "dump", 1, 0),
        wire("route-out", "ui", 0, 0),
        wire("route-out", "live", 1, 0),
        wire("route-out", "rec", 2, 0),
        # Live API: replies, deferred changes, ready signal
        wire("live", "route-defer"),
        wire("route-defer", "deferlow", 0, 0),
        wire("deferlow", "live"),
        wire("thisdevice", "live"),
        # audio: pass through, and record
        wire("in", "out", 0, 0), wire("in", "out", 1, 1),
        wire("in", "rec", 0, 0), wire("in", "rec", 1, 1),
    ]

    p = patch["patcher"]
    p["boxes"], p["lines"] = boxes, lines
    p["openinpresentation"] = 1
    p["devicewidth"] = STRIP_W
    return write_amxd(OUT, chunks, patch)


if __name__ == "__main__":
    print(f"Wrote {build()}")
