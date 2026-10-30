// Aria's UI state and its link to the device. Inside Live the page runs in jweb and talks to
// device/bridge.js through window.max; payloads both ways are URI-encoded JSON so Max never
// splits them on spaces or commas. In a normal browser (development) it calls the engine directly.
import { useSyncExternalStore } from "react";
import { startRecording, stopRecording, transcribe } from "@/lib/voice";

export const ENGINE = "http://127.0.0.1:8765";

export type Kind = "resonance" | "buildup" | "harsh" | "masking" | "bass_click" | "clash" | "reference";
export interface Finding {
  kind: Kind;
  hz?: number;
  hz_range: [number, number];
  size_db?: number;
  gap_db?: number;
  share?: number;
  bars: [number, number];
  masked?: string;
  tracks?: [string, string];   // clash: the two tracks fighting (key tracks mode)
  louder?: string;
  diff_db?: number;
  by?: string;
  range?: string;
  starts?: number;
  clicky_share?: number;
  bursts_per_bar?: number;
  shape?: "stretch" | "band";   // reference: a stretch that stands out, or a whole band off
  band?: string;
  stands_out_db?: number;
}
/** One part of a song (Arrangement, build step 8b). name comes from Muse Spark, or null with the letter shown. */
export interface Part { name: string | null; label: string; start_bar: number; bars: number; start_sec: number; end_sec: number; energy_db: number; rise_db_per_bar: number; confidence: number }
export interface SongParts { tempo: number | null; bars: number; sections: Part[]; names_by: string | null; names_error: string | null; error: string | null; song?: string }
export interface Arrangement { mine: SongParts; ref: SongParts | null; at: number }
export interface BeforeAfter {
  start_bar: number; seconds: number; lufs: { before: number; after: number };
  curve: { hz: number[]; mine: number[]; ref: number[] };   // mine: after, ref: before (both at the same loudness)
  problems: { index: number; kind: Kind; hz_range: [number, number]; change_db: number | null }[];
}

/** The comparison with the producer's reference song (build step 8). diff_db is the mix minus the reference. */
export interface RefCompare {
  name: string; path: string; error: string | null;
  /** The reference's part compared, when the song's parts are known (Arrangement) */
  part?: string | null;
  bands: { name: string; lo: number; hi: number; diff_db: number | null }[];
  /** Both songs at the same loudness, sixth octaves, dB: the picture of where each is fuller */
  curve: { hz: number[]; mine: number[]; ref: number[] } | null;
}
export interface EqFix { type: "eq_band"; freq_hz: number; gain_db: number; q: number }
export interface Note { finding: number; kind: Kind; short: string | null; text: string; fix: EqFix | null }
export interface Spectra { hz: number[]; mix: number[]; parts: Record<string, number[] | null> }
export interface Result {
  recording: { path: string; start_beat: number | null; tempo: number | null; bars: number | null };
  reference?: RefCompare | null;
  measured: {
    integrated_lufs: number | null; true_peak_dbtp: number | null;
    bands_db: Record<string, number | null>; width: Record<string, number | null>;
    unmeasured: Record<string, string>;
  };
  clarity: {
    mode: "master" | "split"; findings: Finding[]; bars?: [number, number];
    stems?: Record<string, number>; spectra?: Spectra; split_by?: string; unmeasured?: string;
  };
  advice: { summary: string; notes: Note[] } | null;
  advice_error: string | null;
  start_bar?: number;
  /** The part of the song this check heard, once Arrangement knows the parts */
  part?: string;
  /** Only when the check ran past the song's last bar: the bars after it were silence */
  song_end_bar?: number;
  chain?: { on_main: boolean; track: string; after: string[] };
}
export interface Progress { step: string; text: string; detail?: string; done?: number; total?: number }
export type EngineState = "starting" | "up" | "down" | "error";

export interface Setting { param: string; value?: number; option?: string; change?: number }
export interface Action { type: "jump_to" | "add_marker" | "eq_band" | "track_volume" | "track_eq" | "track_device" | "track_plugin" | "check_mix" | "undo"
  | "delete_marker" | "track_mute" | "track_solo" | "set_tempo" | "route_sidechain"; args: Record<string, number | string> & { settings?: Setting[] } }
