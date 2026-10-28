// Aria's UI state and its link to the device. Inside Live the page runs in jweb and talks to
// device/bridge.js through window.max; payloads both ways are URI-encoded JSON so Max never
// splits them on spaces or commas. In a normal browser (development) it calls the engine directly.
import { useSyncExternalStore } from "react";

export const ENGINE = "http://127.0.0.1:8765";

export type Kind = "resonance" | "buildup" | "harsh" | "masking" | "bass_click";
export interface Finding {
  kind: Kind;
  hz?: number;
  hz_range: [number, number];
  size_db?: number;
  gap_db?: number;
  share?: number;
  bars: [number, number];
  masked?: string;
  by?: string;
  range?: string;
  starts?: number;
  clicky_share?: number;
  bursts_per_bar?: number;
}
export interface EqFix { type: "eq_band"; freq_hz: number; gain_db: number; q: number }
export interface Note { finding: number; kind: Kind; short: string | null; text: string; fix: EqFix | null }
export interface Spectra { hz: number[]; mix: number[]; parts: Record<string, number[] | null> }
export interface Result {
  recording: { path: string; start_beat: number | null; tempo: number | null; bars: number | null };
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
  chain?: { on_main: boolean; track: string; after: string[] };
}
export interface Progress { step: string; text: string; detail?: string; done?: number; total?: number }
export type EngineState = "starting" | "up" | "down" | "error";

export interface Setting { param: string; value?: number; option?: string; change?: number }
export interface Action { type: "jump_to" | "add_marker" | "eq_band" | "track_volume" | "track_eq" | "track_device" | "track_plugin" | "check_mix" | "undo"; args: Record<string, number | string> & { settings?: Setting[] } }
export interface Done extends Action { ok: boolean; text: string }
export interface Suggestion { type: Action["type"]; args: Action["args"]; why: string; answered?: "yes" | "no"; result?: { ok: boolean; text: string } }
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
}

export type Theme = "sky" | "night";
/** About the set, from Live: shown in headers and the Get started steps */
export interface Session { tempo: number; signature: [number, number]; markers: { bar: number; name: string }[]; chain: { on_main: boolean; after: string[] } }

declare global {
  interface Window {
    max?: { outlet: (...args: unknown[]) => void; bindInlet: (name: string, fn: (arg?: string) => void) => void };
  }
}

export const inMax = typeof window !== "undefined" && !!window.max?.outlet;

let state: State = {
  ask: { open: typeof location !== "undefined" && new URLSearchParams(location.search).get("ask") === "1", pending: null, log: [] },
  engine: { state: "starting", text: "Starting Aria" },
  progress: null, result: null, error: null, marker: null, notice: null, theme: initialTheme(), session: null, askFocus: 0,
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
    on<{ state: EngineState; text: string }>("engine", (e) => set({ engine: e, ...(e.state === "error" ? { error: e.text } : {}) }));
    on<Progress>("progress", (p) => set({ progress: p, error: null }));
    on<Result>("mix_result", (r) => set({ result: r, progress: null, error: null }));
    on<{ text: string }>("error", (e) => set({ error: e?.text || "Something went wrong.", progress: null }));
    on<{ bar: number; name: string }>("marker_done", (m) => set({ marker: m }));
    on<{ request: string | null }>("ask_pending", (p) => set({ ask: { ...state.ask, pending: p.request } }));
    // The bridge owns the history (saved on this Mac) and sends all of it on every change.
    on<Exchange[]>("ask_log", (log) => set({ ask: { ...state.ask, log } }));
    on<{ theme: Theme }>("theme", (t) => { applyTheme(t.theme); set({ theme: t.theme }); });
    on<Session>("session", (x) => set({ session: x }));
    on("focus_ask", () => { arrive(); set({ askFocus: state.askFocus + 1 }); });
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
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mix_path: path }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `The engine could not analyze that file (HTTP ${res.status}).`);
    set({ result: body, progress: null });
  } catch (e) {
    set({ error: e instanceof TypeError ? "The engine is not running." : (e as Error).message, progress: null });
  }
}

// ---------- Ask Muse ----------

export const setAskOpen = (open: boolean) => set({ ask: { ...state.ask, open } });

export async function askMuse(text: string) {
  text = text.trim();
  if (!text || state.ask.pending) return;
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
  if (send("answer", { exchange, index, yes })) return;
  const log = state.ask.log.map((x, i) => i !== exchange ? x : { ...x, suggestions: x.suggestions.map((sg, k) => k !== index ? sg : { ...sg, answered: (yes ? "yes" : "no") as "yes" | "no" }) });
  set({ ask: { ...state.ask, log } });
}

export const undoLast = () => send("undo");

/** Fix it: Muse gets the problem in plain words and makes the change in Live, with Undo. */
export function fixIt(p: { name: string; short: string; findings: Finding[] }) {
  const [a, b] = p.findings[0].bars;
  askMuse(`Fix this: ${p.name}, bars ${a}${b !== a ? ` to ${b}` : ""}. ${p.short}`);
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
export function showResult(r: Result) { set({ result: r, progress: null, error: null }); }
if (typeof window !== "undefined") (window as unknown as { Aria: unknown }).Aria = { showResult, askMuse: (t: string) => askMuse(t) };

// ---------- plain words for what the engine found (DESIGN.md: words first, numbers as detail) ----------

const SOUND: Record<string, string> = { vocals: "Vocal", bass: "Bass", drums: "Drums and loops", other: "Synths and keys", "the rest": "the rest of the mix", mix: "Your mix" };
export const soundName = (s: string) => SOUND[s] || s;

export function hz(v: number) { return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`; }
export function hzRange([lo, hi]: [number, number]) {
  if (lo >= 1000) return `${lo / 1000}–${hi / 1000} kHz`;
  if (hi >= 1000) return `${lo} Hz–${hi / 1000} kHz`;
  return `${lo}–${hi} Hz`;
}

/** What it is, where in frequency, how much, and a sentence describing the measurement. */
export function describe(f: Finding): { name: string; where: string; size: string; about: string } {
  if (f.kind === "masking") {
    const name = f.masked === "other" && f.range === "low-mid" ? "Mud" : `${soundName(f.masked!)} buried`;
    return {
      name, where: hzRange(f.hz_range), size: `${f.gap_db!.toFixed(1)} dB`,
      about: `${soundName(f.masked!)} sits ${Math.abs(f.gap_db!).toFixed(1)} dB under ${soundName(f.by!)} in ${hzRange(f.hz_range)}, ${Math.round(f.share! * 100)}% of the time it plays.`,
    };
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
