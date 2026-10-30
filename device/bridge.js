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
// Dark (Night) by default; Light (Sky) when the producer picks it in the window's rail (Ian, Oct 27). Saved in window.json.
const pageUrl = (screen) => "file://" + encodeURI(path.join(REPO, "ui", "dist", screen, "index.html")) +
  "?theme=" + (loadWindowPrefs().theme === "sky" ? "sky" : "night");
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
let minimized = null;     // { chat: bool } while the docked window is a tab on its edge
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
// Key tracks mode (build step 4): every Aria Ear in the set records with Main and says which track it is
const toEars = (...args) => Max.outlet("ears", ...args);
let earFiles = null;   // [{name, file}] from the Ears during a Check mix
Max.addHandler("ear_back", (s) => { if (earFiles) earFiles.push(decode(s)); });

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

// ---------- Aria's helper in Live (device/remote): puts Aria Ears on key tracks ----------
// Live's API inserts only Live's own devices, so a Max for Live device like Aria Ear needs the browser.

const REMOTE = { host: "127.0.0.1", port: Number(process.env.ARIA_REMOTE_PORT) || 8766 };   // tests use another port
const REMOTE_TIMEOUT_MS = 8000;
const REMOTE_OFF = "To add Ears for you, Aria's helper has to be on: in Live, Settings > Link, Tempo & MIDI > Control Surface, pick Aria.";

function remote(cmd) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(REMOTE);
    let buf = "";
    const fail = (text) => { sock.destroy(); reject(new UserError(text)); };
    sock.setTimeout(REMOTE_TIMEOUT_MS, () => fail("Live took too long to add the Ear."));
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

// Key tracks by name: at most one per role, so each Ear hears one part. Within a role a group wins (one Ear on
// a vocals group hears every vocal). A track named for two roles ("Kick + Bass") is skipped when the roles have
// tracks of their own: a clash between kick and bass can only be heard with them apart.
const ROLES = [["kick", /kick/i], ["bass", /bass|\bsub\b|808/i], ["vocal", /vocal|vox|voice/i],
               ["lead", /lead|synth|pluck|arp/i], ["pad", /pad|chord|keys/i], ["drums", /drum|perc|snare|clap|hat/i]];

// A muted track, or one with no clips, would only give its Ear silence (Ian's empty "vOCAL", Oct 29). Groups hold
// no clips themselves, so they always count. clips is missing from an older live.js: count those as playing.
const mightPlay = (t) => !t.muted && (t.group || t.clips === undefined || t.clips > 0);

function pickKeyTracks(allTracks) {
  const tracks = allTracks.filter(mightPlay);
  const roles = (t) => ROLES.filter(([, re]) => re.test(t.name)).map(([r]) => r);
  const single = new Set(tracks.filter((t) => roles(t).length === 1).flatMap(roles));
  const picked = [];
  for (const [role] of ROLES) {
    const fits = tracks.filter((t) => roles(t).includes(role) && !picked.includes(t) && !(roles(t).length > 1 && roles(t).every((r) => single.has(r))));
    const best = fits.find((t) => t.group) || fits[0];
    if (best) picked.push(best);
  }
  return picked;
}
const EAR = "Aria Ear";
const EAR_READY_MS = 800;
const earsOn = (tracks) => tracks.filter((t) => (t.devices || []).includes(EAR)).map((t) => t.name);

// Put an Ear on each key track that doesn't have one. Returns how many tracks have Ears; throws UserError.
async function addEars() {
  const live = await askLive("state", "live_state");
  const have = earsOn(live.tracks);
  const pick = pickKeyTracks(live.tracks).filter((t) => !have.includes(t.name));
  if (have.length + pick.length < 2) {
    throw new UserError("Aria didn't find key tracks by name (Kick, Bass, Lead, Vocal and so on). Rename them, or drop Aria Ear on the tracks you want.");
  }
  if (pick.length) toUI("ears", { busy: true, text: `Adding Ears to ${pick.map((t) => t.name).join(", ")}` });
  for (const t of pick) {
    const r = await remote({ cmd: "load_ear", track: t.index });
    // An older helper (Live reads it only at startup) doesn't know load_ear yet
    if (!r.ok) throw new UserError(/unknown command/i.test(r.text) ? "Aria's helper in Live is out of date. Quit and reopen Live, then try again." : r.text);
  }
  return pick.length;
}

// "Name my tracks" on: Ears go on now, and Check mix puts them back if they're missing (saved in window.json).
Max.addHandler("listen_tracks", () => serial(listenTracks));
async function listenTracks() {
  savePrefs({ ...loadWindowPrefs(), keyTracks: true });
  let text = null;
  try { await addEars(); } catch (e) { text = e instanceof UserError ? e.message : `Something went wrong: ${e.message}`; }
  toUI("ears", { busy: false, text });
  pushSession();
}