export interface Done extends Action { ok: boolean; text: string; undone?: boolean }
export interface Suggestion { type: Action["type"]; args: Action["args"]; why: string; answered?: "yes" | "no"; result?: { ok: boolean; text: string; undone?: boolean } }
/** One band of a plugin guide, in Aria's shapes and units. dynamic_db: how far a dynamic band moves with the music. */
export interface GuideBand { band: number; shape: string; freq_hz: number; gain_db: number; q: number; dynamic_db?: number }
/** How a third-party plugin should look: Aria draws it, the producer sets it (Aria can't turn third-party plugins). */
export interface Guide { plugin: string; track: string | null; preset: string | null; about: string; source: "preset" | "aria"; bands: GuideBand[] }
export interface Exchange {
  request: string; reply: string | null; done: Done[]; suggestions: Suggestion[]; error: string | null; notes: string[];
  problems?: string[];   // calls Aria dropped, and why
  guides?: Guide[];
  at?: number;
}

/** The one line that says how an exchange went, so the strip is never blank. */
export function outcome(x: Exchange): { text: string; bad: boolean } {
  if (x.reply) return { text: x.reply, bad: false };
  if (x.guides?.length) return { text: `How it should look in ${x.guides[0].plugin}`, bad: false };
  if (x.error) return { text: x.error, bad: true };
  if (x.problems?.length) return { text: x.problems[0], bad: true };
  const failed = x.done.find((d) => !d.ok);
  if (failed) return { text: failed.text, bad: true };
  const did = x.done.filter((d) => d.ok);
  if (did.length) return { text: did[did.length - 1].text, bad: false };
  if (x.suggestions.length) return { text: "Muse has a suggestion. Open Ask to see it.", bad: false };
  return { text: "Muse didn't say anything back. Try asking another way.", bad: true };
}

interface State {
  ask: { open: boolean; pending: string | null; log: Exchange[] };
  engine: { state: EngineState; text: string };
  progress: Progress | null;
  result: Result | null;
  error: string | null;
  marker: { bar: number; name: string } | null;
  notice: string | null;
  theme: Theme;
  session: Session | null;
  /** Goes up each time the mapped key opens Ask Muse, so its input takes focus */
  askFocus: number;
  /** Adding or removing Aria Ears on the key tracks: what's happening, in words */
  ears: { busy: boolean; text: string | null };
  /** Talking to Muse: opening the mic, listening, turning it into words, or why it couldn't */
  voice: { state: "idle" | "starting" | "listening" | "hearing"; error: string | null };
  /** The change Undo will undo next, from the bridge: { exchange, done | suggestion, index }. None after a reload. */
  undoNext: { i: number; kind: "d" | "s"; k: number } | null;
  /** The song's parts (Arrangement), and how hearing the whole song is going */
  arrangement: Arrangement | null;
  hearing: Progress | null;
  /** Before and after (Oct 30): the same bars heard again after a fix, and how it's going */
  beforeAfter: BeforeAfter | null;
  rechecking: Progress | null;
  /** Where the window is, as the bridge placed it */
  layout: { mode: "full" | "left" | "right"; side: "left" | "right" } | null;
  /** Groove match (build step 9): the two loops, the last match, and how it's going */
  groove: GrooveState;
}

export interface GrooveClip { name: string; path: string; track_name: string; track_id: number; arrangement: boolean; start_beat: number | null }
export interface GrooveTiming { avg_ms: number | null; max_ms: number | null; hits: { sec: number; offset_ms: number }[]; missing?: number }
export interface GrooveResult { before: GrooveTiming; after: GrooveTiming; in_time: boolean; hits: number; hits_moved: number; out_path: string;
  grid?: { step_sec: number; beat1_sec: number; steps_per_bar: number };
  follow: string; strength: number; nudge_ms: number }
export interface GrooveState { moving: GrooveClip | null; anchor: GrooveClip | null; placed: { track_id: number; orig_id: number; playing: "before" | "after" } | null;
  result: GrooveResult | null; error: string | null; busy: string | null }

export type Theme = "sky" | "night";
/** About the set, from Live: shown in headers and the Get started steps */
export interface Session { tempo: number; signature: [number, number]; markers: { bar: number; name: string }[]; chain: { on_main: boolean; after: string[] }; ears?: string[]; keyTracks?: boolean;
  reference?: { path: string; name: string } | null;
  layout?: { mode: "full" | "left" | "right"; side: "left" | "right" } }

declare global {
  interface Window {
    max?: { outlet: (...args: unknown[]) => void; bindInlet: (name: string, fn: (arg?: string) => void) => void };
  }
}

export const inMax = typeof window !== "undefined" && !!window.max?.outlet;

