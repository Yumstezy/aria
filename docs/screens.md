# Screens

Pixel references are in `design/screens/`. Each screen has a PNG and a static HTML file built from the design system classes, so markup can be copied straight across. The HTML shows one state. The behavior below is what has to be built.

Every window screen shares a side rail:
- the Aria mark
- links to Home, Mix check, Live analyzer, Groove match and Reference
- the Ask Muse button at the bottom

## 01 Home

- The reference card shows the reference's sections.
- A drop zone accepts a file or a clip dragged from Live.
- Four tool cards show a status tag each.
- The last Mix check appears as a Treble, Mids and Bass by section grid.
- A Fix first card offers "Fix it for me".

## 02 Analyzing

- Progress through the sections of both tracks, with the current one shimmering.
- Steps: loaded, mapped sections, comparing, Muse Spark writes the advice.
- Results tiles fill in as they arrive.

## 03 Mix check, Simple (default)

- The verdict hero ("3 things to improve") with six labeled bars.
- Fix first: a plain headline, what it means for the listener, then "Fix it for me" and "Hear the difference".
- Six status cards (Treble, Bass, Chorus lift, Mids, Loudness, Width). Each has an icon, a status word, one line and You vs Pro bars.
- "Where it happens": the song's sections, with the problem sections outlined. Clicking a section jumps the playhead.

## 04 Mix check, Detailed

The full charts against the reference:
- tonal balance
- section by band map
- stereo width
- energy across the song

Simple and Detailed sit on a segmented toggle in the header.

## 05 Live analyzer

A live spectrum of the master against the reference curve, with key root markers, plus LUFS meters, true peak and phase. It runs from the device's own analysis in real time and needs no engine call.

## 06 Groove match

- Steps row: Same speed, Same start, Follow (Reference, Hat loop or Straight).
- Before and After timing charts.
- How far off now: average and max ms, "Too small to hear" when in time.
- Strength slider, Nudge buttons and A/B.
- A one-line "what changes" bar with "New clip, original kept" and Undo.

## 07 Reference sections

- Two lanes: the reference (read only) and yours (editable).
- A dashed "Not sure" block asks a yes or no question.
- Editing tools: name chips, move end by 1 or 4 bars, merge, split, reset, and "Sections from: Detected or My Live markers".
- "Add markers to Live".
- The Ask Muse pop-up is shown open here, with suggestions that act on the sections.

## 08 Ask Muse states

The pop-up opens over any screen from the rail button or a mapped key or pad:
- Closed
- Listening: live transcript
- Did it: the change is made, with Undo
- Answered: chips with the numbers, and an offer that waits for a yes

## 10 to 12 Design fixes, round 1

Strip states before and after a check, Home on first run, and Mix check before the first check with Ask Muse open. See `docs/design-fixes.md`.

## 09 Device strip

The strip on the master channel. It is 400 x 169; see `10-strip-states.png`, which replaces the older wide strip in 09:
- Check mix
- Ask
- a Treble, Mids and Bass by section mini map against the pro track
- a Chorus lift verdict
- a link that opens the window

It uses the light theme by default, even over a dark Live arrangement, and switches to dark only when the producer picks it.
