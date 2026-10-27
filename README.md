# Aria

An AI co-producer for Ableton Live, built for the Meta Global AI Developer Hackathon (Indie track), Oct 26 to Nov 4, 2026.

Aria is a Max for Live device on the master channel. It compares your mix with a reference track, section by section, and Meta's Muse Spark tells you what to fix in plain words. Ask Muse can then make the change in Live for you, with Undo.

Work in progress. See `docs/status.md` for where things stand.

## Run it (Mac)

You need Python 3.11 (`brew install python@3.11`).

```sh
./install.sh
```

This sets up the engine and starts it on http://127.0.0.1:8765. Put your Meta Model API key in `engine/.env` (created on first run), then restart the engine with `engine/run.sh`.

- Tests: `cd engine && .venv/bin/pytest`
- UI without Live: open `ui/index.html` (window) or `ui/strip.html` (device strip) in Chrome. Add `?theme=night` for the dark theme.

## Read first

- `CLAUDE.md`: what we're building and the rules, especially "No invented data"
- `docs/build-steps.md`: the order of work and each step's pass condition
- `docs/contracts.md`: the JSON between the device, engine and UI
- `docs/rubric.md`: how the hackathon is judged
- `docs/ml-plan.md`: the good mix vs bad mix model
