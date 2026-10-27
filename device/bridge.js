// Aria's bridge. Runs in [node.script bridge.js @autostart 1].
// Starts the engine if needed, loads the strip UI into jweb, and runs Check mix:
// ask Live for tempo, make sure it's playing, record 16 bars of Main with
// sfrecord~, send the file to the engine, and show the result.
//
// Out (outlet 0, through [route jweb live rec]):
//   jweb <name> <URI-encoded JSON>   to the strip UI
//   live <command> <args>            to live.js
//   rec <message>                    to sfrecord~
// In: messages from jweb (the UI) and from live.js, both URI-encoded JSON.
// Timing uses Node timers. Max timers fire late inside a device (build step 1.6).

const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const Max = require("max-api");

const ENGINE = { host: "127.0.0.1", port: 8765 };
const REPO = path.resolve(__dirname, "..");
const ENGINE_DIR = path.join(REPO, "engine");
// The React builds (ui/dist, see ui/vite.config.ts): one self-contained HTML file per screen.
// Light (Sky) by default; Dark (Night) when the producer picks it in the window's rail. Saved in window.json.
const pageUrl = (screen) => "file://" + encodeURI(path.join(REPO, "ui", "dist", screen, "index.html")) +
  "?theme=" + (loadWindowPrefs().theme === "night" ? "night" : "sky");
const LOG_DIR = path.join(os.homedir(), "Library", "Logs", "Aria");
// Ask Muse history, kept across Live sessions. Local to this Mac, never sent anywhere.
const HISTORY_FILE = path.join(os.homedir(), "Library", "Application Support", "Aria", "ask-history.json");
const HISTORY_MAX = 100;
// The window's size and place: "full" (a big window), or "left" / "right" (a tall panel docked to
// that edge, floating over Live so both stay in view). Remembered between sessions.
// Ask Muse can also pop out into its own small floating window ("chat").
const WINDOW_FILE = path.join(os.homedir(), "Library", "Application Support", "Aria", "window.json");
const FULL = { w: 1200, h: 860 };
const SIDE_W = 460;
const COMPACT_H = 280;   // the main window while Ask Muse is popped out: just what to fix
const REC_DIR = path.join(os.tmpdir(), "aria");
const BARS = 16;   // 16 bars, so a check covers a whole phrase (Ian, Oct 27)
const START_TIMEOUT_MS = 20000;
const LIVE_TIMEOUT_MS = 3000;
const ANALYZE_TIMEOUT_MS = 45000;
const FILE_SETTLE_MS = 500;

let engineChild = null;   // only an engine this device started, never one started by hand
let engineState = { state: "starting", text: "Starting Aria" };
let busy = false;
let windowLoaded = false;
let chatLoaded = false;
let chatOpen = false;
let mainOpen = false;
let lastResult = null;    // so a window opened later shows the latest Check mix
const waiters = {};       // live.js reply name -> resolve function
const stateWaiters = [];  // everyone waiting for the next live_state
let askLog = loadHistory();   // every Ask Muse exchange; the strip and window both show it

const encode = (obj) => encodeURIComponent(JSON.stringify(obj));
const decode = (s) => JSON.parse(decodeURIComponent(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Both the strip and the window get every UI message.
const toUI = (name, payload) => {
  Max.outlet("jweb", name, encode(payload));
  if (windowLoaded) Max.outlet("window", name, encode(payload));
  if (chatLoaded) Max.outlet("chat", name, encode(payload));
};
const toLive = (...args) => Max.outlet("live", ...args);
const toRec = (...args) => Max.outlet("rec", ...args);

class UserError extends Error {}

// ---------- Ask Muse history ----------

function loadHistory() {
  try {
    const log = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    return Array.isArray(log) ? log.slice(-HISTORY_MAX) : [];
  } catch (e) {
    return [];   // no history yet, or unreadable: start fresh
  }
}

// Save and show. Every change to the log goes through here.
function logChanged() {
  askLog = askLog.slice(-HISTORY_MAX);
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(askLog));
  } catch (e) {
    Max.post(`Couldn't save the Ask Muse history: ${e.message}`);
  }
  toUI("ask_log", askLog);
  pushSession();
}

function addNote(text, at = askLog.length - 1) {
  if (!askLog[at]) return;
  askLog[at].notes = [...(askLog[at].notes || []), text];
  logChanged();
}

