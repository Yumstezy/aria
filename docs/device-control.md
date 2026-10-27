# Device control (major change, Oct 27)

Ian's ask after the first real Ask Muse session in Live: talk to Aria the way you'd talk to an engineer sitting next to you.

- "cut the mids on the lead using Pro-Q 4"
- "raise it by .4 dB"
- "add some spacey reverb to the vocal"

While typing, the prompt autocompletes tracks, the devices on them, installed plugins and Aria presets.

Today Ask Muse can do only five things: jump, marker, one EQ Eight band on Main, one EQ Eight band on a track, and track volume. This change lets it work with **any device already on a track** and **add Live's own devices** with a sound in mind.

## What Live lets a device do

| | What we know | Status |
|---|---|---|
| List each track's devices | `track.devices`: name, `class_name`, and whether it's a plugin (`PluginDevice`) | Known (Aria already reads devices on Main) |
| Read and set any parameter | `device.parameters`: name, value, min, max, `str_for_value`. Aria already sets EQ Eight exactly this way (`setByDisplay`) | Known |
| Third-party plugin parameters (Pro-Q 4, Valhalla and so on) | Live exposes a plugin's parameters through the same list, but some plugins show only what the producer added with **Configure** | **Spike S1** |
| Add a Live device | `track.insert_device("Hybrid Reverb")` (Live 12). Aria already adds EQ Eight this way | Known for native devices |
| Add a third-party plugin | `insert_device` likely accepts only Live's own devices. Max for Live has no access to Live's browser | **Spike S2** (expect no) |
| Load a preset | No browser access, so Aria can't load a `.adv` file directly. A `.adv` file is gzipped XML, so Aria can read the values and set them on a fresh device | **Spike S4** |

If S2 fails, the answer to "use Pro-Q 4" when it isn't on the track is: *"Drop Pro-Q 4 on LEADS and ask again. I'll set it up."* Once it's on the track, Aria controls it like any other device.

## What changes

### 1. Context: Muse sees the devices
- `live.js` `trackList()` adds `devices: [{name, class_name, index, plugin}]` per track. Names only, so it stays small.
- Parameters are too many to send for every device, so the bridge sends them only for devices the request names, either an exact autocomplete mention or a name match in the text. Each parameter is sent as `{name, display, min_display, max_display}`, read back from `str_for_value`, so Muse sees "2.50 kHz", not 0.43.
- **Conversation memory:** the last 3 exchanges go along too, so "raise it by .4 dB" knows what "it" is.

### 2. New tools
| Tool | Does | Limits | Undo |
|---|---|---|---|
| `set_param` | Set one parameter on a device already on a track, to a value or by a change ("+0.4 dB") | Inside the parameter's own range. Gain-type changes over 6 dB in one step become a suggestion | Old value kept (`params`, as today) |
| `add_device` | Add one of Live's own devices to a track, optionally with an Aria preset ("spacey" reverb) | Native devices only, from a fixed list (below) | The device is deleted |
| `device_on` | Turn a device on or off | | Old state kept |

`eq_band` and `track_eq` stay as shortcuts for the common case.

Native devices `add_device` may add at first: EQ Eight, Compressor, Glue Compressor, Hybrid Reverb, Reverb, Delay, Echo, Saturator, Auto Filter, Chorus-Ensemble, Utility.

Every value still comes from the producer's words, the context or a preset, never invented (CLAUDE.md). The engine validates each call against the parameter list it was sent.

### 3. Presets
- **Aria presets** are small JSON files in `device/presets/`, for example `hybrid-reverb-spacey.json`: `{device, name, words: ["spacey", "big", "airy"], params: {"Decay": "6.0 s", "Dry/Wet": "25 %"}}`. Values are display strings, set through `setByDisplay`, so they come out exact.
- **The producer's own `.adv` presets:** Aria reads them from Live's User Library and converts them to the same form. Spike S4 checks that the names in the file match the parameter names the Live API shows.
- Muse picks a preset by its `words`. If none fits, it says so and adds the plain device.

### 4. Autocomplete in the prompt
- Typing `@` (or a word that matches) opens a list: tracks, devices on those tracks, installed plugins, Aria presets.
- Installed plugins come from a scan of `~/Library/Audio/Plug-Ins/{VST3,Components}` and `/Library/Audio/Plug-Ins/{VST3,Components}` (file names only, done by the bridge).
- A picked item becomes a chip and goes to the engine as a structured mention (`{kind: "device", track: "LEADS", device: "Pro-Q 4", index: 2}`), so there's no guessing.
- The same box is used in the strip, the inline Ask and the pop-up.

## Spike (Oct 28, half a day, in Live)
- **S1:** On a track with Pro-Q 4 (or any third-party EQ) and a Valhalla reverb, list every parameter the Live API shows, with its display text. Do we see "Band 1 Frequency" without Configure?
- **S2:** `insert_device("Pro-Q 4")` and the AU/VST3 names. Expect an error.
- **S3:** Set a Pro-Q 4 band gain to "-2.5 dB" with `setByDisplay`. Check it lands exactly.
- **S4:** Read a `.adv` preset Ian sends, and set its values on a fresh native device. Compare by ear and by the knobs.
- **S5:** Hybrid Reverb and Echo parameter names in Live 12.4, for the first Aria presets.

Pass: in Live, these three work in a row, each with Undo:
1. "cut 2 dB around 400 Hz on LEADS using Pro-Q 4" (Pro-Q 4 already on LEADS)
2. "raise it by .4 dB"
3. "add some spacey reverb to the vocal"

## Order
1. Spike S1 to S5 (Oct 28).
2. Context and `set_param` with Undo, plus conversation memory (Oct 29).
3. `add_device` with Aria presets and `.adv` import (Oct 30).
4. Autocomplete (Oct 31).
5. Polish and the demo take (Nov 1). Feature freeze Nov 2.

## From Ian
- **Presets:** a few `.adv` files for Live's own devices, each with two or three words for its sound. For example Hybrid Reverb "spacey, airy", Echo "dub throw", Saturator "warm", Glue Compressor "glue the drums". Five to ten is plenty. They go in `device/presets/` only if they're yours to share; otherwise they stay on your Mac.
- **Plugins you reach for most** (Pro-Q 4, and which reverb and compressor), so the spike tests the ones in the demo.

## Why it matters for judging (`docs/rubric.md`)
- **Use of Meta AI (25%):** Muse Spark reads the set, picks the device and parameters, and sets real values with Undo. That is much deeper tool use than five fixed actions.
- **Impact (30%):** works with the plugins producers already own, not only Live's EQ.
- **Demo (25%):** "add some spacey reverb to the vocal", heard straight away, is the clip.
