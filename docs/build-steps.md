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

## Why the plan changed (Oct 26, after Step 2)

Ian's call after the first real Check mixes: loudness and true peak are what every meter already shows. A good EDM mix should be loud, but mostly it has to be **clear**, and mixing is finding space for each sound. So Aria's core job is now finding **clarity problems**: what's too loud, what's clashing, and where. Loudness and peak numbers stay, but only in the Detailed view, and Muse never builds advice around them.

Aria has two modes, and the producer picks one:
- **Master mode:** the full mix only, no setup. It finds build-ups, harsh spots and narrow resonances, and says which bars they're in. It can't say which two tracks are fighting.
- **Key tracks mode:** the producer drops a small **Aria Ear** device on 4 to 6 key tracks or groups (Kick, Bass, Leads, Vocals). It finds which tracks clash, in which band and in which bars.

Both measure only inside the producer's own mix, so neither needs a reference track and the no-invented-data rule holds. A reference comparison is still useful later (Step 8), but it's no longer the core.

## Step 3. Clarity, master mode (Oct 27)

- The engine turns the recording into a spectrogram (frequency over time) at fine resolution, smoothed to about 1/6 octave.
- It finds three kinds of problem, each as a measured fact about this mix:
  - **Resonance:** a narrow peak that stands at least 6 dB above its smoothed neighbourhood and holds for most of the recording. Example: "a narrow peak at 340 Hz stands 9 dB above its neighbours".
  - **Build-up:** a band that jumps well above its own level elsewhere in the recording when something enters. Example: "200 to 400 Hz rises 5 dB from bar 37, when the pads come in".
  - **Harsh spots:** short bursts in 2 to 6 kHz that stand well above that band's own average. Example: "hits at 3.5 kHz jump 8 dB above the band on every snare in bars 41 to 44".
- Each finding has a frequency range, the bars it happens in, its size in dB and how much of the time it's there. The engine ranks them and keeps the top 3.
- Longer recordings help here. Check mix can record 16 bars as an option.

Pass: on test mixes built from real stems with a known problem planted (a narrow +9 dB boost at a known frequency, or a buildup that starts at a known bar), the planted problem is ranked first. It must land within 1/6 octave and 1 bar of the truth.

## Step 3b. Split mode: Meta's Demucs (Oct 27)

Why: on Ian's "muddy mix" test, master mode said nothing stuck out, while Ian heard a quiet vocal, overpowering loops, a click on the bass and some mud. Those are relationships between sounds, and the summed master can't show them. A hand test splitting the mix with Demucs (Meta AI research) measured all of them on the track's loudest 16 bars:
- the vocal 8.3 dB under the rest in 1 to 4 kHz while singing, and 3.4 dB under the drums and loops
- a high-frequency burst on 85% of bass note starts (likely a click, possibly kick bleed)
- the bass 7.5 dB over the other instruments in 150 to 400 Hz

What it does:
- **Splits the recording into vocals, drums, bass and other** with `htdemucs` on the CPU. That takes about 10 s per 25 s of audio on Ian's Mac. The Mac's GPU fails with this model ("Output channels > 65536 not supported at the MPS device").
- **Measures masking between stems** in five ranges (low 30 to 150 Hz, low-mid 150 to 400, mid 400 Hz to 1 kHz, presence 1 to 4 kHz, air 4 to 12 kHz). A stem is covered when another stem is at least 3 dB louder in a range that matters to it, for most of the time it plays. Findings: "Vocals covered by drums at 1 to 4 kHz, 3.4 dB under, 70% of the time".
- **Detects bass clicks:** a sharp high-frequency burst at bass note starts that don't land on a drum hit (to rule out kick bleed).
- **Ignores near-silent stretches,** in master mode too. On the muddy mix, ringing notes were reported from bars sitting 30 to 45 dB under the song's loud part.
- The same masking code is reused for Aria Ear in Step 4, with real track names instead of stem names.