// ---------- engine ----------

function request(method, urlPath, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ ...ENGINE, method, path: urlPath, timeout: timeoutMs,
      headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {} }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on("timeout", () => req.destroy(new Error(`timed out after ${timeoutMs / 1000} s`)));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function health() {
  try {
    const res = await request("GET", "/health", null, 1000);
    return res.status === 200 && res.json && res.json.status === "ok" ? res.json : null;
  } catch (e) {
    return null;
  }
}

function setEngine(state, text, extra) {
  engineState = { state, text, ...extra };
  toUI("engine", engineState);
}

// Newest change to the engine's code on disk
function engineCodeTime() {
  const dir = path.join(ENGINE_DIR, "aria_engine");
  try {
    return Math.max(...fs.readdirSync(dir).filter((f) => f.endsWith(".py")).map((f) => fs.statSync(path.join(dir, f)).mtimeMs / 1000));
  } catch (e) {
    return 0;
  }
}

// An engine started before the code changed runs the old code. Stop it so a fresh one starts.
async function stopIfStale(h) {
  if (!h.pid || !h.code_time || engineCodeTime() <= h.code_time + 1) return false;
  Max.post(`Engine code changed since it started. Restarting it (pid ${h.pid}).`);
  try { process.kill(h.pid, "SIGTERM"); } catch (e) { return false; }
  for (let i = 0; i < 20 && (await health()); i++) await sleep(250);
  engineChild = null;
  return true;
}

async function ensureEngine() {
  let h = await health();
  if (h && (await stopIfStale(h))) h = null;
  if (h) { setEngine("up", "Engine connected", { muse: h.muse }); return h; }

  if (!fs.existsSync(path.join(ENGINE_DIR, ".venv", "bin", "uvicorn"))) {
    throw new UserError("The Aria engine isn't installed. Run ./install.sh in the aria folder once.");
  }
  if (!engineChild) {
    setEngine("starting", "Starting Aria");
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const log = fs.openSync(path.join(LOG_DIR, "engine.log"), "a");
    // ARIA_PARENT_PID lets the engine exit by itself if this process disappears.
    engineChild = spawn(path.join(ENGINE_DIR, "run.sh"), [], {
      cwd: ENGINE_DIR, stdio: ["ignore", log, log], detached: true,
      env: { ...process.env, ARIA_PARENT_PID: String(process.pid) },
    });
    engineChild.on("exit", () => { engineChild = null; });
  }
  const until = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < until) {
    await sleep(300);
    h = await health();
    if (h) { setEngine("up", "Engine connected", { muse: h.muse }); return h; }
    if (!engineChild) break;
  }
  throw new UserError("The Aria engine didn't start. Details are in ~/Library/Logs/Aria/engine.log");
}

function stopEngine() {
  if (!engineChild) return;
  try { process.kill(-engineChild.pid, "SIGTERM"); } catch (e) { /* already gone */ }
  engineChild = null;
}

["SIGTERM", "SIGINT", "exit"].forEach((sig) => process.on(sig, () => { stopEngine(); if (sig !== "exit") process.exit(0); }));

// ---------- Aria's Remote Script (device/remote): adds plugins, which Max for Live can't ----------

const REMOTE = { host: "127.0.0.1", port: 8766 };
const REMOTE_TIMEOUT_MS = 8000;
const REMOTE_OFF = "Aria can't add plugins until its helper is on: in Live, Settings > Link, Tempo & MIDI > Control Surface, pick Aria.";
let installedPlugins = null;   // names from Live's browser, read once per session

function remote(cmd) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(REMOTE);
    let buf = "";
    const fail = (text) => { sock.destroy(); reject(new UserError(text)); };
    sock.setTimeout(REMOTE_TIMEOUT_MS, () => fail("Live took too long to add the plugin."));
    sock.on("error", () => fail(REMOTE_OFF));
    sock.on("connect", () => sock.write(JSON.stringify(cmd) + "\n"));
    sock.on("data", (d) => {
      buf += d;
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      sock.end();
      try { resolve(JSON.parse(buf.slice(0, nl))); } catch (e) { reject(new UserError("Aria's helper in Live sent something odd.")); }
    });
  });
}

