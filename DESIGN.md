# Aria design

Frosted glass over soft blue. Show the problem as a picture first, say it in plain words second, give the numbers last. The full system is in `design/ds/` (tokens, CSS, chart helpers) and every screen is in `design/screens/`.

## Principles

- **Verdict first.** Lead with one plain status word (Good, Too bright, A bit light, Too flat, In time), then the number, then the chart.
- **Compare against the reference.** Every chart is your track vs the reference, section by section.
- **One idea per card.** Each card has an icon, a name, a status word, one line and a You vs Pro bar.
- **One primary action per screen**, in plain words ("Fix it for me"), with Undo beside it.
- **Simple by default.** Detailed charts are one tap away.

## Typography

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| figure | 44 / 44 | 300 | The one big number in a tile, tracking -0.04em, tabular |
| figure-sm | 28 / 30 | 300 | Number in small tiles and the device strip |
| title | 22 / 26 | 700 | Window title, one per window, tracking -0.03em |
| tile-title | 15 / 20 | 600 | Tile titles and headlines, tracking -0.02em |
| body | 13 / 18 | 400 | One sentence of explanation |
| control | 12 / 16 | 600 | Buttons and segmented labels |
| cap | 11 / 14 | 600 | Uppercase captions, tracking +0.06em |
| timestamp | 12 / 16 | 500 mono | Times, bars, dB and chip values |
| axis | 10.5 / 14 | 500 mono | Chart axis labels |

- Sans: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Geist, "Segoe UI", system-ui, sans-serif`
- Mono: `ui-monospace, "SF Mono", "Geist Mono", Menlo, Consolas, monospace`
- On a Mac the system font gives SF Pro, and we never ship SF Pro files. Geist and Geist Mono are bundled under the SIL Open Font License (`design/ds/fonts/`).
- Never add Helvetica, Coolvetica or Lemon Milk files. Their licenses don't allow it.

## Color

Two themes: **Night**, the dark default (Ian, Oct 27), and **Sky**, the optional light mode. The producer switches with the Light / Dark control at the bottom of the side rail. The choice is saved and applies to the window and the strip. Set `data-theme="sky|night"` on `.cp-stage`.

| Token | Sky | Night | Use |
|---|---|---|---|
| ground | #dcecfb | #070b14 | Base behind everything |
| orb-1 / orb-2 | #245fcf / #7cc0f7 | #1a3f8a / #0f2a5c | Circles behind the glass, so the frost has color |
| glass | rgba(255,255,255,.72) | rgba(16,24,42,.62) | Window frame and device strip |
| card | #ffffff | #111a2c | Tiles that hold charts and numbers |
| ink | #0c1e3c | #f5f8fc | Main text |
| ink-muted | #42526b | #b9c4d3 | Secondary text |
| ink-faint | #465570 | #97a3b4 | Captions, axis labels |
| action | #1f5fd0 | #6cb4ff | Primary button, playhead, reference marks |
| solid | #0c1e3c | #1a3566 | The one "Fix first" tile per view |
| hot | #c2410c | #ff9a5c | Too much vs the reference, a problem |
| cool | #2b6fd6 | #6cb4ff | Too little vs the reference |
| watch | #8a5600 | #ffc761 | Worth a look |
| good | #0d7a4b | #5fdba6 | Fine or fixed |

- Status color always comes with a word. Color is never the only signal.
- The blue hero tile runs from #1b4fb3 to #5aa2f0, with white text in its top half only.
- Text meets 4.5:1 contrast in both themes.

## Space and shape

- Spacing: 4, 8, 12, 16, 20, 32 (`space-1` to `space-6`). Bento gap 12, tile padding 20, window padding 32.
- Radius:
  - 8: segmented items and wells
  - 12: buttons
  - 20: tiles
  - 24: device strip
  - 28: window frame
  - pill: chips, tags and toggles
- Glass: `backdrop-filter: blur(24px) saturate(140%)`, a 1px light edge and a bright top rim.
- Use the design system classes as they are (`cp-glass`, `cp-card`, `cp-hero`, `cp-solid`, `cp-btn`, `cp-tag`, `cp-stat`, `cp-ask-pop`). Don't restyle them per screen. Colors come from `design/ds/tokens.css` only. (Oct 27: this replaced the earlier liquid glass panels.)
- Type in the UI is Geist (bundled), with Helvetica Neue by name as the fallback.
- Shadow: `0 10px 30px -12px` in blue-gray (Sky) or black (Night).
- Motion: 160 to 200ms ease-out. Charts may grow in over about 1s. Respect `prefers-reduced-motion`.

## Layout

- **Device on Main (Oct 28, Ian picked "Lamp"):** 150 x 169, like a stock Live device. A status light with one word (Ready, Listening 7 s, 3 to fix, Clear), Check (amber, its progress fills it) and Ask side by side, Open window below. Live's own neutral greys and amber, as `--live-*` tokens in `ui/src/styles/index.css` (Aria's design tokens are blue-tinted). The pop-out window keeps Aria's look. Everything else lives in the window.
- **Window:** a 184px side rail plus a 12 column bento. The rail holds Home, Mix check, Live analyzer, Groove match and Reference, with Ask Muse pinned at the bottom.
- **Ask Muse** is a pop-up over the current screen, never a page.

## Empty states and Ask

- Never a blank card. Say what will appear and the next step, and show the result's layout greyed out (`cp-empty`, `cp-tag-idle`, `cp-vs i.is-empty`, `cp-where.is-empty`).
- Setup steps use `cp-check`: done gets a green check, the next step is bold with a blue ring.
- The full window and the strip paint their own ground and orbs. Docked windows and the popped-out chat are tinted glass over Live (86% of the ground), by Ian's call on Oct 27.
- Ask Muse is a 400px pop-up over the current screen (`cp-ask-pop`). Each request gets one reply. A change that was asked for is done right away, with the done pill (`cp-did`) and Undo. Muse's own proposals use one `cp-suggest` card with Do it and Not now.

## Components

These live in `design/ds/components/bundle.css`. The `cp-` prefix is an internal code name.
- Surfaces: `cp-glass`, `cp-card`, `cp-hero`, `cp-solid`
- Controls: `cp-btn` (primary, light, ghost, sm), `cp-seg` (segmented), `cp-chip`, `cp-tag` (good, watch, hot)
- Status cards: `cp-stat` with `cp-vs` (You vs Pro bars), `cp-score`, `cp-where` (section strip)
- Ask: `cp-ask-btn`, `cp-ask-pop`, `cp-sug`, `cp-did` (the "done" pill with Undo), `cp-bubble`, `cp-composer`, `cp-voice`
- Charts: `window.CoProducer` in `bundle.js` provides spectrum, sectionMap, energy, stereo, timing, arrangement and analyzer. Each takes the engine's JSON.

## Voice

- Plain words first: "Your choruses are too bright", then "+3.8 dB at 2 to 5 kHz" as detail.
- Name the everyday thing: Treble, Mids, Bass, Loudness, Width, Chorus lift. Not presence range, LUFS or correlation.
- In simple views, say "the pro track" or "the track you want to sound like". Say "reference" in detailed views.
- Say what it means for a listener ("can sound harsh on earbuds").
- Short sentences, sentence case, no exclamation marks, no emojis, no em dashes.
- Only real measurements. If something can't be measured or Muse Spark is unavailable, say so. Never fill in a number.

## Brand

- Name: **Aria**, in the sans at 700.
- Logo not final. The placeholder is the bars icon in an action-blue rounded square. The candidate marks are in `design/brand/` (black, single shape).
