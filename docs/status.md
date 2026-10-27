# Status

Updated at the end of each session: what passed, what's next, any blocker.

## Done: Step 1, Day 1 tests (Oct 26)

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

**1.5 Device talks to the engine. Yes.** `node.script` POSTs and GETs to 127.0.0.1:8765 in 1 to 34 ms inside Live 12.4.

**1.6 Markers. Adding works. Naming isn't confirmed yet.**
- Moving the playhead (`current_song_time`) and `set_or_delete_cue` both work. Ian saw the playhead jump and the marker appear.
- **Live applies Live API changes a moment after the call.** Reading straight back returns the old value.
- **Max timers (`Task`) fired late inside the device.** Several fired in one burst seconds later. So the check never got to name the marker.
- Chosen path: no timers. Use Live API observers, which notify the device when something changes: watch `cue_points`, then name the new cue when it appears. Confirm naming in Step 2.

**1.7 Clip file paths. Yes.** `live_set view detail_clip` → `file_path` gave `/Users/ianbarrie/Downloads/BELIEVE IT STEMS/6 SOFT TRANCE SYNTH.wav`. MIDI clips are correctly refused.

**1.8 Create an audio clip from a file. Yes, in Arrangement.** `Track.create_audio_clip(path, beat)` added a clip at beat 416 on Live 12.4. Groove match writes the fixed loop straight into the set. The drag-it-in fallback isn't needed.

**Other findings**
- **The Max editor wouldn't open from Live on Ian's Mac** (Max ran with no window). Max's settings were reset; the old ones are in `~/Library/Application Support/Cycling '74/Max 9/Settings.backup-2026-10-26`.
- We don't need the editor anyway. `device/tools/make_spike_amxd.py` builds the `.amxd` from Live's own blank Max Audio Effect, and Live loads it fine.
- Everything the device prints also lands in `~/Library/Application Support/Cycling '74/Max 9/Logs/MaxPlugLib.log`, so Claude can read test results without screenshots.
- `node.script` output didn't show in a message box in the test device, but v8 output did. The real device sends Node output to `jweb`, so check that route in Step 2.

Step 1 passes: all eight questions have an answer and a chosen path.

## Done: Step 2, bare bones round trip (Oct 26)

Passed on Ian's Mac in Live 12.4:
- **The engine starts by itself:** dragging `device/Aria.amxd` onto Main starts it with no terminal open.
- **Check mix works:** it recorded 8 bars, measured them, and Muse Spark advised, 7 times on two projects.
- **Verified against a third-party meter:** Youlean Loudness Meter 2 on the same Main read -6.9 LUFS integrated and -7.3 short term. Aria read -6.6 LUFS over 8 bars. Youlean's true peak max was +1.6 over a longer window; Aria read +1.0 dBTP for its 8 bars.
- **Muse's advice on that mix:** "Your true peak will clip on export, so pull the master down before anything else." That's an objective finding, made without a reference track.

Found and fixed along the way:
- **Aria only hears what's before it in the chain.** It first read -13.5 LUFS against Youlean's -6.7 because it sat before other devices on Main. `live.js` now reports Aria's track and the devices after it, and the strip shows "Move Aria last" or "Not on Main". Ian's chain is now `masteringableton → Washed Out → Youlean → Endless Smile → Aria`.
- **The meter is calibrated:** EBU Tech 3341 test 1 reads -23.0 LUFS, and that's now a test.
- **Recordings are float32,** so overs above 0 dBFS inside Live aren't capped at 0.
- **The strip is laid out at the real 700 px device width.**

Still to confirm: "Mark bar N in Live" names the marker "Aria check", using the observer approach from 1.6.

### Original Step 2 plan

Pass: on Ian's Mac, with no terminal open, dragging Aria onto Main starts the engine. Check mix then shows real measurements and real Muse Spark advice in the strip, three times in a row, under 15 s from the end of the recording.

### What's being built

