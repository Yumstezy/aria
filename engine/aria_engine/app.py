import os
import threading
from contextlib import asynccontextmanager
import time
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import pyloudnorm as pyln
from pydantic import BaseModel
import soundfile as sf

from aria_engine import __version__, analysis, ask, clarity, muse, reference, sections, split, stems, voice

AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff"}
# When the code this engine runs was last changed. The bridge compares it with the files on disk
# and restarts an engine that's running old code (a Live session can outlive an update).
CODE_TIME = max(f.stat().st_mtime for f in Path(__file__).parent.glob("*.py"))
MAX_FILE_BYTES = 500 * 1024 * 1024

@asynccontextmanager
async def lifespan(app):
    split.warm_up()   # load Demucs in the background so the first Check mix isn't slow
    yield


app = FastAPI(title="Aria engine", version=__version__, lifespan=lifespan)


def exit_with_parent(pid, interval=2.0):
    """When the Aria device starts the engine, it passes its process id.
    If that process disappears (Live quit or crashed), stop the engine too."""
    def watch():
        while True:
            time.sleep(interval)
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                os._exit(0)
            except PermissionError:
                pass  # still running, owned by someone else
    threading.Thread(target=watch, daemon=True, name="exit-with-parent").start()


if os.environ.get("ARIA_PARENT_PID", "").isdigit():
    exit_with_parent(int(os.environ["ARIA_PARENT_PID"]))

# Only the Aria UI may call the engine: pages opened from disk (file:// sends
# Origin "null", and so does jweb) and pages served from this machine.
# Any other site open in the browser is refused.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null", "file://"],   # a file page's origin: Chrome says "null", Live's web view says "file://"
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    # Report whether a key is set, never the key, so the UI can say why advice is unavailable.
    return {
        "status": "ok",
        "version": __version__,
        "pid": os.getpid(),
        "code_time": CODE_TIME,
        "muse": {
            "key_set": bool(os.environ.get("MODEL_API_KEY", "").strip()),
            "model": os.environ.get("MUSE_MODEL") or None,
        },
    }


class MixRequest(BaseModel):
    mix_path: str
    start_beat: Optional[float] = None
    tempo: Optional[float] = None
    bars: Optional[int] = None
    beats_per_bar: Optional[float] = None
    reference_path: Optional[str] = None
    reference_name: Optional[str] = None   # the song's own file name (the engine stores it under another)
    # Arrangement (build step 8b): only this stretch of the reference, in seconds: its part matching the checked one
    reference_window: Optional[List[float]] = None
    reference_part: Optional[str] = None
    # Key tracks mode (Aria Ear, build step 4): {track name: wav path}, recorded at the same moment as mix_path
    tracks: Optional[Dict[str, str]] = None
    # Which of those tracks Live says had clips playing in these bars (null: Live couldn't say, a group say)
    tracks_playing: Optional[Dict[str, Optional[bool]]] = None


def _audio_file(path_str):
    path = Path(path_str).expanduser()
    if path.suffix.lower() not in AUDIO_EXTENSIONS:
        raise HTTPException(400, f"Aria reads wav and aiff files. Got {path.name}.")
    if not path.is_file():
        raise HTTPException(400, f"No file at {path}.")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise HTTPException(400, f"{path.name} is too big to analyze.")
    return path


SPLIT_TOP_N = 4


def find_clarity(audio, rate, tempo, start_beat, beats_per_bar):
    """Master mode always. Split mode on top when Demucs is installed (build step 3b)."""
    timing = dict(tempo=tempo, start_beat=start_beat, beats_per_bar=beats_per_bar)
    found = clarity.analyze(audio, rate, **timing)
    found["mode"] = "master"
    found["spectra"] = stems.spectra({"mix": audio}, rate)
    if not split.available():
        return found
    stem_audio, stem_rate = split.separate(audio, rate)
    if stem_audio is None:
        found["split_error"] = stem_rate
        return found
    # Each part's level against the whole mix, for the Detailed view
    mix_power = sum(np.mean(np.asarray(a, dtype=np.float64) ** 2) for a in stem_audio.values())
    found["stems"] = {name: round(float(10 * np.log10(np.mean(np.asarray(a, dtype=np.float64) ** 2) / mix_power + 1e-12)), 1)
                      for name, a in stem_audio.items()}
    found["space"] = stems.space(stem_audio, stem_rate)
    found["spectra"] = stems.spectra(stem_audio, stem_rate)
    split_found = stems.masking(stem_audio, stem_rate, relevant=stems.SPLIT_RELEVANT, **timing)
    split_found += stems.bass_clicks(stem_audio["bass"], stem_audio["drums"], stem_rate, **timing)
    for f in split_found:
        f.pop("score", None)
    # Split findings first: they're the relationships producers hear (buried vocal, mud, clicks).
    found["findings"] = (split_found + found["findings"])[:SPLIT_TOP_N]
    found["mode"] = "split"
    found["split_by"] = "Demucs (Meta AI research), htdemucs"
    return found