async function pluginNames() {
  if (installedPlugins) return installedPlugins;
  try {
    const r = await remote({ cmd: "plugins" });
    if (r.ok) installedPlugins = r.plugins;
  } catch (e) { return null; }   // helper off: Muse is told plugins can't be added
  return installedPlugins;
}

// ---------- live.js ----------

function askLive(command, reply, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (reply === "live_state") stateWaiters.splice(stateWaiters.indexOf(done) >>> 0, 1);
      else delete waiters[reply];
      reject(new UserError("Live didn't answer. Try removing and adding Aria again."));
    }, LIVE_TIMEOUT_MS);
    const done = (payload) => { clearTimeout(timer); resolve(payload); };
    // Several parts of the bridge ask for the state at once (the window's session line, Ask Muse's
    // context): one reply answers them all. Other replies have one asker at a time.
    if (reply === "live_state") { stateWaiters.push(done); if (stateWaiters.length > 1) return; }
    else waiters[reply] = done;
    toLive(command, ...args);
  });
}

function waitForPlaying(timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { delete waiters.live_playing; reject(new UserError("Live didn't start playing.")); }, timeoutMs);
    waiters.live_playing = (on) => { if (on) { clearTimeout(timer); delete waiters.live_playing; resolve(); } };
  });
}

Max.addHandler("live_state", (s) => { const all = stateWaiters.splice(0); all.forEach((w) => w(decode(s))); });
Max.addHandler("marker_done", (s) => { const w = waiters.marker_done; delete waiters.marker_done; if (w) w(decode(s)); });
Max.addHandler("eq_done", (s) => { const w = waiters.eq_done; delete waiters.eq_done; if (w) w(decode(s)); });
Max.addHandler("undo_done", (s) => { const w = waiters.undo_done; delete waiters.undo_done; if (w) w(decode(s)); });
Max.addHandler("device_done", (s) => { const w = waiters.device_done; delete waiters.device_done; if (w) w(decode(s)); });
Max.addHandler("volume_done", (s) => { const w = waiters.volume_done; delete waiters.volume_done; if (w) w(decode(s)); });
Max.addHandler("live_error", (s) => toUI("error", decode(s)));
Max.addHandler("live_playing", (on) => {
  if (waiters.live_playing) waiters.live_playing(on === 1);
  if (on === 0 && recording) recording.stopped = true;
});

// ---------- Check mix ----------

let recording = null;

async function checkMix() {
  if (busy) return;
  busy = true;
  try {
    await ensureEngine();

    let live = await askLive("state", "live_state");
    if (!live.playing) {
      toUI("progress", { step: "play", text: "Starting playback" });
      const started = waitForPlaying(LIVE_TIMEOUT_MS);
      toLive("play");
      await started;
      live = await askLive("state", "live_state");
    }

    Max.post(`check_mix: tempo ${live.tempo}, beat ${live.song_beat}, chain ${JSON.stringify(live.chain)}`);
    const ms = Math.round(BARS * live.beats_per_bar * 60000 / live.tempo);
    const startBar = Math.floor(live.song_beat / live.beats_per_bar) + 1;
    fs.mkdirSync(REC_DIR, { recursive: true });
    const file = path.join(REC_DIR, `mix-${Date.now()}.aif`);

    recording = { stopped: false };
    // Float, so overs above 0 dBFS inside Live are recorded as they are, not capped.
    toRec("samptype", "float32");
    toRec("open", file);
    toRec("record", ms);

    const started = Date.now();
    while (Date.now() - started < ms) {
      if (recording.stopped) { toRec(0); throw new UserError(`Playback stopped before ${BARS} bars were recorded. Press Check mix while the song plays.`); }
      const left = Math.max(0, Math.ceil((ms - (Date.now() - started)) / 1000));
      toUI("progress", { step: "record", text: `Listening to bars ${startBar} to ${startBar + BARS - 1}`, detail: `${left} s`, done: Date.now() - started, total: ms });
      await sleep(250);
    }
    await sleep(FILE_SETTLE_MS);
    recording = null;

    if (!fs.existsSync(file) || fs.statSync(file).size < 1024) {
      throw new UserError("The recording came out empty. Is Aria on the Main track?");
    }

    toUI("progress", { step: "analyze", text: "Splitting your mix and asking Muse Spark" });
    const res = await request("POST", "/mix/analyze",
      { mix_path: file, start_beat: live.song_beat, tempo: live.tempo, bars: BARS, beats_per_bar: live.beats_per_bar }, ANALYZE_TIMEOUT_MS);
    if (res.status !== 200) {
      throw new UserError((res.json && res.json.detail) || `The engine couldn't analyze the recording (HTTP ${res.status}).`);
    }
    lastResult = { ...res.json, start_bar: startBar, chain: live.chain };
    toUI("mix_result", lastResult);
    pushSession();
  } catch (e) {
    recording = null;
    toUI("error", { text: e instanceof UserError ? e.message : `Something went wrong: ${e.message}` });
  } finally {
    busy = false;
  }
}