let state: State = {
  ask: { open: typeof location !== "undefined" && new URLSearchParams(location.search).get("ask") === "1", pending: null, log: [] },
  engine: { state: "starting", text: "Starting Aria" },
  progress: null, result: null, error: null, marker: null, notice: null, theme: initialTheme(), session: null, askFocus: 0, ears: { busy: false, text: null }, voice: { state: "idle", error: null }, undoNext: null, layout: null, arrangement: null, hearing: null, beforeAfter: null, rechecking: null,
  groove: { moving: null, anchor: null, placed: null, result: null, error: null, busy: null },
};

// Dark (Night) unless the producer picked Light. Inside Live the bridge saves the choice and puts it in
// the page's URL; in a browser it's kept in localStorage.
function initialTheme(): Theme {
  if (typeof location === "undefined") return "night";
  const q = new URLSearchParams(location.search).get("theme");
  if (q === "night" || q === "sky") return q;
  try { return localStorage.getItem("aria.theme") === "sky" ? "sky" : "night"; } catch { return "night"; }
}
function applyTheme(theme: Theme) { document.documentElement.setAttribute("data-theme", theme); }
if (typeof document !== "undefined") applyTheme(state.theme);

export function setTheme(theme: Theme) {
  applyTheme(theme);
  set({ theme });
  try { localStorage.setItem("aria.theme", theme); } catch { /* storage may be off */ }
  send("set_theme", { theme });   // the bridge saves it and tells the strip and the other windows
}
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const useAriaSnapshot = () => state;
/** One slice of the state: the component re-renders only when that slice changes (not on every progress tick). */
export function useAriaSel<T>(pick: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => pick(state));
}
export function useAria() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

export function send(name: string, payload?: unknown) {
  if (!inMax) return false;
  if (payload === undefined) window.max!.outlet(name);
  else window.max!.outlet(name, encodeURIComponent(JSON.stringify(payload)));
  return true;
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
/** A short note in the header ("Reference is coming soon."). It clears itself after a few seconds. */
export function notice(text: string | null) {
  clearTimeout(noticeTimer);
  set({ notice: text });
  if (text) noticeTimer = setTimeout(() => set({ notice: null }), 4000);
}

// Moving or resizing a window: Live's web view shows the old frame stretched until the page catches up.
// So the page slides out (toward the edge it's going to, or a small fade), the window changes, and once its
// size settles the page slides back in. It's hidden only while the window itself changes.
type Motion = "fade" | "left" | "right";
const OUT_MS = 150, IN_MS = 260, SETTLE_MS = 120, GIVE_UP_MS = 900, EASE_OUT = "cubic-bezier(.32,.72,0,1)";
const away = (m: Motion) => (m === "left" ? "translateX(-56px)" : m === "right" ? "translateX(56px)" : "scale(0.97)");
let settle: ReturnType<typeof setTimeout> | undefined;
let arriving: Motion | null = null;

function moveThen(fn: () => void, motion: Motion = "fade") {
  const root = document.getElementById("root");
  if (!inMax || !root || location.pathname.includes("/strip/")) { fn(); return; }
  arriving = motion;
  const out = root.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: away(motion) }],
                           { duration: OUT_MS, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
  out.onfinish = () => {
    fn();
    clearTimeout(settle);
    settle = setTimeout(arrive, GIVE_UP_MS);   // in case the size didn't change
  };
}

/** Bring the page back in, from the side it left by. */
export function arrive() {
  const root = document.getElementById("root");
  if (!root) return;
  root.getAnimations().forEach((a) => a.cancel());
  const m = arriving;
  arriving = null;
  if (m) root.animate([{ opacity: 0, transform: away(m) }, { opacity: 1, transform: "none" }], { duration: IN_MS, easing: EASE_OUT });
}
if (typeof window !== "undefined") window.addEventListener("resize", () => {
  if (!arriving) return;
  clearTimeout(settle);
  settle = setTimeout(arrive, SETTLE_MS);
});

function on<T>(name: string, fn: (data: T) => void) {
  window.max!.bindInlet(name, (encoded) => {
    try { fn(encoded === undefined ? (undefined as T) : JSON.parse(decodeURIComponent(encoded))); }
    catch { set({ notice: "The device sent a message Aria could not read." }); }
  });
}

async function checkEngine() {
  try {
    const res = await fetch(ENGINE + "/health");
    if (!res.ok) throw new Error();
    set({ engine: { state: "up", text: "Engine connected" } });
  } catch {
    set({ engine: { state: "down", text: "Engine not running" } });
  }
}