Max.addHandler("stop_listening", () => serial(async () => {
  savePrefs({ ...loadWindowPrefs(), keyTracks: false });
  let text;
  try { text = (await askLive("remove_ears", "ears_removed")).text; } catch (e) { text = e.message; }
  toUI("ears", { busy: false, text });
  pushSession();
}));

// ---------- One at a time ----------
// Everything that changes Live (asks, Do it, Undo, markers, jumps, Ears, Check mix) runs through one queue,
// so two changes never share live.js's reply slots or its pending steps.
let liveQueue = Promise.resolve();
function serial(fn) {
  const run = liveQueue.then(fn, fn);
  liveQueue = run.catch(() => {});
  return run;
}

// Undo, as the producer sees it: which pill each live.js undo step belongs to, newest last.
// The UI shows Undo on the top one only; an undone change is marked, never offered again.
let changeStack = [];   // [{ i: exchange's at, kind: "d" | "s", k }]
const UNDOABLE = (type) => !["jump_to", "check_mix", "undo", "route_sidechain"].includes(type);
function sendUndoNext() {
  const top = changeStack[changeStack.length - 1];
  const i = top ? askLog.findIndex((x) => x.at === top.at) : -1;
  toUI("undo_next", top && i >= 0 ? { i, kind: top.kind, k: top.k } : null);
}

// ---------- live.js ----------

// Reading the whole set takes longer on big projects than one change does
const LIVE_SLOW = { live_state: 8000, ears_removed: 8000, clips_playing: 8000 };
function askLive(command, reply, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (reply === "live_state") stateWaiters.splice(stateWaiters.indexOf(done) >>> 0, 1);
      else delete waiters[reply];
      reject(new UserError("Live didn't answer. Try removing and adding Aria again."));
    }, LIVE_SLOW[reply] || LIVE_TIMEOUT_MS);
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
for (const reply of ["marker_deleted", "prop_done", "tempo_done", "route_done", "jump_done", "clips_playing"]) {
  Max.addHandler(reply, (s) => { const w = waiters[reply]; delete waiters[reply]; if (w) w(decode(s)); });
}
Max.addHandler("ears_removed", (s) => { const w = waiters.ears_removed; delete waiters.ears_removed; if (w) w(decode(s)); });
Max.addHandler("volume_done", (s) => { const w = waiters.volume_done; delete waiters.volume_done; if (w) w(decode(s)); });
// Not a failed check: a note in the header, so Check mix's own result stays on screen
Max.addHandler("live_error", (s) => toUI("notice", decode(s)));
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

    // "Name my tracks" is on: put the Ears on first, in this same check, so it isn't checked twice
    if (loadWindowPrefs().keyTracks && earsOn(live.tracks).length < 2) {
      toUI("progress", { step: "start", text: "Adding Ears to your key tracks" });
      try {
        if (await addEars()) await sleep(EAR_READY_MS);   // let the new Ears load before they're asked to record
        toUI("ears", { busy: false, text: null });
      } catch (e) {
        toUI("ears", { busy: false, text: e instanceof UserError ? e.message : e.message });   // check without them
      }
      pushSession();
      live = await askLive("state", "live_state");   // the song moved on while the Ears loaded
    }

    Max.post(`check_mix: tempo ${live.tempo}, beat ${live.song_beat}, chain ${JSON.stringify(live.chain)}`);
    const ms = Math.round(BARS * live.beats_per_bar * 60000 / live.tempo);
    const startBar = Math.floor(live.song_beat / live.beats_per_bar) + 1;
    // The song's last bar (the one the last note or audio ends in), when Live says. Past it is only silence.
    const songEndBar = live.song_end > 0 ? Math.ceil(live.song_end / live.beats_per_bar) : null;
    if (songEndBar && startBar > songEndBar) {
      throw new UserError(`The playhead is past the end of your song (bar ${songEndBar}). Move it into the song and check again.`);
    }
    fs.mkdirSync(REC_DIR, { recursive: true });
    const file = path.join(REC_DIR, `mix-${Date.now()}.aif`);

    recording = { stopped: false };
    earFiles = [];
    // Float, so overs above 0 dBFS inside Live are recorded as they are, not capped.
    toRec("samptype", "float32");
    toRec("open", file);
    toEars("record", REC_DIR, ms, Date.now());   // the Ears start in the same moment as Main
    toRec("record", ms);

    const started = Date.now();
    while (Date.now() - started < ms) {
      if (recording.stopped) { toRec(0); toEars("stop"); throw new UserError(`Playback stopped before ${BARS} bars were recorded. Press Check mix while the song plays.`); }
      const left = Math.max(0, Math.ceil((ms - (Date.now() - started)) / 1000));
      toUI("progress", { step: "record", text: `Listening to bars ${startBar} to ${startBar + BARS - 1}`, detail: `${left} s`, done: Date.now() - started, total: ms });
      await sleep(250);
    }
    await sleep(FILE_SETTLE_MS);
    recording = null;

    if (!fs.existsSync(file) || fs.statSync(file).size < 1024) {
      throw new UserError("The recording came out empty. Is Aria on the Main track?");
    }

    // Each Ear's recording, by its track's name (a second track with the same name gets " 2")
    const tracks = {}, earNameOf = {};
    const earNames = earFiles || [];
    for (const ear of earNames) {
      if (!fs.existsSync(ear.file) || fs.statSync(ear.file).size < 1024) continue;
      let name = ear.name, n = 2;
      while (tracks[name]) name = `${ear.name} ${n++}`;
      tracks[name] = ear.file;
      earNameOf[name] = ear.name;
    }
    earFiles = null;
    const keyTracks = Object.keys(tracks).length >= 2;
    // Which of those tracks had clips playing in these bars, by Live's word: a quiet vocal is playing, a track
    // with nothing in these bars is silent, whatever its recording sounds like
    let tracksPlaying = null;
    if (keyTracks) {
      try {
        const byName = await askLive("clips_playing", "clips_playing",
          encode({ names: (earNames || []).map((e) => e.name), start: live.song_beat, end: live.song_beat + BARS * live.beats_per_bar }));
        tracksPlaying = {};
        for (const [shown, orig] of Object.entries(earNameOf)) tracksPlaying[shown] = byName[orig] === undefined ? null : byName[orig];
      } catch (e) { tracksPlaying = null; }   // Live didn't answer: the engine goes by the audio
    }

    toUI("progress", { step: "analyze", text: keyTracks ? `Comparing ${Object.keys(tracks).length} tracks and asking Muse Spark`
      : referenceNow() ? `Comparing with ${referenceNow().name} and asking Muse Spark` : "Splitting your mix and asking Muse Spark" });
    const ref = referenceNow();
    // With the song's parts known, compare with the reference's part of the same name, not the whole reference
    const parts = partsFor(startBar, BARS);
    const refPart = ref && parts.theirs ? { reference_window: [parts.theirs.start_sec, parts.theirs.end_sec], reference_part: parts.theirs.name } : {};
    const res = await request("POST", "/mix/analyze",
      { mix_path: file, start_beat: live.song_beat, tempo: live.tempo, bars: BARS, beats_per_bar: live.beats_per_bar,
        ...(keyTracks ? { tracks, ...(tracksPlaying ? { tracks_playing: tracksPlaying } : {}) } : {}),
        ...(ref ? { reference_path: ref.path, reference_name: ref.name, ...refPart } : {}) }, ANALYZE_TIMEOUT_MS);
    if (res.status !== 200) {
      throw new UserError((res.json && res.json.detail) || `The engine couldn't analyze the recording (HTTP ${res.status}).`);
    }
    lastCheck = { file, start_beat: live.song_beat, tempo: live.tempo, beats_per_bar: live.beats_per_bar, start_bar: startBar,
                  findings: (res.json.clarity && res.json.clarity.findings) || [] };
    lastResult = { ...res.json, start_bar: startBar, chain: live.chain, ...(parts.mine && parts.mine.name ? { part: parts.mine.name } : {}),
                   ...(songEndBar && startBar + BARS - 1 > songEndBar ? { song_end_bar: songEndBar } : {}) };
    toUI("mix_result", lastResult);
    pushSession();
  } catch (e) {
    recording = null;
    earFiles = null;
    toUI("error", { text: e instanceof UserError ? e.message : `Something went wrong: ${e.message}` });
  } finally {
    busy = false;
  }
}

