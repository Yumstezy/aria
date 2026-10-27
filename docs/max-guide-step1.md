# Max guide: the Step 1 test device

This builds a small throwaway device, `Aria Spike.amxd`. It answers the four Day 1 questions that can only be tested inside Live (build steps 1.5 to 1.8). It takes about 15 minutes. You don't need to know Max: you type a few boxes, connect them with wires and click.

Tested setup: Live 12.4 Suite with its built-in Max 9.1.4.

## Before you start

1. Start the engine: `engine/run.sh` from the repo, or `./install.sh` the first time.
2. Open a Live set with at least one **audio** clip, any audio file you own.

## Build it

1. **Add a blank device to the master track.** In Live's browser, open **Max for Live**, find **Max Audio Effect**, and drag it onto the **Master** track.
2. **Open the editor.** Click the small **Edit** button in the device's title bar, the icon next to the device name. A Max window opens. It already has two boxes joined by a wire: `plugin~` on top, `plugout~` below. Leave them alone. They pass the audio through.
3. **Save it in the repo first,** so Max can find our script files. Choose **File > Save As**, go to `aria/device/spike/` and save as **`Aria Spike.amxd`**.
4. **Make sure the patch is unlocked** (editable). If the lock icon at the bottom left is closed, press **Cmd+E**.
5. **Add the bridge box.** Click an empty spot and press **N** for a new object box. Type exactly:
   ```
   node.script bridge_spike.js @autostart 1
   ```
   Click outside the box. It should go solid, not dashed red.
6. **Add the Live API box.** Press **N** again and type:
   ```
   v8 live_spike.js
   ```
7. **Add a print box.** Press **N** and type `print spike`.
8. **Add one button per test.** Press **M** for a new message box, type the text, and repeat for each:

   | Message box | Connect its outlet to | Tests |
   |---|---|---|
   | `health` | left inlet of `node.script` | 1.5 device to engine |
   | `state` | left inlet of `v8` | reading tempo, play state and position |
   | `jump 17` | left inlet of `v8` | moving the playhead |
   | `marker 9 Verse` | left inlet of `v8` | 1.6 named marker |
   | `clippath` | left inlet of `v8` | 1.7 clip file path |
   | `makeclip` | left inlet of `v8` | 1.8 new clip from a file |

   To connect two boxes, hover over the small dot at the bottom left of a box (its outlet) and drag to the dot at the top left of the other box (its inlet).
9. **Connect the outputs.** Drag a wire from the left outlet of `node.script` to `print spike`. Drag another from the left outlet of `v8` to `print spike`.
10. **Save** (**Cmd+S**) and **lock** the patch (**Cmd+E**). Clicking a message box now sends it.
11. **Open the Max Console:** **Window > Max Console** (**Cmd+Shift+M**). Every result appears there.

When the device loads, the console should show `bridge_spike.js loaded` and `live_spike.js loaded`. If either box is dashed red, check that the `.amxd` is saved in `device/spike/`, next to the `.js` files.

## Run the tests

Click each message box in this order. Copy the line it prints in the Max Console into Discord or a message to Claude.

| Click | What to do first | Pass looks like |
|---|---|---|
| `health` | Engine running | `1.5 PASS: engine answered HTTP 200 in __ ms: {"status":"ok",...}` |
| `health` again | Stop the engine (Ctrl+C) | `1.5 FAIL: ... Is the engine running?`, an honest failure with no crash. Restart the engine afterwards. |
| `state` | Nothing | `state: tempo 124, playing 0, song time ...` with your real tempo |
| `jump 17` | Live stopped, Arrangement view | `jump PASS`, and Live's playhead visibly moves to bar 17 |
| `marker 9 Verse` | Arrangement view | `1.6 PASS: marker at bar 9 named "Verse"`, and a marker called Verse appears above bar 9 |
| `marker 9 Verse` again | Nothing | Still `1.6 PASS`, and the marker is **still there**, not deleted |
| `clippath` | Click an **audio** clip so it shows in the bottom panel | `1.7 PASS: "<clip name>" file_path = /Users/.../something.wav` |
| `clippath` | Click a **MIDI** clip | `1.7 FAIL: the selected clip is MIDI`, an honest failure |
| `makeclip` | Click an audio clip on an **audio track** | `1.8 PASS (Arrangement)` with a new copy of the clip after the end of the song, or `1.8 PASS (Session)` with the clip in the highlighted slot, or `1.8 FAIL ...` |

A **FAIL on `makeclip`** is a real answer, not a mistake. It means Groove match will save the fixed loop to a folder and you drag it in. Also copy any red error lines from the Max Console.

## When you're done

- Send Claude the console lines. Claude writes the answers into `docs/status.md`.
- Keep `Aria Spike.amxd`. The real `Aria.amxd` in Step 2 starts from what works here.
- You can delete the test marker and any test clips from your Live set.
