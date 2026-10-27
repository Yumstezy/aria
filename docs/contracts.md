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

## Answer key

`test-pack/answer-key.json`:

```json
{
  "mixes": [ { "file": "mix-harsh-chorus.wav", "problem": "treble", "sections": ["Chorus 1", "Chorus 2"] } ],
  "reference": { "file": "reference.wav", "sections": [ { "name": "Intro", "start_bar": 1, "bars": 8 } ] },
  "loops": [ { "moving": "perc.wav", "anchor": "hat.wav", "offset_ms": -19 } ]
}
```
