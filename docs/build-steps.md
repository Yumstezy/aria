# Build steps

Do them in order. A step is done only when its pass condition holds. Dates are targets; the Oct 31 checkpoint decides what survives. The build started Oct 26.

The order follows the judging rubric (`docs/rubric.md`). Use of Meta AI is 25% of the score, so Ask Muse driving Live is core, not stretch.

## Step 0. Repo and tooling (Oct 26)

- Create the layout from CLAUDE.md. Put `design/` in as it is.
- `engine/`: FastAPI app with `GET /health`, `pyproject.toml` or `requirements.txt`, pytest set up, `.env.example`.
- `ui/`: `index.html` and `strip.html` that load the design system CSS and match the Home and Device strip screenshots. In a normal browser they call the engine directly with a real wav path. No fake numbers, and no Home data until the engine provides it, so Home needs empty states.
- `test-pack/answer-key.json` with the shape in `docs/contracts.md`. The teammate fills in the real values.

Pass: `uvicorn` serves `/health`, `pytest` runs, and `ui/index.html` opens in Chrome and looks like the Home screenshot, with empty states where data will go.

## Step 1. Day 1 spikes (Oct 26 to 27)

Answer each question with a tiny proof. Write the answer in `docs/status.md`. Nobody builds on a guess.

1. **Muse Spark.** With the `openai` package pointed at `https://api.meta.ai/v1` and `MODEL_API_KEY`, call `muse-spark-1.1` (also try `muse-spark-1.3`). Send a short measurements JSON and get valid JSON back in our advice shape. If the API is unavailable to us, Muse Spark Open on Baseten is the fallback.
2. **Muse Spark hears audio.** Meta's blog says Muse Spark 1.1 understands audio. Send a short wav from the test pack and check what it can describe. If it works, Muse listens to sections as well as reading numbers. If not, the engine sends numbers only.
3. **Muse Spark tool calling.** Give it our action menu (contracts) as function tools and a request like "make bars 1 to 16 the intro". Check it calls the right tool with valid arguments.
4. **Muse Voice Transcribe.** Find the endpoint and transcribe a short spoken request. If there's no usable endpoint, voice stays stretch.
5. **Transport.** From `node.script` inside a Max for Live device, POST to `127.0.0.1:8765` and get a reply. If that fights us, fall back to the engine writing a JSON file that the device polls.
6. **Markers.** Through the Live API, create a cue point at a given bar and name it. The likely approach is to set `current_song_time`, call `set_or_delete_cue`, then set `name` on the new cue point. `set_or_delete_cue` deletes a cue that's already there, so check `cue_points` first. Confirm it.
7. **Clip file paths.** Read `file_path` from an audio clip in Session or Arrangement view.
8. **Groove output.** Can we write a new audio clip from a file through the Live API in Live 12? If not, the fallback is to render the fixed loop to `test-pack/out/` and have the producer drag it in. That's fine on camera if it's quick.

Pass: all eight have a written yes or no and a chosen path.

## Step 2. Bare bones round trip (Oct 27)

This is the "First milestone" in CLAUDE.md: install, run inside Ableton, call the Live API and the Muse API, and show real results.

- **The engine starts by itself.** When Aria loads, `bridge.js` (in `node.script`) checks `/health`.
  - If nothing answers, it starts `engine/run.sh` as a child process and waits for `/health`. The strip shows "Starting Aria" until then.
  - If an engine is already running (for example one started by hand while developing), it uses that one and starts nothing.
  - The engine's output goes to `~/Library/Logs/Aria/engine.log`.
  - When the device is removed or Live quits, `bridge.js` stops the engine it started, and only that one.
  - If the engine can't start (not installed, port taken), the strip says why in plain words and how to fix it.
- The device sits on the master and shows the strip UI in `jweb` with a Check mix button.
- Pressing it records 8 bars of the master with `sfrecord~` to a temp wav and stores the start song time.
- `bridge.js` POSTs `/mix/analyze` with the path. The engine measures it for real: integrated LUFS, true peak, Bass, Mids and Treble levels, and width. No stub numbers.
- With no reference loaded, the result is measurements only, with no verdict words. Muse Spark may only state things that are true without a reference, like a true peak above 0 dBTP.
- The engine sends the measurements to Muse Spark and returns its advice. If there's no key or the call fails, it says so and shows the measurements only.
- The strip shows the measurements and Muse's advice.

Pass: on Ian's machine, with no terminal open, dragging Aria onto the master starts the engine. Check mix then leads to real measurements and real Muse Spark advice in the strip, three times in a row. From the end of the recording to the result on screen takes under 15 seconds. The 8 bar recording itself runs in real time (about 15.5 s at 124 BPM).

## Parallel track: the good mix vs bad mix model (from Oct 26)

Owned by the teammate who knows ML, with Ian's help. Follow `docs/ml-plan.md`.
- Testers start sending mixes and ratings on day 1.
- The feature extractor reuses the engine's analysis code, so start it once Step 4 exists.
- Two approaches are tested on the same held-out songs: a trained classifier, and Muse Spark given real rated examples (see `docs/ml-plan.md`).
- Oct 31 checkpoint: does either beat the simple baselines on held-out songs? If not, it waits until after the hackathon.

