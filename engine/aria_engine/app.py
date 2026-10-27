import os
import threading
from contextlib import asynccontextmanager
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from pydantic import BaseModel
import soundfile as sf

from aria_engine import __version__, analysis, clarity, muse, split, stems

AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff"}
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
    allow_origins=["null"],
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


@app.post("/mix/analyze")
def mix_analyze(req: MixRequest):
    path = _audio_file(req.mix_path)
    if req.reference_path:
        # Reference comparison arrives in build step 4. Say so instead of ignoring it.
        raise HTTPException(501, "Comparing with a reference isn't built yet.")

    try:
        audio, rate = sf.read(str(path), always_2d=True, dtype="float64")
    except (RuntimeError, sf.LibsndfileError) as e:
        raise HTTPException(400, f"Can't read {path.name} as audio: {e}")
    measured = analysis.measure_array(audio, rate)
    found = find_clarity(audio, rate, req.tempo, req.start_beat, req.beats_per_bar or 4.0)

    context = {k: v for k, v in {"bars": req.bars, "tempo": req.tempo}.items() if v is not None}
    if "all" in measured["unmeasured"]:
        advice, advice_error = None, "Nothing to advise on: " + measured["unmeasured"]["all"]
    else:
        advice, advice_error = muse.advise(measured, context, findings=found["findings"])

    return {
        "recording": {"path": str(path), "start_beat": req.start_beat, "tempo": req.tempo, "bars": req.bars},
        "reference": None,
        "measured": measured,
        "clarity": found,
        "advice": advice,
        "advice_by": "Muse Spark" if advice else None,
        "advice_error": advice_error,
    }
