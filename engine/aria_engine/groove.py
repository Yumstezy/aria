"""Groove match (build step 9): line one loop's hits up with a straight grid or with another loop.

Each hit is found to the millisecond, given a target (the nearest 16th, or the other loop's hit at the same place in
the bar), and moved there by cutting the audio just before the hit and shifting that slice, with short fades. Nothing is
stretched, so the hits keep their sound. Then the new file is measured the same way: "in time" only when every hit
lands within IN_TIME_MS of its target. The original file is never touched.
"""
from pathlib import Path

import numpy as np
import soundfile as sf

IN_TIME_MS = 5.0
STEPS_PER_BEAT = 4          # the straight grid is 16ths
PRE_SEC = 0.003             # a slice starts this long before its hit, in the quiet before the attack
FADE_SEC = 0.002
MAX_MOVE_STEPS = 0.45       # a hit is paired with a target less than about half a 16th away; further is a different note
MIN_GAP_SEC = 0.03          # hits closer than this are one hit


def _mono(audio):
    x = np.asarray(audio, dtype=np.float64)
    return x.mean(axis=1) if x.ndim == 2 else x


def onsets(audio, rate):
    """Each hit's start in seconds. Found where the level jumps (over 10 ms, against the 10 ms before, in 1 ms steps,
    at least 9 dB and within 40 dB of the loudest hit), then pinned to where the attack begins: walking back from the
    hit's peak to where its level falls under a third of that peak (1 ms smoothing)."""
    x = _mono(audio)
    if not np.any(x):
        return []
    pad = int(0.03 * rate)          # silence in front, so a hit right at the start is a jump too
    x = np.r_[np.zeros(pad), x]
    ms = max(1, int(0.001 * rate))
    env = np.convolve(np.abs(x), np.ones(ms) / ms, mode="same")
    hop, span = ms, 10
    frames = env[: len(env) // hop * hop].reshape(-1, hop).mean(axis=1)
    db = 20 * np.log10(frames + 1e-9)
    loud = np.convolve(db, np.ones(span) / span, mode="full")[: len(db)]       # the 10 ms ending at each frame
    jump = np.r_[np.zeros(span), loud[2 * span - 1:] - loud[span - 1:-span]] if len(db) > 2 * span else np.zeros(len(db))
    jump = np.r_[jump, np.zeros(len(db) - len(jump))]
    top = db.max()
    out = []
    k = 0
    while k < len(jump):
        if jump[k] >= 9.0 and db[min(len(db) - 1, k + span)] > top - 40:
            r = k * hop
            lo, hi = max(0, r - int(0.015 * rate)), min(len(env), r + int(0.03 * rate))
            peak = lo + int(np.argmax(env[lo:hi]))
            i = peak
            while i > lo and env[i] > env[peak] / 3:
                i -= 1
            t = max(0.0, (i - pad) / rate)
            if not out or t - out[-1] >= MIN_GAP_SEC:
                out.append(t)
            k += int(MIN_GAP_SEC * 1000)
        else:
            k += 1
    return out


def _targets(times, step, beat1, anchor_times=None, loop_sec=None):
    """Where each hit should be, or None when nothing is near enough. Straight: the nearest 16th. Another loop: its hit
    at the same place in the loop (both loops repeat every loop_sec)."""
    out = []
    for t in times:
        if anchor_times is None:
            target = beat1 + round((t - beat1) / step) * step
        else:
            pos = (t - beat1) % loop_sec
            gaps = [((a - pos + loop_sec / 2) % loop_sec) - loop_sec / 2 for a in anchor_times]
            k = int(np.argmin(np.abs(gaps))) if gaps else None
            target = t + gaps[k] if k is not None else None
        out.append(target if target is not None and abs(target - t) < MAX_MOVE_STEPS * step else None)
    return out


def _offsets(times, targets):
    """{avg_ms, max_ms, hits} for the hits that have a target"""
    pairs = [(t, g) for t, g in zip(times, targets) if g is not None]
    if not pairs:
        return {"avg_ms": None, "max_ms": None, "hits": []}
    ms = [(t - g) * 1000 for t, g in pairs]
    return {"avg_ms": round(float(np.mean(np.abs(ms))), 1), "max_ms": round(float(np.max(np.abs(ms))), 1),
            "hits": [{"sec": round(g, 4), "offset_ms": round(m, 1)} for (_, g), m in zip(pairs, ms)]}


def _move(x, rate, times, shifts):
    """The audio with each hit's slice moved by its shift (seconds). Slices keep their order; a slice that moves later
    leaves a short silence before it, one that moves earlier cuts the tail before it (with a fade)."""
    n = len(x)
    starts = [max(0, int(round((t - PRE_SEC) * rate))) for t in times]
    ends = starts[1:] + [n]
    out = np.zeros_like(x)
    out[:starts[0] if starts else n] = x[:starts[0] if starts else n]
    fade = max(1, int(FADE_SEC * rate))
    new_starts = [s + int(round(d * rate)) for s, d in zip(starts, shifts)]
    for k, (s, e, ns) in enumerate(zip(starts, ends, new_starts)):
        seg = x[s:e].copy()
        stop = new_starts[k + 1] if k + 1 < len(new_starts) else n    # the next slice's new start cuts this one
        seg = seg[:max(0, min(len(seg), stop - ns))]
        if len(seg) > 2 * fade:
            seg[:fade] *= np.linspace(0, 1, fade)[:, None] if seg.ndim == 2 else np.linspace(0, 1, fade)
            seg[-fade:] *= np.linspace(1, 0, fade)[:, None] if seg.ndim == 2 else np.linspace(1, 0, fade)
        a, b = max(0, ns), min(n, ns + len(seg))
        if b > a:
            out[a:b] += seg[a - ns:b - ns]
    return out


def match(moving_path, anchor, tempo, strength=1.0, nudge_ms=0.0, beat1_sec=None, out_dir=None):
    """Move the moving loop's hits toward the anchor ({"kind": "straight"} or {"kind": "loop", "path"}), write
    "<name> (matched).wav" in out_dir and measure it again. Returns the contract's {before, after, in_time, hits_moved, out_path}."""
    beat1_sec = beat1_sec or {}
    audio, rate = sf.read(str(moving_path), always_2d=True, dtype="float64")
    step = 60.0 / tempo / STEPS_PER_BEAT
    b1 = float(beat1_sec.get("moving", 0.0))
    times = onsets(audio, rate)
    if not times:
        raise ValueError("No hits found in that loop.")
    if anchor.get("kind") == "loop":
        other, orate = sf.read(str(anchor["path"]), always_2d=True, dtype="float64")
        a_times = [t - float(beat1_sec.get("anchor", 0.0)) for t in onsets(other, orate)]
        bar = 4 * 60.0 / tempo
        loop_sec = max(bar, round((len(other) / orate) / bar) * bar)
        targets = _targets(times, step, b1, [t % loop_sec for t in a_times], loop_sec)
    elif anchor.get("kind") == "straight":
        targets = _targets(times, step, b1)
    else:
        raise ValueError("Groove match can follow a straight grid or another loop.")

    nudge = nudge_ms / 1000.0
    shifts = [(strength * (g - t) + nudge) if g is not None else nudge for t, g in zip(times, targets)]
    moved = _move(audio, rate, times, shifts)
    out_dir = Path(out_dir) if out_dir else Path(moving_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{Path(moving_path).stem} (matched).wav"
    sf.write(str(out_path), moved, rate, subtype="PCM_24")

    # Measured again from the new file, against the same targets (moved by the nudge)
    after_times = onsets(moved, rate)
    after_targets = []
    for g in targets:
        if g is None:
            continue
        near = min(after_times, key=lambda a: abs(a - (g + nudge)), default=None)
        after_targets.append((near, g + nudge))
    after = _offsets([a for a, _ in after_targets], [g for _, g in after_targets])
    before = _offsets(times, targets)
    return {"before": before, "after": {k: after[k] for k in ("avg_ms", "max_ms")},
            "in_time": after["max_ms"] is not None and after["max_ms"] <= IN_TIME_MS,
            "hits": len(times), "hits_moved": sum(1 for t, g in zip(times, targets) if g is not None and abs(g - t) * 1000 > 1.0),
            "out_path": str(out_path)}
