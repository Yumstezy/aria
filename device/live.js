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

// After live.js reloads (autowatch), Live doesn't bang again: connect on first use instead
function ensureSong() {
  if (song) return true;
  try { bang(); } catch (e) { post("Live API not ready: " + e + "\n"); }
  return !!song;
}

function state() {
  if (!ensureSong()) { send("live_error", { text: "Live isn't ready yet." }); return; }
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
    return { name: String(one(t, "name")), index: i, group: one(t, "is_foldable") === 1,
             devices: ids(t.get("devices")).map(function (d) { return String(one(new LiveAPI("id " + d), "name")); }),
             plugins: pluginsOn(t) };
  });
}

// Third-party plugins on a track, with the knob names Live shows for them (Muse sets knobs by these)
const PLUGIN_CLASSES = ["PluginDevice", "AuPluginDevice"];
const PLUGIN_KNOBS = 48;

function pluginsOn(track) {
  const out = [];
  ids(track.get("devices")).forEach(function (id) {
    const d = new LiveAPI("id " + id);
    if (PLUGIN_CLASSES.indexOf(String(one(d, "class_name"))) < 0) return;
    const knobs = ids(d.get("parameters")).slice(1, PLUGIN_KNOBS + 1).map(function (pid) { return String(one(new LiveAPI("id " + pid), "name")); });
    out.push({ name: String(one(d, "name")), knobs: knobs });
  });
  return out;
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
  if (!ensureSong()) return;
  if (one(song, "is_playing") !== 1) song.call("start_playing");
}

// Move the playhead to <bar>. When Live is stopped, Play starts from the start marker
// (where the producer last clicked), not the playhead, so move that too:
// Song.start_time where this Live has it, else jump to a marker at the bar
// (a locator jump moves the start marker), adding a temporary one if there is none.
let pendingStart = null;

function jump(bar) {
  if (!ensureSong()) return;
  const beats = (bar - 1) * beatsPerBar();
  song.set("current_song_time", beats);
  if (one(song, "is_playing") === 1) return;
  if (String(song.info).indexOf("property start_time") >= 0) {
    song.set("start_time", beats);
    post("jump: start_time " + beats + "\n");
    return;
  }
  const existing = cueAt(beats);
  if (existing) { existing.call("jump"); post("jump: existing marker\n"); return; }
  pendingStart = { beats: beats };
  const t = new LiveAPI(function (args) {
    if (!pendingStart || args[0] !== "current_song_time" || Math.abs(args[1] - beats) >= 0.01) return;
    t.property = "";
    outlet(0, "defer", "start_cue_add");
  }, "live_set");
  t.property = "current_song_time";
}

function start_cue_add() {
  const c = new LiveAPI(function (args) {
    if (!pendingStart || args[0] !== "cue_points" || !cueAt(pendingStart.beats)) return;
    c.property = "";
    outlet(0, "defer", "start_cue_jump");
  }, "live_set");
  c.property = "cue_points";
  song.call("set_or_delete_cue");
}

function start_cue_jump() {
  const cue = pendingStart && cueAt(pendingStart.beats);
  if (cue) cue.call("jump");
  outlet(0, "defer", "start_cue_remove");
}