// ---------- messages from the UI ----------

Max.addHandler("ready", async () => {
  toUI("engine", engineState);
  if (lastResult) toUI("mix_result", lastResult);
  toUI("ask_log", askLog);
  pushSession();
  try { await ensureEngine(); } catch (e) { setEngine("error", e.message); }
});

// What the window shows about the set: tempo, time signature, where Aria sits, and the markers
async function pushSession() {
  try {
    const live = await askLive("state", "live_state");
    toUI("session", { tempo: live.tempo, signature: live.signature, markers: live.markers,
                      chain: { on_main: live.chain.on_main, after: live.chain.after } });
  } catch (e) { /* Live didn't answer; the window says what it doesn't know */ }
}

Max.addHandler("set_theme", (s) => {
  const theme = decode(s).theme === "night" ? "night" : "sky";
  savePrefs({ ...loadWindowPrefs(), theme });
  toUI("theme", { theme });
});
Max.addHandler("check_mix", () => checkMix());
// ---------- the window ----------

function loadWindowPrefs() {
  try { return JSON.parse(fs.readFileSync(WINDOW_FILE, "utf8")); } catch (e) { return { mode: "full", screen: null }; }
}

// Docked windows float over Live with no title bar, so their glass can show Live through it.
function sizeWindow(target, ui, { x, y, w, h }, docked) {
  Max.outlet(target, "window", "size", Math.round(x), Math.round(y), Math.round(x + w), Math.round(y + h));
  Max.outlet(target, "window", "flags", docked ? "float" : "nofloat");
  Max.outlet(target, "window", "flags", docked ? "notitle" : "title");
  Max.outlet(target, "window", "exec");
  Max.outlet(target, "script", "sendbox", ui, "presentation_rect", 0, 0, Math.round(w), Math.round(h));
}

const FALLBACK_SCREEN = { x: 0, y: 25, w: 1440, h: 875 };
const dockX = (side, sc) => (side === "left" ? sc.x + 8 : sc.x + sc.w - SIDE_W - 8);
// Live's web view may report the screen without the menu bar taken off (top 0). Keep clear of it,
// with room for the taller menu bar on MacBooks with a notch.
const MENU_BAR = 40;
const dockTop = (sc) => (sc.y > 0 ? sc.y + 8 : MENU_BAR);
const dockHeight = (sc) => sc.h - (dockTop(sc) - sc.y) - 8;

// Size and place the window for a mode. Docking needs the screen size, which only the page knows.
function placeWindow({ mode, screen }) {
  if (mode === "side") mode = "right";   // the first version had one side
  const docked = (mode === "left" || mode === "right") && screen;
  if (!docked) { sizeWindow("window", "aria-window-ui", { x: 120, y: 90, ...FULL }, false); return; }
  sizeWindow("window", "aria-window-ui", { x: dockX(mode, screen), y: dockTop(screen), w: SIDE_W, h: dockHeight(screen) }, true);
}

// Ask Muse popped out: the main window shrinks to just what to fix, and the chat stacks under it,
// both docked on the same edge, so nothing sits in the middle of Live.
function placeStack(side, sc) {
  const top = { x: dockX(side, sc), y: dockTop(sc), w: SIDE_W, h: COMPACT_H };
  sizeWindow("window", "aria-window-ui", top, true);
  sizeWindow("chat", "aria-chat-ui", { x: top.x, y: top.y + COMPACT_H + 8, w: SIDE_W, h: dockHeight(sc) - COMPACT_H - 8 }, true);
}