// ---------- Arrangement (build step 8b): the song's parts ----------
// "Hear the whole song" (only on the Arrangement tab, Ian): Live plays from bar 1 to the song's end once and Main is
// recorded, the engine finds the parts and Muse names them. The reference's parts come from its file. Kept for
// this Live session; every Check mix after that compares your part with the reference's part of the same name.

let arrangement = null;   // { mine, ref, at }
let hearing = null;       // { cancel } while the song is being heard

Max.addHandler("hear_song", () => serial(hearSong));
Max.addHandler("stop_hearing", () => { if (hearing) hearing.cancel = true; });

async function hearSong() {
  if (busy) return;
  busy = true;
  hearing = { cancel: false };
  try {
    await ensureEngine();
    let live = await askLive("state", "live_state");
    if (!(live.song_end > 0)) throw new UserError("Aria couldn't find where your song ends. Put your clips in the Arrangement and try again.");
    // Always from bar 1 (Ian). Jumping while Live plays lands a moment later than the state reads back (build step
    // 1.6): on Oct 29 the first press recorded from bar 66. So: stop, go to bar 1, play, and wait until Live
    // really is near bar 1 before recording.
    toUI("arrangement_progress", { step: "start", text: "Going to bar 1" });
    if (live.playing) {
      const stopped = new Promise((resolve) => { waiters.live_playing = (on) => { if (!on) { delete waiters.live_playing; resolve(); } }; });
      toLive("stop_song");
      await Promise.race([stopped, sleep(LIVE_TIMEOUT_MS)]);
      delete waiters.live_playing;
    }
    await askLive("jump", "jump_done", 1);
    const playing = waitForPlaying(LIVE_TIMEOUT_MS);
    toLive("play");
    await playing;
    for (let i = 0; i < 20; i++) {
      live = await askLive("state", "live_state");
      if (live.song_beat < live.beats_per_bar) break;
      await sleep(100);
    }
    if (live.song_beat >= live.beats_per_bar) throw new UserError("Live didn't go back to bar 1. Stop the song, press Hear the whole song again.");
    const startBeat = live.song_beat, endBeat = live.song_end;
    const ms = Math.round((endBeat - startBeat) * 60000 / live.tempo) + 500;
    const lastBar = Math.ceil(endBeat / live.beats_per_bar);
    Max.post(`hear_song: tempo ${live.tempo}, from beat ${startBeat} to ${endBeat} (${Math.round(ms / 1000)} s)`);
    fs.mkdirSync(REC_DIR, { recursive: true });
    const file = path.join(REC_DIR, `song-${Date.now()}.aif`);
    recording = { stopped: false };
    toRec("samptype", "float32");
    toRec("open", file);
    toRec("record", ms);
    const started = Date.now();
    while (Date.now() - started < ms) {
      if (hearing.cancel || recording.stopped) {
        toRec(0);
        recording = null;
        if (hearing.cancel) toLive("stop_song");
        throw new UserError(hearing.cancel ? "Stopped. Nothing in your song changed." : "Playback stopped before the end of the song. Press Hear the whole song to try again.");
      }
      const done = Date.now() - started;
      const bar = Math.min(lastBar, Math.floor((startBeat + (done / 60000) * live.tempo) / live.beats_per_bar) + 1);
      toUI("arrangement_progress", { step: "record", text: `Listening to bar ${bar} of ${lastBar}`, done, total: ms, bar, last_bar: lastBar });
      await sleep(250);
    }
    await sleep(FILE_SETTLE_MS);
    recording = null;
    toLive("stop_song");
    if (!fs.existsSync(file) || fs.statSync(file).size < 1024) throw new UserError("The recording came out empty. Is Aria on the Main track?");

    toUI("arrangement_progress", { step: "analyze", text: "Finding the parts and asking Muse Spark to name them" });
    const res = await request("POST", "/sections", { wav_path: file, tempo: live.tempo, start_beat: startBeat, beats_per_bar: live.beats_per_bar }, ANALYZE_TIMEOUT_MS);
    if (res.status !== 200) throw new UserError((res.json && res.json.detail) || `The engine couldn't find the parts (HTTP ${res.status}).`);
    arrangement = { mine: res.json, ref: await referenceSections(), at: Date.now() };
    toUI("arrangement", arrangement);
  } catch (e) {
    toUI("arrangement_progress", { step: "error", text: e instanceof UserError ? e.message : `Something went wrong: ${e.message}` });
  } finally {
    hearing = null;
    busy = false;
  }
}

