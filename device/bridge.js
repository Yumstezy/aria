// Aria's bridge. Runs in [node.script bridge.js @autostart 1].
// Starts the engine if needed, loads the strip UI into jweb, and runs Check mix:
// ask Live for tempo, make sure it's playing, record 8 bars of Main with
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
const STRIP_URL = "file://" + encodeURI(path.join(REPO, "ui", "strip.html")) + "?host=max&theme=night";
const LOG_DIR = path.join(os.homedir(), "Library", "Logs", "Aria");
const REC_DIR = path.join(os.tmpdir(), "aria");
const BARS = 8;
const START_TIMEOUT_MS = 20000;
const LIVE_TIMEOUT_MS = 3000;
const ANALYZE_TIMEOUT_MS = 45000;
const FILE_SETTLE_MS = 500;

let engineChild = null;   // only an engine this device started, never one started by hand
let engineState = { state: "starting", text: "Starting Aria" };
let busy = false;
const waiters = {};       // live.js reply name -> resolve function

const encode = (obj) => encodeURIComponent(JSON.stringify(obj));
const decode = (s) => JSON.parse(decodeURIComponent(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toUI = (name, payload) => Max.outlet("jweb", name, encode(payload));
const toLive = (...args) => Max.outlet("live", ...args);
const toRec = (...args) => Max.outlet("rec", ...args);

class UserError extends Error {}

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
      if (recording.stopped) { toRec(0); throw new UserError("Playback stopped before 8 bars were recorded. Press Check mix while the song plays."); }
      const left = Math.max(0, Math.ceil((ms - (Date.now() - started)) / 1000));
      toUI("progress", { step: "record", text: `Listening to bars ${startBar} to ${startBar + BARS - 1}`, detail: `${left} s`, done: Date.now() - started, total: ms });
      await sleep(250);
    }
    await sleep(FILE_SETTLE_MS);
    recording = null;

    if (!fs.existsSync(file) || fs.statSync(file).size < 1024) {
      throw new UserError("The recording came out empty. Is Aria on the Main track?");
    }

    toUI("progress", { step: "analyze", text: "Measuring and asking Muse Spark" });
    const res = await request("POST", "/mix/analyze",
      { mix_path: file, start_beat: live.song_beat, tempo: live.tempo, bars: BARS }, ANALYZE_TIMEOUT_MS);
    if (res.status !== 200) {
      throw new UserError((res.json && res.json.detail) || `The engine couldn't analyze the recording (HTTP ${res.status}).`);
    }
    toUI("mix_result", { ...res.json, start_bar: startBar, chain: live.chain });
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
  try { await ensureEngine(); } catch (e) { setEngine("error", e.message); }
});
Max.addHandler("check_mix", () => checkMix());
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
// jweb also reports its own status (url loaded and so on). Nothing to do with those.
Max.addHandler(Max.MESSAGE_TYPES.ALL, () => {});

// ---------- start ----------

Max.outlet("jweb", "url", STRIP_URL);
ensureEngine().catch((e) => setEngine("error", e.message));
