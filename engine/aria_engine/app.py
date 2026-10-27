import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from aria_engine import __version__

app = FastAPI(title="Aria engine", version=__version__)

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