function start_cue_remove() {
  if (pendingStart && cueAt(pendingStart.beats)) song.call("set_or_delete_cue");
  post("jump: temporary marker\n");
  pendingStart = null;
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
  if (!ensureSong()) { send("marker_done", { ok: false, text: "Live isn't ready yet." }); return; }
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
// EQ Eight's knobs in Live 12: "1 Filter On A", "1 Filter Type A", "1 Frequency A", "1 Gain A", "1 Q A"
// (found in Live's own resources; the width knob is "Q", not "Resonance")
const BAND_PARAM = /^(\d) (Filter On|Filter Type|Frequency|Gain|Q) A$/;
const BAND_KNOBS = ["Filter On", "Filter Type", "Frequency", "Gain", "Q"];
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

// Parse a parameter's display string: "3.10 kHz" -> 3100, "-4.0 dB" -> -4, "0.71" -> 0.71.
// Times come out in ms ("1.20 s" -> 1200), and "-inf dB" / "inf : 1" as the far ends, so the
// number always rises or falls with the knob.
function amount(t) {
  t = String(t);
  if (/-\s*(inf|\u221e)/i.test(t)) return -1e9;
  if (/inf|\u221e/i.test(t)) return 1e9;
  const m = t.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (/khz/i.test(t)) return n * 1000;
  if (/\d\s*s\b/.test(t) && !/ms\b/.test(t)) return n * 1000;
  return n;
}

function displayed(param, value) {
  return amount(param.call("str_for_value", value));
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

// EQ Eight's band shapes, matched against the Filter Type menu Live reports (value_items),
// with letters only, so "Low Cut 48", "LowCut48" and "Low cut (48 dB)" all match.
// "steep" picks the 48 dB/oct cut over the 12 dB/oct one.
const SHAPES = {
  bell: /bell|peak/, notch: /notch/, low_shelf: /lo(w)?shelf/, high_shelf: /hi(gh)?shelf/,
  low_cut: /lo(w)?cut|highpass/, high_cut: /hi(gh)?cut|lowpass/
};
// EQ Eight's menu order in Live 12, used when the names don't match:
// low cut 48, low cut 12, low shelf, bell, notch, high shelf, high cut 12, high cut 48
const SHAPE_SLOTS = { low_cut: [1, 0], high_cut: [6, 7], low_shelf: [2], bell: [3], notch: [4], high_shelf: [5] };
const letters = function (name) { return String(name).toLowerCase().replace(/[^a-z]/g, ""); };
// Which free band to use: low shapes take the low bands, high shapes the high ones, the rest the middle
const BAND_ORDER = {
  low_cut: ["1", "2", "3", "4"], low_shelf: ["1", "2", "3", "4"],
  high_cut: ["8", "7", "6", "5"], high_shelf: ["8", "7", "6", "5"],
  bell: ["4", "5", "3", "6", "2", "7", "1", "8"], notch: ["4", "5", "3", "6", "2", "7", "1", "8"]
};

function eq(freq, gain, q, trackIndex, shape, steep) {
  const index = trackIndex === undefined ? -1 : trackIndex;
  const opts = { shape: SHAPES[shape] ? shape : "bell", steep: steep === 1 || steep === "1" || steep === true };
  const track = trackAt(index);
  let device = findEq(track);
  if (device) { applyEq(device, false, freq, gain, q, index, opts); return; }
  const devs = ids(track.get("devices"));
  // On Main, add it just before Aria so Aria still hears the result; elsewhere at the end
  const at = index < 0 ? Math.max(0, devs.indexOf(Number(new LiveAPI("this_device").id))) : devs.length;
  try { track.call("insert_device", "EQ Eight", at); } catch (e) { post("insert_device failed: " + e + "\n"); }
  pendingEq = { freq: freq, gain: gain, q: q, index: index, opts: opts };
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
  applyEq(device, true, p.freq, p.gain, p.q, p.index, p.opts);
}

// The Filter Type value for a shape, from the menu Live reports, or -1
function shapeValue(param, opts) {
  const items = param.get("value_items");
  if (!Array.isArray(items)) return -1;
  const fits = [];
  items.forEach(function (name, i) { if (SHAPES[opts.shape].test(letters(name))) fits.push({ name: String(name), i: i }); });
  if (!fits.length) {
    post("EQ Eight Filter Type menu: " + JSON.stringify(items) + "\n");
    const slots = SHAPE_SLOTS[opts.shape];
    if (items.length !== 8 || !slots) return -1;
    return slots.length > 1 ? slots[opts.steep ? 1 : 0] : slots[0];
  }
  if (fits.length > 1) {   // the two cuts: 48 dB/oct when steep, else 12
    const want = opts.steep ? /48/ : /12/;
    const pick = fits.filter(function (f) { return want.test(f.name); })[0];
    if (pick) return pick.i;
  }
  return fits[0].i;
}

// A band that's on but changes nothing: a bell or shelf at 0 dB (cuts and notches always change the sound)
function isFlat(b) {
  const type = String(b["Filter Type"].call("str_for_value", one(b["Filter Type"], "value")));
  if (!/bell|peak|shelf/.test(letters(type))) return false;
  const g = displayed(b["Gain"], one(b["Gain"], "value"));
  return g !== null && Math.abs(g) < 0.05;
}

function applyEq(device, added, freq, gain, q, index, opts) {
  opts = opts || { shape: "bell", steep: false };
  const bands = bandParams(device);
  const order = BAND_ORDER[opts.shape];
  let band = null;
  // A cut replaces the cut already there ("make it a hard cut"), so two never stack
  if (/_cut$/.test(opts.shape)) {
    for (let i = 0; i < order.length && !band; i++) {
      const b = bands[order[i]];
      if (b && b["Filter On"] && one(b["Filter On"], "value") === 1 &&
          SHAPES[opts.shape].test(letters(b["Filter Type"].call("str_for_value", one(b["Filter Type"], "value"))))) band = order[i];
    }
  }
  // A free band: switched off, or on but doing nothing (a fresh EQ Eight has bands 1 to 4 on, flat at 0 dB)
  for (let i = 0; i < order.length && !band; i++) {
    const b = bands[order[i]];
    if (b && b["Filter On"] && one(b["Filter On"], "value") === 0) band = order[i];
  }
  for (let i = 0; i < order.length && !band; i++) {
    const b = bands[order[i]];
    if (b && b["Filter Type"] && b["Gain"] && isFlat(b)) band = order[i];
  }
  if (!band) { send("eq_done", { ok: false, text: "The EQ Eight bands for that are all in use. Free one, then ask again." }); return; }
  const b = bands[band];
  const missing = BAND_KNOBS.filter(function (k) { return !b[k]; });
  if (missing.length) {
    post("EQ Eight band " + band + " is missing " + missing.join(", ") + "\n");
    send("eq_done", { ok: false, text: "Aria couldn't find EQ Eight's " + missing.join(", ") + " knob. Tell Claude: the names changed." });
    return;
  }
  const keep = BAND_KNOBS.map(function (k) {
    return { id: Number(b[k].id), value: one(b[k], "value") };
  });
  undoStack.push({ kind: "eq", params: keep, deviceId: added ? Number(device.id) : null, band: band, track: index === undefined ? -1 : index });

  const type = shapeValue(b["Filter Type"], opts);
  if (type < 0) {
    undoStack.pop();
    send("eq_done", { ok: false, text: "EQ Eight has no " + opts.shape.replace("_", " ") + " shape Aria could find. Its menu: " +
                      JSON.stringify(b["Filter Type"].get("value_items")) });
    return;
  }
  b["Filter Type"].set("value", type);
  const shapeName = String(b["Filter Type"].call("str_for_value", type));
  // Cuts and notches have no gain; shelves and bells do
  const hasGain = opts.shape === "bell" || /shelf/.test(opts.shape);
  const shown = {
    shape: shapeName,
    freq: setByDisplay(b["Frequency"], freq),
    gain: hasGain ? setByDisplay(b["Gain"], gain) : null,
    q: setByDisplay(b["Q"], q)
  };
  b["Filter On"].set("value", 1);
  const where = index === undefined || index < 0 ? "Main" : "\"" + one(trackAt(index), "name") + "\"";
  const what = hasGain ? shapeName + " " + shown.gain + " at " + shown.freq + ", Q " + shown.q : shapeName + " at " + shown.freq;
  send("eq_done", { ok: true, band: Number(band), added: added, shown: shown,
                    text: (added ? "Added an EQ Eight on " + where + ". " : "On " + where + ": ") + "band " + band + " " + what + "." });
}

// ---------- Live's stock devices: add one or adjust the one there, set its knobs, with Undo ----------
// Same steps as EQ Eight: use the device already on the track, else add it, then set each knob by
// what Live displays, so "-18 dB" lands on -18.0 dB. Knob names are Live's own (from Live's
// control-surface bank definitions); a near name still matches ("Dry Wet" for "Dry/Wet").

const STOCK = {
  "EQ Eight": [EQ_CLASS], "Compressor": ["Compressor2"], "Glue Compressor": ["GlueCompressor"], "Multiband Dynamics": ["MultibandDynamics"],
  "Limiter": ["Limiter"], "Gate": ["Gate"], "Reverb": ["Reverb"], "Hybrid Reverb": ["Hybrid"], "Delay": ["Delay"],
  "Echo": ["Echo"], "Saturator": ["Saturator"], "Overdrive": ["Overdrive"], "Roar": ["Roar"], "Drum Buss": ["DrumBuss"],
  "Utility": ["StereoGain"], "Auto Filter": ["AutoFilter2", "AutoFilter"], "Auto Pan": ["AutoPan"],
  "Chorus-Ensemble": ["Chorus2"], "Phaser-Flanger": ["PhaserNew"], "Redux": ["Redux2"], "Channel EQ": ["ChannelEq"]
};
// Names Live's browser may use, newest first (Auto Pan became Auto Pan-Tremolo in Live 12)
const INSERT_AS = { "Auto Pan": ["Auto Pan-Tremolo", "Auto Pan"] };
let pendingDevice = null;

const key = function (name) { return String(name).toLowerCase().replace(/[^a-z0-9]/g, ""); };

function findStock(track, name) {
  const devs = ids(track.get("devices"));
  for (let i = 0; i < devs.length; i++) {
    const d = new LiveAPI("id " + devs[i]);
    if (STOCK[name].indexOf(String(one(d, "class_name"))) >= 0 || key(one(d, "class_display_name")) === key(name)) return d;
  }
  return null;
}

// A third-party plugin on the track whose name matches ("Pro-Q 4" finds "FabFilter Pro-Q 4"), newest first
function findPlugin(track, name) {
  const devs = ids(track.get("devices")), want = key(name);
  for (let i = devs.length - 1; i >= 0; i--) {
    const d = new LiveAPI("id " + devs[i]), k = key(one(d, "name"));
    if (PLUGIN_CLASSES.indexOf(String(one(d, "class_name"))) >= 0 && k && (k.indexOf(want) >= 0 || want.indexOf(k) >= 0)) return d;
  }
  return null;
}

// addedFlag is 1 when the bridge just had Live load this plugin, so Undo removes it
function device(trackIndex, nameText, settingsText, addedFlag) {
  const name = decodeURIComponent(String(nameText));
  const settings = JSON.parse(decodeURIComponent(settingsText || "%5B%5D"));
  const track = trackAt(trackIndex);
  if (!STOCK[name]) {
    const plug = findPlugin(track, name);
    if (!plug) { send("device_done", { ok: false, missing: true, text: name + " isn't on that track." }); return; }
    applyDevice(plug, Number(addedFlag) === 1, trackIndex, String(one(plug, "name")), settings);
    return;
  }
  const found = findStock(track, name);
  if (found) { applyDevice(found, false, trackIndex, name, settings); return; }
  pendingDevice = { index: trackIndex, name: name, settings: settings, tries: (INSERT_AS[name] || [name]).slice() };
  insertNext();
}

function insertNext() {
  const p = pendingDevice, track = trackAt(p.index);
  const devs = ids(track.get("devices"));
  // On Main, just before Aria so Aria still hears the result; elsewhere at the end
  const at = p.index < 0 ? Math.max(0, devs.indexOf(Number(new LiveAPI("this_device").id))) : devs.length;
  const as = p.tries.shift();
  try { track.call("insert_device", as, at); } catch (e) { post("insert_device " + as + " failed: " + e + "\n"); }
  outlet(0, "defer", "device_continue");
}

function device_continue() {
  const p = pendingDevice;
  const found = findStock(trackAt(p.index), p.name);
  if (!found && p.tries.length) { insertNext(); return; }
  pendingDevice = null;
  if (!found) { send("device_done", { ok: false, text: "Aria couldn't add a " + p.name + ". Put one on that track, then ask again." }); return; }
  applyDevice(found, true, p.index, p.name, p.settings);
}

function knob(params, want) {
  const k = key(want);
  const alias = { mix: "drywet", wet: "drywet", amount: "drywet" }[k];
  const exact = params.filter(function (p) { return p.k === k; })[0] || (alias && params.filter(function (p) { return p.k === alias; })[0]);
  if (exact) return exact;
  const near = params.filter(function (p) { return p.k && (p.k.indexOf(k) >= 0 || k.indexOf(p.k) >= 0); });
  near.sort(function (a, b) { return a.k.length - b.k.length; });
  return near[0] || null;
}

// A menu or switch: the item whose words match, else the one whose number is closest ("4" for a 4:1 ratio)
function menuValue(param, setting) {
  const items = param.get("value_items");
  if (!Array.isArray(items) || !items.length) return -1;
  let want = setting.option !== undefined ? String(setting.option) : String(setting.value);
  if (want === "true") want = "on";
  if (want === "false") want = "off";
  for (let i = 0; i < items.length; i++) if (key(items[i]) === key(want)) return i;
  for (let i = 0; i < items.length; i++) if (key(items[i]).indexOf(key(want)) === 0) return i;
  const n = amount(want);
  if (n === null) return -1;
  let best = -1, gap = Infinity;
  items.forEach(function (it, i) { const v = amount(it); if (v !== null && Math.abs(v - n) < gap) { gap = Math.abs(v - n); best = i; } });
  return best;
}

function applyDevice(dev, added, index, name, settings) {
  const params = ids(dev.get("parameters")).map(function (id) {
    const p = new LiveAPI("id " + id);
    return { api: p, name: String(one(p, "name")), k: key(one(p, "name")) };
  });
  const keep = [], done = [], missed = [];
  settings.forEach(function (st) {
    const m = knob(params, st.param);
    if (!m) { missed.push(st.param); return; }
    const p = m.api, before = one(p, "value");
    keep.push({ id: Number(p.id), value: before });
    if (one(p, "is_quantized") === 1) {
      const v = menuValue(p, st);
      if (v < 0) { keep.pop(); missed.push(st.param + " " + (st.option || st.value)); return; }
      p.set("value", v);
    } else {
      const now = displayed(p, before);
      const target = st.change !== undefined ? (now === null ? null : now + st.change) : amount(st.value);
      if (target === null) { keep.pop(); missed.push(st.param); return; }
      setByDisplay(p, target);
    }
    done.push(m.name + " " + String(p.call("str_for_value", one(p, "value"))));
  });
  // A big plugin may show Live only "Device On" until the producer picks knobs with Configure
  const hidden = params.length <= 1 ? " Live isn't showing its knobs to Aria. Press Configure on the " + name +
                 " in Live, move the knobs you want Aria to use, then ask again." : "";
  if (!added && !keep.length) {
    send("device_done", { ok: false, text: hidden ? hidden.trim() : "Aria couldn't find " + missed.join(", ") + " on the " + name + ". Its knobs: " +
                          params.map(function (p) { return p.name; }).slice(0, 40).join(", ") + "." });
    return;
  }
  undoStack.push({ kind: "device", params: keep, deviceId: added ? Number(dev.id) : null, name: name, track: index });
  const where = index < 0 ? "Main" : "\"" + one(trackAt(index), "name") + "\"";
  let text = (added ? "Added " + (/^[AEIO]/i.test(name) ? "an " : "a ") + name + " on " + where : "On the " + name + " on " + where) + (done.length ? ": " + done.join(", ") + "." : ".");
  if (missed.length) text += " Couldn't set " + missed.join(", ") + "." + hidden;
  send("device_done", { ok: true, added: added, text: text });
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
  } else if (u.kind === "device") {
    u.params.forEach(function (p) { new LiveAPI("id " + p.id).set("value", p.value); });
    if (u.deviceId) {
      const track = trackAt(u.track), at = ids(track.get("devices")).indexOf(u.deviceId);
      if (at >= 0) track.call("delete_device", at);
    }
    send("undo_done", { ok: true, text: u.deviceId ? "Removed the " + u.name + " Aria added." : "Put the " + u.name + " back how it was." });
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

// ---------- Spike S1: what each device on a track exposes to the Live API ----------
// One "device_params" reply per device (a plugin can have hundreds), then "devices_end".

function devices(trackIndex) {
  const track = trackAt(trackIndex);
  const devs = ids(track.get("devices"));
  devs.forEach(function (id, i) {
    const d = new LiveAPI("id " + id);
    const params = ids(d.get("parameters")).map(function (pid) {
      const p = new LiveAPI("id " + pid);
      const v = one(p, "value");
      return { name: String(one(p, "name")), value: v, display: String(p.call("str_for_value", v)),
               min: one(p, "min"), max: one(p, "max"), quantized: one(p, "is_quantized") === 1 };
    });
    send("device_params", { index: i, name: String(one(d, "name")), class_name: String(one(d, "class_name")),
                            type: one(d, "type"), params: params });
  });
  send("devices_end", { track: String(one(track, "name")), count: devs.length });
}