**License (decided Oct 26, Ian):**
- Prototype only, disclosed.
- Demucs code is MIT. The weights' license is unclear, per its author; they were trained partly on MUSDB, which is research only.
- The README says this plainly. The weights download from Meta on first use and are never stored in the repo.
- Revisit before any paid release: a model with a clear license, or Aria Ear only.

Pass: on Ian's muddy mix (bars 1 to 16), split mode reports the vocal covered in 1 to 4 kHz, and the bass over the others in the low-mids. On BRILL x 4times4 (the good mix), it reports at most one masking finding per 16 bars. Total Check mix time stays under 15 s after an 8-bar recording.

## Step 4. Clarity, key tracks mode: Aria Ear (Oct 28 to 29)

- **`device/Aria Ear.amxd`:** a tiny device for any track or group. It passes audio through untouched and reports its track's name to the main Aria.
- **Recording together:** when the producer presses Check mix, the main Aria tells every Ear to record its track at the same moment (a shared Max `send`/`receive`), while Aria records Main.
- **The engine compares every pair of Ear tracks** in narrow bands, moment by moment. It's a clash when both tracks carry real energy in the same band at the same time, within a few dB of each other, so neither stands clear.
- **Each clash has:** the two track names, the band in Hz, the bars, how much of the time they overlap, and which track is louder there. The engine ranks clashes by how long they last and how loud they are, and keeps the top 3.
- **The strip and window show** "Bass and Kick clash at 50 to 90 Hz, bars 33 to 48" with the section map.
- **Without Ears,** Check mix falls back to master mode.

Pass: on a test session built from real stems with a known clash planted (two tracks pushed into the same band in known bars), the clash is ranked first. It must name the right two tracks, the band within 1/6 octave and the bars within 1 bar.

## Step 5. Muse Spark advice and the Simple view (Oct 30)

- **Muse gets the findings, not loudness.** `muse.py` sends the ranked clarity findings with their numbers, track names and bars. Each piece of advice is:
  - a plain headline ("Your bass and kick are fighting in the drop")
  - what it means for a listener ("the low end sounds blurry on big speakers")
  - one concrete fix: cut one track at a frequency, sidechain one to the other, or move one in the stereo field
- **The output is validated** as before. It may only cite measured numbers, and any action must come from the action menu.
- **The Simple view leads with the clarity findings.** Fix first is the biggest clash or problem. "Where it happens" shows the bars. Loudness and true peak sit in the Detailed view as plain numbers.
- **"Fix it for me"** applies the fix through Muse tool calling, for example an `eq_band` on that track's EQ Eight, with Undo.
- **Clicking a finding** moves Live's playhead to its first bar.

Pass: on the test session, Check mix ends with the planted clash as Fix first. "Fix it for me" adds the EQ cut on the right track, and Undo removes it.

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

## Step 8. Reference compare (re-scoped by Ian, Oct 29)

Compare first (Ian, Oct 29: "we can test using a reference"). Sections in both songs, editable lanes and "Add markers to Live" come after, if there's time.

- The producer chooses a song in the Aria window (Live's web view takes no dropped files). The page sends the file to the engine, which keeps it on this Mac.
- Every Mix check after that compares the 16 bars with the reference, loudness matched: both curves on one picture (yours gold, theirs blue, the gap shaded by whichever is fuller), and anything that stands out (a boosted instrument, a whole band off) as a problem with Fix it.
- Muse compares with the song by name: "Your mids are fuller than <song>", then the numbers.

Pass: with `test-pack/mixes/control.wav` as the reference, the planted boosts in A (around 200 Hz), B (around 3.2 kHz) and C (350 to 710 Hz) each come out as "more than the reference" with a cut inside the range, and control against itself finds nothing (`engine/tests/test_reference.py`). In Live: choosing a song sets the reference, and the next Check mix shows the comparison and Muse's words about it, three times in a row.

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