// The chat alone (the main window was closed): it takes the full docked height on its side.
function placeChatAlone(prefs) {
  const sc = prefs.screen || FALLBACK_SCREEN;
  const side = prefs.side === "left" ? "left" : "right";
  sizeWindow("chat", "aria-chat-ui", { x: dockX(side, sc), y: dockTop(sc), w: SIDE_W, h: dockHeight(sc) }, true);
}

function savePrefs(prefs) {
  try {
    fs.mkdirSync(path.dirname(WINDOW_FILE), { recursive: true });
    fs.writeFileSync(WINDOW_FILE, JSON.stringify(prefs));
  } catch (e) {
    Max.post(`Couldn't save the window size: ${e.message}`);
  }
}

function showWindow(url) {
  // Load the page every time, so the window always shows the latest UI files.
  // The page says "ready" when it loads, and the bridge replays the latest result.
  windowLoaded = true;
  mainOpen = true;
  Max.outlet("window", "url", url);
  const prefs = loadWindowPrefs();
  // The chat is still out: stack again, the window on top
  if (chatOpen && prefs.mode !== "full") placeStack(prefs.mode === "left" ? "left" : "right", prefs.screen || FALLBACK_SCREEN);
  else placeWindow(prefs);
  Max.outlet("window", "front");
}

Max.addHandler("open_window", () => showWindow(pageUrl("window")));
Max.addHandler("open_chat", (s) => openChatWindow(s && decode(s).screen));

// The mapped key (the strip's "Ask key" in Live's Key Map): pressing it opens Ask Muse, ready to type.
// Voice will use the hold; for now the release does nothing.
Max.addHandler("ask_key", (v) => { if (v === undefined || v === "bang" || Number(v) !== 0) openChatWindow(null); });

function openChatWindow(fromPage) {
  const prefs = loadWindowPrefs();
  const screen = fromPage || prefs.screen || FALLBACK_SCREEN;
  // The side it's docked on, or the side it was last docked on
  const side = prefs.mode === "left" || prefs.mode === "right" ? prefs.mode : prefs.side === "left" ? "left" : "right";
  savePrefs({ ...prefs, mode: side, side, screen });
  if (!windowLoaded) { windowLoaded = true; Max.outlet("window", "url", pageUrl("window")); }
  if (!chatLoaded) { chatLoaded = true; Max.outlet("chat", "url", pageUrl("window") + "&view=chat"); }
  chatOpen = true;
  mainOpen = true;
  placeStack(side, screen);
  Max.outlet("window", "front");
  Max.outlet("chat", "front");
  toUI("focus_ask", {});
}

// Back from the stack: close the chat, the main window takes its full docked height again.
Max.addHandler("close_chat", () => {
  chatOpen = false;
  Max.outlet("chat", "wclose");
  if (mainOpen) placeWindow(loadWindowPrefs());
});

// Closes only the main window. A popped-out chat stays, and grows into the space.
Max.addHandler("close_window", () => {
  mainOpen = false;
  Max.outlet("window", "wclose");
  if (chatOpen) placeChatAlone(loadWindowPrefs());
});

Max.addHandler("window_mode", (s) => {
  const prefs = decode(s);
  if (prefs.mode === "left" || prefs.mode === "right") prefs.side = prefs.mode;
  else prefs.side = loadWindowPrefs().side;
  savePrefs(prefs);
  if (chatOpen && prefs.mode !== "full") { placeStack(prefs.mode, prefs.screen || FALLBACK_SCREEN); return; }
  if (chatOpen) { chatOpen = false; Max.outlet("chat", "wclose"); }
  placeWindow(prefs);
});
Max.addHandler("jump_to", (s) => toLive("jump", decode(s).bar));
Max.addHandler("add_marker", async (s) => {
  const { bar, name } = decode(s);
  try {
    const done = await askLive("marker", "marker_done", bar, name);
    toUI("marker_done", done);
  } catch (e) {
    toUI("error", { text: e.message });
  }
});
// ---------- Ask Muse ----------

