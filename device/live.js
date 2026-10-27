// Aria's Live API side. Runs in [v8 live.js].
// Commands come in from bridge.js. Replies go out to bridge.js as
// "<name> <URI-encoded JSON>", or "live_playing 0|1" when playback changes.
//
// Live applies changes a moment after each call, and Max timers fire late inside
// a device (build step 1.6), so wait for Live's own change notifications instead.
// Live refuses changes made inside a notification, so those go out as
// "defer <function>", through [deferlow], and come back in a moment later.

autowatch = 1;
inlets = 1;
outlets = 1;

let song = null;
let playObserver = null;
let timeObserver = null;
let cueObserver = null;
let pendingMarker = null;

function one(api, prop) {
  const v = api.get(prop);
  return Array.isArray(v) ? v[0] : v;
}

function ids(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 2) if (list[i] === "id" && list[i + 1] !== 0) out.push(list[i + 1]);
  return out;
}

function send(name, payload) {
  outlet(0, name, encodeURIComponent(JSON.stringify(payload)));
}

function beatsPerBar() {
  return one(song, "signature_numerator") * 4 / one(song, "signature_denominator");
}

// [live.thisdevice] bangs once the Live API is ready.
function bang() {
  song = new LiveAPI("live_set");
  playObserver = new LiveAPI(onPlaying, "live_set");
  playObserver.property = "is_playing";
  state();
}

function onPlaying(args) {
  if (args[0] === "is_playing") outlet(0, "live_playing", args[1]);
}

// Where Aria sits. It hears only what the devices before it pass on, so it must be
// last on Main to hear what listeners hear (a limiter after it can add 7 dB).
function chain() {
  const me = new LiveAPI("this_device");
  const track = new LiveAPI("id " + me.get("canonical_parent")[1]);
  const main = new LiveAPI("live_set master_track");
  const devices = ids(track.get("devices"));
  const after = devices.slice(devices.indexOf(Number(me.id)) + 1).map(function (id) {
    return one(new LiveAPI("id " + id), "name");
  });
  return { on_main: Number(track.id) === Number(main.id), track: one(track, "name"), after: after,
           track_path: track.unquotedpath, track_id: Number(track.id), main_id: Number(main.id),
           devices: devices.map(function (id) { return one(new LiveAPI("id " + id), "name"); }) };
}

function state() {
  if (!song) { send("live_error", { text: "Live isn't ready yet." }); return; }
  send("live_state", {
    tempo: one(song, "tempo"),
    signature: [one(song, "signature_numerator"), one(song, "signature_denominator")],
    beats_per_bar: beatsPerBar(),
    playing: one(song, "is_playing") === 1,
    song_beat: one(song, "current_song_time"),
    chain: chain()
  });
}

function play() {
  if (one(song, "is_playing") !== 1) song.call("start_playing");
}

function jump(bar) {
  song.set("current_song_time", (bar - 1) * beatsPerBar());
}

function cueAt(beats) {
  let found = null;
  ids(song.get("cue_points")).forEach(function (id) {
    const cue = new LiveAPI("id " + id);
    if (Math.abs(one(cue, "time") - beats) < 0.01) found = cue;
  });
  return found;
}

function nameMarker(cue) {
  const m = pendingMarker;
  pendingMarker = null;
  cue.set("name", m.name);
  send("marker_done", { bar: m.bar, name: m.name });
}

// Add a marker named <name> at <bar>, or rename the one already there.
// set_or_delete_cue toggles, so calling it on an existing marker would delete it.
function marker(bar) {
  const name = Array.prototype.slice.call(arguments, 1).join(" ") || "Aria";
  const beats = (bar - 1) * beatsPerBar();
  pendingMarker = { bar: bar, beats: beats, name: name };

  const existing = cueAt(beats);
  if (existing) { nameMarker(existing); return; }

  // Step 1: move the playhead, wait until Live reports it arrived.
  // Step 2: press set_or_delete_cue, wait until Live reports the new marker.
  cueObserver = new LiveAPI(onCues, "live_set");
  cueObserver.property = "cue_points";
  timeObserver = new LiveAPI(onTime, "live_set");
  timeObserver.property = "current_song_time";
  song.set("current_song_time", beats);
}

function onTime(args) {
  if (!pendingMarker || args[0] !== "current_song_time") return;
  if (Math.abs(args[1] - pendingMarker.beats) >= 0.01) return;
  timeObserver.property = "";
  outlet(0, "defer", "press_cue");
}

function press_cue() {
  song.call("set_or_delete_cue");
}

function onCues(args) {
  if (!pendingMarker || args[0] !== "cue_points") return;
  if (!cueAt(pendingMarker.beats)) return;
  cueObserver.property = "";
  outlet(0, "defer", "name_cue");
}

function name_cue() {
  const cue = pendingMarker && cueAt(pendingMarker.beats);
  if (cue) nameMarker(cue);
  else send("live_error", { text: "The marker disappeared before Aria could name it." });
}