// The reference's parts, from its own file (cached by the engine). Null without a reference or when it fails.
async function referenceSections() {
  const ref = referenceNow();
  if (!ref) return null;
  try {
    const res = await request("POST", "/sections", { wav_path: ref.path }, ANALYZE_TIMEOUT_MS);
    return res.status === 200 ? { ...res.json, song: ref.name } : null;
  } catch (e) { return null; }
}

// "Add markers to Live": each part's name at its first bar. The producer pressed the button, so that's the yes;
// each marker is its own Undo.
Max.addHandler("arrangement_markers", () => serial(async () => {
  const parts = arrangement && arrangement.mine ? arrangement.mine.sections : [];
  let added = 0;
  toLive("markers_begin");   // stop once, place them all, put the playhead back once (live.js)
  await sleep(150);
  for (const p of parts) {
    try {
      const done = await askLive("marker", "marker_done", p.start_bar, p.name || `Part ${p.label}`);
      if (done.ok !== false) { added++; changeStack.push({ at: null, kind: "d", k: 0 }); }
    } catch (e) { /* the rest still go in */ }
  }
  toLive("markers_end");
  sendUndoNext();
  toUI("notice", { text: added ? `Added ${added} marker${added === 1 ? "" : "s"} to Live. Undo takes them back one at a time.` : "Live didn't take the markers." });
}));

// Which part of the song a check heard (most of its bars), and the reference's part with the same name
function partsFor(startBar, bars) {
  if (!arrangement || !arrangement.mine) return {};
  const overlap = (s) => Math.max(0, Math.min(s.start_bar + s.bars, startBar + bars) - Math.max(s.start_bar, startBar));
  const mine = arrangement.mine.sections.reduce((best, s) => (overlap(s) > (best ? overlap(best) : 0) ? s : best), null);
  if (!mine || !mine.name) return { mine };
  const theirs = arrangement.ref && arrangement.ref.sections.filter((s) => s.name === mine.name)
    .sort((a, b) => b.energy_db - a.energy_db)[0];   // their loudest part of that name: the one producers compare
  return { mine, theirs };
}