// One action from Muse's menu, applied in Live. Returns { ok, text } for the UI.
// Track tools name a track; the engine already checked the name exists in the set.
async function apply(action, tracks = []) {
  const a = action.args || {};
  const trackIndex = (name) => {
    if (/^(main|master)$/i.test(String(name).trim())) return -1;
    const t = tracks.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    if (!t) throw new UserError(`There's no track called "${name}" in this set.`);
    return t.index;
  };
  switch (action.type) {
    case "track_volume":
      return await askLive("volume", "volume_done", trackIndex(a.track), a.change_db);
    case "track_eq":
      return await askLive("eq", "eq_done", a.freq_hz, a.gain_db, a.q, trackIndex(a.track), a.shape || "bell", a.steep ? 1 : 0);
    case "track_device":
      return await askLive("device", "device_done", trackIndex(a.track), encodeURIComponent(a.device), encodeURIComponent(JSON.stringify(a.settings || [])));
    case "track_plugin": {
      // Use the one on the track, else have the Remote Script load it, then set its knobs like a stock device
      const idx = trackIndex(a.track), settings = encodeURIComponent(JSON.stringify(a.settings || []));
      const first = await askLive("device", "device_done", idx, encodeURIComponent(a.plugin), settings, 0);
      if (!first.missing) return first;
      const loaded = await remote({ cmd: "load", track: idx, name: a.plugin });
      if (!loaded.ok) return { ok: false, text: loaded.text };
      return await askLive("device", "device_done", idx, encodeURIComponent(loaded.name), settings, 1);
    }
    case "jump_to":
      toLive("jump", a.bar);
      return { ok: true, text: `Moved the playhead to bar ${a.bar}.` };
    case "add_marker": {
      const m = await askLive("marker", "marker_done", a.bar, a.name);
      if (m.ok === false) return m;
      return { ok: true, text: `Marker "${m.name}" at bar ${m.bar}.` };
    }
    case "eq_band":
      return await askLive("eq", "eq_done", a.freq_hz, a.gain_db, a.q, -1, a.shape || "bell", a.steep ? 1 : 0);
    case "undo":
      return await askLive("undo", "undo_done");
    case "check_mix":
      checkMix();
      return { ok: true, text: "Started a Mix check." };
    default:
      return { ok: false, text: `Aria can't do "${action.type}" yet.` };
  }
}

async function askContext() {
  let live = null;
  try { live = await askLive("state", "live_state"); } catch (e) { /* Live didn't answer; Muse gets less context */ }
  const r = lastResult;
  return {
    findings: r ? r.clarity.findings : [],
    bars: r && r.start_bar ? [r.start_bar, r.start_bar + (r.recording.bars || BARS) - 1] : null,
    tempo: live ? live.tempo : null,
    playhead_bar: live ? Math.floor(live.song_beat / live.beats_per_bar) + 1 : null,
    markers: live ? live.markers : [],
    tracks: live ? live.tracks : [],
    plugins: await pluginNames(),   // installed third-party plugins; null when Aria's helper in Live is off
    // The last few exchanges, so "it" and "that" make sense. What was done, as Aria reported it.
    recent: askLog.slice(-3).map((x) => ({ asked: x.request, did: x.done.map((d) => d.text), replied: x.reply })),
  };
}

// "/devices <track>": list every device on a track and every parameter Live exposes for it
// (spike S1 in docs/device-control.md). Saved in full to Application Support/Aria/devices-<track>.json.
let deviceDump = null;
Max.addHandler("device_params", (s) => { if (deviceDump) deviceDump.devices.push(decode(s)); });
Max.addHandler("devices_end", (s) => { if (deviceDump) { deviceDump.done(decode(s)); } });