TRACKS_TOP_N = 4


def find_tracks(paths, rate, audio, timing, playing=None):
    """Key tracks mode: the producer's own tracks, by name. Clashes first (neither track stands clear),
    then a track covered by another, then what the master shows."""
    sounds = {}
    for name, p in paths.items():
        try:
            x, r = sf.read(str(_audio_file(p)), always_2d=True, dtype="float64")
        except (RuntimeError, sf.LibsndfileError) as e:
            raise HTTPException(400, f"Can't read the recording of {name}: {e}")
        if r != rate:
            raise HTTPException(400, f"{name} was recorded at {r} Hz, Main at {rate} Hz.")
        sounds[name] = x
    n = min(len(x) for x in sounds.values())
    sounds = {k: v[:n] for k, v in sounds.items()}
    master = clarity.analyze(audio, rate, **timing)
    # The producer's own tracks have no separation bleed: quiet isn't absent, only silence (or Live's "no clips") is
    found_clash = stems.clashes(sounds, rate, relative=False, playing=playing, **timing)
    found_cover = stems.masking(sounds, rate, relative=False, playing=playing, **timing)
    for f in found_clash + found_cover:
        f.pop("score", None)
    master["findings"] = (found_clash + found_cover + master["findings"])[:TRACKS_TOP_N]
    master["mode"] = "tracks"
    master["tracks"] = list(sounds)
    master["spectra"] = stems.spectra(sounds, rate, relative=False, playing=playing)
    return master


@app.post("/reference")
async def reference_keep(request: Request, name: str = "reference.wav"):
    """A reference song dropped on the window (build step 8): the raw file in the body. Kept on this Mac
    under ~/Library/Application Support/Aria/references, so later checks can name it by path."""
    raw = await request.body()
    if not raw or len(raw) > MAX_FILE_BYTES:
        raise HTTPException(400, "Send the song as the request body.")
    try:
        path, seconds = reference.keep(raw, name)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"path": str(path), "name": Path(name).name, "seconds": seconds}


def compare_with(ref_path, audio, rate, bars, name=None, window=None, part=None):
    """The reference block of a result, and its findings for the problem list."""
    path = Path(ref_path).expanduser()
    if not path.is_file():
        raise HTTPException(400, f"The reference song isn't at {path} any more. Choose it again on the Reference screen.")
    try:
        ref_audio, ref_rate = reference.read(path)
    except (RuntimeError, sf.LibsndfileError) as e:
        raise HTTPException(400, f"Can't read the reference {path.name}: {e}")
    if window and len(window) == 2 and window[1] > window[0]:
        a, b = int(window[0] * ref_rate), int(window[1] * ref_rate)
        if b - a >= ref_rate * 2:   # at least two seconds of it, or compare with the whole song
            ref_audio = ref_audio[a:b]
        else:
            part = None
    else:
        part = None
    out = reference.compare(audio, rate, ref_audio, ref_rate)
    for f in out["findings"]:
        if bars:
            f["bars"] = bars
    return {"name": name or path.name, "path": str(path), "part": part, **out}


@app.post("/mix/analyze")
def mix_analyze(req: MixRequest):
    path = _audio_file(req.mix_path)

    try:
        audio, rate = sf.read(str(path), always_2d=True, dtype="float64")
    except (RuntimeError, sf.LibsndfileError) as e:
        raise HTTPException(400, f"Can't read {path.name} as audio: {e}")
    measured = analysis.measure_array(audio, rate)
    timing = dict(tempo=req.tempo, start_beat=req.start_beat, beats_per_bar=req.beats_per_bar or 4.0)
    if req.tracks and len(req.tracks) >= 2:
        found = find_tracks(req.tracks, rate, audio, timing, req.tracks_playing)
    else:
        found = find_clarity(audio, rate, req.tempo, req.start_beat, req.beats_per_bar or 4.0)

    # With a reference, what stands out against it leads the list: the producer asked for that comparison
    ref = compare_with(req.reference_path, audio, rate, found.get("bars"), req.reference_name,
                       req.reference_window, req.reference_part) if req.reference_path else None
    if ref and ref["findings"]:
        found["findings"] = (ref["findings"] + found["findings"])[:SPLIT_TOP_N + 1]

    context = {k: v for k, v in {"bars": req.bars, "tempo": req.tempo}.items() if v is not None}
    if "all" in measured["unmeasured"]:
        advice, advice_error = None, "Nothing to advise on: " + measured["unmeasured"]["all"]
    elif ref:
        advice, advice_error = muse.advise(measured, context, findings=found["findings"],
                                           reference={"name": ref["name"], "bands": ref["bands"]})
    else:
        advice, advice_error = muse.advise(measured, context, findings=found["findings"])

    return {
        "recording": {"path": str(path), "start_beat": req.start_beat, "tempo": req.tempo, "bars": req.bars},
        "reference": ref and {k: ref[k] for k in ("name", "path", "part", "bands", "curve", "error")},
        "measured": measured,
        "clarity": found,
        "advice": advice,
        "advice_by": "Muse Spark" if advice else None,
        "advice_error": advice_error,
    }