// ---------- Live analyzer (Oct 30) ----------
// The device's filter bank (Aria.amxd, an-*) reads 31 third-octave bands of Main 20 times a second, only while the
// window's analyzer is open. Frames go to the window alone, in dB, never to the strip or the chat.
let analyzerOn = false;
Max.addHandler("analyzer_on", () => { analyzerOn = true; Max.outlet("an", 1); });
Max.addHandler("analyzer_off", () => { analyzerOn = false; Max.outlet("an", 0); });
Max.addHandler("analyzer_frame", (...rms) => {
  if (!analyzerOn || !windowLoaded) return;
  Max.outlet("window", "analyzer", encode(rms.map((x) => (x > 1e-6 ? Math.round(200 * Math.log10(x)) / 10 : -120))));
});

// ---------- Arrangement edits (Oct 30): renamed parts and moved edges, kept for markers and checks ----------
Max.addHandler("arrangement_edit", (s) => {
  const { sections } = decode(s);
  if (!arrangement || !Array.isArray(sections) || !sections.length) return;
  arrangement = { ...arrangement, mine: { ...arrangement.mine, sections, edited: true } };
  toUI("arrangement", arrangement);
});

// ---------- Before and after (Oct 30): the same bars again, after a fix, at the same loudness ----------
// Live plays from the bar the last check started in, and Main is recorded long enough to cover the same beats.
// The engine lines the two up beat for beat, matches their loudness and says what changed in each problem's range.
let lastCheck = null;   // { file, start_beat, tempo, beats_per_bar, start_bar, findings }
Max.addHandler("recheck", () => serial(recheck));

async function recheck() {
  if (busy || !lastCheck) return;
  busy = true;
  const c = lastCheck;
  try {
    await ensureEngine();
    toUI("before_after_progress", { step: "start", text: `Going to bar ${c.start_bar}` });
    let live = await askLive("state", "live_state");
    if (live.playing) {
      const stopped = new Promise((resolve) => { waiters.live_playing = (on) => { if (!on) { delete waiters.live_playing; resolve(); } }; });
      toLive("stop_song");
      await Promise.race([stopped, sleep(LIVE_TIMEOUT_MS)]);
      delete waiters.live_playing;
    }
    await askLive("jump", "jump_done", c.start_bar);
    const playing = waitForPlaying(LIVE_TIMEOUT_MS);
    toLive("play");
    await playing;
    const barBeat = (c.start_bar - 1) * c.beats_per_bar;
    for (let i = 0; i < 20; i++) {
      live = await askLive("state", "live_state");
      if (Math.abs(live.song_beat - barBeat) < c.beats_per_bar) break;
      await sleep(100);
    }
    const startBeat = live.song_beat;
    const beats = (c.start_beat - startBeat) + BARS * c.beats_per_bar;   // up to where the first check ended
    const ms = Math.round(beats * 60000 / live.tempo) + 300;
    fs.mkdirSync(REC_DIR, { recursive: true });
    const file = path.join(REC_DIR, `after-${Date.now()}.aif`);
    recording = { stopped: false };
    toRec("samptype", "float32");
    toRec("open", file);
    toRec("record", ms);
    const started = Date.now();
    while (Date.now() - started < ms) {
      if (recording.stopped) { toRec(0); recording = null; throw new UserError("Playback stopped before the bars were heard again."); }
      toUI("before_after_progress", { step: "record", text: `Listening to bars ${c.start_bar} to ${c.start_bar + BARS - 1} again`, done: Date.now() - started, total: ms });
      await sleep(250);
    }
    await sleep(FILE_SETTLE_MS);
    recording = null;
    toUI("before_after_progress", { step: "analyze", text: "Comparing before and after at the same loudness" });
    const res = await request("POST", "/mix/before-after", {
      before: { path: c.file, start_beat: c.start_beat }, after: { path: file, start_beat: startBeat },
      tempo: c.tempo, bars: BARS, findings: c.findings }, ANALYZE_TIMEOUT_MS);
    if (res.status !== 200) throw new UserError((res.json && res.json.detail) || `The engine couldn't compare them (HTTP ${res.status}).`);
    toUI("before_after", { ...res.json, start_bar: c.start_bar });
  } catch (e) {
    toUI("before_after_progress", { step: "error", text: e instanceof UserError ? e.message : `Something went wrong: ${e.message}` });
  } finally {
    busy = false;
  }
}

// ---------- messages from the UI ----------

Max.addHandler("ready", async () => {
  toUI("engine", engineState);
  if (lastResult) toUI("mix_result", lastResult);
  if (arrangement) toUI("arrangement", arrangement);
  toUI("ask_log", askLog);
  sendUndoNext();
  pushSession();
  try { await ensureEngine(); } catch (e) { setEngine("error", e.message); }
});

// Where the window is, as the bridge placed it: the UI's Layout menu, Minimize and the tab follow this
function layoutNow() {
  const p = loadWindowPrefs();
  const side = p.mode === "left" || p.mode === "right" ? p.mode : p.side === "right" ? "right" : "left";
  return { mode: p.mode === "left" || p.mode === "right" ? p.mode : "full", side };
}

