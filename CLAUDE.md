# Aria

Aria is an AI co-producer for Ableton Live: a Max for Live device on the master channel. It finds clarity problems in the producer's mix, meaning sounds that clash or stick out, and where they happen. Muse Spark explains what to fix in plain words and can apply the fix. Comparing with a reference track is optional. See "Why the plan changed" in `docs/build-steps.md`. Built for the Meta Global AI Developer Hackathon, Indie track.

- Build window: Oct 26 to Nov 4, 2026. Feature freeze end of day Nov 2. Submit by noon PT Nov 4.
- Only code written from Oct 26 onward goes in the repo. Commit often, with clear messages, so the history shows the build window.
- The 3 minute demo video is what judges see. Every task exists to make a demo beat work on camera. Anything else waits until after Nov 4.

## First milestone: the bare bones

Before any feature work, get one thin path working end to end, on Ian's Mac, inside Ableton:

1. **Install:** one script sets up the engine (Python venv, dependencies, `.env` from `.env.example`) and starts it on `127.0.0.1:8765`. One `.amxd` file goes on the master track.
2. **Inside Ableton:** the device sits on the master channel, passes audio through untouched, and shows the strip UI in `jweb`.
3. **Ableton API:** the device reads tempo, song position and play state through the Live API, and can move the playhead and add a named marker.
4. **Engine:** on Check mix, the device records a few bars of the master to a wav and sends the path to the engine. The engine measures it (loudness, true peak, band balance, width).
5. **Muse API:** the engine sends those measurements to Muse Spark and gets advice JSON back.
6. **Back in Live:** the result shows in the strip.

Done means a real Check mix in Live shows real measurements and real Muse Spark advice, three times in a row. Bugs after that are expected and fine.

## Muse Spark API (checked Oct 26)

- Meta's Model API is OpenAI compatible.
  - Base URL: `https://api.meta.ai/v1`
  - Key: the env var `MODEL_API_KEY`
  - Client: the `openai` Python package with `base_url` set
