# Status

Updated at the end of each session: what passed, what's next, any blocker.

## In progress: Step 1, Day 1 tests (Oct 26)

Run with `engine/spikes/muse_spike.py`. The measurements in it are a test fixture and the audio is a generated test tone, so neither reaches the app.

**1.1 Muse Spark. Yes. Use `muse-spark-1.3` with `reasoning_effort: "minimal"`.**

| Model | Reasoning | Advice JSON | Time | Output tokens |
|---|---|---|---|---|
| muse-spark-1.1 | default | valid | 6.0 s | 1781 |
| muse-spark-1.1 | minimal | valid | 3.6 s | 808 |
| muse-spark-1.3 | default | **empty**, spent all 2000 tokens thinking | 8.0 s | 2000 |
| muse-spark-1.3 | minimal | valid | **2.5 s** | 540 |

- Both models followed the no-reference rule. They only stated measured values and flagged the true peak above 0 dBTP. Neither called anything too bright or too quiet.
- `response_format: {"type": "json_object"}` works.
- **Always set `reasoning_effort`.** With default reasoning, 1.3 can use up the whole token budget and return nothing. The engine must also treat an empty reply as "no advice", with the reason.
- The key must be created on dev.meta.ai under API keys. The first key Ian made was rejected (401); a fresh one worked.

**1.2 Muse Spark hears audio. No, not through the API today.**
- We tried `input_audio`, `audio_url` and `file` on Chat Completions, and `input_audio` and `input_file` on Responses, with both models.
- The request is accepted, but the audio is dropped silently. The prompt stays at 60 tokens and the model says no audio was attached.
- So the engine sends numbers only.
- **Idea to test later:** images do work, so Muse could look at a spectrogram picture drawn from the real audio.

**1.3 Tool calling. Yes, on both models.**
- "Make bars 1 to 16 the intro" became `set_section({"start_bar":1,"bars":16,"name":"Intro"})` in 0.8 s (1.1) and 1.2 s (1.3).

