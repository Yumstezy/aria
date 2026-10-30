# Status

Updated at the end of each session: what passed, what's next, any blocker.

## Oct 30, afternoon

- **"Against good mixes" is out** (Ian: confusing, and 30 rated mixes aren't an industry standard). With no reference, Aria finds clashes and problem spots only. `typical.py` and its tests are deleted (in git history); `ml/` keeps the data and `ml/curves.py`.
- **Problems marked by icon and color, not numbers** (8498781): the kind's icon, colored by range (lows red to highs violet), on the chart and in the rows; a ribbon under the chart shows the colors.
- **Song end** (590e3da): the last clip that plays, not Live's last_event_time (which said bar 185 on a song ending near 49).
- **Live analyzer**: glides at the screen's rate (d26e6d6). Ian asked what the grey line is (peaks) and wants the screen to explain itself; next.

- **Intro runs to the first Break** (Ian: EDM intros are for DJs to mix in): THE WEEKEND now reads Intro 1 to 40, Break 41 to 48, Build, Drop, Break, Build, Drop, Drop, Outro (real Muse run). Check: Hear the whole song again; your song's Intro should reach its first break.

- **Checked in Live by Ian (Oct 30, 12:37):** the new build runs well (arrangement, markers, before and after, analyzer, marks). To polish later: navigation, and shorter explanations. The analyzer now has a legend (Now, Peaks, your reference).

- **Groove match (build step 9), built, to check in Live.** Engine `POST /groove/match` (tests pass on generated hit loops), live.js and bridge (pick the selected clip, a new track with the matched clip under the original, original muted, A/B, Undo), and the screen (Loop to fix, Follow: Straight grid or Another loop, Strength, Nudge, the timing chart). Still to do: Muse explains the result and can set follow, strength and nudge (Ask Muse); "follow the reference song" waits. Needs from Ian: two real loops he owns that flam against each other (a hat loop and a perc loop) for the test pack and the demo.
  Manual check (remove and re-add Aria on Main, live.js changed): put a hat loop in the Arrangement view, click its clip, Groove match, Use selected clip. Straight grid, Match it. Expected: a new track "<track> (matched)" right under it with the clip at the same bar, the original track muted, and the chart. Original / Matched switches which track plays. Undo removes the new track and unmutes the original. If "Live didn't make the new clip" shows, tell Claude. Then Another loop: click the perc loop's clip, Use selected clip, Match again: the earlier matched track is replaced, not added to.
- **Ask Muse fixes:** the pop-up is at most about half the window; it opens at the newest message; requests queue instead of being dropped (the stuck "..." after an answer); Cmd+C/V/X/A work in its box. Check: paste text into Ask Muse with Cmd+V.

- **Groove match, first try in Live (Ian, 13:59):** clip placed and matched. Fixed after: Original / Matched switched forever (live.js's reply had the request's name); "190 ms off" (after-measurement paired hits with neighbours; now each hit's own sound is found again where it was put); every hit read 13 ms late on low drums (attack finder stopped at a dip in the level). On Ian's tribal loop at 165 BPM: before 6.1 ms off on average, 12.2 at worst; after 0, all 66 found; half strength gives half. The chart folds every bar into one row of 16ths. Check again in Live: Original / Matched switches once per press.

- **After Fix it (Ian, 14:40: fixed problems "stay in the way", no fix prompts on Before and after):** a problem Muse made a change for leaves To fix for a "N done" group at the bottom of the list (closed; each row says what was done, Undo while it's the next undo). Check again marks it Fixed when its range is 3 dB or more lower, otherwise it's back in To fix with "Still there" and Fix it again. Before and after rows say Fixed, Fix it again or Fix it. Counts (To fix, side menu, Home) count only what's left. Check in Live: Fix it on one problem, the count drops and "1 done" appears; Check again; Fixed or Fix it again.
- **Ask Muse fixes (14:30):** Drum Buss Drive is a percentage (was refused as a gain jump); Utility Mono stays off unless asked (and "Mono Bass" no longer switches Mono); "vOCAL" vs "VOCAL" picks the exact one.
- **Vocal sync, built, to check in Live** (Groove match, Vocal): pick the vocal's Arrangement clip; Aria shows its tempo (file name, measured, or typed), beat 1 on a picture of the vocal's start, Beat 1 earlier / later, and Sync it, which sets two warp markers on the clip (Complex Pro): beat 1 on a bar line, stretched to the song's tempo. Undo puts the old markers back. Manual check (remove and re-add Aria on Main): an acapella at another tempo in the Arrangement, click it, Groove match, Vocal, Use selected clip, Sync it. Expected: the clip's warp markers change and it plays in time; if "Live didn't take Aria's warp markers" shows, tell Claude (the add_warp_marker call is the untested part).

**Bug queue**
- Home's kind cards (GlowCard): hovering lags a little, and since the cards fill half the page, scrolling over them feels sticky (Ian, Oct 30, 12:35).

## Pick up here (Oct 29, 20:15)

**Fixed: the blank "jweb" box on Main.** It was Live's audio, not the UI. From about 18:40 Live's audio wasn't running (its device list includes a "rekordbox Aggregate Device" that reports a sample rate of 0). Max's message queue inside Live stops when Live's audio does, so the bridge's one message to the jweb, "load the strip page", never arrived. The Max log showed it: Node for Max's `start success` came 22 to 37 s late or never, and arrived the same second Ian saved Live's audio settings (20:09:26). Probes that only printed hello, or had their page built in, worked, which is why it looked like the device.

So a producer is never stuck on a blank box, the strip now starts on a page built into the device (`FALLBACK_PAGE` in `device/tools/make_aria_amxd.py`). Normally the real strip replaces it in a moment. If it's still there after 4 s, it says Live's audio isn't running and where to pick an output device. When audio comes back, the real strip loads by itself.

Manual check for Ian: drag the new `device/Aria.amxd` onto Main. The strip shows as before. Optional: in Live's Settings, Audio, set Audio Output Device to No Device, remove and re-add Aria: after 4 s it says "Live's audio isn't running". Set the speakers back: the strip appears without re-adding.

Test files from the debug, not committed, still to delete (Ian to OK): `device/Aria test.amxd`, `device/Probe A.amxd`, `device/hello-test.js`, and `~/Desktop/n4m-test/`.

**Done after that (Oct 29, evening): no more words where a picture works.** Home lost the Get started card and the tool tiles; before a check it shows the six kinds of problem as icons and Check mix, after one the count, the problem icons and the real spectrum. Name my tracks is one switch with an ear. The empty Mix check has no sentences. PNGs of every screen (from Ian's real 20:10 check, his Ask Muse history) are in `~/Desktop/Aria screens Oct 29/` for the group. Manual check for Ian: Open window in Live, look at Home before and after a check.

**Roadmap decision (Ian, Oct 29 night):** skip "Prove the fix" and the test-mix checkpoint (Step 7) for now; they come back once there's a reference or the model to test against. Order: the small fixes (done, below), the Ember polish (done: Detailed and compact), then Step 8 (Reference compare, built, below).

**Small fixes done (Oct 29 night), to check in Live** (remove and re-add Aria on Main so live.js reloads):
- No Ear on a muted track or one with no clips: mute a key track (say Bass), turn Name my tracks on. It shouldn't get an Ear.
- Past the end of the song: put the playhead 8 bars before the last clip ends and press Check. The window says "Your song ends at bar N, so the last 8 bars were silence." With the playhead after the last clip, Check refuses and says to move into the song.
- Undo with nothing left: press Undo twice after one change. The second press shows a passing note in the header, not a line in the chat.
- Check mix advice has no em or en dashes (a dash between numbers becomes "to"). Ask Muse replies already had this.
- The bird is on the device on Main, between the light and "Aria".

**Built Oct 30 morning, for Ian to test in Live** (remove and re-add Aria on Main: the device itself changed, for the analyzer):
1. Arrangement editing: each part's name is a menu, and -4 / +4 moves where it starts (the part before grows or shrinks). The header says "edited by you". Add markers to Live uses the edited names and bars.
2. Before and after: after a check, Fix it, then "Check bars N to N+15 again" in Mix check. Live plays the same bars again; the card shows before (blue) and after (gold) at the same loudness and how much each problem's range changed (green when less). Tested with Ian's mix B as before and the control as after: harsh hits -6.9 dB, presence -2.3 dB.
3. Live analyzer (side menu): press play; the gold line is Main right now, the grey line holds peaks, the dashed blue is the reference (or the typical good mix) matched to your level. If it stays empty, tell Claude: the device's new filter bank (fffb~) is the part not testable from here. Ian saw it working but choppy (12:11); since d26e6d6 the lines glide at the screen's rate and the scale moves only in 6 dB steps. Check it moves smoothly.
4. Markers: all of them should land now (each press checks the playhead first).
5. The song's end (Oct 30, 12:21): Hear the whole song said "bar 15 of 185" when the clips end near bar 49. Live's last_event_time counts automation and muted clips; the end is now the last clip that plays. Check: Hear the whole song stops right after your last clip, and so does the "past the end" note in Mix check.

**Checked in Live by Ian (Oct 30, 00:50):** Home (the website look), the charts (tilt, strips, docked), and a quiet track no longer called silent. Still to check: Against good mixes (a check with no reference), the Intro/Outro rule. Raghav has the directions to run the EQ curves and Audiobox on the 99 mixes: https://github.com/Yumstezy/aria/blob/main/ml/RUN-AUDIOBOX.md. Next: Arrangement editing (rename, move an edge by 4 bars), then Before and after.

**The mix model, and "against good mixes" (Oct 30).** The model PR is merged (99 rated mixes, three tiers). Official result: best 0.49 against loudness-only 0.45, wins 66% of rounds, shuffle p = 0.70, so no classifier ships (its own rule). What does ship: the good-rated mixes as a comparison when no reference song is picked. Each band's share of the mix against where 8 in 10 good mixes sit; outside by more than 0.5 dB is a problem with Muse's words and a cut. On Ian's planted mixes it catches what the checkpoint missed: A low mids +1.9 dB past the good range (control +0.8), B presence +3.4, C low mids +1.6. Permission for the mixes: given or free-download releases (Ian, Oct 30). Manual check: with no reference, Check mix shows "Against good mixes" with a row per band.

**Arrangement (build step 8b, Oct 29 night): built, to check in Live.** A new Arrangement tab (Ian named it; the button lives only there). "Hear the whole song" plays from bar 1 to the song's end once and records Main; the engine finds the parts (`POST /sections`, 4-bar lines, 8 to 32 bars, repeats share a label) and Muse names them from EDM names only (Intro, Build, Drop, Break, Bridge, Outro), which keeps names steady between runs. The reference's parts come from its file. Two lanes, matching parts outlined; "Add N markers to Live" with Undo. After that every Mix check knows which part it heard (shown after the bars in the title) and compares only the reference's part of the same name ("Against their Drop"). On THE WEEKEND: Intro, Drop, Break, Build, Drop, Break, Build, Drop, Drop, Outro, 152 BPM, three runs in a row.

Manual check for Ian (remove and re-add Aria on Main first, so the new bridge and live.js load):
1. Open window, Arrangement. Press Hear the whole song. Live jumps to bar 1 and plays; the lane fills with a playhead and "Listening to bar N of M". Stop should stop Live and say nothing changed.
2. Let it finish: Live stops at the end, and your parts appear with names (and THE WEEKEND's under them if it's still your reference).
3. Press Add markers to Live: named markers at each part's first bar. Undo takes them back one at a time.
4. Play a drop and Check mix: the title says the part after the bars, and the reference card says "Against their Drop".
5. The pin 2 that was missing on the reference chart (Oct 29, 22:42) is still open.

**Website (Oct 29 night): live at https://aria-sigma-gilt.vercel.app** (Vercel project "aria", Ian's team). Code in `site/`; redeploy with `vercel deploy --prod` from `site/`. Made for the video editor and the judges, who don't make music: plain words, real screenshots, logos (also in `~/Desktop/Aria logo/`), every card as its own PNG (`~/Desktop/Aria components/`), and the 30 second beat sheet. Additional features (Live analyzer, Groove match, Song sections, Mix score, Before and after, One-click install) are shown as in development. The example Ask Muse requests are verbatim from testing, typos included; swap in a fresh, clean session when there is one.

**Step 8, Reference compare (Oct 29 night): runs in Live (Ian, 21:34, THE WEEKEND.wav, Choose a song; dropping doesn't work in Live's web view, so it's gone). Redone after his look: both curves on one picture (yours gold, the reference blue, the gap shaded by whichever is fuller), the song's real name, at most 2 reference problems with louder ones first, and a missing range only as a whole band.** Earlier notes: Engine passes its test (`engine/tests/test_reference.py`: against `control.wav`, A, B and C each come out "fuller than the reference" in the planted range with a cut; control against itself finds nothing). The window: drop a song anywhere on it, or Reference, Choose a song. Mix check then shows "Against <song>" (seven bars, up is louder than the reference) and puts what stands out first, with Fix it. Muse compares with the song by name.

Manual check for Ian:
1. Remove and re-add Aria on Main (new bridge and live.js; the engine restarts itself with the new code).
2. Open window, Reference. Drag a song from Finder onto the window. Expected: "Drop to compare with this song" while dragging, then "<song> is your reference" in the header and the song's name on the Reference screen. If nothing happens on drop, press Choose a song instead. If that doesn't open a file dialog either, tell Claude: Live's web view may block both, and the fallback is a track named Reference.
3. Play the song, Check mix. The progress line says "Comparing with <song> and asking Muse Spark". The result has the "Against <song>" card, and any range that stands out is first in the list with Fix it.
4. Three times in a row. Only our own songs as references in the video (no commercial music).

**Then continue the polish (Ian, Oct 29: "lets move on to other features ui/ux and polishing everything else up"):**
- The Ember look is in for Mix check, Simple (commit 89558f3, `DESIGN.md` "Ember direction"). Ian hasn't seen it in Live yet because of the blocker; he liked the mockup and said "the glow may be too much", so it has no glow.
- Next screens in the Ember style: Home, Ask Muse, Detailed, the empty state before a first check, the compact view.
- "Prove the fix" is parked (Ian, Oct 29). After the Ember polish: Step 8, Reference track.
- Checkpoint (Step 7) is parked until the model: 1 of 3, see below.

## Where we are (Oct 29, evening)

Feature freeze end of day Nov 2. Submit by noon PT Nov 4. "Built" means it passes its tests here; "Live" means Ian has checked it in Live.

| Step | What it is | State |
|---|---|---|
| 0 to 2 | Repo, day 1 tests, the first working Check mix in Live | Done, Live |
| 3 | Problems in the whole mix: ringing notes, build-up, harsh hits | Done, Live |
| 3b | Split mode (Meta's Demucs): buried vocal, mud, bass clicks | Done, Live |
| 4 | Aria Ear: which of your tracks clash, by name. Name my tracks adds the Ears for you | Done, Live (Oct 28) |
| 5 | Muse's advice, the Simple view, Fix it (Muse makes the change, with Undo) | Done, Live (Oct 28) |
| 6 | Ask Muse drives Live: EQ, volume, 20 stock devices (add or change), sections and markers, sidechain, mute, solo, tempo, Undo, plugin guides, voice | Done, Live (Oct 28): Ian ran the whole test list |
| 7 | Checkpoint (Oct 31): 3 test mixes pass | Ran Oct 29 on Ian's song: 1 of 3. Spikes are found; broad low-mid boosts are not. Parked until the model (Ian) |
| 8 | Reference track: compare with a song you want to sound like | Later, after the model |
| 9 | Groove match | Not started; likely cut (Ian to decide) |
| 11 | README, demo video | Nov 3 to 4 |
| Model | Good, mid and bad mixes in one genre; says what pulls a mix down | Oct 29 (Raghav): 99 mixes, 71 producer groups, 29 measurements. Best model 0.49 vs loudness-only 0.45, but it wins only 66% of test rounds and fails the shuffle test (p = 0.70), so nothing ships. Next: the Muse rater, and how the tiers were rated |

What changed most recently:
- **Ember look for Mix check (Oct 29, Ian's reference).** Neutral near-black, hairline cards, monospace details, no glows. To fix (with an icon per kind), Fix first (with the clashing parts' real curves), Listening to, then the chart beside a numbered list that opens to Muse's words. The side menu lists the tracks Aria heard with their problem counts; Groove match and Live analyzer are off it, Reference says soon. Frequencies are written one way everywhere (890 Hz to 1.1 kHz).
- **Checkpoint run (Oct 29), 1 of 3.** Ian planted three problems in his own 165 BPM song, each in its own 16 bars, with a clean control (`test-pack/answer-key.json`; the audio stays local in `test-pack/mixes/`). The synth spike (+4.9 dB at 3.6 kHz in the mix) was found as harsh hits at 3.62 kHz. The bass (+3.3 dB at 180 Hz) and drums (+4 dB from 360 to 720 Hz) boosts were missed in every mode. Aria finds sharp problems and parts fighting at one level; it can't call a broad range "too much" without something to compare with. The fix is a comparison built from the good-rated mixes (the model track). Ian: come back to it once the model is done.
- **The window vanished after a check that found a clash (fixed Oct 29).** The chart read a size every clash lacks, the page threw, and the see-through window drew nothing; reopening replayed the result. Both pages now sit in an error boundary that shows a card and logs `ui_error` to the Max log.
- **The device on Main looks like a Live device (Oct 28, Ian picked "Lamp" of four mockups).** A status light with one word, Check and Ask side by side, Open window below, in Live's greys and amber. The page never scrolls, so it doesn't slide with the mouse. 150 x 169. Results live in the window.
- **EQ moves go on Aria's own EQ Eight (Oct 28).** Never the producer's, unless they ask to change their EQ; "add an EQ" is always new. Open window docks reliably on first open.
- **Adding a device adds a new one (Oct 28, Ian).** "Add a compressor" never changes the producer's own; "raise the threshold" changes the one Aria added, else the last one.
- **Step 6 review (Oct 28):** see "Step 6 dialed in" below.

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

### Item 1 built (Oct 26, late): the Aria window

- **"Open window" on the strip** opens a floating window inside Live: a `p window` subpatcher with its own `jweb` loading `ui/index.html`.
- **The bridge** sends every update to both the strip and the window, and replays the latest result when the window opens.
- **Home** shows the latest verdict.
- **Mix check Simple:**
  - a verdict hero with Muse's summary
  - Fix first with Muse's words, and "Hear it in Live"
  - a card per finding (click its numbers to jump there)
  - "Where it happens", one block per recorded bar (click to jump)
- **Mix check Detailed:** loudness, true peak, bands and width, each split part's level against the mix, and everything Muse said.
- **The engine** returns each split part's level (`clarity.stems`).
- **Muse may only attach an EQ fix** to ringing notes, harsh hits and build-ups. It had offered an EQ cut for a buried vocal, which would cut the vocal too.
- **Checked:** rendered with a real result from Ian's muddy mix, and the bridge's window routing was tested with a stand-in for Max. **Not yet checked inside Live.**

## Done (pending a check in Live): the UI in React (Oct 27)

- **`ui/`** is now a Vite, React 19, TypeScript and Tailwind 4 project with `motion` and the shadcn layout.
- **`npm run build`** makes `ui/dist/strip/index.html` and `ui/dist/window/index.html`: single files of about 570 to 590 KB, with fonts inlined. `device/bridge.js` loads them.
- **Ported:** the strip, and the window (Home, Mix check Simple with waves and expandable problems, Detailed). Rendered with a real result from the muddy mix in Night.
- **Ian's liquid glass card** lives in `ui/src/components/ui/liquid-glass.tsx`, typed and using our tokens, with dragging off by default.
- **Still to do:** confirm it in Live, then delete the old `ui/index.html`, `strip.html`, `app.js`, `window.js` and `aria.css`.

### The React plan

Ian's call: use React for the front end so it can look better, using component libraries (21st.dev, shadcn) and `motion`. It still runs entirely inside Ableton, in Live's built-in web view.

1. **Scaffold `ui/`:** Vite, React, TypeScript, Tailwind v4, `motion`, the shadcn layout (`src/components/ui`, `src/lib/utils.ts`), and `vite-plugin-singlefile` so each screen builds to one HTML file.
2. **Port the strip first** and check it inside Live. That doubles as the test that React works in `jweb`.
3. **Port the window:** Home, and Mix check Simple and Detailed with the waves, using the liquid glass card (the component Ian sent, adapted to our tokens).
4. **The bridge** points `jweb` at `ui/dist/strip.html` and `ui/dist/index.html`.
5. **The old plain files** (`ui/app.js`, `window.js`, `aria.css`) are removed once the React versions pass in Live.
6. **Then** Fix it for me and Ask Muse are built in React.

## Now: Ask Muse (Oct 27, Ian's pick for "step 3")

You type a request, Muse Spark picks tools, and Aria does it in Live with Undo. If you ask, it happens right away. If Muse suggests something on its own, it waits for a yes.

**Tools in this version** (the action menu in `docs/contracts.md`, limited to what exists today):

| Tool | Does | Limits |
|---|---|---|
| `jump_to` | moves the playhead to a bar | bar 1 or later |
| `add_marker` | adds a named marker at a bar (renames one already there) | name up to 32 characters |
| `eq_band` | one bell band on an EQ Eight at the end of Main (Aria adds one if there isn't one), old values kept for Undo | 20 Hz to 20 kHz, -6 to +6 dB, Q 0.3 to 12 |
| `check_mix` | runs a Check mix | none |
| `undo` | undoes the last change Aria made | none |

**Pieces:**
- **Engine:** `POST /muse/ask` sends the request plus context (latest findings, bars, playhead, tempo) to Muse Spark with these tools. It validates every call and drops anything off the menu or out of range. It returns `{reply, actions, suggestions}`.
- **Bridge:** applies `actions` in order through `live.js`, pushes undo entries, and sends the outcome to the UI. Suggestions wait for "Do it".
- **`live.js`:** `eq_band` finds or adds EQ Eight at the end of Main, uses a free band, and sets frequency, gain and Q by reading back each parameter's own display value (so Hz, dB and Q are exact). Undo restores the previous values.
- **UI:** an Ask Muse pop-up over the window (from design screen 08): a text box, suggestion chips from the findings, Muse's reply, a "Done" pill with Undo, and "Do it / Not now" for suggestions. The strip's Ask opens the window with the pop-up open.
- **Voice** (Muse Voice Transcribe works, from Step 1.4) comes after typed requests pass.

Pass: in Live, three typed requests work in a row, each with a working Undo: "jump to bar 17", "add a marker called Drop at bar 33", and "cut 3 dB at 3 kHz".

### Fixes from Ian's first Ask Muse session in Live (Oct 27)
- **Jump, then Play started from the old spot.** When Live is stopped, Play starts from the start marker, not the playhead. `jump` now moves that too: `Song.start_time` if this Live has it, else a jump to a marker at the bar (adding a temporary one and removing it). The Max console says which way it went (`jump: ...`). **Ian: check this.**
- **"Cut the mud" did nothing and the strip went blank.** `live.js` crashed: EQ Eight's width knob is named `Q` in Live 12 (`1 Q A`), not `Resonance`. Fixed. A missing knob now gives a clear message, not a crash.
- **A reply said "done" when nothing happened.** The engine now matches a near track name when only one track fits ("new vocal" finds "NEW VOCAL 2"). A dropped call comes back as a reason ("No track called ... Tracks: ..."), and the reply that claimed it was done is dropped.
- **The strip went blank on an empty reply.** It now always shows a line: the reply, the error, the reason a call was dropped, or "Muse didn't say anything back."
- **Hard to see the window and Live together.** The window has two sizes: **Full**, and **Side**, a tall panel docked on the right that floats over Live. The button is next to Check again; the choice is remembered. In Side, everything stacks in one column.
- **Chat history.** The bridge keeps the Ask Muse history in `~/Library/Application Support/Aria/ask-history.json` (last 100), and both the strip and the window show it. Clear asks once more before it deletes.
- **Ask inline.** The Ask Muse box and the latest two exchanges sit at the bottom of Mix check.
- **EQ shapes (second session, Oct 27).** Muse only had bell bands, so "a hard low end cut at 500 Hz" failed. Twice it also said it was "sorting the low end" without calling a tool. Now:
  - EQ tools take a shape: bell, low cut, high cut, low shelf, high shelf, notch. "Hard" or "steep" picks the 48 dB/oct cut.
  - Muse sees the last 3 exchanges, so "it" works.
  - The prompt says to call a tool for every part of a request and to describe only what it called. Em dashes are stripped from replies.
  - Replayed against Muse Spark, Ian's three requests from the log now each call the right tools.
- **Third session (Oct 27): the engine was running old code.** It had started at 12:44, so the EQ shapes never reached Muse. It asked "how many dB?" and then made a -6 dB bell. Fixes:
  - `/health` now reports the engine's pid and when its code was loaded. The bridge restarts the engine when the code on disk is newer.
  - A cut reuses the cut already on the track instead of stacking a second one.
  - A band that's on but flat (a fresh EQ Eight has bands 1 to 4 on at 0 dB) counts as free.
- **Window, fourth pass (Oct 27).** The window docks **Left** or **Right** (floats over Live) or goes **Full**. In docked mode, buttons at the top switch sides, pop out Ask Muse, and go back to Full. **Ask Muse pops out** into its own small window (`p chat` in the device, `?view=chat`) that floats over Live; it shows the same saved history. A see-through window isn't possible as far as we know: Max windows are opaque, so the page can only look like glass.
- **Window, fifth pass (Oct 27).**
  - **See-through:** docked panels and the popped-out chat are see-through glass, so Live shows through the tint. That takes a transparent patcher background, no title bar while docked, and `jweb` rendermode 2 (transparent background). A see-through window can't blur what's behind it, so it's tinted glass. Earlier we said Max windows were always opaque; that was wrong.
  - **Pop-out stack:** popping out Ask Muse shrinks the main window to a short "what to fix" card (tap a row to hear it), with the chat stacked under it on the same edge. "Show everything" closes the chat and brings the full panel back. Docked windows have their own close buttons.
- **Everyday asks:** "add clarity", "less muddy", "some air" and the like now use standard starting points (for example clarity is +2 dB at 3 kHz) instead of asking for numbers. A Mix check finding's frequency wins when there is one.
- **Low cut failed in Live: "EQ Eight has no low cut shape Aria could find."** The menu names didn't match the guessed pattern (High Shelf did). Shapes now match by letters anywhere in the name, with a fallback to EQ Eight's fixed 8-slot menu order. The real names print to the Max console.
- **`/devices <track>` in Ask Muse** lists every device on a track and every parameter Live exposes, saved to `~/Library/Application Support/Aria/devices-<track>.json`. That's spike S1: run it with Pro-Q 4 on a track.
- **Voice** isn't in yet. Muse Voice Transcribe works (step 1.4). The open question is the microphone: whether `jweb` can record it, or whether it goes through Live's input.

### The big change: device control
- **Presets (Oct 27):** Ian's DØWD racks are renamed into `User Library/Aria Presets/`. A catalog of 6,717 presets (DØWD, FabFilter, Valhalla, Ozone) is built by `engine/aria_engine/presets.py`. A Remote Script is the likely way to load racks and plugins (spike S6).
- **Stock devices (Oct 27, sixth pass).** Ian: "make sure the top 20 most used are implemented just how the EQ 8 is". New tool `track_device` with 20 stock devices plus a plain EQ Eight (list in `docs/contracts.md`). Same steps as EQ Eight: use the one on the track or add it, set knobs by display, Undo. Knob names come from Live's own control-surface bank definitions, read from the Live app. Third-party plugins: Muse says it can't yet and offers the stock device as a suggestion. Checked against the real API: reverb, compressor, glue, delay, width, saturation, set ratio and threshold, limit Main, Pro-Q 4 and Valhalla all come back right. Not yet run in Live.
- **Pro-Q 4's knobs are hidden (Oct 27, night).** Update: Live's save button on a VST3 plugin writes a `.vstpreset`, which doesn't keep the Configure list. Saving Pro-Q 4 inside an Audio Effect Rack (`.adg`) does, so the helper loads "<plugin> (Aria)" racks or `.adv` presets only, and `live.js` finds plugins inside racks (Undo removes the rack). In Live, Pro-Q 4 loads but shows Aria only Device On: Live hides the knobs of plugins with hundreds of them until the producer picks some with Configure, and no API can do that for us. So: (1) the Remote Script loads a User Library preset named "<plugin> (Aria)" instead of the bare plugin when one exists, and Ian saves one per plugin once, after configuring it; (2) when the knobs are hidden, Muse says so and suggests the same move with EQ Eight or a stock device, and the bridge now keeps the follow-up's suggestions.
- **Data (Oct 28).** The rated mixes for the model are sorted in a shared Drive (audio stays out of git, as `ml/README.md` says).
- **Step 6 dialed in (Oct 28).** Ian: "really dial in step 6... everything needs to work as intended... push the boundaries". Three code reviews (engine, bridge and Live, UI) plus 27 real requests found and fixed: honest replies were erased by the number check; a reply could describe a dropped part; set_section named the rest wrong; "Main" could land on "Main Vox"; one bad tool call crashed a request; "filter" pulled in FabFilter presets; two quick Do its crossed replies; markers broke while playing; Undo stayed on undone changes; a layout change wiped the saved theme; jumps didn't wait; findings could map to the wrong bars after adding Ears; the whole UI re-rendered on every progress tick; the thread blinked when Muse answered; a window that moved without resizing sat blank for a second. New: sidechain, mute, solo, tempo, delete marker; "fix everything" offers one suggestion per finding. Tests: engine 93, bridge 21.
- **Step 6, sections (Oct 28).** With the real API: "jump to the second chorus" goes to bar 65 from Live's markers; "make bars 1 to 16 the intro" names bar 1; "cut the harshness in the choruses" cuts the measured 3.4 kHz on Main for the whole song. New `set_section`: "make bars 97 to 112 the drop" adds Drop at 97 and Outro at 113, so the rest keeps its name. Live pass still to do.
- **Side experiment, not official (Oct 29, late, Raghav).** After the official run: with loudness taken out, tone and stereo alone still separate the tiers better than chance (0.49 vs 0.33, beats chance in 92% of rounds, shuffle test p = 0.01). Good mixes have more sub-bass and narrower mids. Not better than loudness alone (0.45) by enough to ship, and reported as a follow-up, not the planned test. Script `ml/experiments/no_loudness.py`, report `ml/results/no-loudness-experiment.md`. Also: `ml/README.md` brought up to date (29 measurements, new ship rule, folder map), `ml/data/manifest.csv` template added for owner, permission and rating source, and `muse_rater.py` confirmed to use the same split as the first of `train.py`'s repeats.
- **Second run: detailed measurements (Oct 29, night, Raghav).** New `ml/detail.py` adds 18 measurements on the engine's clarity grid, all stopping at 16 kHz so mp3s don't look different: 8-band balance, mud, harshness, resonance, punch low and high, stereo correlation, low-end width, clipping, whole-song range and drop lift. `train.py` now compares basic vs detailed measurements across four models, with 5-fold splits repeated 10 times (50 test rounds) and a shuffle test that repeats the pick-the-best-of-8 step on shuffled tiers. All of that was fixed before results. Result: random forest on detailed measurements 0.49, loudness-only 0.45, chance 0.33. It wins 66% of rounds (the rule needs 80%) and the shuffle test gives p = 0.70: picking the best of 8 models on random tiers beats loudness by that much most of the time. So the gain isn't reliable, and nothing ships. Pretrained audio embeddings were blocked from the cloud workspace (no access to model hosting).
- **First training run (Oct 29, Raghav).** 99 mixes measured from the Drive set (good 30, mid 36, bad 33), no gaps. Left out, with reasons in `ml/data/excluded.csv`: one exact duplicate and one m4a the script can't read. MP3 is now read too. Producer grouping fixes are in `ml/data/song_groups.csv` (71 groups; Brill's 8 tracks stay together). Result (`ml/results/train-report.md`): loudness-only 0.45, best real model (ordinal logistic) 0.41, chance 0.33. Bad mixes are quieter and punchier on average (median -7.1 vs -6.0 LUFS, crest 8.7 vs 7.1 dB); good and mid look almost the same on these 11 numbers. Nothing ships. Open: the rights and source of the mixes (several are released or bootleg tracks by other artists, one file is from a Spotify ripper) and how the tiers were rated.
- **Three tiers in `ml/` (Oct 28, night, Raghav).** `extract.py` reads `good/`, `mid/` and `bad/`; `train.py` and `muse_rater.py` rate bad < mid < good. Changes: (1) band balance (each band minus the whole mix) replaces raw band level as a model input, since raw levels move with loudness; raw levels stay in `features.csv`. (2) The split groups by the name before ` - ` with underscores read as spaces and the `GOOD_`/`MID_`/`BAD_` prefix dropped, so `Artist - Title` files group by producer, as the plan asks. (3) New `ordinal logistic` model that uses the tier order. (4) Report adds "tiers off" and "two off" (good called bad or the reverse). (5) Ship rule, fixed before results: beat the best baseline overall and in 4 of 5 folds. (6) Minimum data: 30 mixes, 5 songs per tier. Checked: extraction on one real mix per tier; the training and Muse-answer code paths on throwaway numbers that were never committed. `ml/README.md` has Windows setup too. Open question: where the rated mixes and their ratings come from, and the written permission for each (the plan's rule), to record in `ml/data/manifest.csv`.
- **The model's direction (Oct 28, Ian).** One genre; mixes that already come rated as good, mid or bad, so no rating round. The model learns what separates the tiers and says what pulls a mix down, with numbers. The reference track comes later as a second view, for a particular sound. `docs/ml-plan.md` updated; `ml/` still has the two-label version, so Raghav's first change is the three tiers.
- **Talk to Muse (Oct 27, late night).** The mic in Ask Muse records, Meta's Muse Voice Transcribe turns it into words (`engine/aria_engine/voice.py`, `/voice/transcribe`), and the words run as a request. The mapped key is hold-to-talk. Checked: "Cut the mud on the bass" (spoken with `say`) came back in 1.4 s; in headless Chrome the page's mic recording, WAV, CORS and the engine's call all work. Not yet known: whether Live's web view allows the microphone. The engine log prints each recording's length and peak ("voice: 3.5 s at 48000 Hz, peak -12 dBFS").
- **Name my tracks (Oct 27, late night).** A switch set before Check mix: on, Check mix puts the Ears on the key tracks itself and checks in the same go. Saved, so the strip's Check mix uses it too.
- **Ears added for you (Oct 27, late night).** Ian didn't want users dropping six devices. Decided: Check mix stays zero-setup (Main plus Demucs); a "Listen to my key tracks" button in Mix check has Aria put an Ear on each track named like a key part (up to 6) through the Remote Script, which is back for this one job. "Stop listening" takes them all off. Needs the Aria control surface on in Live.
- **Step 4, Aria Ear: built, not yet run in Live (Oct 27, late night).** `device/Aria Ear.amxd` (from `device/tools/make_aria_ear_amxd.py`, with `device/ear.js`) goes on 4 to 6 key tracks. Check mix tells every Ear to record with Main; each answers with its track's name. With two or more, the engine compares the tracks by name: `stems.clashes` (both strong in the same 1/3-octave bands, within 3 dB, at least half the time both play) plus masking with track names. Muse advises on clashes ("Kick and bass blur together down low"); the picture draws each track by its own name. Pass condition, on generated test signals: the planted Kick/Bass clash at 63 Hz in bars 5 to 8 ranks first, band within 1/6 octave, bars within 1. Still to do: the pass on a real session in Live with a planted clash.
- **Clearer pictures (Oct 27, late night).** Ian, on a check where only the vocal played: "its only showing the vocal and not the actual where things are wrong", and the strip's Fix first "is weird and hard to understand". The Mix check picture is now "Where the problems are": each finding is a numbered zone with a matching chip (name, range, amount); part lines only when two or more parts play, else the whole mix as one line and "Only the vocal is playing in these bars"; a ruler names the ranges (Sub to Air, with Hz). The strip's Fix first is Muse's plain sentence, one low-to-high bar with the problem marked ("1–4 kHz"), then Fix it, Hear it and "N more". Ask starters and Home copy no longer assume a vocal. Minimize is its own button again (Layout, Minimize, Close).
- **Docked left by default (Oct 27, late night, Ian).** With no saved layout the window opens docked on the left; the strip sends the screen size so it docks on the very first open.
- **One Layout menu, sliding moves (Oct 27, late night).** Ian: the minimize transition was "weird and not smooth", and "too many buttons for different views". All window layout now sits in one Layout button (full, docked left, docked right, minimize to the edge, pop out Ask Muse or back to one window), with the current one ticked. Docked headers keep only Layout and close; the full window drops its two dock buttons. Moves slide: the page slides out toward the edge it's going to (or fades for dock switches), the window changes while it's hidden, then the page slides back in once the size settles.
- **Plugins become guides; minimize to a tab (Oct 27, late night).** Ian: "we are going to scrap the custom plug ins for now... give advice and a visual diagram of how something should look... if the user's using pro q 4 and wants to add air to my vocals please show how that should look". New `plugin_guide`: Muse gets the producer's presets for the plugin they named, with each one's curve in words, picks one (or gives a stated starting point), and Ask Muse draws the EQ curve with numbered bands and lists them. Real API: "add air to my vocals" in Pro-Q 4 picked "Vocal Lead 1" (+3 dB at 12 kHz) 3 times out of 3; mud on loops picked a Mud Removal preset. `track_plugin` and the bridge's Remote Script calls are removed; the script is kept, on hold. Also: a docked window's minimize button turns it into a small tab on its edge (with the count to fix); tapping the tab brings the window, and the chat if it was open, back.
- **Plugins found (Oct 27, night).** After a Live restart the helper finds 277 plugin entries (133 names: Pro-Q 2 to 4, Ozone 12, Valhalla and more). "pro q" without a version now finds every Pro-Q and Muse picks the newest. Checked with the real API on Ian's request: Pro-Q 4 on vocals and Muddy Loops (set afterwards with its knobs), a suggestion for the synths.
- **Plugins not found (Oct 27, night).** In Live the Remote Script listed 0 plugins, so Muse offered EQ Eight for Pro-Q 4. It only counted browser items Live marks as devices; it now counts any loadable item under Plugins and walks folders. An empty list is no longer cached on either side, and a `tree` command shows how Live lays out Plugins if it happens again. Needs a Live restart to load.
- **Bands fit when docked; the analysis isn't final (Oct 27, night).** Docked, the seven bands wrap four and three so every name and status shows. Ian: "make sure that this mixing thing isnt the finished product rember we are training a model to use to give acurate data". Noted in CLAUDE.md: the findings are measurement rules v1; the trained mix model (`ml/`, checkpoint Oct 31) is what makes the data accurate, and it feeds the same band row and cards when it passes. Detailed view says where the findings come from.
- **Dark by default, glass back, where in the mix (Oct 27, night).** Ian, on the bar rows: "this screen shot doesnt really tell us ANYTHING... show where its muddy in the mix in general". The strip and Mix check now show seven frequency bands, Sub to Air: the fix-first problem filled, the others outlined, each band naming what's there. Then: Dark is the default again, and docked windows and the popped-out chat are see-through glass over Live again. Opening the chat remembers the layout it came from, and its Back button (and Back to window in the shrunk window) restores it. Window moves fade out and in, and the page is sized before the window, so the stretched frame doesn't show. Header notes clear after 4 s. Mix check advice now says "synths and keys", never "other". The bridge's Remote Script port can be set with `ARIA_REMOTE_PORT`, so tests never touch a running Live.
- **Dock buttons and the mapped key (Oct 27, late).** Ian asked for both back. Dock left / right sit beside Check mix in the full window again. "Or press your mapped key" is real: the strip has a small Live control, "Ask key", at the bottom of its left column (a `live.text`, since Live maps keys only to its own controls). Map a key to it with Cmd+K and that key opens Ask Muse with the cursor in the box. Also fixed: two parts of the bridge asking Live for its state at once could make one of them time out; one reply now answers both. Checked: engine tests (72), UI types and build, a fake-Max run of `bridge.js` (12 checks: theme saved and applied, session, mapped key, the whole Pro-Q 4 load path), the Remote Script against a fake Live (8 checks) and 4 real Muse requests.
- **Light by default, design fixes round 1 (Oct 27, evening).** Ian sent a new kit with `docs/design-fixes.md` and screens 10 to 12 (light and dark). Built from the design system classes as they are, with token colors only:
  - Sky is the default. A Light / Dark switch at the bottom of the rail (a moon or sun button when docked) saves the choice in `window.json` and applies it to the window, the chat and the strip.
  - Every window and the strip paint their own ground and orbs; nothing is see-through over Live any more.
  - The strip is 400 x 169 with two areas: Check mix, Ask (opens the chat) and Open window; then one card: Ready (with your markers as a row), Checking, the error, or Fix first (status tag, bars, the checked bars as a tappable row with the problem ones filled, Fix it, "N more in the window").
  - Home: the hero says what Aria does today, a Get started checklist (engine, Aria last on Main, check, ask) with real ticks, four tool cards with true statuses (Live analyzer, Groove match and Reference say "Coming soon"), and Where it happens (greyed until the first check).
  - Mix check: before the first check, the layout greyed out. After: the waves on the blue hero, Fix first on the navy tile with Fix it (Muse makes the change, with Undo) and Hear it in Live, one card per problem, Where it happens by bars.
  - Ask Muse is the `cp-ask-pop` pop-up by the rail's button; the inline panel in Mix check is gone. A "Do it" turns its card into the done pill with Undo. Duplicate suggestion cards are dropped.
  - Decided with Ian: the layout follows the screens, but it is filled with Aria's own findings, not a reference comparison, since the reference step isn't built. Docked windows keep their own controls.
- **Third-party plugins (Oct 27, seventh pass).** Ian: "i want to be able to add the custom plugins". A Live Remote Script, `device/remote/Aria`, loads any installed plugin onto a track (Max for Live can't reach the browser). New tool `track_plugin`: Muse sees only the installed plugins the request names, plus the knob names Live shows for plugins already on a track. "Add pro q 4 and cut the lows at 400" loads Pro-Q 4, then asks Muse again with its knobs and sets the cut. With the helper off, Muse says how to turn it on and offers the stock tool. Checked against the real API (7 cases, twice each). Not yet run in Live. Earlier the same day: a plugin ask with a move now suggests the move on stock tools, and "compress it and raise the threshold" on a track with no Compressor starts from -18 dB.
- **Strip redesign (Oct 27).** Flat, rounded, 480 x 169: Check mix / Ask / Open on the left, what the check found in the middle (tap the count for the window, a chip to jump to its bar), Muse's last answer and an always-there Ask box on the right. Ask opens the popped-out chat.
- **Smaller fixes (Oct 27).** Closing the main window leaves a popped-out chat open, and the chat grows into the space. Thin scrollbars that don't grow on hover. A voice button in every Ask box ("Voice is coming soon" for now; Muse Voice Transcribe works, see 1.4). live.js reconnects to Live after a reload instead of saying "Live isn't ready yet".
- See `docs/device-control.md`. "Cut the mids using Pro-Q 4", "raise it by .4 dB", "add some spacey reverb", with autocomplete of tracks, devices and plugins. Spike on Oct 28.

## Next
- **Ian (Live):**
  - Re-add `device/Aria.amxd` on Main. Drop `device/Aria Ear.amxd` on 2 to 4 key tracks (Kick, Bass, Leads, Vocals).
  - Plant a clash: push Kick and Bass into the same low band in a known stretch (8 bars), play it, press Check mix. Fix first should name both tracks, the band and the bars.
  - Try "I'm using Pro-Q 4, add air to my vocals" (the guide card), minimize and the Layout menu.
  - Raghav Agarwal (RaghavAgarwal18) was invited with Write access on Oct 28; he starts at `ml/README.md` once he accepts. He needs the rated mixes (good, mid, bad) before the Oct 31 checkpoint.
- **Claude:** Step 4's pass in Live, then Step 5 ("Fix it for me" on a clash: the cut on the right track, with Undo).

## Decisions so far
- The build started Oct 26.
- The build order follows `docs/rubric.md`. Ask Muse driving Live is core (Step 6). Groove match stays (Step 9).
- With no reference, Check mix shows raw measurements with no verdict.
- The repo is public from the start, so `.env` and tester audio are gitignored.
- Ian has Live 12.4 Suite (Max 9.1.4) and a Meta API key.
- **Check mix records 16 bars (Oct 27, Ian),** so a check covers a whole phrase.
- **The strip (Oct 27, Ian):** 360 px, with slim stacked buttons (Check, Ask, Open) and a card holding the count to fix, a waves thumbnail and short chips. Four layouts were compared; this is the one Ian chose.
- **Clarity first (Oct 26):** Aria's core job is finding clashes and problem spots, not loudness. There are two modes: master only, and key tracks with Aria Ear devices. Loudness and true peak appear only in the Detailed view, and Muse never builds advice around them. A reference comparison is optional (Step 8).
- Devices are generated from Live's blank Max Audio Effect by `device/tools/`, not built in the Max editor.
- The ML track trains on measurements only (about 2 KB per mix). Audio never goes into the repo.
- **Split mode (Oct 26):** Meta's Demucs for the prototype only, disclosed. Its weights' license is unclear. Revisit before any paid release: Aria Ear, a clearly licensed model, or our own model trained on consented producer stems.

## Blockers
- None yet.
