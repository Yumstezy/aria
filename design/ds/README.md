Aria is an AI co-producer: a calm assistant on Live's master channel. It points the way and the producer makes the call. The interface is frosted glass over soft blue, and it shows the problem as a picture before it says a word.

## Show, don't tell, against the reference

- Every chart compares your track to the reference the producer chose, section by section: chorus with chorus, verse with verse. Reference Breakdown provides the section map that lines the two tracks up.
- The context row names what we compare against: both tracks' tempo and key, and the style. Advice speaks to that style, not to a generic target.
- Each finding is a picture first: tonal balance, a section-by-band map, stereo width per band, the energy arc, hit timing in ms, and the two arrangements side by side. Words come second and stay short.
- One thin, large number per tile says how much (`figure`). Chips say where and when.
- `hot` means more than the reference, `cool` means less, grey means within 1 dB. A mix that matches its reference is all blue, white and grey.
- The one thing to fix first gets the navy `solid` tile. Everything else waits behind its page dashes.
- Draw charts with the helpers in `components/bundle.js` (the `CoProducer` namespace is the internal code name: `CoProducer.spectrum`, `sectionMap`, `stereo`, `energy`, `timing`, `arrangement`). They take the engine's JSON and colour themselves from the surface they sit on.

## Where this runs

- Build the interface in HTML, CSS and SVG inside Max's `jweb` object (embedded Chromium), not native Max UI. That's what makes glass and these charts possible.
- The device strip is 169px tall, Live's fixed device height; design it at about 700px wide. The MixCheck window opens from it and holds the full bento.
- `backdrop-filter` only blurs what's inside the web view. So every window paints its own `ground` with two big circles (`orb-1`, `orb-2`) for the glass to frost over.

## Surfaces

- **Glass:** the window frame and the strip. `glass`, 1px `glass-edge`, `blur-glass` with `saturate(140%)`, `shadow-tile` and `shadow-rim`. Hot appears here only as marks, never as text.
- **Card:** crisp white tiles inside the glass for charts and numbers. `card` with `card-edge`.
- **Hero:** a blue gradient tile (`tile-top` to `tile-bottom`) with a blurred dark `tile-core`, for the biggest chart in a view. White text in its top half only.
- **Solid:** the navy tile for the one fix. White text, light buttons, `hot-glow` and `good-glow` marks.
- Recessed tracks and wells use `well`. Gridlines use `hairline`; unlit ticks and empty bars use `track`.

## Voice

- Producer words, not engineer words: "Harsh build-up in the chorus", not "spectral centroid exceeds target".
- A note is a plain headline ("Your choruses are too bright"), one line on what it means for the listener, and the numbers in a chip or in Detailed view.
- Suggest, never decide. Buttons say what will happen in plain words: "Fix it for me", "Add 7 markers to Live".
- Sentence case, no exclamation marks, no emoji. Credit the model where it speaks: "Advice by Muse Spark".

## Type

- On a Mac, `sans` and `mono` resolve to SF Pro and SF Mono through the system font, so the device and demo video show the Apple look. Never ship SF Pro, Helvetica or Coolvetica files; their licenses don't allow it. Helvetica Neue can also be reached by name on a Mac if we ever prefer it.
- Elsewhere they fall back to Geist and Geist Mono, bundled under the SIL Open Font License (`fonts/Geist-OFL.txt`).
- `title` for the window title, `figure` and `figure-sm` for the one number, `tile-title` for headlines, `cap` for uppercase captions, `body` for the Try line, `timestamp` and `axis` in mono for every number.

## Space, shape, motion

- Tiles are 20px radius inside a 28px window frame; the strip is `radius-lg`. Buttons, chips, tags and segmented controls are pills.
- Bento gap is `space-3`, tile padding about `space-5`, window padding `space-6`.
- Motion is short and soft, 160 to 200ms ease-out. Charts may grow in from the baseline over about a second. Respect `prefers-reduced-motion`.

## Rules

- If the producer asks Muse for a change, it happens right away with Undo. Anything Muse suggests on its own waits for a yes. Every applied fix shows A and B and Undo.
- Clicking a chip, peak or section moves Live's playhead there.
- Text tokens meet 4.5:1 on the surface their note names, in both themes. Severity always carries a word.
- Keyboard focus is a solid 2px `focus-ring`, offset 2px.

## Say it plainly

Judges and new producers should get every screen at a glance. Lead with a verdict in everyday words, then the number, then the chart.

- **Verdict first:** one status word per thing: Good, Too bright, A bit light, Too flat, Rushing, In time. Color carries the same meaning (good, watch, hot), but the word always says it too.
- **One idea per card:** icon, name, status word, one short line, and a You vs Pro bar. Like a plant app's "Water: Medium".
- **Everyday names:** Treble, Mids, Bass, Loudness, Width, Chorus lift, Same speed, Same start. Not presence range, LUFS or correlation.
- **"Pro track":** in Simple views the reference is "the pro track" or "the track you want to sound like". Detailed views can say reference.
- **Numbers on request:** dB, Hz, LUFS and ms live in Detailed view and in tags or meta text, never as the headline.
- **Say what it means for the listener:** "can sound harsh on phones and earbuds", "too small to hear".
- **One big action:** each screen has one primary button in plain words, like "Fix it for me" or "Apply", with Undo next to it.
- **Simple by default:** Mix check opens in Simple. Detailed is one tap away for producers who want the charts.
