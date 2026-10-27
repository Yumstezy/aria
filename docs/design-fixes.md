# Design fixes, round 1

What's built is close in spirit, but it drifts from the design in a few places. Match these three new reference screens. Pull the latest `design/ds/components/bundle.css` first, since it adds the classes they use.

| Screen | Reference |
|---|---|
| Device strip, before and after a check | `design/screens/10-strip-states.png` and `.html` |
| Home, first run | `design/screens/11-home-first-run.png` and `.html` |
| Mix check before the first check, with Ask Muse open | `design/screens/12-mix-check-empty-ask.png` and `.html` |

Each also has a `-dark` version showing the optional dark mode. The light versions are the default.

The numbers in the screenshots are layout examples. Real values come from the engine.

## Everywhere

1. **Windows are never see-through.** The Mix check window currently shows Live's browser through it, which makes it hard to read. Every window and strip paints its own `ground` and the two orbs, then the glass. `backdrop-filter` only blurs what's inside the web view.
2. **Light is the default.** The original Sky look is the main look: light blue ground, white cards, the blue hero and the navy Fix first tile.
   - Dark is an option. Add a Light / Dark switch at the bottom of the side rail, above Ask Muse (see the screenshots), save the choice, and apply it to the window and the strip.
   - Dark uses the Night tokens exactly: ground `#070b14`, orbs `#1a3f8a` and `#0f2a5c`, action `#6cb4ff`. No purple glow.
   - If a color isn't in `tokens.css`, don't use it.
3. **Use the design system classes as they are:** `cp-glass`, `cp-card`, `cp-hero`, `cp-solid`, `cp-btn`, `cp-tag`, `cp-stat`, `cp-ask-pop`. Don't restyle them per screen. Type sizes come from the scale in DESIGN.md.
4. **One window layout.** Every window has the side rail and the bento:
   - The rail lists Home, Mix check, Live analyzer, Groove match and Reference, with Ask Muse pinned at the bottom.
   - Drop the Home and Mix check tab pill at the top of the pop-out window.
   - Drop the two panel icons next to Check mix on Home, unless they do something we've designed.
5. **No blank cards.** Every empty card says what will appear there and what to do next. Where possible, show the result's layout greyed out, so people learn the screen before the first check.
6. **The reference comes first.** Comparing with "the track you want to sound like" is the core idea. Until one is loaded, say so and offer to load it. Never show a comparison without one.
7. **Copy only promises what exists.** Home says "finds what's buried, muddy or clicking", but we don't measure those yet. Describe what Aria does today: compares your mix with the track you want to sound like, section by section, and fixes what you approve.

## Device strip (10)

The device is **400 x 169**. Use the `cp-strip is-mini` class from the latest bundle.css.

- **Two areas:**
  - Left (108px): the Aria mark, Check mix, Ask and an "Open window" link.
  - Right: one card that always shows the next step, or the one thing to fix.
- **No chat in the strip.** Ask opens the Ask Muse pop-up.
- Check mix is a plain primary button. Remove the small triangle icon.
- **The right card has three states:**
  1. No reference yet: a dashed drop area, "Load the track you want to sound like".
  2. Ready to check: the reference name, its sections as a row (`cp-secrow`), and "Play the busiest part, then press Check mix".
  3. After a check: "Fix first" with a status tag ("Too bright"), where it happens ("Both choruses"), the section row with the problem sections filled in, and a "Fix it" button. Add a note like "2 more in the window" when there are more findings.
- The full results live in the window, not the strip.

## Home (11)

- **The reference card leads.** "The track you want to sound like", with a drop zone for a file or a clip dragged from Live.
- **The Get started checklist** has four steps:
  1. Aria engine is running
  2. Aria is last on your Main track
  3. Load the track you want to sound like
  4. Play the busiest part, press Check mix

  Done steps get a green check. The next step is bold, with a blue ring.
- **Tool cards row:** Mix check, Live analyzer, Groove match, Reference, each with a real status ("Not run yet", "Listening", "Pick two loops", "Needs a track").
- **Section by section card:** a greyed placeholder until the first check, with a button pointing to the next step.
- No big empty area under the cards.

## Mix check (12)

- **Before the first check, show the Simple view's layout greyed out:**
  - the hero says "Not checked yet" and how to start
  - Fix first says "Nothing yet"
  - the six cards say "Not checked", with empty bars
  - "Where it happens" lists the reference's sections
- **Ask Muse is a pop-up**, about 400px wide, anchored bottom left by the rail's Ask button, over whatever screen is open. It's not a panel built into Mix check, and the page behind stays visible and usable.
- **Inside the pop-up:**
  - The header reads "Ask Muse about Mix check", with a close button. A History link is fine.
  - Each request gets one reply bubble, plus at most one "Muse suggests" card. Never two identical cards.
  - If the person asks for something Aria can do, do it right away. Show the "done" pill naming the change, with Undo (see `08-ask-muse-states.png`).
  - If Muse proposes something different from what was asked, like EQ Eight instead of Pro-Q 4, show a "Muse suggests" card with "Do it" and "Not now". After "Do it", the card becomes the done pill with Undo.

## What to stick to, always

- The picture first, plain words second, numbers last.
- Simple view by default, Detailed one tap away.
- One primary action per screen, in plain words.
- The Ask Muse pop-up over the current screen. Never a page, never inside the strip.
- Only real measurements and real Muse Spark output on screen. If something is missing, say so.
- Light (Sky) by default, Dark (Night) only when the producer picks it. Colors come from the tokens only.
- The screenshots in `design/screens/` are the source of truth for layout. When the build and a screenshot disagree, the screenshot wins, unless we decide otherwise and update the screenshot.