## Step 3. Sections (Oct 28)

Mix check compares chorus with chorus, so it needs sections first. Confirm this order with Ian before starting.

- `POST /sections`: beat grid with librosa, bars from tempo and the first downbeat, then section boundaries snapped to 4 bar phrases. Use chroma repetition, so a louder repeat of the intro stays "intro" and gets flagged as unsure (see contracts, `confidence`).
- Muse Spark names the sections. It gets the boundaries, the measured energy per section, the producer's Live track and clip names, and the audio if Step 1.2 passed. Names come from the fixed list in contracts.
- Run it on the reference and on the producer's bounce.

Pass: on the reference in the test pack, section starts land within 1 bar of the answer key and the names match.

## Step 4. Mix check analysis (Oct 29)

Per section, for both tracks:
- band levels for Bass (below 250 Hz), Mids (250 Hz to 2 kHz) and Treble (above 2 kHz), plus the 5 band detail
- integrated and short-term LUFS
- width per band (mid/side ratio)
- chorus lift: the loudness jump into each chorus versus the verse before it

Then compare yours with the reference section by section. Pick the three biggest problems and rank them.

Pass: on each of the 3 test mixes, the planted problem is ranked first and lands in the right section.

## Step 5. Muse Spark advice and the Simple view (Oct 30)

- The engine sets each aspect's `status` and numbers from the comparison. `muse.py` writes the words: the status word, the one line, and the Fix first headline and why. The prompt includes the reference style and the section names. The output is validated, and anything off the action menu is dropped.
- The UI builds the Mix check Simple view from that JSON: the verdict hero, Fix first, six status cards with You vs Pro bars, and "Where it happens". The Detailed view uses the chart helpers.
- Clicking a section or a finding moves Live's playhead there.
- Muse Spark is named on screen while it writes.

Pass: on the demo song, Check mix ends on the Simple view with "Your choruses are too bright" first, and clicking Chorus 2 jumps the playhead.

## Step 6. Ask Muse drives Live (Oct 31)

Moved up from stretch. This is the main Meta AI beat in the video.

- The Ask Muse pop-up, typed text first.
- `muse.py` gives Muse Spark the action menu from contracts as function tools, plus the current screen, sections and measurements as context.
- The device checks each tool call against the limits in contracts, applies it through the Live API, and pushes an undo entry. Anything off the menu or out of range is dropped and shown as not done.
- If the producer asks, it happens right away with Undo. If Muse suggests something on its own, it waits for a yes.
- Tools in this step: `jump_to`, `add_markers`, `set_section`, `merge_sections`, `split_section`, `use_live_markers`, and `eq_band` on the producer's EQ Eight for the whole song. `eq_band` limited to some sections is stretch.

Pass: in Live, three typed requests work in a row, each with a working Undo: "jump to the second chorus", "make bars 1 to 16 the intro" and "cut the harshness in the choruses".

## Step 7. Checkpoint (Oct 31, end of day)

- The teammate grades Mix check against the answer key with `engine/tests/grade.py`. It prints pass or fail per file.
- Decide what makes the cut. If Mix check or Ask Muse isn't solid, Groove match drops to stretch and all effort goes to those two.

Pass: 3 of 3 test mixes pass, Step 6 passes, and the decision is written in `docs/status.md`.

## Step 8. Reference breakdown (Nov 1)

- The Reference screen shows both lanes. Sections are editable: rename, move an edge by 1 or 4 bars, merge, split, reset, or use Live markers instead.
- "Add markers to Live" writes named cue points at each section start.
- Every Mix check chart reads the edited sections.

Pass: on the reference, the markers appear in Live with the right names and bars, and editing a section changes the Mix check comparison.

## Step 9. Groove match (Nov 2, freeze at end of day)

- Read both loops' file paths. Check they share Live's tempo, find beat 1 in each, and let the producer drag the 1 marker if it's wrong.
- Match the moving loop to the anchor: the reference feel, the other loop, or a straight grid. Strength runs 0 to 100 percent, plus a ms nudge.
- Measure again after the fix. Show the average and worst offset left. Say "In time" only if every hit is within 5 ms.
- Write a new clip and keep the original.
- Ask Muse can set the anchor, strength and nudge through the groove tools.

Pass: on both loop pairs, the flam is audible before, gone after, and the screen says In time.

## Step 10. Stretch, only with a spare day

In this order:
1. **Voice:** hold a mapped key or pad to talk to Ask Muse through Muse Voice Transcribe, if Step 1.4 found an endpoint.
2. **Apply fix with A/B:** `eq_band` limited to some sections, and an A/B toggle with loudness matching.

## Step 11. Polish and ship (Nov 3 to 4)

- Fix bugs from the log only. No new features.
- README:
  - what Aria is, with a GIF
  - the architecture diagram
  - the Meta models used and where
  - how to run it
  - "built Oct 26 to Nov 4"
- Golden takes of every beat. The repo is public, so check no secrets or audio we don't own are in it.

Pass: a fresh clone runs by following the README on Ian's machine.
