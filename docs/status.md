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

## Done: Step 3, clarity in master mode (Oct 26)

- `engine/aria_engine/clarity.py` finds ringing notes (resonances), low-mid build-ups and harsh hits in the recording, each with a frequency, bars, size in dB and share of the time.
- **On generated noise:** clean pink noise gives no findings. Each planted problem is found where it was planted.
- **On Ian's own stems** (BELIEVE IT, summed, bars 93 to 108; local only, not in git):
  - The plain mix gives one finding: harsh hits at about 2.1 kHz from bar 98, 7.9 dB above the band. **Ian to check by ear.**
  - A planted +9 dB at 340 Hz is found first, at 339 Hz.
  - A planted +6 to +9 dB build-up at 200 to 400 Hz is found at the right bar in 5 of 6 placements. **Known limit:** +6 dB over only the last 4 of 16 bars was missed. A change has to last a few bars to stand out from the music's own bar-to-bar movement of 5 to 10 dB.
- **Design lessons:**
  - Measuring a band against the whole mix flagged the drop itself (the sub coming in) as a build-up, so bands are compared with their neighbours instead.
  - Judging bar by bar was noise, so build-ups use a change point over averages.
- **On Ian's latest real Check mix** nothing stuck out, and Muse said so instead of inventing a problem.
- **Muse advises on findings with a fix,** for example a -4.5 dB narrow cut at 339 Hz, in about 2 s. The validator now accepts "around 340 Hz" for a measured 339 Hz. Before that change it rejected 3 replies in 4.
- **The strip shows "What sticks out":** rows you can click to jump the playhead.

### Checked against a good mix (Oct 26)

Ian supplied a good mix as a comparison: "BRILL x 4times4 - Drugs In The Club (Edit) v0", 152 BPM, analyzed locally and not in git. The whole song was scanned 16 bars at a time (8-bar steps), next to BELIEVE IT.

| | Good mix | BELIEVE IT (rough) |
|---|---|---|
| First version: windows with nothing flagged | 10 of 19 | 2 of 16 |
| After the changes below | **15 of 19 (78%)** | **6 of 16 (37%)** |

- **Build-ups fired at every arrangement change in the good mix** (9 of its 14 findings): the drop bringing the bass in. Master mode can't tell "an element entered" from "this range got crowded", so build-ups are now off in master mode (`include_buildups=False`). Low-mid crowding moves to key tracks mode.
- **Ringing notes now start at 150 Hz.** Below that, narrow peaks were sustained bass notes (107 and 160 Hz in the good mix).
- **Left in the good mix:** harsh hits at 2.7 kHz in bars 75 to 120, and 160 Hz at bar 89. Ian to listen: intentional brightness, or a real issue?
- **BELIEVE IT's findings persist across windows:** 508 Hz rings through bars 57 to 88, and 2.0 to 2.2 kHz hits through bars 17 to 40 and 98 to 136. Ian to listen.

## Done: Step 3b, split mode with Meta's Demucs (Oct 26)

Why: on Ian's "muddy mix" master mode said nothing stuck out, while Ian heard a quiet vocal, overpowering loops, a click on the bass and mud.

- **`split.py`** separates the recording with `htdemucs` on the CPU. Apple's GPU backend fails on this model. The model loads at engine start.
- **`stems.py`** measures masking between sounds, including against "the rest" of the mix, and bass clicks. It's reused for Aria Ear in Step 4.
- **Evaluation on Ian's files,** 16 bars at a time with stems cached, local only:
  - **Muddy mix:** 3 of 3 windows flagged. The bass click shows on 98 to 100% of note starts in every window. Synths are covered in the low-mids (mud), and the vocal sits 5 to 7 dB under the rest in 1 to 4 kHz (bars 1 to 31).
  - **Good mix (BRILL x 4times4):** 6 of 10 windows clear. **Ian to listen** to bars 128 to 143, where the vocal sits 11.4 dB under the rest: intended or not?
- **Tuning lessons:**
  - Sounds that are absent (separation bleed) looked "50 dB buried", so a sound now counts only within 20 dB of the mix.
  - Air (4 to 12 kHz) belongs to hi-hats in any mix, so it's dropped.
  - Drums over synths in presence appeared in both songs, so split mode only checks vocals (mid, presence), synths (low-mid) and bass (low, low-mid).
  - A click is judged against the note's own level: -50 dB, since real bass starts sit about -40 and a test sine's fade splatter at -67. It's also judged on consistency, with 85% or more of starts needed.
- **A real 8-bar Check mix on the muddy mix** took **8 to 9 s** end to end with Muse. Muse said: "The vocals get covered in bars 9 to 16 and the bass notes start with a click", with fixes in words. That matches all three things Ian heard.
- **Master mode now skips frames more than 30 dB under the loudest.** It had reported ringing notes from a near-silent stretch.
- **License:** prototype only and disclosed in the README (decided with Ian).

Ian confirmed the "Mud" call on his new track (bars 65 to 72). The phantom "Vocal buried" there was Demucs bleed, now fixed. Ian's view: a trained model may judge these better than hand-tuned rules, so the ML data gets sorted on Oct 27.

## Now: the rest of the UX (from Oct 26, late)

Build order, each a demo beat:

1. **The Aria window, opened from the strip.**
   - A floating window inside Live: a second `jweb` loading `ui/index.html`.
   - Home shows the latest result.
   - **Mix check Simple view:**
     - a verdict hero ("3 things to fix")
     - Fix first, with Muse's words
     - one card per finding, in plain words with the numbers as detail
     - "Where it happens" bars you can click to jump there
   - **Detailed view:** loudness, true peak, band levels, width, and the split stems' levels. The numbers live here only.
2. **Fix it for me, with Undo.**
   - When Muse's fix is an `eq_band` cut (ringing notes, harsh hits), Aria finds or adds an EQ Eight at the end of Main and sets one band.
   - It keeps the old values for Undo.
   - A/B toggles the band so the producer can hear the difference.
3. **Ask Muse pop-up** (build Step 6).
   - Type a request, and Muse Spark calls tools from the action menu: `jump_to`, `add_markers`, `eq_band` and the section tools.
   - The device applies them with Undo. If the producer asked, it happens right away. If Muse suggests something itself, it waits for a yes.
   - Voice through Muse Voice Transcribe comes after typed requests work.
4. **Then Aria Ear** (exact per-track clashes, build Step 4), and checking a whole bounced song.

## Next
- **Ian:** the ML data on Oct 27 with the ML teammate (`ml/README.md`). Confirm the "Aria check" marker name.
- **Claude:** item 1 above.

## Decisions so far
- The build started Oct 26.
- The build order follows `docs/rubric.md`. Ask Muse driving Live is core (Step 6). Groove match stays (Step 9).
- With no reference, Check mix shows raw measurements with no verdict.
- The repo is public from the start, so `.env` and tester audio are gitignored.
- Ian has Live 12.4 Suite (Max 9.1.4) and a Meta API key.
- **Clarity first (Oct 26):** Aria's core job is finding clashes and problem spots, not loudness. There are two modes: master only, and key tracks with Aria Ear devices. Loudness and true peak appear only in the Detailed view, and Muse never builds advice around them. A reference comparison is optional (Step 8).
- Devices are generated from Live's blank Max Audio Effect by `device/tools/`, not built in the Max editor.
- The ML track trains on measurements only (about 2 KB per mix). Audio never goes into the repo.
- **Split mode (Oct 26):** Meta's Demucs for the prototype only, disclosed. Its weights' license is unclear. Revisit before any paid release: Aria Ear, a clearly licensed model, or our own model trained on consented producer stems.

## Blockers
- None yet.