**1.4 Muse Voice Transcribe. Yes.**
- Endpoint: `POST https://api.meta.ai/v1/asr/transcribe`, multipart form with a `request` JSON part and an `audio` WAV part. Model `muse-voice-transcribe-1.0`.
- There's a `PUSH_TO_TALK` mode, which matches the hold-to-talk design. It costs $0.18 per hour of audio.
- A 4.2 s spoken request (made with the Mac's `say` command) came back in 2.0 s as: "Make bars one to 16 the intro, then cut the cut the harshness in the choruses." Close enough for Muse Spark to act on.
- **It only accepts mono 16-bit PCM WAV at 16 or 24 kHz.** 44.1 kHz, 48 kHz, 24-bit and float are all rejected with HTTP 400. Live records at 44.1 or 48 kHz, so the engine converts the recording to 16 kHz mono before sending.
- Voice can move up from stretch whenever Ask Muse is solid.

**1.5 to 1.8: the device files and guide are ready.**
- `device/spike/bridge_spike.js` and `device/spike/live_spike.js`. The bridge's HTTP code was tested against the running engine: it answered in 6 ms.
- Waiting on Ian to build the test device with `docs/max-guide-step1.md` and run the tests.

### Plan for the rest of Step 1

Pass condition: all eight questions have a written yes or no and a chosen path.

**1.4 Muse Voice Transcribe (Claude, no Max needed)**
- Find the endpoint in Meta's docs.
- Make a test recording with the Mac's built-in `say` command ("make bars one to sixteen the intro"), send it, and check the transcript.
- If there's no usable endpoint, voice stays stretch and Ask Muse is typed only.

**1.5 to 1.8 inside Live (Claude writes the code and a guide, Ian builds the test device)**

Claude writes these files in `device/spike/`:
- `bridge_spike.js`, for `node.script`: calls the engine's `/health` and prints the reply in the Max window. This answers 1.5.
- `live_spike.js`, for Max's `v8` object, which has the Live API built in. It answers the other three:
  - **1.6 Markers:** add a cue point at a given bar and name it. It checks for an existing marker first, because `set_or_delete_cue` deletes one that's already there.
  - **1.7 Clip file paths:** read `file_path` from the selected audio clip.
  - **1.8 Groove output:** try to create a new audio clip from a wav file on a track (`create_audio_clip`, which needs a recent Live 12).
- `docs/max-guide-step1.md`: a click-by-click guide for Ian:
  - create a Max Audio Effect on the master track
  - place about 6 objects
  - add one button per test
  - save the device as `device/spike/Aria Spike.amxd`
  - for each test: what to click, and what you should see in the Max window if it worked

Ian runs the tests in Live 12.4 (Max 9.1.4) and reports what the Max window says. Claude writes the answers here.

**What happens with the answers**
- If 1.5 fails, the device and engine talk through a JSON file the device checks instead of HTTP.
- If 1.8 fails, Groove match writes the fixed loop to `test-pack/out/` for you to drag in.
- Everything that passes becomes the base of the real `Aria.amxd` in Step 2.

## Done: Step 0, repo and tooling (Oct 26)

Passed on Ian's Mac:
- `./install.sh` set up `engine/.venv` with Python 3.11.14 and started the engine.
- `/health` answers on 127.0.0.1:8765.
- `pytest`: 4 passed.
- `ui/index.html` opens in Chrome and shows "Engine connected" live.

One change from the plan below: the first-run Home is simpler than the screenshot. Six tiles all saying "nothing yet" was hard to read. It now shows two tiles:
- **A "Get started" checklist.** The first item ticks when the engine is really running.
- **The reference drop zone.**

The results tiles (section map, Fix first, tool status) come back once there's real data for them.

### Original Step 0 plan

Pass condition (from `docs/build-steps.md`): `uvicorn` serves `/health`, `pytest` runs, and `ui/index.html` opens in Chrome and looks like the Home screenshot, with empty states where data will go.

### What's being built

**Install**
- `install.sh` at the repo root. It finds Python 3.11, creates `engine/.venv`, installs the engine's dependencies, copies `engine/.env.example` to `engine/.env` if there isn't one, and starts the engine on `127.0.0.1:8765`.
- `engine/run.sh` starts the engine again later, without reinstalling.
- Ian's Mac only has Python 3.9 right now, so this step installs Python 3.11 with Homebrew (`brew install python@3.11`).

**Engine** (`engine/`)
- `requirements.txt`, which installs:
  - fastapi and uvicorn: the web server
  - python-dotenv: lets uvicorn read `.env`
  - pytest and httpx: tests
  - The audio libraries (numpy, soundfile, pyloudnorm and the rest) come in Step 2, when something first uses them.
- `.env.example` with `MODEL_API_KEY`, `MUSE_BASE_URL` and `MUSE_MODEL`, all blank or defaulted. The real `.env` is gitignored.
- `aria_engine/app.py`: the FastAPI app with `GET /health`. It returns the engine version and whether a Muse key is set (true or false, never the key itself), so the UI can say honestly why advice is unavailable.
- CORS allows only the UI: `file://` pages (which includes `jweb`) and localhost. Other websites in your browser can't call the engine.
- `tests/test_health.py` and `pytest.ini`.

**UI** (`ui/`)
- `index.html`: the Aria window with the Home screen. It has the side rail (Home, Mix check, Live analyzer, Groove match, Reference, Ask Muse) and matches the Home screenshot's layout, but every data spot shows an empty state:
  - **Reference card:** "No reference yet" and the drop zone.
  - **Tool cards:** "Not run yet".
  - **Section grid and Fix first:** "Run Check mix to see this".
  - **No numbers anywhere** until the engine sends them.
- `strip.html`: the 169px device strip in the Night theme, with Check mix, Ask, Open window and the same empty states.
- `app.js`: shared code.
  - It checks `/health` and shows whether the engine is connected.
  - It talks to Max through `window.max` when running inside Live. In a normal browser it calls the engine directly.
  - Check mix only says "not built yet" until Step 2.
- The UI uses `design/ds/tokens.css`, `bundle.css` and `bundle.js` as they are, with no build step.
- Theme: Sky by default. Adding `?theme=night` to the URL forces Night for development.

**Test pack** (`test-pack/`)
- `answer-key.json` in the shape from `docs/contracts.md`, with empty lists. The teammate fills in the real values once the real files exist. No made-up entries.
- `README.md` saying what goes in the folder and that we must own everything in it.

**Repo**
- A short `README.md` so teammates landing on GitHub know what this is and how to run it.

### How to check it yourself
1. Run `./install.sh` from the repo root. It should end with the engine running on 127.0.0.1:8765.
2. Open http://127.0.0.1:8765/health in a browser. You should see `"status": "ok"`.
3. In a second terminal: `cd engine && .venv/bin/pytest`. All tests pass.
4. Open `ui/index.html` in Chrome. It should look like `design/screens/01-home.png`, but with empty states instead of numbers, and show "Engine connected".
5. Stop the engine and reload the page. It should say the engine isn't running.

## Next
- Step 1: the Day 1 tests. To start them, Ian needs to say how the `.amxd` gets built (Ian wires it in Max from a guide, or Claude generates it) and which Max version is installed.

## Decisions so far
- The build started Oct 26.
- The build order follows `docs/rubric.md`. Ask Muse driving Live is core (Step 6). Groove match stays (Step 9).
- With no reference, Check mix shows raw measurements with no verdict.
- The repo is public from the start, so `.env` and tester audio are gitignored.
- Ian has Live 12 Suite and a Meta API key.

## Blockers
- None yet.
