# Contracts

All engine calls are HTTP JSON on `http://127.0.0.1:8765`. Times are in bars (1-based) unless the field name says `beat` or `sec`. Levels are dB, loudness is LUFS, timing is ms.

Who may call (Nov 2): requests with no `Origin` (the bridge), or with `Origin` `null`, `file:...` or `http://localhost` / `http://127.0.0.1` (Aria's pages). Any other `Origin` gets 403 `{"detail": "Only Aria's own pages can call the engine."}` before the request runs.

## Sections

`POST /sections` (as built Oct 29, build step 8b, Arrangement). The producer's song sends Live's tempo and where its recording started; a reference file sends only its path, and the engine estimates the tempo (95 to 190 BPM) and the first beat.

```json
{ "wav_path": "/abs/path/song.aif", "tempo": 165.0, "start_beat": 0.0, "beats_per_bar": 4 }
```

```json
{
  "tempo": 165.0, "first_downbeat_sec": null, "bars": 65, "path": "...",
  "sections": [
    { "name": "Intro", "label": "A", "start_bar": 1, "bars": 16, "start_sec": 0.0, "end_sec": 23.27,
      "energy_db": -3.7, "rise_db_per_bar": 0.07, "confidence": 1.0 }
  ],
  "names_by": "Muse Spark", "names_error": null, "error": null
}
```

- Edges fall on 4-bar lines counted from bar 1, at least 8 bars apart; no part is longer than 32 bars. `confidence` is how clear the edge is (1.0 for the clearest in the song).
- `label`: parts that sound alike (notes and tone balance, not loudness) share a letter.
- `energy_db` is the part's level against the loudest bar of the song; `rise_db_per_bar` is positive when it climbs.
- `name` comes from Muse Spark only, one of Intro, Build, Drop, Break, Bridge, Outro (EDM names only, so they stay the same from run to run and between songs), from those numbers. The first part is always Intro and the last always Outro (songs open and close there; loudness can't tell a loud intro from a drop). Everything before the first Break is the Intro, joined into one part (Ian, Oct 30: an EDM intro runs to the first break so DJs can mix the song in); its `energy_db` and `rise_db_per_bar` are the bar-weighted average. Without Muse it's `null` and `names_error` says why; the UI then shows the letters.
- `error`: a silent recording, or fewer than 8 bars.
- Results are cached per file and its change time.

## Mix check

`POST /mix/analyze`

```json
{
  "mix_path": "/tmp/aria/mix-001.wav",
  "start_beat": 0.0,
  "tempo": 124.0,
  "reference_path": "/abs/path/reference.wav",
  "sections": [ { "name": "Intro", "start_bar": 1, "bars": 16 } ],
  "reference_sections": [ { "name": "Intro", "start_bar": 1, "bars": 8 } ]
}
```

If `sections` is missing, the engine calls its own section finder.

### Without a reference (build step 2)

The device sends only what it recorded:

```json
{ "mix_path": "/tmp/aria/mix-001.wav", "start_beat": 64.0, "tempo": 150.0, "bars": 8 }
```

With no reference, the engine compares nothing. It returns what it measured and Muse Spark's advice on those numbers:

```json
{
  "recording": { "path": "/tmp/aria/mix-001.wav", "start_beat": 64.0, "tempo": 150.0, "bars": 8 },
  "reference": null,
  "measured": {
    "duration_sec": 12.8, "sample_rate": 48000, "channels": 2,
    "integrated_lufs": -18.2,
    "true_peak_dbtp": -5.7,
    "bands_db": { "bass": -33.1, "mids": -27.1, "treble": -49.1 },
    "width": { "bass": 0.2, "mids": 0.13, "treble": 0.25 },
    "unmeasured": {}
  },
  "advice": {
    "summary": "Nothing is clipping, so load a track you want to sound like so Aria can compare.",
    "notes": [ { "aspect": "true_peak", "text": "True peak is -5.7 dBTP, so it will not clip on export.", "uses": ["true_peak_dbtp"] } ]
  },
  "advice_by": "Muse Spark",
  "advice_error": null
}
```

- Any measured value can be `null`. `unmeasured` gives the reason, keyed by field (`"integrated_lufs"`, `"bands_db.treble"`, `"width.mids"`), or `"all"` for a silent recording.
- `bands_db` is the RMS level of mid plus side in each band, in dBFS. Bass is below 250 Hz, Mids 250 Hz to 2 kHz, Treble above 2 kHz.
- `width` is the side share of the band's energy: 0 is mono, 1 is all side.
- `advice` is `null` when there's no key, the call fails, or nothing valid comes back. `advice_error` then says why in plain words. There is no fallback text.
- Validation drops any advice note that cites a number not in `measured` or the request, or that says "too X" without a reference.
- `tracks_playing` (key tracks mode, Oct 29): `{track name: true | false | null}`, Live's word on whether each track had unmuted clips in the checked bars (null: no Arrangement clips at all, so Live can't say). For the producer's own tracks, silent means `false` here or, when null, near-digital silence (under -60 dBFS); a quiet track is still drawn and checked for being buried. The 20 dB-under-the-mix rule stays for split mode, where it filters Demucs bleed.
- `reference_path` (build step 8, as built Oct 29): see "With a reference" below.

### Against the rated mixes: the shape model (Nov 2)

Every Mix check result has `good_mixes`, where the shape model (`ml/experiments/shape.py`, report in `ml/results/shape-experiment.md`) puts the mix. It was trained on 63 of our testers' mixes rated good or bad, on EQ shape only (loudness taken out): 0.75 on held-out songs, shuffle p = 0.002. The engine measures the recording's loudest 60 s exactly as the rated mixes were (`engine/aria_engine/goodmix.py`; the model file is a copy of `ml/data/shape-model.json`, kept the same by a test).

```json
"good_mixes": {
  "lean": 0.06,                 // the model's chance of "good", 0 to 1. Drawn as a position, never shown as a number or a score
  "lean_word": "further",       // "closer" (0.6 and up), "between", "further" (0.4 and under)
  "mixes": {"good": 30, "bad": 33}, "heldout_accuracy": 0.749, "loudness_only_accuracy": 0.723,
  "features": [                 // only the model's stable directions (show = true in the model file), in its order
    {"name": "band_sub_db", "hz": [30, 60], "value": -24.51, "good_median": -17.778, "bad_median": -21.063,
     "good_range": [-20.119, -16.468], "toward": 1, "off": true, "diff": -6.73}
  ],
  "error": null                 // with a reason, and lean null and no features: too short (under 4 s), silent, model missing
}
```

- `toward`: 1 when the good mixes have more of it, -1 when less. `off`: this mix is past the good mixes' middle half (`good_range`), the far way. `hz` is null for the measurements that aren't one range (bumpiness, tilt, top-end spread, low end against the mids).
- Units are dB against the mix's loudness, except `tilt_db_per_oct` (dB per octave).
- The `off` measurements an EQ move can change (the bands, and the low-mid build-up) join `clarity.findings` as `good_mix` findings, at most 2, after the clarity rules' findings, only without a reference: `{"kind": "good_mix", "feature", "band", "hz", "hz_range", "diff_db", "good_median_db", "toward", "bars"}`. `diff_db` is this mix minus the good mixes' middle. Positive (more than them): Muse may fix it with an EQ cut, like a reference finding. Negative: lift it on the track that carries it (Ask, Fix all), never a fader.
- Muse Spark gets `lean_word`, `mixes` and `features`, not the number, and its summary says where the mix lands in words.
- With a reference, `good_mixes` is still measured but neither joins the problems nor goes to Muse: the producer picked what to aim for.

### Before and after (Oct 30)

`POST /mix/before-after {before: {path, start_beat}, after: {path, start_beat}, tempo, bars, findings}`: the same bars after a fix. The takes are lined up on the beat (the later start sets where both begin), cut to the same length, loudness matched, and compared as a reference comparison would be (after against before). Returns `{curve: {hz, mine: after, ref: before}, bands, problems: [{index, kind, hz_range, change_db}], seconds, lufs: {before, after}}`; negative `change_db` is less of it than before. The bridge's `recheck` plays from the last check's first bar and records long enough to cover the same beats; the UI gets `before_after` and `before_after_progress`.

### Live analyzer (Oct 30)

The device's filter bank (31 third octaves from 31.25 Hz, `fffb~` then RMS) is read 20 times a second while the window's analyzer is open (`analyzer_on` / `analyzer_off` from the page; the bridge turns the device's metro on and off through the `an` outlet). The bridge sends `analyzer [31 dB values]` to the window only.

### Arrangement edits (Oct 30)

`arrangement_edit {sections}` from the page: the producer's renamed parts and moved edges (4 bars at a time, no part under 4 bars). The bridge keeps them for markers and for which part a check heard, and marks the song `edited`.

### With a reference (build step 8, as built Oct 29)

The producer chooses a song from Finder on the Reference screen (Live's web view takes no dropped files; Ian, Oct 29). The page sends the file itself (an exception to "paths, not audio": the page can't see the chosen file's path) as the raw body of `POST /reference?name=<file name>`. The engine keeps it once per song (by content) in `~/Library/Application Support/Aria/references/` and returns `{path, name, seconds}`. wav, aiff, flac, mp3 and ogg; anything else is a 400. The page sends `set_reference {path, name}` to the bridge, which saves it in `window.json` and adds `reference_path` to every `/mix/analyze` until `clear_reference`.

With `reference_path`, the result's `reference` is:

```json
{ "name": "control.wav", "path": "...", "error": null,
  "bands": [ { "name": "Mids", "lo": 400, "hi": 1000, "diff_db": 3.1 } ],
  "curve": { "hz": [32, 35, "... sixth octaves to 16000"], "mine": [-38.2, "..."], "ref": [-37.9, "..."] } }
```

- Both songs are loudness matched (integrated LUFS) and compared in third octaves over the moments each plays. `diff_db` is the mix minus the reference. `curve` is both songs at twelfth octaves, dB against their own loudness, for the picture (yours gold, the reference blue). The window draws both tipped up 4.5 dB an octave around 1 kHz, as Pro-Q does, and says so on the chart; the numbers stay as measured.
- The bridge sends `reference_name` (the song's own file name) with `reference_path`, since the engine stores it under another name.
- What stands out becomes a finding, first in `clarity.findings`: `{kind: "reference", shape: "stretch" | "band", hz, hz_range, diff_db, stands_out_db (stretch), band (band), bars}`. A stretch is louder than the reference: at least 2 dB above the difference curve around it and 1.5 dB above the reference. Something missing counts only as a whole band 3 dB off (a pro track's deeper sub isn't a stretch to fix). At most 2, louder ones first. Frequencies are rounded to two significant figures.
- Muse gets `reference: {name, bands}` and may compare with the song by name. It may give an `eq_band` cut for a stretch that's louder than the reference, never for a quieter one.
- `error` says why nothing was compared (a silent reference). A reference that's gone from disk is a 400 that says to choose it again.

### Clarity findings (build step 3, master mode)

`/mix/analyze` also returns what sticks out in the recording, and takes `beats_per_bar` so findings map to bars:

```json
"clarity": {
  "mode": "master",
  "bars": [93, 108],
  "findings": [
    { "kind": "resonance", "hz": 339, "hz_range": [329, 349], "size_db": 9.7, "share": 0.97, "bars": [93, 108] },
    { "kind": "buildup", "hz_range": [247, 311], "size_db": 6.5, "share": 0.5, "bars": [101, 108] },
    { "kind": "harsh", "hz": 2153, "hz_range": [2091, 2216], "size_db": 7.9, "bursts_per_bar": 1.2, "share": 0.05, "bars": [98, 108] }
  ]
}
```

- **`resonance`:** a narrow peak `size_db` above its 1-octave neighbourhood, for `share` of the frames with content.
- **`buildup`:** a 1/3-octave band between 120 Hz and 1 kHz whose average from `bars[0]` is `size_db` higher against its neighbours, and in itself.
- **`harsh`:** bursts between 2 and 6 kHz at least 6 dB above that band's usual margin, `bursts_per_bar` times per bar.
- At most 3 findings, strongest first. An empty list means nothing stuck out. It is never padded.

With Demucs installed (build step 3b), `mode` is `"split"`, `split_by` names the model, and split findings come first (at most 4 findings in total):

```json
{ "kind": "masking", "masked": "vocals", "by": "the rest", "range": "presence", "hz_range": [1000, 4000],
  "gap_db": -7.5, "share": 0.68, "bars": [9, 16] }
{ "kind": "bass_click", "starts": 28, "clicky_share": 1.0, "size_db": 15.0, "hz_range": [2000, 10000], "bars": [9, 15] }
```

- **`masking`:** `masked` sits `gap_db` under `by` (another sound, or `"the rest"`, meaning everything else together) in `range`, for `share` of the time it plays there.
  - Sounds are `vocals`, `drums`, `bass` and `other` (synths, pads, keys, non-drum loops).
  - Split mode checks only what decides clarity: vocals in mid and presence, `other` in the low-mids (mud), and bass in low and low-mid.
  - Sounds more than 20 dB under the mix in a range count as absent, not buried.
- **`bass_click`:** a sharp top-end burst at bass note starts that don't land on a drum hit, on `clicky_share` of the `starts`. It's reported only when 85% or more of the starts have it.
- `split_error` explains why split mode didn't run, for example a silent recording. Master findings are still returned.
- `unmeasured` replaces `findings` content when the recording is too short.

Advice is now about the findings:

```json
"advice": {
  "summary": "A ringing note around 339 Hz sticks out most in these bars.",
  "notes": [ { "finding": 0, "kind": "resonance",
               "text": "It sits 9.7 dB above the frequencies around it for 97 percent of the time.",
               "fix": { "type": "eq_band", "freq_hz": 339, "gain_db": -4.5, "q": 6.0 } } ]
}
```

- `finding` indexes `clarity.findings`. Notes pointing at a missing finding, or of the wrong kind, are dropped.
- `fix` is null, or an `eq_band` cut inside the finding's frequency range, between -6 and -0.5 dB, Q between 0.3 and 12. Anything else is dropped.
- Numbers in the text must come from the measurements, the findings or the fix. A frequency may be rounded to 10 Hz or given inside a finding's range ("around 340 Hz").

```json
{
  "verdict": { "to_improve": 3, "total": 6 },
  "aspects": [
    { "id": "treble", "status": "hot", "word": "Too bright",
      "line": "Choruses sparkle more than the pro track, so they can sound harsh.",
      "you": 0.78, "pro": 0.60, "detail_db": 3.8, "where": ["Chorus 1", "Chorus 2"] },
    { "id": "bass", "status": "watch", "word": "A bit light", "you": 0.48, "pro": 0.60, "detail_db": -1.8 },
    { "id": "lift", "status": "watch", "word": "Too flat", "you": 0.45, "pro": 0.70, "detail_db": -1.9 },
    { "id": "mids", "status": "good", "word": "Good", "you": 0.61, "pro": 0.60 },
    { "id": "loudness", "status": "good", "word": "Good", "you_lufs": -8.9, "pro_lufs": -9.0 },
    { "id": "width", "status": "good", "word": "Good", "you": 0.58, "pro": 0.60 }
  ],
  "fix_first": {
    "title": "Your choruses are too bright",
    "why": "They can sound harsh on phones and earbuds.",
    "action": { "type": "eq_band", "freq_hz": 3100, "gain_db": -2.0, "q": 0.7, "sections": ["Chorus 1", "Chorus 2"] }
  },
  "sections": [
    { "name": "Chorus", "start_bar": 33, "bars": 16, "status": "hot", "word": "Too bright",
      "bands_db": { "air": 1.2, "presence": 3.8, "mid": -0.5, "low": -1.8, "sub": -0.9 } }
  ],
  "detail": {
    "spectrum": [ { "hz": 2500, "mix": -4.5, "ref": -8.5 } ],
    "energy": { "mix": [-14.0], "ref": [-14.5] },
    "stereo": [ { "band": "Presence", "mix": 0.48, "ref": 0.74 } ]
  },
  "advice_by": "Muse Spark"
}
```

- `status` is one of `good`, `watch` or `hot`.
- `you` and `pro` are 0 to 1, scaled for the bars.
- `detail` feeds the chart helpers in the Detailed view, with the same field names the helpers take.

### Key tracks mode: Aria Ear (build step 4, Oct 27)

- Each `device/Aria Ear.amxd` on a key track listens on `aria_ear`. At Check mix the bridge sends `record <dir> <ms> <stamp>` there in the same moment it starts recording Main; each Ear records its track to `<dir>/ear-<stamp>-<device id>.aif` and answers on `aria_ear_back` with `{name, file}` (its track's name in Live). The bridge also sends `stop` if playback stops early.
- **Aria adds the Ears (Oct 27, Ian: "idk if the user would like to have to put 6 plugins on").** UI `listen_tracks`: the bridge picks tracks named like key parts (kick, bass, sub, 808, lead, synth, vocal, vox, pad, chord, keys, drum, perc, snare, clap, pluck, arp; up to 6) and asks the Remote Script `{"cmd": "load_ear", "track": i}` for each, which loads `Aria Ear.amxd` from the User Library (`install.sh` copies it to Presets/Audio Effects/Max Audio Effect/Aria). UI `stop_listening`: `live.js` `remove_ears` deletes every "Aria Ear". Device to UI: `ears {busy, text}`; `session.ears` lists the tracks with an Ear.
- With two or more Ear recordings, `POST /mix/analyze` gets `tracks: {track name: path}` (a repeated name gets " 2"). `clarity.mode` is `"tracks"`, `clarity.tracks` lists the names, and `clarity.spectra.parts` is keyed by track name.
- Findings, strongest first, at most 4: clashes, then a track covered by another (`masking` with track names in `masked` and `by`), then master findings.
- A covered sound is counted only where it plays: for a sound that dips just after each kick (a sidechain, or a part between the kicks), the moments right after the kicks are left out (`stems._ducked`, Nov 1).
- `track_faders_db: {track: dB}` comes with `tracks`: each Ear track's fader, read from Live at Check mix. An Aria Ear records before the fader, so the engine applies it to that track's recording (Nov 1). Devices Aria adds to a track go in before its Aria Ear (live.js `insertAt`, and the helper moves a loaded rack there), so the Ear hears them.
- Each clash and masking finding also carries `levels_lufs: {track: LUFS}`, and the result has `clarity.levels_lufs`: every track's integrated loudness while it plays (gated; null when silent). Muse uses it to tell a buried sound from a cover that's simply too loud (Nov 1, Ian: on an unleveled mix it raised every buried track).
- A clash: `{"kind": "clash", "tracks": [a, b], "louder": a, "hz_range": [lo, hi], "diff_db": 0.4, "share": 0.52, "bars": [first, last]}`. Both tracks play strongly in that range (1/3-octave bands, next-door bands merged) within 3 dB of each other for at least half the time both play there.

## Talk to Muse (voice)

`POST /voice/transcribe`, body: the recording as WAV (the page sends 16-bit mono at the mic's rate). The engine converts it to the 16 kHz mono 16-bit WAV that Muse Voice Transcribe accepts (multipart: `request` `{"model": "muse-voice-transcribe-1.0", "audioEncoding": "WAV", "mode": "PUSH_TO_TALK"}` and `audio`) and returns `{"text"}`, or 400 with a plain reason (too short, over 30 s, no key, no words heard). The words then go to Ask Muse like typed ones.

## Groove match

`POST /groove/match`

```json
{
  "moving_path": "/abs/Perc loop.wav",
  "anchor": { "kind": "reference" },
  "tempo": 124.0,
  "strength": 1.0,
  "nudge_ms": 0,
  "beat1_sec": { "moving": 0.0, "anchor": 0.0 },
  "out_dir": "/abs/test-pack/out"
}
```

`anchor.kind` is one of:
- `reference`, with `path`
- `loop`, with `path`
- `straight`

```json
{
  "before": { "avg_ms": 19, "max_ms": 22, "hits": [ { "beat": 1.5, "offset_ms": -19 } ] },
  "after": { "avg_ms": 1, "max_ms": 3 },
  "in_time": true,
  "hits_moved": 8,
  "out_path": "/abs/test-pack/out/Perc loop (matched).wav"
}
```

`in_time` is true only when `after.max_ms <= 5`.

Built Oct 30 (`engine/aria_engine/groove.py`): `anchor.kind` is `straight` (the nearest 16th) or `loop` (the other loop's hit at the same place in the loop; both repeat). `reference` isn't built yet and returns 400. Hits are found where the level jumps 9 dB or more in 10 ms and pinned to where the attack starts; a hit is paired only with a target under about half a 16th away. Each hit's slice is cut 3 ms before it and moved (2 ms fades), so nothing is stretched. `out_dir` defaults to `~/Library/Application Support/Aria/groove/`. The result also has `hits` (how many were found), and `before.hits` and `after.hits` are `[{sec, offset_ms}]` (target time, how late), for the timing chart. `grid` is `{step_sec, beat1_sec, steps_per_bar}` so the chart can fold every bar into one. After the move, each hit's own first 30 ms (from the original) is found again in the new file by cross-correlation within 20 ms of where it was put; one that doesn't match (under 0.6) is counted in `after.missing`, and `in_time` needs `missing` to be 0. Hit starts use the loudest sample of the last 10 ms, so a low drum's cycles don't make it read late. Since Oct 31 the request also takes `moving: {warp, start_beat, start_marker}` and the anchor the same fields: Live's warp markers and where each clip sits, so everything is timed in song seconds (a 140 BPM loop warped to 165 is matched as it's heard; offsets are in heard ms). The device copies the original's warp markers and start/end to the matched clip. Known limit: quiet hits under a louder one's tail (hats under a kick) aren't found, so they move with the hit before them; a loop of one kind of sound works best.

## Vocal sync (Groove match, Oct 30)

`POST /groove/vocal` `{path, song_tempo, tempo?, beat_shift?, kick?: {path, start_beat, start_marker}, place?: {start_beat, beats_per_bar}}` returns `{tempo, tempo_source: "file name" | "measured" | "you", beats_tempo, song_tempo, beat_shift, key ("A minor", from the notes, Krumhansl profiles), confidence, sync: {kick_found, kick_offset_ms (the kick against Live's grid), bar, kicks_sec (where the kicks land in the vocal's file, for the picture)}, first_beat_sec, first_sound_sec, seconds, picture: {start_sec, step_sec, levels_db}, warp: {markers: [{beat_time, sample_time}] (2), start_marker, end_marker, bars_before}}`. `beats_tempo` is the tempo counted at the song's scale (half or double). The device sets the markers on the vocal's Arrangement clip with warping on in Complex Pro (live.js `vocal_warp`), with Undo; bridge messages `groove_pick {role: "vocal"}`, `vocal_analyze {tempo, beat_shift}`, `vocal_apply`, reply `vocal_done`.

Loops: the window sends `groove_pick {role: "moving" | "anchor"}`, `groove_run {follow, strength, nudge_ms}`, `groove_ab {play: "before" | "after"}` and `groove_next` (Nov 2: Match another loop, which clears the loop to fix and the try it would replace, and keeps the loop to follow). The bridge answers each with `groove_state`.

## Muse Spark actions

Muse Spark answers in JSON only:

```json
{ "reply": "Done. Bars 1 to 16 are one Intro now.", "actions": [ { "type": "set_section", "start_bar": 1, "bars": 16, "name": "Intro" } ] }
```

The device runs only these action types and drops anything else or anything out of range:

| type | fields | limits |
|---|---|---|
| `set_section` | start_bar, bars, name | name from Intro, Verse, Build, Chorus, Drop, Break, Outro |
| `merge_sections` | index | |
| `split_section` | index | |
| `use_live_markers` | | |
| `add_markers` | | |
| `groove_anchor` | kind, path? | |
| `groove_strength` | value | 0 to 1 |
| `groove_nudge` | ms | -20 to 20 |
| `eq_band` | freq_hz, gain_db, q, sections | gain -6 to +6 dB, on the producer's EQ Eight only |
| `limiter_ceiling` | db | -3 to 0 |
| `jump_to` | bar | |
| `vocal_sync` | vocal_track, kick_track?, tempo? | tracks from the set; tempo 40 to 300 (Oct 31) |
| `groove_match` | track, follow_track?, strength, nudge_ms | strength 0 to 1 (Muse may say 0 to 100), nudge -20 to 20 ms (Oct 31) |
| `check_again` | | the last Mix check's bars, Before and after (Oct 31) |
| `hear_song` | | (Oct 31) |
| `add_part_markers` | | after hear_song (Oct 31) |

Every applied action pushes an undo entry. (Oct 31: the planned `groove_anchor`, `groove_strength` and `groove_nudge` became `groove_match`'s fields. The bridge finds each track's Arrangement clip by name, the one under the playhead or the first, with live.js `track_clip`. Muse asks which track when the request doesn't say, and uses these, never sidechain, for "on time", "in sync", "tighten".)

## Device to UI messages

Over `jweb`, in both directions, as `window.max.outlet(name, jsonString)` and `bindInlet(name, fn)`:

- UI to device:
  - `check_mix`
  - `jump_to {bar}`
  - `apply {action}`
  - `undo`
  - `add_markers {sections}`
  - `groove {request}`
  - `open_window`
- Device to UI:
  - `state {tempo, key, theme, playing, song_bar}`
  - `progress {step, text, done, total}`
  - `mix_result {...}`: the engine's result plus `start_bar`, `chain`, and `song_end_bar` only when the 16 bars ran past the song's last bar (Live's `last_event_time`), so the UI can say the bars after it were silence. A check that starts past the end is refused before recording.
  - `sections {...}`
  - `groove_result {...}`
  - `error {text}`

### Ask Muse messages (as built, Oct 27)

- UI to device:
  - `ask {text, image_id?}`: one request. The bridge adds context and calls `POST /muse/ask`. `image_id`: a screenshot the page already sent to the engine (Nov 1).
  - `answer {exchange, index, yes, at}`: the producer answered a suggestion. Yes runs it. `at` (the exchange's time) finds it even after the history has shifted.
  - `undo`: undo the last change Aria made.
  - `clear_history`
  - `open_ask`: open the window with the Ask pop-up open.
  - `window_mode {mode: "full" | "left" | "right", screen: {x, y, w, h}}`: size and place the window. Left and right dock to that screen edge and float over Live. Saved in `~/Library/Application Support/Aria/window.json`.
  - `open_chat {screen}`: pop Ask Muse out. The main window shrinks to what to fix, with the chat stacked under it on the docked edge.
  - `open_window {screen}`: open the window in the saved layout (docked left by default). The screen size lets it dock on the first open.
  - `close_chat {back?}`: close the chat and put the main window back in the layout it had before the pop-out (full or docked). With `back: true` (the chat's Back button) it also reopens the main window if it was closed.
  - `close_window`: close the main window only. A popped-out chat stays and takes the full docked height.
  - `ask_key <0|1>` (from the device's "Ask key" live.text, not the page): the mapped key. A press opens Ask Muse; the bridge sends `voice_key {down}` for press and release, and the popped-out chat records while it's held (a second press sends, if Live sends presses only).
  - `minimize` / `restore`: a docked window becomes a 44 x 132 tab on its edge (a popped-out chat hides too); `restore` brings both back as they were.
  - `set_theme {theme: "sky" | "night"}`: the Light / Dark switch. The bridge saves it in `window.json`, puts it in every page's URL (`?theme=`) and sends `theme` to every page.
- Device to UI:
  - `ask_pending {request | null, auto?, image_id?}`: `auto` marks a step of Fix my whole mix (shown as a line, not your message).
  - `theme {theme}`: apply this theme now.
  - `undo_next {i, kind: "d" | "s", k} | null`: the change Undo will undo next (exchange index, a done item or an accepted suggestion, its index). Only that pill offers Undo; an undone change has `undone: true`. Null after a reload or when the top step isn't a pill (Home's Mark bar).
  - `layout {mode, side}`: where the bridge placed the window. `placed {}`: a window was just placed, so a page that slid out comes back even when its size didn't change.
  - `notice {text}`: a short note for the header (marker trouble, Live not ready), never a failed check.
  - `focus_ask {}`: put the cursor in Ask Muse's input (the mapped key was pressed).
  - `session {tempo, signature, markers: [{bar, name}], chain: {on_main, after}}`: about the set, sent on `ready`, after a check and after every ask. The window uses it for the header and the "Move Aria last on Main" warning.
  - `ask_log [exchange]`: the whole history, sent on `ready` and on every change. The bridge owns it and saves it in `~/Library/Application Support/Aria/ask-history.json` (last 100).
  - An exchange is `{request, reply, done: [{type, args, ok, text}], suggestions: [{type, args, why, answered?, result?: {ok, text}}], guides: [guide], reads: [read], image_id?, auto?, results?, problems: [text], error, notes: [text], at}`.

`set_section {name, first_bar, last_bar}` (Step 6, Oct 28): sections are Live's markers. The engine turns it into marker actions: the name at `first_bar`; a `delete_marker` for each marker inside the new section; and, unless a marker already sits at `last_bar + 1`, one there with the name of the section that was playing there ("After <name>" when nothing was marked), so the rest of the song keeps its names. Each is its own Undo.

More tools (Oct 28): `delete_marker {bar}`; `track_mute {track, on}` and `track_solo {track, on}` (not Main); `set_tempo {bpm}` (20 to 999); `sidechain {track, from_track, amount: light | medium | heavy}`, which the engine turns into `track_device` Compressor (S/C On, Threshold -18 / -24 / -30 dB, Ratio 4, Attack 1 ms, Release 150 ms) then `route_sidechain {track, from_track}` (live.js sets the Compressor's `input_routing_type`; Undo of the Compressor puts the routing back). Each runs right away with Undo.

How the bridge applies them (Oct 28 review): every change to Live (an answer's actions, Do it, Undo, markers, jumps, Ears, Check mix) runs through one queue, one at a time. `jump` replies `jump_done` when finished. A marker added, deleted or undone while Live plays: Live stops briefly, the marker is placed exactly, and the song carries on from where it was. Muse's `check_mix` is queued after the answer's changes.

Actions Muse may call: `jump_to`, `add_marker`, `eq_band`, `track_volume`, `track_eq`, `track_device`, `check_mix`, `undo`, and `suggest` for any of the first six. Plus `plugin_guide`, which shows rather than changes.

`track_device {track, device, settings: [{param, value | option | change}]}`: add one of Live's stock devices to a track (`track` may be `Main`), or adjust the one of that kind already there, and set its knobs. `device` is one of EQ Eight (added plain, with no settings), Compressor, Glue Compressor, Multiband Dynamics, Limiter, Gate, Reverb, Hybrid Reverb, Delay, Echo, Saturator, Overdrive, Roar, Drum Buss, Utility, Auto Filter, Auto Pan, Chorus-Ensemble, Phaser-Flanger, Redux, Channel EQ. Each setting names a knob by Live's own name and gives exactly one of: `value` (in the units Live displays: dB, %, Hz, times in ms), `option` (a menu item or On/Off) or `change` (a step from where it is now). Up to 8 settings. Gain, output, volume, makeup and ceiling knobs go up at most 6 dB at a time. The device sets each knob by its display (`str_for_value`) and replies `device_done {ok, added, text}`; Undo puts every knob back and removes a device Aria added.

`plugin_guide {plugin, track?, preset?, bands?}` (Oct 27, replaces `track_plugin`, which is on hold): Aria can't add or turn third-party plugins, so Muse shows how one should look. `context.plugin_presets` maps each plugin the request names (newest version only) to up to 8 of the producer's presets that fit, each `{name, folder, about, curve}` (curve: its biggest moves in words). Muse passes `preset` (Aria reads its real bands from the file) or its own `bands` (`[{shape, freq_hz, gain_db, q}]`, up to 8). The engine returns it in `guides: [{plugin, track, preset, about, source: "preset" | "aria", bands: [{band, shape, freq_hz, gain_db, q, dynamic_db}]}]`; nothing is applied in Live. The exchange keeps `guides`, and Ask Muse draws the curve and lists the bands. Only Pro-Q 3 and 4 text presets give bands.

`POST /muse/ask {text, context, image_id?}` returns `{reply, actions, suggestions, guides, reads, dropped, problems, error}`. `problems` gives one plain sentence per dropped call. When calls were dropped and none ran, `reply` is null, so a reply never claims a change that didn't happen.

## Answer key

`test-pack/answer-key.json` (Oct 29: one entry per planted file, with what was planted, what it measurably changed against the clean control, and what Aria should find):

```json
{
  "mixes": [ { "file": "mixes/B.wav", "bars": [33, 48], "planted": "Synth, EQ Eight bell 4 kHz +12 dB",
               "measured": "Mix +4.9 dB at 3.6 kHz against control.wav",
               "expect": [ { "kind": ["resonance", "harsh"], "hz": [3000, 5000] } ], "result_oct29": "found" } ],
  "control": { "file": "mixes/control.wav", "bars": [1, 16], "findings_oct29": ["..."] },
  "reference": null,
  "loops": []
}
```

### Show Muse a screenshot (Nov 1)

The page sends the picture straight to the engine, like the voice clip, because Max can't carry an image: `POST /muse/image` with the raw PNG or JPEG as the body (under 8 MB; the page scales it to 1600 px and sends a JPEG) returns `{image_id}` (32 hex). `GET /muse/image/{image_id}` serves it back for the chat. They're kept in `~/Library/Application Support/Aria/images/`. The request goes through the bridge as `ask {text, image_id}`, and the engine attaches the picture to Muse's message as an `image_url` part.

Muse answers with `screenshot_steps {what, seen: [text], steps: [text]}` (what the picture shows, the settings it can read that matter, the moves to make, up to 6 each), returned as `reads: [{what, seen, steps}]`. It's only accepted when a screenshot was sent. Numbers in `reads` count as known for the reply's number check: they were read off the producer's own screen and are shown beside it, labeled as read by Muse Spark. Nothing is applied in Live.

### Fix my whole mix (Nov 1)

`fix_mix {}`: the producer asked to fix the whole mix. Accepted only with findings. The bridge runs it in the queue, with one replay (Ian, Nov 1: two rounds meant hearing the same bars twice):

1. `POST /muse/fix {stage: "fix", context}`: Muse fixes the strongest problems (at most 4) with `eq_band`, `track_volume`, `track_eq` or `track_device`, checked like any Ask Muse call. Applied with Undo.
2. Check again (the same bars, `POST /mix/before-after`).
3. `POST /muse/fix {stage: "report", context, results}`, where `results` is the before-and-after `problems` list: no tools, Muse says how it went from `results` only.

Pressing it again is the next try. It builds on the first because of how Aria's EQ works (Nov 1, below).

### Aria's racks, the full toolbox in Fix all, and Aria names (Nov 1)

- `aria_rack {track, rack, macros: [{name, value}]}`: one of Ian's racks, built only from Live's stock devices. The catalog is `engine/aria_engine/racks.py`, the files are in `device/racks/` and the copier is `device/tools/make_aria_racks.py`. Each catalog entry says what the rack does and what each macro moves, read from the macro mappings in the files. `value` is 0 to 100, a percent of the macro's travel. The engine checks that the rack and each macro name exist.
- The bridge sends Aria's helper `{"cmd": "load_rack", "track", "name"}` (port 8766), which loads it from the User Library. install.sh copies the racks to Presets > Audio Effects > Audio Effect Rack > Aria. Then live.js `device <track> <name> <macros> 1 rack` finds the newest device with that name and sets the macros (`{param, percent}`). Undo removes the rack.
- Fix my whole mix can now use `sidechain` and `aria_rack` too, beside the EQ tools, `track_volume` and `track_device`. Muse's prompt has a playbook that picks the tool by problem:
  - kick or drums vs bass: always a sidechain
  - mud: low cuts first
  - harsh only on some hits: Multiband Dynamics
  - ringing: a notch
  - a buried sound: an EQ lift plus a light duck or cut on what covers it
  - punch, thin bass or a messy synth: Aria's racks
- Names: what Aria adds is "Aria <what it does>". The racks carry their Aria name inside the file. A stock device Aria adds is renamed "Aria <device>", or by its label (`track_device` `label`, e.g. "Aria Sidechain"). An EQ Eight is "Aria EQ".

### Undo everything (Nov 1)

`undo {}` undoes the last change, `undo {steps: n}` the last n (up to 50), and `undo {all: true}` everything Aria changed. The bridge calls live.js `undo` until it has done that many, or until there's nothing left. The reply carries `count`, and the chat crosses out that many changes.

### Faders to a level, and two things at once (Nov 1)

- `track_volume {track, change_db}` moves a fader by an amount (±6 dB), or `{track, to_db}` sets it to a level the producer named ("down to -15"), from -70 to +6 dB. live.js `volume <track> <change> <to|none>`.
- `context.tracks[].volume_db` is each fader's reading ("-inf" as -70), so Muse knows where it starts.
- The prompt says a message asking for several things gets a tool call for each in the same answer, and Muse never promises to do something "next".

### The EQ bands Aria already set (Nov 1)

Every Ask Muse and Fix my whole mix context carries `aria_eq: [{track, band, shape, freq, gain, q}]`, read from Live by `aria_eqs` → `aria_eqs {bands}` (Main is `"Main"`, tracks by name, values as Live shows them; bands that are off or flat are left out).

- The EQ Eight Aria adds is named "Aria EQ". Aria finds it by that name, so a reloaded set or device reuses it instead of adding another.
- A bell or shelf within half an octave of a band Aria set, with the same shape, deepens that band (`gain` is the extra amount). It doesn't take a new band. The reply says `now -5.00 dB ... (was -3.0 dB)`, and `eq_done` carries `was`.
- One band stops at ±6 dB. Past that, `eq_done` is `ok: false` and says to turn the track down or change the other sound. Muse's prompt says the same: when a sound needs more than about 6 dB less, use `track_volume`, a `low_cut`, or cut the other sound.
- `track_volume` never takes a fader past +6 dB, Aria's own ceiling (Ian: nothing should be louder). There it's `ok: false` and says to boost the part you want with EQ. For a buried sound Muse lifts that track's own range with `track_eq` (bell +2 dB) before raising the whole track.

`POST /muse/fix` returns `{reply, actions, problems, error}`; each `results` item gets `fixed` (change_db <= -3) before Muse sees it. Each step is an exchange with `auto: true` and the step's label as `request`; the report's exchange carries `results`, which the chat shows as one line per problem.