async function listDevices(trackName) {
  const live = await askLive("state", "live_state");
  const t = live.tracks.find((x) => x.name.toLowerCase() === trackName.toLowerCase())
    || live.tracks.find((x) => x.name.toLowerCase().includes(trackName.toLowerCase()));
  if (!t) throw new UserError(`No track called "${trackName}". Tracks: ${live.tracks.map((x) => x.name).join(", ")}.`);
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { deviceDump = null; reject(new UserError("Live didn't list the devices in time.")); }, 15000);
    deviceDump = { devices: [], done: (end) => { clearTimeout(timer); const out = { ...end, devices: deviceDump.devices }; deviceDump = null; resolve(out); } };
    toLive("devices", t.index);
  });
  const file = path.join(path.dirname(HISTORY_FILE), `devices-${t.name.replace(/[^\w -]/g, "_")}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 1));
  const lines = result.devices.map((d) => `${d.name}: ${d.params.length} controls`);
  return { reply: `"${t.name}" has ${result.devices.length} devices. ${lines.join(". ")}. Full list saved for Claude.`, file };
}

let asking = false;
Max.addHandler("ask", async (s) => {
  if (asking) return;
  asking = true;
  const { text } = decode(s);
  toUI("ask_pending", { request: text });
  if (/^\/devices\b/i.test(text)) {
    try {
      const out = await listDevices(text.replace(/^\/devices\s*/i, "").trim());
      askLog.push({ request: text, reply: out.reply, done: [], suggestions: [], problems: [], error: null, notes: [], at: Date.now() });
    } catch (e) {
      askLog.push({ request: text, reply: null, done: [], suggestions: [], problems: [], error: e.message, notes: [], at: Date.now() });
    }
    asking = false;
    toUI("ask_pending", { request: null });
    logChanged();
    return;
  }
  try {
    await ensureEngine();
    const context = await askContext();
    const res = await request("POST", "/muse/ask", { text, context }, ANALYZE_TIMEOUT_MS);
    if (res.status !== 200 || !res.json) throw new UserError(`Muse couldn't answer (HTTP ${res.status}).`);
    const done = [];
    for (const action of res.json.actions) {
      try { done.push({ ...action, ...(await apply(action, context.tracks)) }); }
      catch (e) { done.push({ ...action, ok: false, text: e.message }); }
    }
    // A plugin just loaded for a request that also wants it set: ask Muse again, now that Live shows its knobs
    let reply = res.json.reply;
    const fresh = done.filter((d) => d.type === "track_plugin" && d.ok && d.added && d.args.then_set);
    if (fresh.length) {
      const again = await askContext();
      again.follow_up = { added: fresh.map((d) => ({ track: d.args.track, plugin: d.args.plugin })), did: done.map((d) => d.text) };
      const res2 = await request("POST", "/muse/ask", { text, context: again }, ANALYZE_TIMEOUT_MS);
      if (res2.status === 200 && res2.json) {
        for (const action of res2.json.actions.filter((x) => x.type === "track_plugin")) {
          try { done.push({ ...action, ...(await apply(action, again.tracks)) }); }
          catch (e) { done.push({ ...action, ok: false, text: e.message }); }
        }
        reply = res2.json.reply || reply;
      }
    }
    askLog.push({ request: text, reply, done, suggestions: res.json.suggestions,
                  problems: res.json.problems || [], error: res.json.error, notes: [], at: Date.now() });
  } catch (e) {
    askLog.push({ request: text, reply: null, done: [], suggestions: [], problems: [], notes: [], at: Date.now(),
                  error: e instanceof UserError ? e.message : `Something went wrong: ${e.message}` });
  } finally {
    toUI("ask_pending", { request: null });
    logChanged();
    asking = false;
  }
});

// The producer answered one of Muse's suggestions. Yes runs it (the engine already checked it).
Max.addHandler("answer", async (s) => {
  const { exchange, index, yes } = decode(s);
  const sg = askLog[exchange] && askLog[exchange].suggestions[index];
  if (!sg || sg.answered) return;
  sg.answered = yes ? "yes" : "no";
  logChanged();
  if (!yes) return;
  let out;
  try { out = await apply(sg, (await askContext()).tracks); } catch (e) { out = { ok: false, text: e.message }; }
  sg.result = { ok: !!out.ok, text: out.text };   // the card becomes the done pill, with Undo
  logChanged();
});

Max.addHandler("undo", async () => {
  let out;
  try { out = await askLive("undo", "undo_done"); } catch (e) { out = { ok: false, text: e.message }; }
  addNote(out.text);
});

Max.addHandler("clear_history", () => { askLog = []; logChanged(); });

// The strip's Ask opens the window with Ask Muse open.
Max.addHandler("open_ask", () => showWindow(pageUrl("window") + "&ask=1"));

// jweb also reports its own status (url loaded and so on). Nothing to do with those.
Max.addHandler(Max.MESSAGE_TYPES.ALL, () => {});

// ---------- start ----------

Max.outlet("jweb", "url", pageUrl("strip"));
ensureEngine().catch((e) => setEngine("error", e.message));