**Engine** (`engine/`)
- Adds numpy, scipy, soundfile and pyloudnorm for measuring audio.
- `aria_engine/analysis.py` measures a wav:
  - integrated loudness (LUFS)
  - true peak (dBTP, 4x oversampled)
  - Bass (below 250 Hz), Mids (250 Hz to 2 kHz) and Treble (above 2 kHz) levels in dB
  - width per band (side energy share, 0 is mono)
  - Anything it can't measure, like silence, comes back as null with a reason.
- `aria_engine/muse.py`: the Muse Spark client.
  - `muse-spark-1.3`, minimal reasoning, JSON only.
  - Measured numbers only. With no reference, it may not call anything too bright or too quiet.
  - The reply is validated. No key, a failure, an empty reply or invalid JSON all mean `advice: null` plus the reason. No canned text.
- `POST /mix/analyze`: takes the recorded wav's path and returns the measurements and Muse's advice. With no reference, it compares nothing. The new response shape goes into `docs/contracts.md`.
- Tests on generated test tones, which stay in tests. Muse calls are faked in tests, so no network is needed.

**Device** (`device/`)
- `bridge.js` (`node.script`) runs the show:
  - Starts the engine if it isn't running, and stops it when Live quits.
  - Points the strip's `jweb` at `ui/strip.html`.
  - On Check mix: asks `live.js` for tempo and position, starts playback if Live is stopped, records 8 bars of Main with `sfrecord~`, then sends the wav to the engine.
  - Uses Node timers, not Max timers (see 1.6).
- `live.js` (`v8`) does the Live API work:
  - tempo, time signature, play state and position
  - start playback
  - move the playhead
  - add named markers, using observers
- `Aria.amxd`, built by `device/tools/make_aria_amxd.py` from Live's blank device. It passes audio through untouched and shows the strip in `jweb`.

**UI** (`ui/strip.html`, `ui/app.js`)
- Check mix shows progress: "Recording 8 bars", then "Measuring", then "Muse Spark is writing".
- Then the real measurements (Loudness, True peak, Bass, Mids, Treble, Width) and Muse's advice. If there's no advice, it says why.
- Night theme in the device for now. Following Live's theme comes later.

### Manual checks for Ian
1. Quit anything running the engine, then drag `device/Aria.amxd` onto Main. Within a few seconds the strip should say the engine is connected.
2. Load a song and press **Check mix**. Live plays, the strip counts through 8 bars, then shows the numbers and Muse's advice.
3. Do it three times in a row.
4. Remove Aria from Main. The engine should stop.

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
- **Claude:** Step 3, clarity in master mode (resonances, build-ups, harsh spots, with bars). Then Step 4, Aria Ear and track clashes.
- **Ian:**
  - Confirm the marker naming.
  - Say whether the stems in `~/Downloads/BELIEVE IT STEMS` are his to use. If yes, Claude builds test mixes with planted problems from them, kept out of git unless Ian says otherwise.
- **ML teammate:** follow `ml/README.md`. Ian provides the EDM mixes. Send Claude his GitHub username for an invite.

## Decisions so far
- The build started Oct 26.
- The build order follows `docs/rubric.md`. Ask Muse driving Live is core (Step 6). Groove match stays (Step 9).
- With no reference, Check mix shows raw measurements with no verdict.
- The repo is public from the start, so `.env` and tester audio are gitignored.
- Ian has Live 12.4 Suite (Max 9.1.4) and a Meta API key.
- **Clarity first (Oct 26):** Aria's core job is finding clashes and problem spots, not loudness. There are two modes: master only, and key tracks with Aria Ear devices. Loudness and true peak appear only in the Detailed view, and Muse never builds advice around them. A reference comparison is optional (Step 8).
- Devices are generated from Live's blank Max Audio Effect by `device/tools/`, not built in the Max editor.
- The ML track trains on measurements only (about 2 KB per mix). Audio never goes into the repo.

## Blockers
- None yet.