// What the window shows about the set: tempo, time signature, where Aria sits, and the markers
async function pushSession() {
  try {
    const live = await askLive("state", "live_state");
    toUI("session", { tempo: live.tempo, signature: live.signature, markers: live.markers,
                      chain: { on_main: live.chain.on_main, after: live.chain.after }, ears: earsOn(live.tracks),
                      keyTracks: !!loadWindowPrefs().keyTracks, layout: layoutNow(), reference: referenceNow() });
  } catch (e) { /* Live didn't answer; the window says what it doesn't know */ }
}

Max.addHandler("set_theme", (s) => {
  const theme = decode(s).theme === "night" ? "night" : "sky";
  savePrefs({ ...loadWindowPrefs(), theme });
  toUI("theme", { theme });
});
// The reference song (build step 8): the page drops it, the engine keeps the file, the page tells us its path.
// Saved in window.json, so it stays picked across Live sessions. Only kept while the file is still there.
function referenceNow() {
  const r = loadWindowPrefs().reference;
  return r && r.path && fs.existsSync(r.path) ? { path: r.path, name: r.name } : null;
}
Max.addHandler("set_reference", (s) => {
  const { path: p, name } = decode(s);
  savePrefs({ ...loadWindowPrefs(), reference: p ? { path: p, name: name || path.basename(p) } : null });
  pushSession();
  if (arrangement) referenceSections().then((ref) => { arrangement = { ...arrangement, ref }; toUI("arrangement", arrangement); });
});
Max.addHandler("clear_reference", () => {
  savePrefs({ ...loadWindowPrefs(), reference: null });
  pushSession();
  if (arrangement) { arrangement = { ...arrangement, ref: null }; toUI("arrangement", arrangement); }
});

Max.addHandler("check_mix", () => serial(checkMix));
// The mic: the page sends the words to the engine itself, so make sure it's running
Max.addHandler("ensure_engine", async () => { try { await ensureEngine(); } catch (e) { setEngine("error", e.message); } });
// ---------- the window ----------

function loadWindowPrefs() {
  try { return JSON.parse(fs.readFileSync(WINDOW_FILE, "utf8")); } catch (e) { return { mode: "left", side: "left", screen: null }; }   // docked left by default (Ian, Oct 27)
}

// Docked windows float over Live with no title bar, so their glass can show Live through it.
// The page is sized first, then the window, so Live never shows the old page stretched to the new size.
// (The page also fades out before a move it asks for, and back in once it has its new size.)
function sizeWindow(target, ui, { x, y, w, h }, docked) {
  Max.outlet(target, "script", "sendbox", ui, "presentation_rect", 0, 0, Math.round(w), Math.round(h));
  Max.outlet(target, "window", "size", Math.round(x), Math.round(y), Math.round(x + w), Math.round(y + h));
  Max.outlet(target, "window", "flags", docked ? "float" : "nofloat");
  Max.outlet(target, "window", "flags", docked ? "notitle" : "title");
  Max.outlet(target, "window", "exec");
  setTimeout(() => toUI("placed", {}), 250);
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
  const docked = mode === "left" || mode === "right";
  screen = screen || FALLBACK_SCREEN;
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
  const side = prefs.side === "right" ? "right" : "left";
  sizeWindow("chat", "aria-chat-ui", { x: dockX(side, sc), y: dockTop(sc), w: SIDE_W, h: dockHeight(sc) }, true);
}

function savePrefs(prefs) {
  setTimeout(() => toUI("layout", layoutNow()), 0);   // every page follows where the window really is
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
  minimized = null;
  Max.outlet("window", "url", url);
  const prefs = loadWindowPrefs();
  // The chat is still out: stack again, the window on top
  // Up first: a window that isn't showing yet ignores its size, and would open at its default spot
  Max.outlet("window", "front");
  const place = () => {
    if (chatOpen && prefs.mode !== "full") placeStack(prefs.mode === "left" ? "left" : "right", prefs.screen || FALLBACK_SCREEN);
    else placeWindow(prefs);
  };
  place();
  setTimeout(place, 300);
}

// The strip sends the screen size, so the window can dock on its very first open
// A screen that failed to draw says why, so it shows in the Max log
Max.addHandler("ui_error", (s) => Max.post(`ui_error: ${decode(s).message}`));

Max.addHandler("open_window", (s) => {
  const screen = s && decode(s).screen;
  if (screen) savePrefs({ ...loadWindowPrefs(), screen });
  showWindow(pageUrl("window"));
});
Max.addHandler("open_chat", (s) => openChatWindow(s && decode(s).screen));

// The mapped key (the strip's "Ask key" in Live's Key Map): hold to talk to Muse, let go to send.
// Pressing it opens Ask Muse; the chat page records while it's held.
Max.addHandler("ask_key", (v) => {
  const down = v === undefined || v === "bang" || Number(v) !== 0;
  if (down && !chatOpen) openChatWindow(null);
  toUI("voice_key", { down });
});