/** Start listening. Call once per screen. */
export function connect() {
  if (inMax) {
    on<{ state: EngineState; text: string }>("engine", (e) => set({ engine: e, ...(e.state === "error" ? { error: e.text }
      : e.state === "up" && state.engine.state === "error" && state.error === state.engine.text ? { error: null } : {}) }));
    on<Progress>("progress", (p) => set({ progress: p, error: null }));
    on<Result>("mix_result", (r) => set({ result: known(r), progress: null, error: null, beforeAfter: null }));   // a new check: a new "before"
    on<{ text: string }>("error", (e) => set({ error: e?.text || "Something went wrong.", progress: null }));
    on<{ bar: number; name: string }>("marker_done", (m) => set({ marker: m }));
    on<{ request: string | null }>("ask_pending", (p) => {
      // The answer already arrived in ask_log: keep the thread as it is (no flicker)
      if (p.request === null && !state.ask.pending) return;
      set({ ask: { ...state.ask, pending: p.request } });
      if (p.request === null) askQueued();
    });
    // The bridge owns the history (saved on this Mac) and sends all of it on every change.
    on<Exchange[]>("ask_log", (log) => {
      // The answer to what's pending is in: clear pending in the same update, so the thread never blinks
      // Only a new entry counts: the same request asked twice (Fix it on one problem again) mustn't match the old answer
      const answered = state.ask.pending !== null && log.length > state.ask.log.length && log[log.length - 1].request === state.ask.pending;
      set({ ask: { ...state.ask, log, ...(answered ? { pending: null } : {}) } });
      if (answered) askQueued();
    });
    on<{ i: number; kind: "d" | "s"; k: number } | null>("undo_next", (u) => set({ undoNext: u ?? null }));
    on<{ text: string }>("notice", (n) => notice(n.text));
    on("placed", () => arrive());
    on<{ mode: "full" | "left" | "right"; side: "left" | "right" }>("layout", (l) => set({ layout: l }));
    on<{ theme: Theme }>("theme", (t) => { applyTheme(t.theme); set({ theme: t.theme }); });
    on<Session>("session", (x) => set({ session: x }));
    on<{ busy: boolean; text: string }>("ears", (e) => set({ ears: e }));
    on<Arrangement>("arrangement", (a) => set({ arrangement: a, hearing: null }));
    on<Progress>("arrangement_progress", (p) => set({ hearing: p }));
    on<{ text: string }>("groove_progress", (p) => set({ groove: { ...state.groove, busy: p.text, error: null } }));
    on<Partial<GrooveState> & { undone?: boolean }>("groove_state", (g) => set({ groove: {
      moving: g.moving ?? null, anchor: g.anchor ?? null, placed: g.placed ?? null, busy: null, error: g.error ?? null,
      // A new loop to fix starts fresh; Undo takes the matched loop away; otherwise the last result stays
      result: g.result ?? (g.undone || (g.moving?.path !== state.groove.moving?.path) ? null : state.groove.result) } }));
    on<BeforeAfter>("before_after", (b) => set({ beforeAfter: b, rechecking: null }));
    on<Progress>("before_after_progress", (p) => set({ rechecking: p }));
    on<number[]>("analyzer", (frame) => analyzerListeners.forEach((l) => l(frame)));
    // The mapped key: hold to talk, let go to send. Only the popped-out chat listens, so it records once.
    if (new URLSearchParams(location.search).get("view") === "chat") on<{ down: boolean }>("voice_key", (k) => voiceKey(k.down));
    if (new URLSearchParams(location.search).get("view") === "chat") on("focus_ask", () => { arrive(); set({ askFocus: state.askFocus + 1 }); });
    send("ready");   // bridge.js replies with the engine state and the latest result
  } else {
    checkEngine();
    setInterval(checkEngine, 5000);
  }
}

