"""Build device/spike/Aria Spike.amxd, the build step 1 test device.

Run:  python3.11 device/tools/make_spike_amxd.py
"""
from pathlib import Path

from amxd import msg, obj, template_patch, wire, write_amxd

OUT = Path(__file__).resolve().parent.parent / "spike" / "Aria Spike.amxd"


def build():
    chunks, patch = template_patch()

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
    return write_amxd(OUT, chunks, patch)


if __name__ == "__main__":
    print(f"Wrote {build()}")
