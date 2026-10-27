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
let pendingRemoval = null;   // a marker Undo is removing (set_or_delete_cue toggles it off)
const undoStack = [];        // every change Aria made, newest last

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
    chain: chain(),
    markers: markerList(),
    tracks: trackList()
  });
}

function trackList() {
  return ids(song.get("tracks")).map(function (id, i) {
    const t = new LiveAPI("id " + id);
    return { name: String(one(t, "name")), index: i, group: one(t, "is_foldable") === 1 };
  });
}

function trackAt(index) {
  return index < 0 ? mainTrack() : new LiveAPI("live_set tracks " + index);
}

function markerList() {
  const bpb = beatsPerBar();
  return ids(song.get("cue_points")).map(function (id) {
    const cue = new LiveAPI("id " + id);
    return { name: String(one(cue, "name")), bar: Math.floor(one(cue, "time") / bpb) + 1 };
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
  const before = String(one(cue, "name"));
  undoStack.push(m.isNew ? { kind: "marker_new", beats: m.beats, bar: m.bar, name: m.name }
                         : { kind: "marker_rename", id: Number(cue.id), bar: m.bar, name: before });
  cue.set("name", m.name);
  send("marker_done", { bar: m.bar, name: m.name, ok: true });
}

// Add a marker named <name> at <bar>, or rename the one already there.
// set_or_delete_cue toggles, so calling it on an existing marker would delete it.
function marker(bar) {
  const name = Array.prototype.slice.call(arguments, 1).join(" ") || "Aria";
  const beats = (bar - 1) * beatsPerBar();
  pendingMarker = { bar: bar, beats: beats, name: name, isNew: false };

  const existing = cueAt(beats);
  if (existing) { nameMarker(existing); return; }
  pendingMarker.isNew = true;

  // Step 1: move the playhead, wait until Live reports it arrived.
  // Step 2: press set_or_delete_cue, wait until Live reports the new marker.
  cueObserver = new LiveAPI(onCues, "live_set");
  cueObserver.property = "cue_points";
  timeObserver = new LiveAPI(onTime, "live_set");
  timeObserver.property = "current_song_time";
  song.set("current_song_time", beats);
}

function onTime(args) {
  const target = pendingMarker || pendingRemoval;
  if (!target || args[0] !== "current_song_time") return;
  if (Math.abs(args[1] - target.beats) >= 0.01) return;
  timeObserver.property = "";
  outlet(0, "defer", "press_cue");
}

function press_cue() {
  song.call("set_or_delete_cue");
  if (pendingRemoval) {
    const r = pendingRemoval;
    pendingRemoval = null;
    send("undo_done", { ok: true, text: "Removed the marker \"" + r.name + "\" at bar " + r.bar + "." });
  }
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

// ---------- EQ: one bell band on an EQ Eight on Main, with Undo ----------

const EQ_CLASS = "Eq8";
const BAND_PARAM = /^(\d) (Filter On|Filter Type|Frequency|Gain|Resonance) A$/;
let pendingEq = null;

function mainTrack() { return new LiveAPI("live_set master_track"); }

function findEq(track) {
  const devs = ids(track.get("devices"));
  for (let i = 0; i < devs.length; i++) {
    const d = new LiveAPI("id " + devs[i]);
    if (one(d, "class_name") === EQ_CLASS) return d;
  }
  return null;
}

// Parse a parameter's display string: "3.10 kHz" -> 3100, "-4.0 dB" -> -4, "0.71" -> 0.71
function displayed(param, value) {
  const t = String(param.call("str_for_value", value));
  const m = t.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  return parseFloat(m[0]) * (/k/i.test(t) ? 1000 : 1);
}

// Find the raw value whose display matches the target (the display is monotonic in the value)
function setByDisplay(param, target) {
  let lo = one(param, "min"), hi = one(param, "max");
  const rising = displayed(param, hi) >= displayed(param, lo);
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2, d = displayed(param, mid);
    if (d === null) break;
    if ((d < target) === rising) lo = mid; else hi = mid;
  }
  param.set("value", (lo + hi) / 2);
  return String(param.call("str_for_value", (lo + hi) / 2));
}

function bandParams(eq) {
  const bands = {};
  ids(eq.get("parameters")).forEach(function (id) {
    const p = new LiveAPI("id " + id);
    const m = String(one(p, "name")).match(BAND_PARAM);
    if (m) { (bands[m[1]] = bands[m[1]] || {})[m[2]] = p; }
  });
  return bands;
}

function eq(freq, gain, q, trackIndex) {
  const index = trackIndex === undefined ? -1 : trackIndex;
  const track = trackAt(index);
  let device = findEq(track);
  if (device) { applyEq(device, false, freq, gain, q, index); return; }
  const devs = ids(track.get("devices"));
  // On Main, add it just before Aria so Aria still hears the result; elsewhere at the end
  const at = index < 0 ? Math.max(0, devs.indexOf(Number(new LiveAPI("this_device").id))) : devs.length;
  try { track.call("insert_device", "EQ Eight", at); } catch (e) { post("insert_device failed: " + e + "\n"); }
  pendingEq = { freq: freq, gain: gain, q: q, index: index };
  outlet(0, "defer", "eq_continue");
}

function eq_continue() {
  const p = pendingEq;
  pendingEq = null;
  const device = findEq(trackAt(p.index));
  if (!device) {
    send("eq_done", { ok: false, text: "Aria couldn't add an EQ Eight. Put one on that track, then ask again." });
    return;
  }
  applyEq(device, true, p.freq, p.gain, p.q, p.index);
}

function applyEq(device, added, freq, gain, q, index) {
  const bands = bandParams(device);
  // A band that's switched off, inner bands first; the outer ones are usually cuts
  const order = ["4", "5", "3", "6", "2", "7", "1", "8"];
  let band = null;
  for (let i = 0; i < order.length; i++) {
    const b = bands[order[i]];
    if (b && b["Filter On"] && one(b["Filter On"], "value") === 0) { band = order[i]; break; }
  }
  if (!band) { send("eq_done", { ok: false, text: "All eight bands on your EQ Eight are in use. Free one, then ask again." }); return; }
  const b = bands[band];
  const keep = ["Filter On", "Filter Type", "Frequency", "Gain", "Resonance"].map(function (k) {
    return { id: Number(b[k].id), value: one(b[k], "value") };
  });
  undoStack.push({ kind: "eq", params: keep, deviceId: added ? Number(device.id) : null, band: band, track: index === undefined ? -1 : index });

  const types = b["Filter Type"].get("value_items");
  const bell = Array.isArray(types) ? types.indexOf("Bell") : -1;
  if (bell >= 0) b["Filter Type"].set("value", bell);
  const shown = {
    freq: setByDisplay(b["Frequency"], freq),
    gain: setByDisplay(b["Gain"], gain),
    q: setByDisplay(b["Resonance"], q)
  };
  b["Filter On"].set("value", 1);
  const where = index === undefined || index < 0 ? "Main" : "\"" + one(trackAt(index), "name") + "\"";
  send("eq_done", { ok: true, band: Number(band), added: added, shown: shown,
                    text: (added ? "Added an EQ Eight on " + where + ". " : "On " + where + ": ") + "band " + band + " " + shown.gain + " at " + shown.freq + ", Q " + shown.q + "." });
}

// ---------- Undo: reverse the last change Aria made ----------

function undo() {
  const u = undoStack.pop();
  if (!u) { send("undo_done", { ok: false, text: "Nothing to undo." }); return; }
  if (u.kind === "eq") {
    u.params.forEach(function (p) { new LiveAPI("id " + p.id).set("value", p.value); });
    if (u.deviceId) {
      const track = trackAt(u.track), at = ids(track.get("devices")).indexOf(u.deviceId);
      if (at >= 0) track.call("delete_device", at);
    }
    send("undo_done", { ok: true, text: u.deviceId ? "Removed the EQ Eight Aria added." : "Put EQ band " + u.band + " back how it was." });
  } else if (u.kind === "params") {
    u.params.forEach(function (p) { new LiveAPI("id " + p.id).set("value", p.value); });
    send("undo_done", { ok: true, text: "Put \"" + one(trackAt(u.track), "name") + "\" volume back." });
  } else if (u.kind === "marker_rename") {
    new LiveAPI("id " + u.id).set("name", u.name);
    send("undo_done", { ok: true, text: "Renamed the marker at bar " + u.bar + " back to \"" + u.name + "\"." });
  } else if (u.kind === "marker_new") {
    // set_or_delete_cue toggles: move there, wait for Live to arrive, then press it to remove
    pendingRemoval = { beats: u.beats, bar: u.bar, name: u.name };
    timeObserver = new LiveAPI(onTime, "live_set");
    timeObserver.property = "current_song_time";
    song.set("current_song_time", u.beats);
  }
}

// ---------- Track volume: nudge one track up or down, with Undo ----------

function volume(trackIndex, changeDb) {
  const track = trackAt(trackIndex);
  const fader = new LiveAPI(track.unquotedpath + " mixer_device volume");
  const before = one(fader, "value");
  const now = displayed(fader, before);
  if (now === null) { send("volume_done", { ok: false, text: "Aria couldn't read that track's volume." }); return; }
  const target = Math.min(6, now + changeDb);
  undoStack.push({ kind: "params", params: [{ id: Number(fader.id), value: before }], what: "volume", track: trackIndex });
  const shown = setByDisplay(fader, target);
  send("volume_done", { ok: true, text: "\"" + one(track, "name") + "\" " + (changeDb > 0 ? "up" : "down") + " " + Math.abs(changeDb) + " dB, now " + shown + "." });
}
