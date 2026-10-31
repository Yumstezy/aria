"""Groove match (build step 9): line one loop's hits up with a straight grid or with another loop.

Each hit is found to the millisecond, given a target (the nearest 16th, or the other loop's hit at the same place in
the bar), and moved there by cutting the audio just before the hit and shifting that slice, with short fades. Nothing is
stretched, so the hits keep their sound. Then the new file is measured the same way: "in time" only when every hit
lands within IN_TIME_MS of its target. The original file is never touched.
"""
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d

IN_TIME_MS = 5.0
STEPS_PER_BEAT = 4          # the straight grid is 16ths
PRE_SEC = 0.003             # a slice starts this long before its hit, in the quiet before the attack
FADE_SEC = 0.002
MAX_MOVE_STEPS = 0.45       # a hit is paired with a target less than about half a 16th away; further is a different note
MIN_GAP_SEC = 0.03          # hits closer than this are one hit
FIND_AGAIN_SEC = 0.02       # after the move, a hit is looked for this close to where it was put
MATCH_MIN = 0.6             # and counts as found when its sound matches at least this well (correlation, 0 to 1)


def _mono(audio):
    x = np.asarray(audio, dtype=np.float64)
    return x.mean(axis=1) if x.ndim == 2 else x


def onsets(audio, rate):
    """Each hit's start in seconds. Found where the level jumps (over 10 ms, against the 10 ms before, in 1 ms steps,
    at least 9 dB and within 40 dB of the loudest hit), then pinned to where the attack begins: walking back from the
    hit's peak to where its level falls under a third of that peak. The level for that walk is the loudest sample in
    the last 10 ms: a plain smoothed level dips at every cycle of a low drum, and the walk stopped at a dip 13 ms into
    the hit (Ian's tribal loop, Oct 30, every hit read 13 ms late)."""
    x = _mono(audio)
    if not np.any(x):
        return []
    pad = int(0.03 * rate)          # silence in front, so a hit right at the start is a jump too
    x = np.r_[np.zeros(pad), x]
    ms = max(1, int(0.001 * rate))
    env = np.convolve(np.abs(x), np.ones(ms) / ms, mode="same")
    hold_n = int(0.01 * rate)
    hold = np.roll(maximum_filter1d(np.abs(x), size=hold_n), hold_n // 2)   # the loudest of the last 10 ms
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
            top = hold[peak]
            i = peak
            while i > lo and hold[i] > top / 3:
                i -= 1
            t = max(0.0, (i - pad) / rate)
            if not out or t - out[-1] >= MIN_GAP_SEC:
                out.append(t)
            k += int(MIN_GAP_SEC * 1000)
        else:
            k += 1
    return out


def _targets(times, step, beat1, anchor_times=None, loop_sec=None):
    """Where each hit should be, or None when nothing is near enough. Straight: the nearest 16th. Another loop: the
    nearest 16th on the grid that loop plays to: at a 16th where it has a hit, that hit's exact time; at the others,
    the grid moved by how late or early its hits sit (the median). A kick that plays only the beats still says where
    the off-beat 16ths go (Ian, Oct 30: a perc loop following a kick loop paired nothing, since no perc hit shared a
    16th with a kick). Both loops repeat every loop_sec."""
    out = []
    offs, n = {}, None
    if anchor_times is not None:
        n = max(1, int(round(loop_sec / step)))
        for a in anchor_times:
            k = int(round(a / step))
            o = a - k * step
            if abs(o) < MAX_MOVE_STEPS * step and (k % n not in offs or abs(o) < abs(offs[k % n])):
                offs[k % n] = o
    feel = float(np.median(list(offs.values()))) if offs else 0.0
    for t in times:
        k = int(round((t - beat1) / step))
        target = beat1 + k * step + (offs.get(k % n, feel) if n else 0.0)
        out.append(target if abs(target - t) < MAX_MOVE_STEPS * step else None)
    return out


def _offsets(times, targets):
    """{avg_ms, max_ms, hits} for the hits that have a target"""
    pairs = [(t, g) for t, g in zip(times, targets) if g is not None]
    if not pairs:
        return {"avg_ms": None, "max_ms": None, "hits": []}
    ms = [(t - g) * 1000 for t, g in pairs]
    return {"avg_ms": round(float(np.mean(np.abs(ms))), 1), "max_ms": round(float(np.max(np.abs(ms))), 1),
            "hits": [{"sec": round(g, 4), "offset_ms": round(m, 1)} for (_, g), m in zip(pairs, ms)]}


def _after(x, y, rate, times, shifts, targets, nudge, clip=None):
    """The new file measured again. Each hit's own sound (its first 30 ms, from the original) is looked
    for in the new file within FIND_AGAIN_SEC of where it was put, by cross-correlation; where it matches best is
    where it is now. Finding hits from scratch in the new file was unreliable (Ian, Oct 30: a soft hit after a ringing
    one wasn't found, and a neighbour's time made it "190 ms off"). A hit whose sound isn't there (match under
    MATCH_MIN) is left out and counted in "missing", never given someone else's time."""
    x, y = _mono(x), _mono(y)
    post, reach = int(0.03 * rate), int(FIND_AGAIN_SEC * rate)
    found, goal, missing = [], [], 0
    for t, d, g in zip(times, shifts, targets):
        if g is None:
            continue
        i = int(round(t * rate))
        seg = x[i:i + post]
        put = i + int(round(d * rate))
        lo, hi = max(0, put - reach), min(len(y), put + post + reach)
        area = y[lo:hi]
        if len(seg) < 8 or len(area) < len(seg) or not np.any(seg):
            missing += 1
            continue
        corr = np.correlate(area, seg, mode="valid")
        energy = np.sqrt(np.convolve(area ** 2, np.ones(len(seg)), mode="valid") * np.sum(seg ** 2)) + 1e-12
        k = int(np.argmax(corr / energy))
        if corr[k] / energy[k] < MATCH_MIN:
            missing += 1
            continue
        found.append(clip.song((lo + k) / rate) if clip else (lo + k) / rate)
        goal.append(g + nudge)
    return {**_offsets(found, goal), "missing": missing}


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
        # The fade in covers only the quiet gap before the hit, never the hit (a hit at 0 s has no gap)
        fin = min(fade, max(0, int(round(times[k] * rate)) - s))
        ramp = lambda n, up: (np.linspace(0, 1, n) if up else np.linspace(1, 0, n))[:, None] if seg.ndim == 2 else (np.linspace(0, 1, n) if up else np.linspace(1, 0, n))
        if len(seg) > 2 * fade:
            if fin:
                seg[:fin] *= ramp(fin, True)
            seg[-fade:] *= ramp(fade, False)
        a, b = max(0, ns), min(n, ns + len(seg))
        if b > a:
            out[a:b] += seg[a - ns:b - ns]
    return out


class ClipTime:
    """A clip's file seconds against song seconds (Ian, Oct 31: a 140 BPM loop warped to a 165 song was matched in
    its own file time). With Live's warp markers, a file moment is at the beat the markers put it on, counted from
    where the clip sits in the song; without them (not warped) the file plays as it is, from beat1 seconds in."""

    def __init__(self, tempo, warp=None, start_beat=None, start_marker=None, beat1=0.0):
        self.spb, self.start = 60.0 / tempo, float(start_beat or 0.0) * 60.0 / tempo
        self.marker, self.beat1 = float(start_marker or 0.0), float(beat1 or 0.0)
        w = sorted(((float(m["sample_time"]), float(m["beat_time"])) for m in (warp or [])))
        self.st, self.bt = (np.array([x[0] for x in w]), np.array([x[1] for x in w])) if len(w) >= 2 else (None, None)

    @staticmethod
    def _line(x, xs, ys):
        """Through the points, carried on straight past both ends"""
        if x <= xs[0]:
            return ys[0] + (x - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0])
        if x >= xs[-1]:
            return ys[-1] + (x - xs[-1]) * (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
        return float(np.interp(x, xs, ys))

    def song(self, t):
        if self.st is None:
            return self.start + (t - self.beat1)
        return self.start + (self._line(t, self.st, self.bt) - self.marker) * self.spb

    def file(self, s):
        if self.st is None:
            return s - self.start + self.beat1
        return self._line((s - self.start) / self.spb + self.marker, self.bt, self.st)


def _song_envelope(x, rate, clip, start, seconds):
    """A clip's waveform as heard in the song, 1 ms steps from song second start, 0 to 1 against its own loudest"""
    x = np.abs(_mono(x))
    ms = max(1, int(rate / 1000))
    env = np.r_[x, np.zeros((-len(x)) % ms)].reshape(-1, ms).max(axis=1)
    out = []
    for k in range(int(round(seconds * 1000))):
        i = int(clip.file(start + k / 1000) * 1000)
        out.append(float(env[i]) if 0 <= i < len(env) else 0.0)
    top = max(out) if out else 0.0
    return [round(float(np.sqrt(v / top)), 3) if top > 0 else 0.0 for v in out]


def _picture(audio, moved, rate, clip, step, anchor_info, song_times, targets):
    """One bar as producers see it in Live (Ian, Oct 31: the dots "look like random dots placed wherever"): the loop to
    follow on top, this loop before and after, as heard in the song (warping and all), 1 ms steps, and the lines every
    hit should sit on (where each was moved to). The bar shown is the one holding the hit that was furthest off."""
    bar = 16 * step
    offs = [(abs(g - t), t) for t, g in zip(song_times, targets) if g is not None]
    worst = max(offs)[1] if offs else (song_times[0] if song_times else 0.0)
    start = float(np.floor(worst / bar) * bar)
    lines = sorted({round(g - start, 4) for g in targets if g is not None and start <= g < start + bar})
    out = {"bar_sec": round(bar, 4), "step_sec": round(step, 5), "start_sec": round(start, 4), "lines_sec": lines,
           "before": _song_envelope(audio, rate, clip, start, bar), "after": _song_envelope(moved, rate, clip, start, bar), "anchor": None}
    if anchor_info:
        a, period = anchor_info["clip"], anchor_info["period"]
        # the same bar of the song, or of the other loop's repeat when it doesn't reach there
        a_start = start if a.start <= start < a.start + period else a.start + (start - a.start) % period
        out["anchor"] = _song_envelope(anchor_info["audio"], anchor_info["rate"], a, a_start, bar)
    return out


def match(moving_path, anchor, tempo, strength=1.0, nudge_ms=0.0, beat1_sec=None, out_dir=None, moving=None):
    """Move the moving loop's hits toward the anchor ({"kind": "straight"} or {"kind": "loop", "path", "warp"?,
    "start_beat"?, "start_marker"?}), write "<name> (matched).wav" in out_dir and measure it again. moving
    {warp, start_beat, start_marker} places this loop's clip in the song (Live's warp markers), so a loop at another
    tempo is matched as it's heard. Everything is timed in song seconds; offsets are what you hear.
    Returns {before, after, in_time, hits, hits_moved, out_path, grid, picture}."""
    beat1_sec, moving = beat1_sec or {}, moving or {}
    audio, rate = sf.read(str(moving_path), always_2d=True, dtype="float64")
    step = 60.0 / tempo / STEPS_PER_BEAT
    clip = ClipTime(tempo, moving.get("warp"), moving.get("start_beat"), moving.get("start_marker"), beat1_sec.get("moving", 0.0))
    times = onsets(audio, rate)
    if not times:
        raise ValueError("No hits found in that loop.")
    song_times = [clip.song(t) for t in times]
    if anchor.get("kind") == "loop":
        other, orate = sf.read(str(anchor["path"]), always_2d=True, dtype="float64")
        a_clip = ClipTime(tempo, anchor.get("warp"), anchor.get("start_beat"), anchor.get("start_marker"), beat1_sec.get("anchor", 0.0))
        bar = 16 * step
        length = a_clip.song(len(other) / orate) - a_clip.song(0.0)
        period = max(bar, round(length / bar) * bar)
        a_song = [a_clip.song(t) for t in onsets(other, orate)]
        targets = _targets(song_times, step, 0.0, a_song, period)
        anchor_info = {"audio": other, "rate": orate, "clip": a_clip, "period": period}
    elif anchor.get("kind") == "straight":
        targets = _targets(song_times, step, 0.0)
        anchor_info = None
    else:
        raise ValueError("Groove match can follow a straight grid or another loop.")

    nudge = nudge_ms / 1000.0
    # Where each hit goes, in the song, then back into the file: that's how far its slice moves
    goal = [(s + strength * (g - s) + nudge) if g is not None else s + nudge for s, g in zip(song_times, targets)]
    shifts = [clip.file(x) - t for x, t in zip(goal, times)]
    moved = _move(audio, rate, times, shifts)
    out_dir = Path(out_dir) if out_dir else Path(moving_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{Path(moving_path).stem} (matched).wav"
    sf.write(str(out_path), moved, rate, subtype="PCM_24")

    before = _offsets(song_times, targets)
    after = _after(audio, moved, rate, times, shifts, targets, nudge, clip)
    picture = _picture(audio, moved, rate, clip, step, anchor_info, song_times, targets)
    return {"before": before, "after": after, "grid": {"step_sec": round(step, 5), "beat1_sec": 0.0, "steps_per_bar": 4 * STEPS_PER_BEAT}, "picture": picture,
            # "Every hit within 5 ms" needs every hit heard again
            "in_time": after["max_ms"] is not None and after["max_ms"] <= IN_TIME_MS and after["missing"] == 0,
            "hits": len(times), "hits_moved": sum(1 for s, g in zip(song_times, targets) if g is not None and abs(g - s) * 1000 > 1.0),
            "out_path": str(out_path)}
