<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="site/public/brand/aria-logo-white.png">
    <img src="site/public/brand/aria-logo-black.png" alt="Aria" width="180">
  </picture>
</p>

<h1 align="center">Aria hears your mix and fixes it, inside Ableton.</h1>

<p align="center">
  An AI co-producer on your Main track. It finds the sounds that clash or stick out,<br>
  <b>Meta's Muse Spark</b> explains them in plain words and makes the fix in Live,<br>
  and Aria measures again to prove it worked.
</p>

<p align="center">
  <a href="https://aria-sigma-gilt.vercel.app/judges"><b>For judges</b></a> ·
  <a href="https://aria-sigma-gilt.vercel.app">Product page</a> ·
  <a href="#try-it">Try it</a> ·
  <a href="#results">Results</a> ·
  <a href="#challenges">Challenges</a>
</p>

<p align="center"><sub>Meta Global AI Developer Hackathon · Indie track · built Oct 26 to Nov 4, 2026 · 172 commits · 153 engine tests</sub></p>

<br>

<img src="site/public/img/judges/home.png" alt="Aria's Home in the full window, on a real song">

<p align="center"><sub>Home, full window, on Ian's own song: what to fix, the reference, the song's parts and the live analyzer. Every screenshot in this README is the real app with real results.</sub></p>

---

## How this maps to the rubric