export async function checkMix() {
  if (send("check_mix")) { set({ progress: { step: "start", text: "Getting ready" }, error: null }); return; }
  // Development in a normal browser: analyze a real file on this machine.
  const path = window.prompt("Development mode. Path to a wav or aiff file to analyze:");
  if (!path) return;
  set({ progress: { step: "analyze", text: "Splitting your mix and asking Muse Spark" }, error: null });
  try {
    const res = await fetch(ENGINE + "/mix/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mix_path: path, ...(devReference ? { reference_path: devReference.path, reference_name: devReference.name } : {}) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `The engine could not analyze that file (HTTP ${res.status}).`);
    set({ result: known(body), progress: null });
  } catch (e) {
    set({ error: e instanceof TypeError ? "The engine is not running." : (e as Error).message, progress: null });
  }
}

// ---------- Arrangement (build step 8b) ----------

/** Play the song from bar 1 to its end once, so Aria can find its parts. Only the Arrangement tab offers it (Ian). */
export function hearSong() {
  if (send("hear_song")) set({ hearing: { step: "start", text: "Going to bar 1" } });
  else notice("Hearing the whole song needs Aria inside Live.");
}
export const stopHearing = () => send("stop_hearing");
/** Rename a part or move an edge: the bridge keeps the edit for markers and checks */
export function editArrangement(sections: Part[]) {
  if (!state.arrangement) return;
  set({ arrangement: { ...state.arrangement, mine: { ...state.arrangement.mine, sections } } });
  send("arrangement_edit", { sections });
}

// ---------- Before and after (Oct 30) ----------
export function recheck() {
  if (send("recheck")) set({ rechecking: { step: "start", text: "Going back to the same bars" } });
  else notice("Checking the same bars again needs Aria inside Live.");
}

// ---------- Live analyzer (Oct 30): frames of 31 third-octave levels in dB, 20 a second ----------
// Kept out of the main state, so a frame redraws only the analyzer, not the whole window.
export const ANALYZER_HZ = Array.from({ length: 31 }, (_, k) => 31.25 * 1.2599 ** k);
const analyzerListeners = new Set<(frame: number[]) => void>();
export function onAnalyzer(fn: (frame: number[]) => void) {
  analyzerListeners.add(fn);
  send("analyzer_on");
  return () => { analyzerListeners.delete(fn); if (!analyzerListeners.size) send("analyzer_off"); };
}
export const addArrangementMarkers = () => send("arrangement_markers");

// ---------- Groove match (build step 9) ----------
export function groovePick(role: "moving" | "anchor") {
  if (!send("groove_pick", { role })) notice("Groove match needs Aria inside Live.");
}
export function grooveRun(follow: "straight" | "loop", strength: number, nudge_ms: number) {
  if (send("groove_run", { follow, strength, nudge_ms })) set({ groove: { ...state.groove, busy: "Finding every hit", error: null } });
  else notice("Groove match needs Aria inside Live.");
}
export const grooveAB = (play: "before" | "after") => send("groove_ab", { play });

// ---------- Reference song (build step 8) ----------

/** A song dropped on the window: the page sends the file to the engine (Live's web view can't see its path),
    the engine keeps it on this Mac, and the bridge remembers its path for every check after. */
export async function setReferenceFile(file: File) {
  notice(`Reading ${file.name}`);
  try {
    if (inMax) send("ensure_engine");
    // An engine started before this code (or still starting) isn't ready for it yet: the bridge restarts it,
    // so try again for a few seconds before saying it isn't running
    let res: Response | null = null;
    for (let i = 0; i < 12; i++) {
      try { res = await fetch(`${ENGINE}/reference?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file }); }
      catch { res = null; }
      if (res && res.status !== 404 && res.status !== 405) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!res) throw new TypeError("engine");
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `The engine couldn't keep that song (HTTP ${res.status}).`);
    if (!send("set_reference", { path: body.path, name: body.name })) devReference = { path: body.path, name: body.name };
    set({ session: state.session ? { ...state.session, reference: { path: body.path, name: body.name } } : state.session });
    notice(`${body.name} is your reference. Check mix compares with it.`);
  } catch (e) {
    notice(e instanceof TypeError ? "The engine is not running." : (e as Error).message);
  }
}
export function clearReference() {
  if (!send("clear_reference")) devReference = null;
  set({ session: state.session ? { ...state.session, reference: null } : state.session });
}
let devReference: { path: string; name: string } | null = null;   // development in a browser only
export const referenceOf = (s: State) => s.session?.reference ?? (inMax ? null : devReference);

// ---------- Ask Muse ----------

export const setAskOpen = (open: boolean) => set({ ask: { ...state.ask, open } });

let queued: string | null = null;
function askQueued() { const q = queued; queued = null; if (q) askMuse(q); }

export async function askMuse(text: string) {
  text = text.trim();
  if (!text) return;
  if (state.ask.pending) { queued = text; notice("Muse will do that next."); return; }   // never drop a request
  if (send("ask", { text })) { set({ ask: { ...state.ask, pending: text } }); return; }
  // Development in a normal browser: ask the engine directly. Nothing is applied without Live.
  set({ ask: { ...state.ask, pending: text } });
  try {
    const r = state.result;
    const res = await fetch(ENGINE + "/muse/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context: { findings: r?.clarity.findings ?? [], bars: null, tempo: r?.recording.tempo ?? null, playhead_bar: null, markers: [] } }),
    });
    const body = await res.json();
    const done: Done[] = (body.actions ?? []).map((a: Action) => ({ ...a, ok: false, text: `Would ${a.type.replace("_", " ")} in Live (not connected).` }));
    set({ ask: { ...state.ask, pending: null, log: [...state.ask.log, { request: text, reply: body.reply, done, suggestions: body.suggestions ?? [], problems: body.problems ?? [], error: body.error, notes: [] }] } });
  } catch {
    set({ ask: { ...state.ask, pending: null, log: [...state.ask.log, { request: text, reply: null, done: [], suggestions: [], error: "The engine is not running.", notes: [] }] } });
  }
}

export function answerSuggestion(exchange: number, index: number, yes: boolean) {
  if (send("answer", { exchange, index, yes, at: state.ask.log[exchange]?.at })) return;
  const log = state.ask.log.map((x, i) => i !== exchange ? x : { ...x, suggestions: x.suggestions.map((sg, k) => k !== index ? sg : { ...sg, answered: (yes ? "yes" : "no") as "yes" | "no" }) });
  set({ ask: { ...state.ask, log } });
}

export const undoLast = () => send("undo");

// ---------- Talk to Muse ----------

let voiceSince = 0;
let voiceErrorTimer: ReturnType<typeof setTimeout> | undefined;
function voiceError(text: string) {
  set({ voice: { state: "idle", error: text } });
  clearTimeout(voiceErrorTimer);
  voiceErrorTimer = setTimeout(() => set({ voice: { ...state.voice, error: null } }), 6000);
}

/** The mic button: first press starts listening, the next sends what was said to Muse. */
let releasedWhileStarting = false;

export async function toggleVoice() {
  const v = state.voice.state;
  if (v === "hearing" || v === "starting") return;
  if (v === "idle") {
    // "starting" at once, so a second press or a key release while the mic opens is handled, not lost
    releasedWhileStarting = false;
    set({ voice: { state: "starting", error: null } });
    send("ensure_engine");   // the words go to the engine; start it if it isn't running
    try { await startRecording(); } catch (e) { voiceError((e as Error).message); return; }
    voiceSince = Date.now();
    set({ voice: { state: "listening", error: null } });
    if (releasedWhileStarting) toggleVoice();   // the key came up before the mic was ready: send what was said
    return;
  }
  set({ voice: { state: "hearing", error: null } });
  try {
    const words = (await transcribe(await stopRecording())).trim();
    set({ voice: { state: "idle", error: null } });
    if (words) askMuse(words);
    else voiceError("Muse didn't hear any words. Try again a little closer to the mic.");
  } catch (e) { voiceError((e as Error).message); }
}

/** The mapped key: down starts (or, if Live sends only presses, a second press sends); up after a hold sends. */
function voiceKey(down: boolean) {
  const v = state.voice.state;
  if (down) { if (v === "idle" || v === "listening") toggleVoice(); }
  else if (v === "starting") releasedWhileStarting = true;
  else if (v === "listening" && Date.now() - voiceSince > 400) toggleVoice();
}

/** Key tracks mode: Aria puts an Ear on each key track (by name), or takes them all off. */
export const listenTracks = () => { if (send("listen_tracks")) set({ ears: { busy: true, text: "Finding your key tracks" } }); };
export const stopListening = () => { if (send("stop_listening")) set({ ears: { busy: true, text: "Taking the Ears off" } }); };

/** Fix it: Muse gets the problem in plain words and makes the change in Live, with Undo. The change is on
    the track for the whole song, not just the bars that were checked, so the request doesn't name bars. */
export function fixIt(p: { name: string; short: string; where: string }) {
  askMuse(`Fix this for the whole song: ${p.name} (${p.where}). ${p.short}`);
}
export const clearHistory = () => { if (!send("clear_history")) set({ ask: { ...state.ask, log: [] } }); };
export const openAsk = () => { if (!send("open_ask")) window.open("../window/index.html?ask=1", "aria-window"); };

export const jumpTo = (bar: number) => send("jump_to", { bar });

function screenRect() {
  const sc = window.screen as Screen & { availLeft?: number; availTop?: number };
  return { x: sc.availLeft ?? 0, y: sc.availTop ?? 0, w: sc.availWidth, h: sc.availHeight };
}

export type WindowMode = "left" | "right" | "full";
/** Left or right: a tall panel docked to that edge, floating over Live. Full: the big window. */
export function setWindowMode(mode: WindowMode) {
  try { localStorage.setItem("aria.dock", mode); } catch { /* storage may be off; the bridge remembers too */ }
  moveThen(() => send("window_mode", { mode, screen: screenRect() }));
}
export function lastDock(): "left" | "right" {
  const side = state.layout?.side ?? state.session?.layout?.side;
  if (side) return side;
  try { return localStorage.getItem("aria.dock") === "right" ? "right" : "left"; } catch { return "left"; }
}

/** Docked: shrink to a small tab on the edge, and back. */
// Minimize and restore slide toward / from the docked edge
export const minimize = () => { if (inMax) moveThen(() => send("minimize"), lastDock()); };
export const restore = () => { if (inMax) moveThen(() => send("restore"), lastDock()); };

/** Ask Muse in its own window, stacked under a shrunk main window on the docked edge. */
export const openChat = () => { if (!inMax) window.open("?view=chat", "aria-chat", "width=460,height=620"); else moveThen(() => send("open_chat", { screen: screenRect() })); };
/** Close the popped-out chat; the main window takes its full docked height again. */
export const closeChat = () => { if (!inMax) window.close(); else moveThen(() => send("close_chat")); };
/** The chat's Back button: close it and bring the window back as it was before the pop-out. */
export const backToWindow = () => { if (!inMax) window.close(); else moveThen(() => send("close_chat", { back: true })); };
export const closeWindow = () => { if (!send("close_window")) window.close(); };

/** The window's size, kept up to date (docked, stacked and full layouts depend on it). */
export function useViewport() {
  return useSyncExternalStore(
    (l) => { window.addEventListener("resize", l); return () => window.removeEventListener("resize", l); },
    () => `${window.innerWidth}x${window.innerHeight}`,
  ).split("x").map(Number) as [number, number];
}
export const openWindow = () => { if (!send("open_window", { screen: screenRect() })) window.open("../window/index.html", "aria-window"); };
export const addMarker = (bar: number) => send("add_marker", { bar, name: "Aria check" });

/** For previews and tests: show a result without the device (window.Aria.showResult in the console). */
export function showResult(r: Result | null) { set({ result: r && known(r), progress: null, error: null }); }

// A result saved before a kind of problem was taken out (Oct 30: "typical", the good-mixes comparison) would break
// the screen: drop findings of kinds this screen doesn't know, and Muse's notes on them, keeping the notes' indexes right.
const KNOWN: Kind[] = ["resonance", "buildup", "harsh", "masking", "bass_click", "clash", "reference"];
function known(r: Result): Result {
  const fs = r.clarity?.findings ?? [];
  if (fs.every((f) => KNOWN.includes(f.kind))) return r;
  const newIndex = new Map<number, number>();
  const findings = fs.filter((f, i) => KNOWN.includes(f.kind) && newIndex.set(i, newIndex.size));
  const advice = r.advice && { ...r.advice, notes: r.advice.notes.filter((n) => newIndex.has(n.finding)).map((n) => ({ ...n, finding: newIndex.get(n.finding)! })) };
  return { ...r, clarity: { ...r.clarity, findings }, advice };
}
if (typeof window !== "undefined") (window as unknown as { Aria: unknown }).Aria = { showResult, askMuse: (t: string) => askMuse(t) };

// ---------- plain words for what the engine found (DESIGN.md: words first, numbers as detail) ----------

const SOUND: Record<string, string> = { vocals: "Vocal", bass: "Bass", drums: "Drums and loops", other: "Synths and keys", "the rest": "the rest of the mix", mix: "Your mix" };
/** A track name short enough for a chip or a line ("Vocals LB aka LABAT - Juicy J - …") */
export const shortName = (s: string, max = 24) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
export const soundName = (s: string) => SOUND[s] || shortName(s);

// One way to write a frequency everywhere: 890 Hz, 1.1 kHz, 2 kHz. "to" between two ends, as in the copy rules.
const kilo = (v: number) => String(Math.round(v / 100) / 10);
const under1k = (v: number) => (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v));
export function hz(v: number) { return v >= 1000 ? `${kilo(v)} kHz` : `${under1k(v)} Hz`; }
export function hzRange([lo, hi]: [number, number]) {
  if (lo >= 1000) return `${kilo(lo)} to ${kilo(hi)} kHz`;
  if (hi >= 1000) return `${under1k(lo)} Hz to ${kilo(hi)} kHz`;
  return `${under1k(lo)} to ${under1k(hi)} Hz`;
}

/** What it is, where in frequency, how much, and a sentence describing the measurement. */
// The parts in the picture: split sounds in a fixed order, or the producer's own tracks (key tracks mode)
const SPLIT_ORDER = ["drums", "bass", "other", "vocals"];
const TRACK_COLORS = ["var(--trk-0)", "var(--trk-1)", "var(--trk-2)", "var(--trk-3)", "var(--trk-4)", "var(--trk-5)"];
export function partNames(spectra: Spectra): string[] {
  const all = Object.keys(spectra.parts).filter((n) => spectra.parts[n]);
  // The producer's tracks in name order, so each keeps its color from one check to the next
  return all.every((n) => SPLIT_ORDER.includes(n)) ? SPLIT_ORDER.filter((n) => all.includes(n)) : all.sort((a, b) => a.localeCompare(b));
}
export function partColor(n: string, i: number) { return SPLIT_ORDER.includes(n) || n === "mix" ? `var(--part-${n})` : TRACK_COLORS[i % TRACK_COLORS.length]; }

export function describe(f: Finding): { name: string; where: string; size: string; about: string } {
  if (f.kind === "clash") {
    const [a, b] = f.tracks!;
    return { name: `${a} and ${b} clash`, where: hzRange(f.hz_range), size: `${f.diff_db!.toFixed(1)} dB apart`,
      about: `${a} and ${b} both play strongly in ${hzRange(f.hz_range)}, within ${f.diff_db!.toFixed(1)} dB of each other, ${Math.round(f.share! * 100)}% of the time both play there.` };
  }
  if (f.kind === "masking") {
    const name = f.masked === "other" && f.range === "low-mid" ? "Mud" : `${soundName(f.masked!)} buried`;
    return {
      name, where: hzRange(f.hz_range), size: `${f.gap_db!.toFixed(1)} dB`,
      about: `${soundName(f.masked!)} sits ${Math.abs(f.gap_db!).toFixed(1)} dB under ${soundName(f.by!)} in ${hzRange(f.hz_range)}, ${Math.round(f.share! * 100)}% of the time it plays.`,
    };
  }
  if (f.kind === "reference") {
    const more = (f.diff_db ?? 0) > 0, where = f.shape === "band" ? f.band! : hzRange(f.hz_range);
    // The range by its everyday name (problems.ts BANDS), so the card says "Mids fuller than your reference"
    const band = f.band ?? [["Sub", 60], ["Bass", 150], ["Low mids", 400], ["Mids", 1000], ["Upper mids", 4000], ["Highs", 10000], ["Air", 1e9]]
      .find(([, top]) => (f.hz ?? 0) < (top as number))![0];
    return { name: `${band} ${more ? "fuller" : "thinner"} than your reference`,
      where, size: `${more ? "+" : "−"}${Math.abs(f.diff_db!).toFixed(1)} dB`,
      about: `${where} is ${Math.abs(f.diff_db!).toFixed(1)} dB ${more ? "louder" : "quieter"} than in your reference, at the same loudness.` };
  }
  if (f.kind === "bass_click") {
    return { name: "Bass click", where: "Note starts", size: `+${Math.round(f.size_db!)} dB`,
      about: `A click on ${Math.round(f.clicky_share! * 100)}% of ${f.starts} bass note starts.` };
  }
  const name = { resonance: "Ringing note", buildup: "Build-up", harsh: "Harsh hits" }[f.kind];
  return { name, where: f.kind === "buildup" ? `${hz(f.hz_range[0])} to ${hz(f.hz_range[1])}` : hz(f.hz!),
    size: `+${f.size_db!.toFixed(1)} dB`, about: "" };
}

export function barsLabel(r: Result) {
  const span = r.clarity.bars ?? (r.start_bar ? [r.start_bar, r.start_bar + (r.recording.bars || 16) - 1] : null);
  return span ? `Bars ${span[0]} to ${span[1]}` : "Your recording";
}
