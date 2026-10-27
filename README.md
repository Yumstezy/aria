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

## Meta models used

- **Muse Spark** (`muse-spark-1.3`, Meta Model API): turns Aria's measurements into plain advice and a concrete fix, and drives Live through tool calling.
- **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`): hold-to-talk requests for Ask Muse.
- **Demucs** (`htdemucs`, Meta AI research): split mode separates the recording into vocals, drums, bass and other, so Aria can measure which sound covers which.
  - **License note:** the Demucs code is MIT, but its author says the license of the trained weights is not clear (they were trained partly on MUSDB, which is for research use). Aria uses it in this hackathon prototype only, for non-commercial use. The weights download from Meta on first use and are not part of this repo.
  - Split mode runs on the CPU (Apple's GPU backend doesn't support this model) and adds about 5 s to an 8-bar Check mix.

## Read first

- `CLAUDE.md`: what we're building and the rules, especially "No invented data"
- `docs/build-steps.md`: the order of work and each step's pass condition
- `docs/contracts.md`: the JSON between the device, engine and UI
- `docs/rubric.md`: how the hackathon is judged
- `docs/ml-plan.md`: the good mix vs bad mix model