| | Weight | Where to look |
|---|---|---|
| **Impact** | 30% | [Who it helps](#impact) |
| **Use of Meta AI** | 25% | [Meta's models in every screen](#meta-ai) |
| **Technical** | 20% | [How it's built](#how-its-built) · [Results](#results) · [Challenges](#challenges) |
| **Demo** | 25% | [The seven tools](#the-seven-tools), screen by screen |

---

## Impact

**Finishing a song stops at the mix.** Most producers learn to make a drop long before they learn why it sounds muddy next to the songs they love. The usual answers are an engineer, a course, or guessing with plugins. Aria works where they already are: in Ableton, on their own song.

| It finds the problem | It says it plainly | It fixes it, and proves it |
|---|---|---|
| Not a score out of 100. The sound, the range and the bars: *"SYNTH buried, 1 to 4 kHz, bars 33 to 48."* | Muse Spark writes it like a producer would say it, from measured numbers only, never canned text. | One tap makes the change in Live, with Undo. **Check again** measures the same bars at the same loudness and marks it **Fixed**. |

**Who it's for:** bedroom and indie producers in Ableton Live, starting with EDM, who can make the parts but can't yet hear why the whole doesn't hold up.

**What it never does:** invent a number, judge your taste, or change a third-party plugin. It changes Live's own devices; for a plugin, it draws how it should look and you set it.

---

## Meta AI

Meta's models do the work you see, in every screen. Not a chat box on the side.

| Model | What it does in Aria |
|---|---|
| **Muse Spark** `muse-spark-1.3` | Turns the engine's measurements into plain advice and a concrete fix, as JSON that Aria validates. It only ever sees measured numbers. |
| | **Drives Live through tool calling: 21 actions**: EQ, volume, 20 stock devices, sidechain, markers and sections, tempo, mute, solo, plugin guides, groove match, vocal sync, Check again, hearing the song, Undo. |
| | **Asks instead of guessing.** A real reply from testing: *"Which vocal track do you mean, VOCAL TEST or Vox 2?"* |
| | Names the parts of a song (Intro, Build, Drop, Break, Bridge, Outro) from their measured loudness and shape. |
| **Muse Voice Transcribe** `muse-voice-transcribe-1.0` | Hold the mapped key and say it. *"Cut the mud on the bass"* came back as text in 1.4 s, then ran like a typed request. |
| **Demucs** `htdemucs` (Meta AI research) | Splits each Mix check into vocals, drums, bass and other, so Aria can say which sound covers which. |
| **Audiobox Aesthetics** | Scored all 99 rated mixes as a feature for the mix model. A planned side experiment, [reported honestly](#what-didnt-work): it didn't beat loudness, so it didn't ship. |

> **The guardrail.** Muse Spark never touches Live directly. It answers with actions from a fixed menu; Aria checks each one (the track exists, the gain stays within ±6 dB, the knob's unit fits) and only then applies it, with Undo. If Muse is down, Aria shows the measurements and says advice is unavailable. It never falls back to canned text.

---

## The seven tools

### Mix check

Records 16 bars of your Main track, splits it with Demucs, and finds what clashes or sticks out: buried sounds, mud, harsh hits, ringing notes, bass clicks, tracks that fight. Each problem is marked on the spectrum by its kind (icon) and its range (color, lows red to highs violet). Compare with a reference song, part for part: *"Against their Drop."*

<img src="site/public/img/judges/mixcheck.png" alt="Mix check against a reference song">

<table>
<tr>
<td width="50%" valign="top">

### Fix it, then prove it

**Fix it** asks Muse Spark for the change, and Muse makes it in Live with Undo. The problem moves to a small *done* group, out of the way. **Check again** plays the same bars and measures them at the same loudness: 3 dB or more lower is **Fixed**, otherwise it comes back with **Fix it again**.

*Here: a planted harsh boost, 6.9 dB less after the fix.*

</td>
<td width="50%"><img src="site/public/img/judges/fixed.png" alt="Before and after, a problem confirmed fixed"></td>
</tr>
<tr>
<td width="50%"><img src="site/public/img/judges/ask.png" alt="Ask Muse making changes in Live"></td>
<td width="50%" valign="top">

### Ask Muse

Type or say what you want. *"Make the drums crispier." "Sync my vocal to the kick." "Tighten the bongo to the kick at 70%."* It happens right away, each change with Undo. Anything Muse suggests on its own waits for a yes. The ↑ key brings back what you asked before.

*Real requests from testing, typos and all, with what Aria did in green.*

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Groove match

Two loops flamming? Aria finds every hit to the millisecond, moves each one onto the grid or onto another loop's feel, and writes a new clip under the original (kept, muted). Nothing is stretched. Warped loops are timed the way you hear them, through Live's warp markers.

*A perc loop following a kick loop: worst hit 15.5 ms off, now 0.*

</td>
<td width="50%"><img src="site/public/img/judges/groove.png" alt="Groove match result"></td>
</tr>
<tr>
<td width="50%"><img src="site/public/img/judges/vocal.png" alt="Vocal sync with the kick"></td>
<td width="50%" valign="top">

### Vocal sync

Drop in an acapella. Aria reads its original tempo and key, puts its first beat on your kick, and warps it to your song with Live's own warp markers, which it reads back to be sure they stuck. Undo puts it back.

*Ian's vocal: 148 BPM, A minor, beat 1 on the kick at bar 9, which sits 22.6 ms after Live's grid.*

</td>
</tr>
</table>

### Arrangement

Aria hears the whole song once, finds its parts on a 4-bar grid, and Muse Spark names them. Rename or move them, then add them to Live as markers. Every Mix check then knows which part it heard, and compares your drop with their drop.

<img src="site/public/img/judges/arrangement.png" alt="The parts of two songs, named by Muse Spark">

### Live analyzer

Your Main track as it plays: a sixth-octave spectrum against your reference, loudness to the BS.1770 standard, a polar stereo view with a phase meter, and a waveform colored by where the sound is (red lows, green highs).

<img src="site/public/img/judges/analyzer.png" alt="Live analyzer">

---

## How it's built

**One rule:** the engine reports only what it measured. If it can't measure something, it says so and returns nothing. Muse gets only those numbers, and its JSON is checked before anything happens.

```mermaid
flowchart LR
  subgraph Live["Ableton Live"]
    D["Aria.amxd on Main<br/>records, Live API,<br/>live analyzer"]
    W["Aria window<br/>React in Live's web view"]
  end
  B["Bridge<br/>Node for Max<br/>Undo stack"]
  E["Engine<br/>Python, FastAPI<br/>127.0.0.1:8765"]
  M["Muse Spark<br/>Muse Voice Transcribe"]
  X["Demucs"]
  D <--> B
  W <--> B
  B <--> E
  E <--> M
  E --> X
```

| Part | What it does |
|---|---|
| **The device** (`device/Aria.amxd`) | Sits last on the Main track. Records bars for a check, reads tempo, clips and warp markers, sets EQ, devices, markers and warp markers through the Live API, and runs the live analyzer: 55 sixth-octave bands, K-weighted loudness and a stereo buffer, 20 times a second. |
| **The bridge** (`device/bridge.js`) | Node for Max. Carries messages between Live, the screens and the engine, keeps every change on an Undo stack, and starts the engine when it's needed. |
| **The engine** (`engine/`) | Python. Measures, splits with Demucs, and talks to Muse Spark. Returns numbers; the words come from Muse. |
| **The screens** (`ui/`) | React, TypeScript and Tailwind, built into single HTML files that Live's own web view loads: the strip on the device and the window docked over Live. |

**How it measures**

- **Clarity rules:** buried sounds, mud, harsh bursts, ringing notes, bass clicks and clashing tracks, from the split parts or from the producer's own tracks (Aria Ear), each with its bars and range.
- **Always at the same loudness:** reference compares and before and after are loudness matched (pyloudnorm) and compared in third and twelfth octaves.
- **Hits to the millisecond:** onsets pinned to the start of the attack, moved by slicing just before each hit (no stretching), then found again in the new file by cross-correlation. Warped clips are timed through Live's warp markers.
- **Vocals and kicks:** tempo from how the vocal repeats over 1, 2, 4 and 8 beats, key from the notes it uses (Krumhansl profiles), kicks timed by their full sound and counted as kicks by the low band.
- **Song parts:** tempo and a 4-bar grid, parts of 8 to 32 bars, repeats share a label, Muse Spark names them.

---

## Results

Every number came from real audio this week, and the code that produced it is in this repo.

| Result | How it was measured |
|---|---|
| **14.9 ms → 0 ms** average lateness of a perc loop following a kick loop | Ian's loops at 165 BPM; all 32 hits found again by cross-correlation |
| **5.5 ms** worst, for a 140 BPM loop warped into a 165 song (before warp-aware timing, 21 hits moved up to 39 ms the wrong way) | Same loop, same kick, timed through Live's warp markers |
| **6.9 dB less** for a planted harsh boost after the fix, so **Fixed** | Test mix B against the clean control, loudness matched |
| **126.6 BPM** read from a 126 BPM acapella (190 before the fix); key **G# minor**, right | The vocal alone, no beat underneath |
| **22.6 ms**: how far Ian's kick sits after Live's grid, so a vocal lands on the kick, not the grid | His drum and vocal stems |
| **-9.2 LUFS** in the Live analyzer on Ian's drop, the same as the engine measured for that recording | BS.1770 in the device against pyloudnorm in the engine |
| **5 of 5** real requests to Muse Spark got the right tool or a clarifying question | Sync, groove at 70%, a sidechain, an unclear vocal, "did that work" |
| **Same part names three runs in a row** for Ian's reference song | `POST /sections`, Muse Spark naming, Oct 29 |

### What didn't work

- **The mix model didn't ship.** Trained on 99 mixes people rated good, mid or bad (71 producer groups): best **0.49** balanced accuracy against **0.45** for loudness alone (0.33 is a coin toss), and it failed the shuffle test (p = 0.70). With Meta's Audiobox scores added: **0.51**, better than chance (p = 0.01), but it beat loudness in only 52% of test rounds against a bar of 80%. Raters preferred louder mixes. Next: spectral shape only, good against bad ([`ml/HANDOFF-shape-model.md`](ml/HANDOFF-shape-model.md)).
- **One vocal still reads the wrong tempo:** Ian's own 148 BPM stem reads 192. So every reading comes with the next likely ones, and the song's own tempo is one tap.
- **Broad boosts are hard to hear without a reference:** on three test mixes with one planted problem each, the clarity rules found the spikes but missed a broad low-mid boost (1 of 3). That's why the reference compare exists.

---

## Challenges

Found by using Aria on real songs inside Live, every day of the build.

| What broke | How we fixed it |
|---|---|
| **A blank device.** The strip came up empty in Live. | Live's audio wasn't running, which stalls Max's message queue, so the page was never told to load. The device now carries a page of its own that says so after 4 seconds. |
| **Max's message limit.** A groove result was 50 KB; Max passes its web view about 32 KB, so the screen hung. | Results are packed (7 KB), and the bridge refuses anything too long with a plain error instead of sending it broken. |
| **Live drops warp markers without a word.** Vocal sync set two markers, Live kept one, and the vocal played half time. | A marker every 4 bars, set in rounds, read back from Live. Aria only says Synced when they're there. |
| **Kicks read 30 ms late.** Filtered to the low end, a kick's body builds slowly. | Each hit is timed by its full sound; the low band only decides whether it's a kick. |
| **Vocals in three against two.** A 126 BPM acapella read 190. | Counting how the vocal repeats over whole bars, not single beats. |
| **Warped loops in the wrong time.** A 140 BPM loop in a 165 song was matched in its own file time. | Aria reads each clip's warp markers and works in the song's time. The matched clip gets the same warp. |
| **"On time" became a sidechain.** Before Muse had the tools, it read "set my vocal on time with my kick" as ducking. | Timing tools, a rule that timing words never mean sidechain, and a question when the track isn't clear. |
| **A comparison nobody understood.** "Against good mixes" confused our own producer, and 30 mixes aren't a standard. | Taken out the same day. Without a reference, Aria finds clashes and problem spots only. |

---

## Try it

You need a Mac, **Ableton Live 12 Suite** (Max for Live) and **Python 3.11** (`brew install python@3.11`).

```sh
git clone https://github.com/Yumstezy/aria
cd aria
./install.sh
```

One script, run once:

1. **The engine:** a Python environment with Aria's libraries, and `engine/.env`. Put your Meta Model API key in it (`MODEL_API_KEY=...`).
2. **Live's browser:** Aria and Aria Ear appear under **User Library > Presets > Audio Effects > Max Audio Effect > Aria**. Drag them onto a track like any effect. They're links to this folder, so `git pull` updates them.
3. **The Remote Script**, for "Name my tracks". In Live, once: Settings > Link, Tempo & MIDI > Control Surface: **Aria**.

Then open Live and drag **Aria** onto the Main track, last. Aria starts its engine by itself when it needs it.

<details>
<summary>For developers</summary>

- Engine tests: `cd engine && .venv/bin/pytest` (153 passing)
- Screens: `cd ui && npm install && npm run build` (the built pages in `ui/dist/` are committed, so running Aria never needs Node)
- Websites: `cd site && npm run build` (the product page and `/judges`)
- The JSON between device, bridge, engine and screens: [`docs/contracts.md`](docs/contracts.md)
- Where things stand, day by day: [`docs/status.md`](docs/status.md)

</details>

---

## The repo

```
device/    Aria.amxd and Aria Ear.amxd, the bridge (bridge.js), Live API helpers (live.js), the stereo scope (scope.js)
engine/    the FastAPI engine: clarity, reference, sections, groove, vocal, Muse Spark, voice, with tests
ui/        the screens (React), built to ui/dist for Live's web view
ml/        the rated-mix model: data manifest, measurements, training, results, and the next experiment
site/      the product page and the judges' page
design/    the design system and screen references
docs/      build steps, contracts, the rubric, status
```

---

## Rules we built by

- **No invented data.** The engine reports only what it measured; the UI never shows example numbers; Muse gets only measured numbers and its JSON is validated. If the model fails, the screen says advice is unavailable and why.
- **Plain words.** "Your choruses are too bright" first, then "+3.8 dB at 2 to 5 kHz" as the detail. No jargon on the main screens.
- **The producer stays in charge.** Every change has Undo. What you ask for happens; what Muse suggests waits for a yes. Third-party plugins are never changed, only shown.

## Licenses and credits

- **Demucs:** the code is MIT, but its author says the license of the trained weights is unclear (trained partly on MUSDB, which is for research use). Aria uses it in this hackathon prototype only, for non-commercial use. The weights download from Meta on first use and are not in this repo.
- **No commercial music** anywhere in the repo or the video. The 99 rated mixes were given to us or released for free download for us to use; only their measurements are in the repo, never the audio.
- **Fonts:** the system font on Mac, Geist bundled under the OFL.
- Built by **Ian** and **Raghav**, with Claude Code.
