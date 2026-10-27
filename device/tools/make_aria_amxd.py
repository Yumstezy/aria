"""Build device/Aria.amxd, the Aria device for the Main track.

    plugin~ ──────────────► plugout~        audio passes through untouched
       └──► sfrecord~ 2                      records Main while Check mix runs
    jweb (strip UI) ──► node.script bridge.js ──► route jweb window live rec
                                 ▲                 │      │     └──► sfrecord~
                                 │                 │      └──► v8 live.js
                                 │                 └──► jweb
    v8 live.js ──► route defer ──┤ (everything else)
                       └──► deferlow ──► v8 live.js   (Live API changes from notifications)
    live.thisdevice ──► v8 live.js                    (Live API ready)
    p window: routepass front window script wclose ──► thispatcher (open, size, float, close), else ──► jweb ──► out
              The window can be see-through: transparent patcher background, no title bar when docked
              (set by the bridge), and jweb rendering with a transparent background
    p chat:   the same, for Ask Muse popped out into its own small window

Run:  python3.11 device/tools/make_aria_amxd.py
"""
from pathlib import Path

from amxd import FONT, obj, template_patch, wire, write_amxd

OUT = Path(__file__).resolve().parent.parent / "Aria.amxd"
STRIP_W, STRIP_H = 480.0, 169.0   # wider so the check and Ask sit side by side (Ian, Oct 27)
WINDOW_W, WINDOW_H = 1200.0, 860.0
CHAT_W, CHAT_H = 400.0, 620.0


def window_patcher(template, ui_name="aria-window-ui", w=WINDOW_W, h=WINDOW_H):
    """The Aria window: a floating window with its own jweb (ui/dist/window).
    "front", "window ..." (size, float) and "script ..." (resize the page) go to thispatcher;
    everything else goes to the page. The page's messages come back out."""
    inner = {k: v for k, v in template.items() if k not in ("boxes", "lines", "project")}
    inner.update({
        "rect": [120.0, 90.0, 120.0 + w, 90.0 + h],
        "openinpresentation": 1, "toolbarvisible": 0, "statusbarvisible": 0, "devicewidth": 0.0,
        "bgcolor": [0.0, 0.0, 0.0, 0.0], "editing_bgcolor": [0.0, 0.0, 0.0, 0.0],
        "boxes": [
            {"box": {"id": "w-in", "maxclass": "inlet", "numinlets": 0, "numoutlets": 1, "outlettype": [""],
                     "patching_rect": [8.0, 8.0, 30.0, 30.0]}},
            obj("w-route", "routepass front window script wclose", [8.0, 50.0, 220.0, 22.0], 1, 5),   # routepass keeps the first word for thispatcher
            obj("w-this", "thispatcher", [8.0, 90.0, 70.0, 22.0], 1, 2),
            {"box": {**FONT, "id": "w-ui", "varname": ui_name, "maxclass": "jweb", "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                     "patching_rect": [100.0, 90.0, 400.0, 280.0],
                     "presentation": 1, "presentation_rect": [0.0, 0.0, w, h], "rendermode": 2, "url": ""}},   # 2: transparent background
            {"box": {"id": "w-out", "maxclass": "outlet", "numinlets": 1, "numoutlets": 0,
                     "patching_rect": [100.0, 400.0, 30.0, 30.0]}},
        ],
        "lines": [wire("w-in", "w-route"), wire("w-route", "w-this", 0, 0), wire("w-route", "w-this", 1, 0),
                  wire("w-route", "w-this", 2, 0), wire("w-route", "w-this", 3, 0), wire("w-route", "w-ui", 4, 0),
                  wire("w-ui", "w-out")],
    })
    return inner


def build():
    chunks, patch = template_patch()

    jweb = {"box": {**FONT, "id": "ui", "maxclass": "jweb", "numinlets": 1, "numoutlets": 1, "outlettype": [""],
                    "patching_rect": [8.0, 200.0, 350.0, 85.0],
                    "presentation": 1, "presentation_rect": [0.0, 0.0, STRIP_W, STRIP_H],
                    "rendermode": 0, "url": ""}}

    window = obj("window", "p window", [8.0, 500.0, 70.0, 22.0], 1, 1)
    window["box"]["patcher"] = window_patcher(patch["patcher"])
    chat = obj("chat", "p chat", [90.0, 500.0, 60.0, 22.0], 1, 1)
    chat["box"]["patcher"] = window_patcher(patch["patcher"], "aria-chat-ui", CHAT_W, CHAT_H)

    boxes = [
        jweb,
        window,
        chat,
        obj("bridge", "node.script bridge.js @autostart 1 @watch 1", [8.0, 300.0, 230.0, 22.0], 1, 2),
        obj("route-out", "route jweb window chat live rec", [8.0, 340.0, 190.0, 22.0], 1, 6),
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
        wire("route-out", "window", 1, 0),
        wire("route-out", "chat", 2, 0),
        wire("route-out", "live", 3, 0),
        wire("route-out", "rec", 4, 0),
        wire("window", "bridge"),
        wire("chat", "bridge"),
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