function openChatWindow(fromPage) {
  const prefs = loadWindowPrefs();
  const screen = fromPage || prefs.screen || FALLBACK_SCREEN;
  // The side it's docked on, or the side it was last docked on
  const side = prefs.mode === "left" || prefs.mode === "right" ? prefs.mode : prefs.side === "right" ? "right" : "left";
  // Remember the layout it came from (full or docked), so closing the chat goes back to it
  savePrefs({ ...prefs, mode: side, side, screen, before: chatOpen ? prefs.before : prefs.mode });
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
// Back from the pop-out: close the chat and put the window back the way it was before (full or
// docked). "back" (the chat's Back button) also reopens the window if it was closed.
Max.addHandler("close_chat", (s) => {
  const back = !!(s && decode(s).back);
  chatOpen = false;
  Max.outlet("chat", "wclose");
  const prefs = loadWindowPrefs();
  if (prefs.before) { prefs.mode = prefs.before; delete prefs.before; savePrefs(prefs); }
  if (mainOpen) { placeWindow(prefs); Max.outlet("window", "front"); }
  else if (back) showWindow(pageUrl("window"));
});

// Closes only the main window. A popped-out chat stays, and grows into the space.
Max.addHandler("close_window", () => {
  mainOpen = false;
  if (analyzerOn) { analyzerOn = false; Max.outlet("an", 0); }
  Max.outlet("window", "wclose");
  if (chatOpen) placeChatAlone(loadWindowPrefs());
});

Max.addHandler("window_mode", (s) => {
  // Keep the rest of the saved choices (theme, Name my tracks): only the layout changes here
  const prefs = { ...loadWindowPrefs(), ...decode(s) };
  if (prefs.mode === "left" || prefs.mode === "right") prefs.side = prefs.mode;
  delete prefs.before;
  savePrefs(prefs);
  toUI("layout", layoutNow());
  if (chatOpen && prefs.mode !== "full") { placeStack(prefs.mode, prefs.screen || FALLBACK_SCREEN); return; }
  if (chatOpen) { chatOpen = false; Max.outlet("chat", "wclose"); }
  placeWindow(prefs);
});
// Minimize: the docked window becomes a small tab on its edge (the chat hides too). The tab brings it back.
const TAB = { w: 44, h: 132 };
Max.addHandler("minimize", () => {
  const prefs = loadWindowPrefs(), sc = prefs.screen || FALLBACK_SCREEN;
  const side = prefs.mode === "right" || (prefs.mode !== "left" && prefs.side === "right") ? "right" : "left";
  minimized = { chat: chatOpen };
  if (chatOpen) { chatOpen = false; Max.outlet("chat", "wclose"); }
  const x = side === "left" ? sc.x : sc.x + sc.w - TAB.w;
  sizeWindow("window", "aria-window-ui", { x, y: dockTop(sc) + Math.round(dockHeight(sc) / 2 - TAB.h / 2), ...TAB }, true);
  Max.outlet("window", "front");
});
Max.addHandler("restore", () => {
  const was = minimized;
  minimized = null;
  if (was && was.chat) { openChatWindow(null); return; }
  placeWindow(loadWindowPrefs());
  Max.outlet("window", "front");
});

Max.addHandler("jump_to", (s) => serial(() => askLive("jump", "jump_done", decode(s).bar).catch(() => {})));
Max.addHandler("add_marker", (s) => serial(async () => {
  const { bar, name } = decode(s);
  try {
    const done = await askLive("marker", "marker_done", bar, name);
    if (done.ok !== false) { changeStack.push({ at: null, kind: "d", k: 0 }); sendUndoNext(); }   // Undo can take it back, but no pill shows it
    toUI("marker_done", done);
  } catch (e) {
    toUI("notice", { text: e.message });
  }
}));
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
      return await askLive("eq", "eq_done", a.freq_hz, a.gain_db, a.q, trackIndex(a.track), a.shape || "bell", a.steep ? 1 : 0, a.mode || "aria");
    case "track_device":
      return await askLive("device", "device_done", trackIndex(a.track), encodeURIComponent(a.device), encodeURIComponent(JSON.stringify(a.settings || [])),
                           0, a.mode === "change" ? "change" : "add");
    case "route_sidechain":
      return await askLive("route_sidechain", "route_done", trackIndex(a.track), encodeURIComponent(a.from_track));
    case "delete_marker":
      return await askLive("delete_marker", "marker_deleted", a.bar);
    case "track_mute":
    case "track_solo":
      return await askLive("track_prop", "prop_done", trackIndex(a.track), action.type === "track_mute" ? "mute" : "solo", a.on ? 1 : 0);
    case "set_tempo":
      return await askLive("tempo", "tempo_done", a.bpm);
    case "jump_to":
      return await askLive("jump", "jump_done", a.bar);   // waits, so the next step never overlaps it
    case "add_marker": {
      const m = await askLive("marker", "marker_done", a.bar, a.name);
      if (m.ok === false) return m;
      return { ok: true, text: `Marker "${m.name}" at bar ${m.bar}.` };
    }
    case "eq_band":
      return await askLive("eq", "eq_done", a.freq_hz, a.gain_db, a.q, -1, a.shape || "bell", a.steep ? 1 : 0, a.mode || "aria");
    case "undo":
      return await askLive("undo", "undo_done");
    case "check_mix":
      if (busy) return { ok: false, text: "A Mix check is already running." };
      serial(checkMix);   // queued: it starts once this answer's changes are done
      return { ok: true, text: "Mix check is next." };
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
Max.addHandler("ask", (s) => {
  let text;
  try { text = decode(s).text; } catch (e) { return; }
  if (asking || !text) return;
  asking = true;
  return serial(() => runAsk(text));
});

async function runAsk(text) {
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
      // A sidechain's routing only follows its own Compressor
      if (action.type === "route_sidechain" && done.length && !done[done.length - 1].ok) continue;
      try { done.push({ ...action, ...(await apply(action, context.tracks)) }); }
      catch (e) { done.push({ ...action, ok: false, text: e.message }); }
    }
    const reply = res.json.reply, suggestions = res.json.suggestions;
    // guides: how a third-party plugin should look (Aria draws it; the producer sets it)
    const at = Date.now();
    // Everything failed in Live: the reply would say it was done
    askLog.push({ request: text, reply: done.length && done.every((d) => !d.ok) ? null : reply, done, suggestions, guides: res.json.guides || [],
                  problems: res.json.problems || [], error: res.json.error, notes: [], at });
    noteChanges(at, done);
  } catch (e) {
    askLog.push({ request: text, reply: null, done: [], suggestions: [], problems: [], notes: [], at: Date.now(),
                  error: e instanceof UserError ? e.message : `Something went wrong: ${e.message}` });
  } finally {
    logChanged();                                   // the answer first, then pending clears: no blink
    toUI("ask_pending", { request: null });
    asking = false;
  }
}