- Model IDs: `muse-spark-1.1` (in Meta's examples) and `muse-spark-1.3` (newer). Keep the model in an env var, `MUSE_MODEL`.
- Endpoints: Chat Completions and Responses both work. Tool calling is supported. Images work through `image_url` content parts.
- Audio input isn't documented in Meta's post. Assume we send measurements, not audio, until a day 1 test proves otherwise.
- Muse Voice Transcribe: no public docs found yet. Voice stays a stretch goal until we find the endpoint.
- Sources: https://dev.meta.ai/resources/blog/build-with-muse-spark and https://www.promptfoo.dev/docs/providers/meta/

## No invented data

This is a hard rule for code, tests, UI and the video.

- The engine reports only what it measured from real audio. If it can't measure something, it says so and returns null. It never fills in a plausible number.
- With no reference track, the engine compares nothing and calls nothing too bright or too quiet. Comparisons need a reference.
- Muse Spark gets only measured numbers, and its prompt says to use only those. Validate its JSON. If the call fails or there's no key, show "no advice" and the reason. Never fall back to canned advice text.
- The UI never shows example numbers outside a development mode clearly labeled as such. The numbers in `design/screens/` are illustrations for layout only. Don't copy them into code as data.
- Tests may generate test tones. Those stay in tests and never reach the app.
- The model training work (see `docs/ml-plan.md`) uses only real mixes with real ratings from our testers.

## Read these first

- `docs/rubric.md`: how judges score us. Use of Meta AI is 25%, so Muse Spark does visible work in every demo beat.
- `docs/build-steps.md`: the order of work. Each step has a pass condition. Work on one step at a time and don't start the next until the current one passes.
- `docs/contracts.md`: the JSON that moves between the device, the bridge, the engine and the UI. Keep to it. Change it only on purpose, and update the doc in the same commit.
- `docs/screens.md`: what each screen does. The pixels are in `design/screens/*.png` and `*.html`.
- `DESIGN.md`: the short design reference (type, color, space, voice). `design/ds/README.md` has the full rules.
- `docs/design-fixes.md`: the latest design corrections (round 1, Oct 27). The layouts are in `design/screens/10` to `12`. Aria fills them with its own findings, not a reference comparison, until the reference step is built.
- `design/ds/README.md`: design rules. "Say it plainly" is the most important section.
- `docs/ml-plan.md`: the good mix vs bad mix model. It's a parallel track for the teammate who knows ML, and it plugs into the engine later.

## Architecture

```
Ableton Live
  master track
    Aria.amxd (Max for Live audio effect)
      plugin~ -> sfrecord~        records the master to a wav while Mix check runs
      live.path / live.object     Live API: tempo, song time, cue points, clip file paths, EQ Eight params
      jweb (strip, 400 x 169)     the device strip UI
      jweb (window, opened)       the full Aria window
      node.script bridge.js       HTTP to the engine, routes messages to jweb and the Live API
  key tracks (optional)
    Aria Ear.amxd                 records its track with Main at Check mix, by name (send aria_ear / aria_ear_back)
                 |
                 | HTTP JSON on 127.0.0.1:8765
                 v
engine/ (Python, FastAPI)
  analysis: loudness, bands, width, sections, timing
  muse.py: Muse Spark client. Returns JSON only, validated against the action menu
```

- Send file paths, not audio. The engine is local, so the device writes a wav and sends its path.
- Only Mix check records the master. Groove match and Reference breakdown read the clips' own files through `Clip.file_path`.
- Store the song position when recording starts, so every finding maps back to a bar.
- Muse Spark never edits anything directly. It returns actions from a fixed menu (see contracts). The device checks each action, applies it, and keeps an undo.

## Repo layout

```
device/        Aria.amxd, bridge.js (node.script), live helpers
ui/            the jweb app: index.html (window), strip.html, app.js, views/, charts from design/ds/components/bundle.js
engine/        FastAPI app, analysis modules, muse.py, tests/
design/        design system, screen references, brand marks (read only, from the design phase)
test-pack/     demo song, test mixes, loop pairs, reference, answer-key.json (we own all of it)
ml/            dataset manifest, labels, feature extraction, training, evaluation (see docs/ml-plan.md)
docs/          build steps, contracts, screens
```

## UI rules

- The UI is React + TypeScript + Tailwind, built with Vite (decided Oct 27 with Ian, so we can use components like 21st.dev and shadcn, and `motion`, and keep the interactive screens tidy).
  - Code lives in `ui/src/`, and components go in `ui/src/components/ui/` (shadcn layout).
  - `npm run build` in `ui/` turns each screen into one self-contained HTML file in `ui/dist/` (`strip.html`, `index.html`), with code, styles and fonts inside.
  - Max's `jweb` loads those files from disk, because module scripts won't load over `file://`.
  - `ui/dist/` is committed, so running Aria never needs Node. Only changing the UI does.
  - It all runs inside Live's built-in web view, not a browser app.
- Use `design/ds/tokens.css` and `design/ds/components/bundle.css` as they are. Class names start with `cp-`, an internal code name. Keep it.
- Charts come from `window.CoProducer` in `design/ds/components/bundle.js` (spectrum, sectionMap, energy, stereo, timing, arrangement, analyzer). Feed them the engine's JSON.
- Talk to Max with `window.max.outlet(...)` and `window.max.bindInlet(...)`. Guard for `window.max` being missing. In a normal browser, the UI calls the engine directly with a real wav path, so we develop fast without Live and still see only real results.
- Dark (Night) is the default theme (Ian, Oct 27, after trying both). Light (Sky) is an option the producer picks with the Light / Dark switch at the bottom of the side rail. The bridge saves the choice in `window.json` and applies it to the window and the strip. Set `data-theme` on the root.
- Docked windows and the popped-out chat are see-through glass over Live (Ian, Oct 27). The full window and the strip paint the ground and orbs.
- Mix check opens in Simple view: a plain verdict first, then the numbers. Detailed view is one tap away.
- Ask Muse is a pop-up over the current screen, never a separate page.
- The product name on screen is Aria. The logo isn't chosen yet, so keep the placeholder bars icon.

## Engine rules

- Python 3.11, FastAPI, uvicorn, numpy, scipy, soundfile, librosa, pyloudnorm. Add a library only when a step needs it, and note why in the commit.
- Every endpoint has a test that runs on files from `test-pack/`. `pytest` must pass before a step counts as done.
- Today's clarity findings (buried, mud, harsh, ringing, clicks) come from measurement rules, version 1. They are not the finished product (Ian, Oct 27): the mix model trained on rated mixes (`docs/ml-plan.md`, `ml/`) is what makes the data accurate. Keep the UI fed by data shapes the model can fill (the band row, the problem cards), and wire `POST /mix/score` in after the Oct 31 checkpoint if the model beats its baselines.
- Third-party plugins (Oct 27, Ian): Aria changes only Live's own devices. For a plugin the producer names, Muse shows how it should look (`plugin_guide`: the EQ curve and bands from one of the producer's own presets, or a stated starting point) and the producer sets it. The Remote Script in `device/remote/` that loaded plugins is on hold.
- Analysis returns numbers. Words come from Muse Spark only. If the model is down, the UI shows the measurements and says advice is unavailable.
- Loudness is LUFS (pyloudnorm). Before and after comparisons are always loudness matched.
- Read secrets from environment variables (`MODEL_API_KEY`, `MUSE_BASE_URL`, `MUSE_MODEL`). Never commit them. Keep a `.env.example`.

## Writing rules for anything a user sees

- Plain words first: "Your choruses are too bright", then "+3.8 dB at 2 to 5 kHz" as the detail.
- Short sentences. No emojis. No em dashes.
- Buttons say what will happen: "Fix it for me", "Add 7 markers to Live".
- If the producer asks Muse for a change, it happens right away with Undo. Anything Muse suggests on its own waits for a yes.

## Licenses

- Never add SF Pro, Helvetica, Coolvetica or Lemon Milk font files. On a Mac the system font gives the SF look. Geist is bundled under the OFL.
- Rubber Band is GPL. If we use it, call it as a separate command-line tool. Don't link it.
- Demucs (split mode): the code is MIT, but the model weights' license is unclear, per its author. Use it for the prototype only, say so in the README, and never commit the weights.
- No commercial music anywhere in the repo or the video.

## How to work

- Before coding a step, restate its pass condition and list the files you will touch.
- Prefer the smallest thing that passes. We have 9 days and one builder.
- When something in Live or Max can't be tested from the terminal, write down the exact manual check for Ian (what to click, what should happen) instead of guessing.
- Keep `docs/status.md` updated at the end of each session: what passed, what's next, any blocker.
