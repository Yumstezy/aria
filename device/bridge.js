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
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const Max = require("max-api");

const ENGINE = { host: "127.0.0.1", port: 8765 };
const REPO = path.resolve(__dirname, "..");
const ENGINE_DIR = path.join(REPO, "engine");
// The React builds (ui/dist, see ui/vite.config.ts): one self-contained HTML file per screen.
const STRIP_URL = "file://" + encodeURI(path.join(REPO, "ui", "dist", "strip", "index.html")) + "?theme=night";
const WINDOW_URL = "file://" + encodeURI(path.join(REPO, "ui", "dist", "window", "index.html")) + "?theme=night";
const LOG_DIR = path.join(os.homedir(), "Library", "Logs", "Aria");
// Ask Muse history, kept across Live sessions. Local to this Mac, never sent anywhere.
const HISTORY_FILE = path.join(os.homedir(), "Library", "Application Support", "Aria", "ask-history.json");
const HISTORY_MAX = 100;
// The window's size and place: "full" (a big window) or "side" (a tall panel docked right,
// floating over Live so both stay in view). Remembered between sessions.
const WINDOW_FILE = path.join(os.homedir(), "Library", "Application Support", "Aria", "window.json");
const FULL = { w: 1200, h: 860 };
const SIDE_W = 460;
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
let lastResult = null;    // so a window opened later shows the latest Check mix
const waiters = {};       // live.js reply name -> resolve function
let askLog = loadHistory();   // every Ask Muse exchange; the strip and window both show it

const encode = (obj) => encodeURIComponent(JSON.stringify(obj));
const decode = (s) => JSON.parse(decodeURIComponent(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Both the strip and the window get every UI message.
const toUI = (name, payload) => {
  Max.outlet("jweb", name, encode(payload));
  if (windowLoaded) Max.outlet("window", name, encode(payload));
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

async function ensureEngine() {
  let h = await health();
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

// ---------- live.js ----------

function askLive(command, reply, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { delete waiters[reply]; reject(new UserError("Live didn't answer. Try removing and adding Aria again.")); }, LIVE_TIMEOUT_MS);
    waiters[reply] = (payload) => { clearTimeout(timer); resolve(payload); };
    toLive(command, ...args);
  });
}

function waitForPlaying(timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { delete waiters.live_playing; reject(new UserError("Live didn't start playing.")); }, timeoutMs);
    waiters.live_playing = (on) => { if (on) { clearTimeout(timer); delete waiters.live_playing; resolve(); } };
  });
}

Max.addHandler("live_state", (s) => { const w = waiters.live_state; delete waiters.live_state; if (w) w(decode(s)); });
Max.addHandler("marker_done", (s) => { const w = waiters.marker_done; delete waiters.marker_done; if (w) w(decode(s)); });
Max.addHandler("eq_done", (s) => { const w = waiters.eq_done; delete waiters.eq_done; if (w) w(decode(s)); });
Max.addHandler("undo_done", (s) => { const w = waiters.undo_done; delete waiters.undo_done; if (w) w(decode(s)); });
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
  try { await ensureEngine(); } catch (e) { setEngine("error", e.message); }
});
Max.addHandler("check_mix", () => checkMix());
// ---------- the window ----------

function loadWindowPrefs() {
  try { return JSON.parse(fs.readFileSync(WINDOW_FILE, "utf8")); } catch (e) { return { mode: "full", screen: null }; }
}

// Size and place the window for a mode. Side needs the screen size, which only the page knows.
function placeWindow({ mode, screen }) {
  let x, y, w, h;
  if (mode === "side" && screen) {
    w = SIDE_W;
    h = Math.max(600, screen.h - 40);
    x = screen.x + screen.w - w - 8;
    y = screen.y + 32;
  } else {
    ({ w, h } = FULL);
    x = 120; y = 90;
  }
  Max.outlet("window", "window", "size", x, y, x + w, y + h);
  Max.outlet("window", "window", "flags", mode === "side" ? "float" : "nofloat");
  Max.outlet("window", "window", "exec");
  Max.outlet("window", "script", "sendbox", "aria-window-ui", "presentation_rect", 0, 0, w, h);
}

function showWindow(url) {
  // Load the page every time, so the window always shows the latest UI files.
  // The page says "ready" when it loads, and the bridge replays the latest result.
  windowLoaded = true;
  Max.outlet("window", "url", url);
  placeWindow(loadWindowPrefs());
  Max.outlet("window", "front");
}

Max.addHandler("open_window", () => showWindow(WINDOW_URL));
Max.addHandler("window_mode", (s) => {
  const prefs = decode(s);
  try {
    fs.mkdirSync(path.dirname(WINDOW_FILE), { recursive: true });
    fs.writeFileSync(WINDOW_FILE, JSON.stringify(prefs));
  } catch (e) {
    Max.post(`Couldn't save the window size: ${e.message}`);
  }
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
    const t = tracks.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    if (!t) throw new UserError(`There's no track called "${name}" in this set.`);
    return t.index;
  };
  switch (action.type) {
    case "track_volume":
      return await askLive("volume", "volume_done", trackIndex(a.track), a.change_db);
    case "track_eq":
      return await askLive("eq", "eq_done", a.freq_hz, a.gain_db, a.q, trackIndex(a.track), a.shape || "bell", a.steep ? 1 : 0);
    case "jump_to":
      toLive("jump", a.bar);
      return { ok: true, text: `Moved the playhead to bar ${a.bar}.` };
    case "add_marker": {
      const m = await askLive("marker", "marker_done", a.bar, a.name);
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
    // The last few exchanges, so "it" and "that" make sense. What was done, as Aria reported it.
    recent: askLog.slice(-3).map((x) => ({ asked: x.request, did: x.done.map((d) => d.text), replied: x.reply })),
  };
}

let asking = false;
Max.addHandler("ask", async (s) => {
  if (asking) return;
  asking = true;
  const { text } = decode(s);
  toUI("ask_pending", { request: text });
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
    askLog.push({ request: text, reply: res.json.reply, done, suggestions: res.json.suggestions,
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
  addNote(out.text, exchange);
});

Max.addHandler("undo", async () => {
  let out;
  try { out = await askLive("undo", "undo_done"); } catch (e) { out = { ok: false, text: e.message }; }
  addNote(out.text);
});

Max.addHandler("clear_history", () => { askLog = []; logChanged(); });

// The strip's Ask opens the window with Ask Muse open.
Max.addHandler("open_ask", () => showWindow(WINDOW_URL + "&ask=1"));

// jweb also reports its own status (url loaded and so on). Nothing to do with those.
Max.addHandler(Max.MESSAGE_TYPES.ALL, () => {});

// ---------- start ----------

Max.outlet("jweb", "url", STRIP_URL);
ensureEngine().catch((e) => setEngine("error", e.message));
