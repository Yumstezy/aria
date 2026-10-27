# Contracts

All engine calls are HTTP JSON on `http://127.0.0.1:8765`. Times are in bars (1-based) unless the field name says `beat` or `sec`. Levels are dB, loudness is LUFS, timing is ms.

## Sections

`POST /sections`

```json
{ "wav_path": "/abs/path/reference.wav", "tempo": 124.0 }
```

```json
{
  "tempo": 124.0,
  "key": "A minor",
  "first_downbeat_sec": 0.12,
  "sections": [
    { "name": "Intro", "start_bar": 1, "bars": 16, "confidence": 0.92 },
    { "name": "Verse", "start_bar": 17, "bars": 16, "confidence": 0.58,
      "note": "Louder and brighter, but the chords repeat the intro" }
  ]
}
```

A `confidence` below 0.7 shows the dashed "Not sure" block and the yes or no question in the UI.

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
- Sending `reference_path` returns 501 until build step 8.

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

Every applied action pushes an undo entry.

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
  - `mix_result {...}`
  - `sections {...}`
  - `groove_result {...}`
  - `error {text}`

### Ask Muse messages (as built, Oct 27)

- UI to device:
  - `ask {text}`: one request. The bridge adds context and calls `POST /muse/ask`.
  - `answer {exchange, index, yes}`: the producer answered a suggestion. Yes runs it.
  - `undo`: undo the last change Aria made.
  - `clear_history`
  - `open_ask`: open the window with the Ask pop-up open.
  - `window_mode {mode: "full" | "left" | "right", screen: {x, y, w, h}}`: size and place the window. Left and right dock to that screen edge and float over Live. Saved in `~/Library/Application Support/Aria/window.json`.
  - `open_chat {screen}`: pop Ask Muse out. The main window shrinks to what to fix, with the chat stacked under it on the docked edge.
  - `close_chat`: close the chat; the main window takes its full docked height again.
  - `close_window`: close the main window only. A popped-out chat stays and takes the full docked height.
- Device to UI:
  - `ask_pending {request | null}`
  - `ask_log [exchange]`: the whole history, sent on `ready` and on every change. The bridge owns it and saves it in `~/Library/Application Support/Aria/ask-history.json` (last 100).
  - An exchange is `{request, reply, done: [{type, args, ok, text}], suggestions: [{type, args, why, answered?}], problems: [text], error, notes: [text], at}`.

Actions Muse may call: `jump_to`, `add_marker`, `eq_band`, `track_volume`, `track_eq`, `track_device`, `track_plugin`, `check_mix`, `undo`, and `suggest` for any of the first seven.

`track_device {track, device, settings: [{param, value | option | change}]}`: add one of Live's stock devices to a track (`track` may be `Main`), or adjust the one of that kind already there, and set its knobs. `device` is one of EQ Eight (added plain, with no settings), Compressor, Glue Compressor, Multiband Dynamics, Limiter, Gate, Reverb, Hybrid Reverb, Delay, Echo, Saturator, Overdrive, Roar, Drum Buss, Utility, Auto Filter, Auto Pan, Chorus-Ensemble, Phaser-Flanger, Redux, Channel EQ. Each setting names a knob by Live's own name and gives exactly one of: `value` (in the units Live displays: dB, %, Hz, times in ms), `option` (a menu item or On/Off) or `change` (a step from where it is now). Up to 8 settings. Gain, output, volume, makeup and ceiling knobs go up at most 6 dB at a time. The device sets each knob by its display (`str_for_value`) and replies `device_done {ok, added, text}`; Undo puts every knob back and removes a device Aria added.

`track_plugin {track, plugin, settings, then_set}`: a third-party plugin the producer named. `plugin` must be one Muse was shown: `context.plugins` (installed plugins the request names, from Live's browser via the Remote Script) or `context.tracks[].plugins` (`[{name, knobs}]`, the plugins on each track and up to 48 knob names Live shows for each). `context.plugins` is `null` and `context.plugin_helper` is `"off"` when the Remote Script isn't on. Settings are the same as `track_device`, by the names in `knobs`. The bridge asks `live.js` for the plugin on the track (`device` with the plugin's name; the reply has `missing: true` when it isn't there), else sends `{"cmd": "load", "track": index, "name": plugin}` to the Remote Script on 127.0.0.1:8766 (`-1` is Main, where it lands before Aria), then sets the knobs; Undo removes a plugin Aria added. `then_set` is true when the plugin isn't on the track yet and the producer also asked for a change on it: once it's loaded, the bridge asks Muse again with `context.follow_up {added: [{track, plugin}], did: [text]}`, and applies only the `track_plugin` calls that come back. When Live shows only "Device On" for a plugin, the reply says to press Configure on it in Live.

`POST /muse/ask` returns `{reply, actions, suggestions, dropped, problems, error}`. `problems` gives one plain sentence per dropped call. When calls were dropped and none ran, `reply` is null, so a reply never claims a change that didn't happen.

## Answer key

`test-pack/answer-key.json`:

```json
{
  "mixes": [ { "file": "mix-harsh-chorus.wav", "problem": "treble", "sections": ["Chorus 1", "Chorus 2"] } ],
  "reference": { "file": "reference.wav", "sections": [ { "name": "Intro", "start_bar": 1, "bars": 8 } ] },
  "loops": [ { "moving": "perc.wav", "anchor": "hat.wav", "offset_ms": -19 } ]
}
```
