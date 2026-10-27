// Step 1 spikes 1.6 to 1.8, plus the playhead move from the bare bones milestone.
// Runs in [v8 live_spike.js], which has the Live API built in.
// Messages: state | jump <bar> | marker <bar> <name...> | clippath | makeclip
// Every result is posted to the Max Console, prefixed with the question number.

autowatch = 1;
outlets = 1;

function song() { return new LiveAPI("live_set"); }

function one(api, prop) {
  const v = api.get(prop);
  return Array.isArray(v) ? v[0] : v;
}

// Beats (quarter notes) at the start of a 1-based bar, using the song's time signature.
function barToBeats(bar) {
  const s = song();
  const perBar = one(s, "signature_numerator") * 4 / one(s, "signature_denominator");
  return (bar - 1) * perBar;
}

// LiveAPI lists come back as ["id", 3, "id", 5, ...].
function ids(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 2) if (list[i] === "id" && list[i + 1] !== 0) out.push(list[i + 1]);
  return out;
}

function report(text) {
  post(text + "\n");
  outlet(0, text);
}

// Live applies Live API changes a moment later, so reading back right away
// returns the old value. Wait before each check. Keep tasks so they aren't collected.
const LIVE_SETTLE_MS = 150;
const pending = [];
function later(fn) {
  const t = new Task(function () { pending.splice(pending.indexOf(t), 1); fn(); }, this);
  pending.push(t);
  t.schedule(LIVE_SETTLE_MS);
}

function cueAt(beats) {
  let found = null;
  ids(song().get("cue_points")).forEach(function (id) {
    const cue = new LiveAPI("id " + id);
    if (Math.abs(one(cue, "time") - beats) < 0.01) found = cue;
  });
  return found;
}

function cueList() {
  return ids(song().get("cue_points")).map(function (id) {
    const cue = new LiveAPI("id " + id);
    return one(cue, "name") + " @ beat " + Math.round(one(cue, "time") * 100) / 100;
  }).join(", ") || "none";
}

function state() {
  const s = song();
  report("state: tempo " + one(s, "tempo") +
    ", playing " + one(s, "is_playing") +
    ", song time " + one(s, "current_song_time") + " beats" +
    ", signature " + one(s, "signature_numerator") + "/" + one(s, "signature_denominator"));
}

function jump(bar) {
  const beats = barToBeats(bar);
  song().set("current_song_time", beats);
  later(function () {
    const now = one(song(), "current_song_time");
    report((Math.abs(now - beats) < 0.01 ? "jump PASS" : "jump FAIL") + ": asked for bar " + bar + " (" + beats + " beats), playhead now at " + now);
  });
}

// 1.6 Add a named marker at a bar. set_or_delete_cue toggles, so it would delete
// a marker already at that spot. Check first and rename instead.
function marker(bar) {
  const name = Array.prototype.slice.call(arguments, 1).join(" ") || "Aria";
  const beats = barToBeats(bar);

  function nameIt(cue, how) {
    cue.set("name", name);
    later(function () {
      report("1.6 PASS (" + how + "): marker at bar " + bar + " named \"" + one(cue, "name") + "\"");
    });
  }

  const existing = cueAt(beats);
  if (existing) { nameIt(existing, "renamed existing"); return; }

  song().set("current_song_time", beats);
  later(function () {
    const now = one(song(), "current_song_time");
    if (Math.abs(now - beats) >= 0.01) {
      report("1.6 FAIL: playhead didn't reach bar " + bar + " (at beat " + now + "), so no marker was added");
      return;
    }
    song().call("set_or_delete_cue");
    later(function () {
      const cue = cueAt(beats);
      if (cue) nameIt(cue, "new");
      else report("1.6 FAIL: no marker at bar " + bar + " after set_or_delete_cue. Markers now: " + cueList());
    });
  });
}

function selectedAudioClip() {
  const clip = new LiveAPI("live_set view detail_clip");
  if (!clip.id || clip.id === "0") return { error: "no clip selected. Click an audio clip first." };
  if (!one(clip, "is_audio_clip")) return { error: "the selected clip is MIDI. Select an audio clip." };
  return { clip: clip, path: one(clip, "file_path") };
}

// 1.7 Read the audio file path of the selected clip.
function clippath() {
  const sel = selectedAudioClip();
  if (sel.error) { report("1.7 FAIL: " + sel.error); return; }
  report("1.7 PASS: \"" + one(sel.clip, "name") + "\" file_path = " + sel.path);
}

// 1.8 Create a new audio clip from a file. Uses the selected clip's own file,
// so no extra audio is needed. Tries Arrangement first, then Session.
function makeclip() {
  const sel = selectedAudioClip();
  if (sel.error) { report("1.8 FAIL: " + sel.error); return; }

  const track = new LiveAPI("live_set view selected_track");
  if (!one(track, "has_audio_input")) { report("1.8 FAIL: select a clip on an audio track"); return; }

  // Arrangement: append after the end of the song.
  const before = ids(track.get("arrangement_clips")).length;
  const end = one(song(), "song_length");
  try { track.call("create_audio_clip", sel.path, end); } catch (e) { post("arrangement call threw: " + e + "\n"); }
  later(function () {
    const after = ids(track.get("arrangement_clips")).length;
    if (after > before) {
      report("1.8 PASS (Arrangement): new clip on \"" + one(track, "name") + "\" at beat " + end);
      return;
    }

    // Session: the highlighted slot, if it's empty.
    const slot = new LiveAPI("live_set view highlighted_clip_slot");
    if (!slot.id || slot.id === "0" || one(slot, "has_clip")) {
      report("1.8 FAIL: no new Arrangement clip, and no empty Session slot highlighted to try instead");
      return;
    }
    try { slot.call("create_audio_clip", sel.path); } catch (e) { post("session call threw: " + e + "\n"); }
    later(function () {
      if (one(slot, "has_clip")) report("1.8 PASS (Session): new clip in the highlighted slot");
      else report("1.8 FAIL: create_audio_clip did not add a clip in Arrangement or Session");
    });
  });
}

post("live_spike.js loaded. Click the test messages.\n");
