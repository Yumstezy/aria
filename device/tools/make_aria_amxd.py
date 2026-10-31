"""Build device/Aria.amxd, the Aria device for the Main track.

    plugin~ ──────────────► plugout~        audio passes through untouched
       └──► sfrecord~ 2                      records Main while Check mix runs
    jweb (strip UI) ──► node.script bridge.js ──► route jweb window live rec
    live.text "Ask key" ──► prepend ask_key ──┘   (map a key to it in Live: it opens Ask Muse)
    route ears ──► send aria_ear      receive aria_ear_back ──► prepend ear_back ──► bridge   (Aria Ear, step 4)
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
from urllib.parse import quote

from amxd import FONT, obj, template_patch, wire, write_amxd

OUT = Path(__file__).resolve().parent.parent / "Aria.amxd"
STRIP_W, STRIP_H = 150.0, 169.0   # just the buttons, glassy and muted like Live's devices (Ian, Oct 28)
WINDOW_W, WINDOW_H = 1200.0, 860.0
CHAT_W, CHAT_H = 400.0, 620.0
AN_BANDS = 55   # Live analyzer: sixth octaves from 31.25 Hz to 16 kHz (31.25 x 1.12246^k; Oct 31, finer, so peaks show)
AN_EXTRA = 5    # then mid level, side level, K-weighted L and R (400 ms), peak since the last frame

# The page the strip starts on, built into the device. The bridge swaps in the real strip about
# 0.15 s after load, but its message goes through Max's queue, and that queue stops when Live's
# audio isn't running (Oct 29: the device sat blank until Ian fixed Live's audio device). This page
# needs no message, so the producer always sees what to do. Live's dark greys, like the strip.
FALLBACK_PAGE = """<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;background:#3a3a3a;color:#dcdcdc;
font:11px -apple-system,Arial,sans-serif;padding:10px;box-sizing:border-box;overflow:hidden">
<div style="display:flex;align-items:center;gap:6px;font-weight:600">
<span id="l" style="width:8px;height:8px;border-radius:50%;background:#7a7a7a"></span><span>Aria</span>
<span id="w" style="margin-left:auto;color:#a8a8a8;font-size:9.5px">Starting</span></div>
<p id="m" style="display:none;margin:12px 0 0;line-height:1.4">Live's audio isn't running, so Aria can't start.
<br><br>Open Live's Settings, then Audio, and pick an Audio Output Device. Aria starts by itself.</p>
<script>setTimeout(function(){l.style.background="#e0703a";w.textContent="Waiting";m.style.display="block"},4000)</script>"""
FALLBACK_URL = "data:text/html," + quote(" ".join(FALLBACK_PAGE.split()), safe="")


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
                    "rendermode": 0, "url": FALLBACK_URL}}

    # The mapped key: Live maps keys and MIDI only to its own controls, so the strip has one small
    # live.text under the page's left column. Key Map (Cmd+K), click it, press a key: that key opens Ask Muse.
    ask_key = {"box": {"id": "askkey", "maxclass": "live.text", "varname": "Ask Muse", "numinlets": 1, "numoutlets": 2, "outlettype": ["", ""],
                       "patching_rect": [400.0, 300.0, 60.0, 20.0], "presentation": 1, "presentation_rect": [10.0, 148.0, 130.0, 14.0],
                       "mode": 0, "text": "Ask key", "texton": "Ask key", "fontname": "Arial", "fontsize": 9.0,
                       "bgcolor": [0.0, 0.0, 0.0, 0.0], "bgoncolor": [0.89, 0.643, 0.227, 1.0], "bordercolor": [0.0, 0.0, 0.0, 0.0],
                       "focusbordercolor": [0.89, 0.643, 0.227, 1.0], "textcolor": [0.55, 0.55, 0.55, 1.0], "textoncolor": [0.1, 0.1, 0.1, 1.0],
                       "parameter_enable": 1,
                       "saved_attribute_attributes": {"valueof": {"parameter_longname": "Ask Muse", "parameter_shortname": "Ask",
                                                                  "parameter_type": 2, "parameter_mmax": 1, "parameter_enum": ["off", "on"]}}}}

    window = obj("window", "p window", [8.0, 500.0, 70.0, 22.0], 1, 1)
    window["box"]["patcher"] = window_patcher(patch["patcher"])
    chat = obj("chat", "p chat", [90.0, 500.0, 60.0, 22.0], 1, 1)
    chat["box"]["patcher"] = window_patcher(patch["patcher"], "aria-chat-ui", CHAT_W, CHAT_H)

    boxes = [
        jweb,
        ask_key,   # after the page, so it draws on top of it
        obj("ask-prepend", "prepend ask_key", [400.0, 330.0, 95.0, 22.0], 1, 1),
        window,
        chat,
        obj("bridge", "node.script bridge.js @autostart 1 @watch 1", [8.0, 300.0, 230.0, 22.0], 1, 2),
        obj("route-out", "route jweb window chat live rec ears an", [8.0, 340.0, 240.0, 22.0], 1, 8),
        # Key tracks mode: broadcast "record" to every Aria Ear, and hear back which track each one is
        obj("ears-send", "send aria_ear", [240.0, 380.0, 85.0, 22.0], 1, 0),
        obj("ears-back", "receive aria_ear_back", [240.0, 260.0, 130.0, 22.0], 0, 1),
        obj("ears-prepend", "prepend ear_back", [240.0, 285.0, 100.0, 22.0], 1, 1),
        obj("dump", "print aria-node", [250.0, 340.0, 90.0, 22.0], 1, 0),
        obj("live", "v8 live.js", [150.0, 380.0, 80.0, 22.0], 1, 1),
        obj("route-defer", "route defer", [150.0, 420.0, 70.0, 22.0], 1, 2),
        obj("deferlow", "deferlow", [150.0, 460.0, 60.0, 22.0], 1, 1),
        obj("thisdevice", "live.thisdevice", [300.0, 380.0, 90.0, 22.0], 1, 3, ["bang", "int", "int"]),
        obj("in", "plugin~", [400.0, 200.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("out", "plugout~", [400.0, 460.0, 53.0, 20.0], 2, 2, ["signal", "signal"]),
        obj("rec", "sfrecord~ 2", [480.0, 380.0, 75.0, 22.0], 2, 1, ["signal"]),
        # Live analyzer (Oct 30): Main in mono through 31 third-octave filters from 31 Hz, each band's RMS read 20
        # times a second while the window's analyzer is open (the bridge turns the metro on and off), to the bridge
        obj("an-sum", "+~", [600.0, 220.0, 40.0, 22.0], 2, 1, ["signal"]),
        obj("an-half", "*~ 0.5", [600.0, 250.0, 50.0, 22.0], 2, 1, ["signal"]),
        obj("an-bank", f"fffb~ {AN_BANDS} 31.25 1.12246 8.65", [600.0, 280.0, 160.0, 22.0], 1, AN_BANDS, ["signal"] * AN_BANDS),
        obj("an-metro", "metro 50", [800.0, 280.0, 60.0, 22.0], 2, 1, ["bang"]),
        obj("an-order", "t b b", [800.0, 310.0, 40.0, 22.0], 1, 2, ["bang", "bang"]),
        *[obj(f"an-rms-{k}", "average~ 2048 rms", [600.0 + k * 36, 330.0, 34.0, 22.0], 1, 1, ["signal"]) for k in range(AN_BANDS)],
        *[obj(f"an-snap-{k}", "snapshot~", [600.0 + k * 36, 360.0, 34.0, 22.0], 2, 1, [""]) for k in range(AN_BANDS)],
        # Live analyzer extras (Oct 31, Ian: loudness, how wide, the waveform): mid and side levels; each channel
        # K-weighted (BS.1770's two filters, 48 kHz coefficients) and averaged over 400 ms, for loudness; and the
        # peak since the last frame. They go after the bands in the same frame.
        obj("an-diff", "-~", [1000.0, 220.0, 40.0, 22.0], 2, 1, ["signal"]),
        obj("an-side", "*~ 0.5", [1000.0, 250.0, 50.0, 22.0], 2, 1, ["signal"]),
        obj("an-side-rms", "average~ 2048 rms", [1000.0, 330.0, 100.0, 22.0], 1, 1, ["signal"]),
        obj("an-side-snap", "snapshot~", [1000.0, 360.0, 60.0, 22.0], 2, 1, [""]),
        obj("an-mid-rms", "average~ 2048 rms", [1110.0, 330.0, 100.0, 22.0], 1, 1, ["signal"]),
        obj("an-mid-snap", "snapshot~", [1110.0, 360.0, 60.0, 22.0], 2, 1, [""]),
        *[o for ch in (0, 1) for o in (
            obj(f"an-k1-{ch}", "biquad~ 1.53512485958697 -2.69169618940638 1.19839281085285 -1.69065929318241 0.73248077421585",
                [1220.0 + ch * 220, 250.0, 210.0, 22.0], 6, 1, ["signal"]),
            obj(f"an-k2-{ch}", "biquad~ 1. -2. 1. -1.99004745483398 0.99007225036621", [1220.0 + ch * 220, 280.0, 210.0, 22.0], 6, 1, ["signal"]),
            obj(f"an-k-rms-{ch}", "average~ 19200 rms", [1220.0 + ch * 220, 330.0, 110.0, 22.0], 1, 1, ["signal"]),
            obj(f"an-k-snap-{ch}", "snapshot~", [1220.0 + ch * 220, 360.0, 60.0, 22.0], 2, 1, [""]))],
        obj("an-peak", "peakamp~", [1660.0, 330.0, 60.0, 22.0], 2, 1, [""]),
        obj("an-pack", "pack " + " ".join(["0."] * (AN_BANDS + AN_EXTRA)), [600.0, 400.0, 400.0, 22.0], AN_BANDS + AN_EXTRA, 1),
        # The stereo view (Oct 31): Main's last 100 ms recorded round and round into a stereo buffer~, read by
        # scope.js on each analyzer frame ("---" makes the buffer's name this device's own)
        obj("scope-buf", "buffer~ ---aria_scope 100 2", [1700.0, 420.0, 160.0, 22.0], 1, 2, ["float", "bang"]),
        obj("scope-rec", "record~ ---aria_scope 2 @loop 1", [1700.0, 380.0, 170.0, 22.0], 4, 1, ["signal"]),
        obj("scope-lb", "loadbang", [1880.0, 340.0, 60.0, 22.0], 1, 1, ["bang"]),
        obj("scope-on", "1", [1880.0, 360.0, 30.0, 22.0], 2, 1, [""], maxclass="message"),
        obj("scope-js", "v8 scope.js ---aria_scope", [1880.0, 420.0, 150.0, 22.0], 1, 1),
        obj("an-prepend", "prepend analyzer_frame", [600.0, 430.0, 130.0, 22.0], 1, 1),
    ]

    lines = [
        # UI and Live API messages into the bridge
        wire("ui", "bridge"),
        wire("askkey", "ask-prepend"),
        wire("ask-prepend", "bridge"),
        wire("route-defer", "bridge", 1, 0),
        # bridge out to the UI, the Live API and the recorder
        wire("bridge", "route-out"),
        wire("bridge", "dump", 1, 0),
        wire("route-out", "ui", 0, 0),
        wire("route-out", "window", 1, 0),
        wire("route-out", "chat", 2, 0),
        wire("route-out", "live", 3, 0),
        wire("route-out", "rec", 4, 0),
        wire("route-out", "ears-send", 5, 0),
        wire("ears-back", "ears-prepend"),
        wire("ears-prepend", "bridge"),
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
        # Live analyzer: sum, filter, RMS; the metro bangs the snapshots, the leftmost (pack's hot inlet) last
        wire("in", "an-sum", 0, 0), wire("in", "an-sum", 1, 1), wire("an-sum", "an-half"), wire("an-half", "an-bank"),
        *[wire("an-bank", f"an-rms-{k}", k, 0) for k in range(AN_BANDS)],
        *[wire(f"an-rms-{k}", f"an-snap-{k}") for k in range(AN_BANDS)],
        *[wire("an-order", f"an-snap-{k}", 1, 0) for k in range(1, AN_BANDS)],
        wire("an-order", "an-snap-0", 0, 0),
        *[wire(f"an-snap-{k}", "an-pack", 0, k) for k in range(AN_BANDS)],
        wire("route-out", "an-metro", 6, 0), wire("an-metro", "an-order"),
        # the extras: side (L-R)/2 and mid (the bank's mono) levels, K-weighted L and R, the peak of the mono
        wire("in", "an-diff", 0, 0), wire("in", "an-diff", 1, 1), wire("an-diff", "an-side"), wire("an-side", "an-side-rms"), wire("an-side-rms", "an-side-snap"),
        wire("an-half", "an-mid-rms"), wire("an-mid-rms", "an-mid-snap"), wire("an-half", "an-peak"),
        *[w for ch in (0, 1) for w in (wire("in", f"an-k1-{ch}", ch, 0), wire(f"an-k1-{ch}", f"an-k2-{ch}"), wire(f"an-k2-{ch}", f"an-k-rms-{ch}"), wire(f"an-k-rms-{ch}", f"an-k-snap-{ch}"))],
        *[wire("an-order", x, 1, 0) for x in ("an-mid-snap", "an-side-snap", "an-k-snap-0", "an-k-snap-1", "an-peak")],
        *[wire(x, "an-pack", 0, AN_BANDS + i) for i, x in enumerate(("an-mid-snap", "an-side-snap", "an-k-snap-0", "an-k-snap-1", "an-peak"))],
        # the stereo view: record always (from load), read on each frame, to the bridge
        wire("in", "scope-rec", 0, 0), wire("in", "scope-rec", 1, 1), wire("scope-lb", "scope-on"), wire("scope-on", "scope-rec", 0, 0),
        wire("an-order", "scope-js", 1, 0), wire("scope-js", "bridge"),
        wire("an-pack", "an-prepend"), wire("an-prepend", "bridge"),
    ]

    p = patch["patcher"]
    p["boxes"], p["lines"] = boxes, lines
    p["openinpresentation"] = 1
    p["devicewidth"] = STRIP_W
    return write_amxd(OUT, chunks, patch)


if __name__ == "__main__":
    print(f"Wrote {build()}")