class SectionsRequest(BaseModel):
    wav_path: str
    # The producer's song: Live's tempo and where the recording started. A reference file leaves them out.
    tempo: Optional[float] = None
    start_beat: Optional[float] = 0.0
    beats_per_bar: Optional[float] = 4.0


_sections_cache = {}   # a reference's parts, by file and its change time: a song doesn't change between checks


@app.post("/sections")
def song_sections(req: SectionsRequest):
    """The song's parts (Arrangement, build step 8b): where each starts and stops, with Muse Spark's names."""
    path = Path(req.wav_path).expanduser()
    if not path.is_file():
        raise HTTPException(400, f"No file at {path}.")
    key = (str(path), path.stat().st_mtime, req.tempo, req.start_beat)
    if key in _sections_cache:
        return _sections_cache[key]
    try:
        audio, rate = reference.read(path)
    except (RuntimeError, sf.LibsndfileError) as e:
        raise HTTPException(400, f"Can't read {path.name} as audio: {e}")
    out = sections.find(audio, rate, tempo=req.tempo, start_beat=req.start_beat or 0.0, beats_per_bar=req.beats_per_bar or 4.0)
    names, names_error = muse.name_sections(out["sections"]) if out["sections"] else (None, out["error"])
    for s, n in zip(out["sections"], names or []):
        s["name"] = n
    out.update(names_by="Muse Spark" if names else None, names_error=names_error, path=str(path))
    if names or not out["sections"]:
        _sections_cache[key] = out
    return out


class Take(BaseModel):
    path: str
    start_beat: float = 0.0


class BeforeAfterRequest(BaseModel):
    before: Take
    after: Take
    tempo: float
    bars: int = 16
    findings: list = []


@app.post("/mix/before-after")
def before_after(req: BeforeAfterRequest):
    """The same bars after a fix (Oct 30): both takes lined up beat for beat, loudness matched, and how much each
    problem's range changed. Negative change_db: less of it than before."""
    takes = []
    for t in (req.before, req.after):
        try:
            x, r = sf.read(str(_audio_file(t.path)), always_2d=True, dtype="float64")
        except (RuntimeError, sf.LibsndfileError) as e:
            raise HTTPException(400, f"Can't read {Path(t.path).name}: {e}")
        takes.append((x, r, t.start_beat))
    (bx, br, bb), (ax, ar, ab) = takes
    if br != ar:
        raise HTTPException(400, "The two takes were recorded at different sample rates.")
    # Line up on the beat: the later-starting take sets where both begin
    sec_per_beat = 60.0 / req.tempo
    start = max(bb, ab)
    bx, ax = bx[int(round((start - bb) * sec_per_beat * br)):], ax[int(round((start - ab) * sec_per_beat * ar)):]
    n = min(len(bx), len(ax), int(req.bars * 4 * sec_per_beat * br))
    if n < br * 2:
        raise HTTPException(400, "The two takes don't overlap enough to compare.")
    bx, ax = bx[:n], ax[:n]
    out = reference.compare(ax, ar, bx, br)          # after against before, both at the same loudness
    if out["error"]:
        raise HTTPException(400, out["error"])
    # Each problem's range, from the fine curve (after minus before, loudness matched)
    hz = np.array(out["curve"]["hz"]); diff = np.array(out["curve"]["mine"]) - np.array(out["curve"]["ref"])
    problems = []
    for i, f in enumerate(req.findings):
        lo, hi = (f.get("hz_range") or [None, None])[:2]
        sel = (hz >= lo) & (hz <= hi) if lo and hi else np.zeros(len(hz), bool)
        problems.append({"index": i, "kind": f.get("kind"), "hz_range": [lo, hi],
                         "change_db": round(float(diff[sel].mean()), 1) if sel.any() else None})
    meter = pyln.Meter(br)
    lufs = lambda x: round(float(meter.integrated_loudness(x)), 1)
    return {"curve": out["curve"], "bands": out["bands"], "problems": problems, "seconds": round(n / br, 1),
            "lufs": {"before": lufs(bx), "after": lufs(ax)}}


class AskRequest(BaseModel):
    text: str
    context: dict = {}


@app.post("/muse/ask")
def muse_ask(req: AskRequest):
    """Ask Muse: returns checked tool calls for the device to apply, and suggestions."""
    return ask.ask(req.text, req.context)


@app.post("/voice/transcribe")
async def voice_transcribe(request: Request):
    """A spoken request (the raw WAV in the body) as text, by Muse Voice Transcribe."""
    raw = await request.body()
    if not raw or len(raw) > MAX_FILE_BYTES:
        raise HTTPException(400, "Send the recording as the request body.")
    try:
        return {"text": voice.transcribe(raw)}
    except voice.VoiceError as e:
        raise HTTPException(400, str(e))