// Each change that went through, in order, onto the Undo stack (an Undo from Muse pops one)
function noteChanges(at, done) {
  done.forEach((d, k) => {
    if (!d.ok) return;
    if (d.type === "undo") undoneTop();
    else if (UNDOABLE(d.type)) changeStack.push({ at, kind: "d", k });
  });
  sendUndoNext();
}
function undoneTop() {
  const top = changeStack.pop();
  const x = top && askLog.find((e) => e.at === top.at);
  if (x && top.kind === "d" && x.done[top.k]) x.done[top.k].undone = true;
  if (x && top.kind === "s" && x.suggestions[top.k] && x.suggestions[top.k].result) x.suggestions[top.k].result.undone = true;
}

// The producer answered one of Muse's suggestions. Yes runs it (the engine already checked it).
Max.addHandler("answer", (s) => serial(async () => {
  const { exchange, index, yes, at } = decode(s);
  // By the exchange's time when given: positions shift once the history is full
  const x = at ? askLog.find((e) => e.at === at) : askLog[exchange];
  const sg = x && x.suggestions[index];
  if (!sg || sg.answered) return;
  sg.answered = yes ? "yes" : "no";
  logChanged();
  if (!yes) return;
  let out;
  try { out = await apply(sg, (await askContext()).tracks); } catch (e) { out = { ok: false, text: e.message }; }
  sg.result = { ok: !!out.ok, text: out.text };   // the card becomes the done pill, with Undo
  if (out.ok && UNDOABLE(sg.type)) changeStack.push({ at: x.at, kind: "s", k: index });
  logChanged();
  sendUndoNext();
}));

Max.addHandler("undo", () => serial(async () => {
  let out;
  try { out = await askLive("undo", "undo_done"); } catch (e) { out = { ok: false, text: e.message }; }
  const top = changeStack[changeStack.length - 1];
  // Nothing of Aria's left to undo: a passing note in the header, not a line in the chat each press
  if (!out.ok && !top) { toUI("notice", { text: out.text }); sendUndoNext(); return; }
  if (out.ok) undoneTop();
  // The note goes on the exchange whose change was undone
  const i = top ? askLog.findIndex((x) => x.at === top.at) : -1;
  addNote(out.text, i >= 0 ? i : askLog.length - 1);
  sendUndoNext();
}));

Max.addHandler("clear_history", () => { askLog = []; changeStack = []; logChanged(); sendUndoNext(); });

// The strip's Ask opens the window with Ask Muse open.
Max.addHandler("open_ask", () => showWindow(pageUrl("window") + "&ask=1"));

// jweb also reports its own status (url loaded and so on). Nothing to do with those.
Max.addHandler(Max.MESSAGE_TYPES.ALL, () => {});

// ---------- start ----------

Max.outlet("jweb", "url", pageUrl("strip"));
ensureEngine().catch((e) => setEngine("error", e.message));
