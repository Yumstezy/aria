# Test pack

The real audio Aria is tested and demoed on. We must own everything in this folder: no commercial music, and nothing a tester hasn't cleared. The repo is public.

## What goes here

- **`reference.wav`:** the track the demo song is compared against.
- **The demo song:** the producer's bounce used on camera.
- **3 test mixes:** each one has a single planted problem in known sections, for example `mix-harsh-chorus.wav` with too much treble in both choruses.
- **2 loop pairs:** for Groove match, each with a known timing offset.
- **`answer-key.json`:** what's true about each file. The shape is in `docs/contracts.md`. It starts empty. Fill it in only from files that actually exist here, with the problems you actually planted.
- **`out/`:** files Aria writes. It's gitignored.

## Answer key entries

```json
{
  "mixes": [ { "file": "...", "problem": "treble | bass | mids | loudness | width | lift", "sections": ["..."] } ],
  "reference": { "file": "...", "sections": [ { "name": "...", "start_bar": 1, "bars": 8 } ] },
  "loops": [ { "moving": "...", "anchor": "...", "offset_ms": 0 } ]
}
```
