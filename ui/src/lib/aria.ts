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

export interface Action { type: "jump_to" | "add_marker" | "eq_band" | "check_mix" | "undo"; args: Record<string, number | string> }
export interface Done extends Action { ok: boolean; text: string }
export interface Suggestion { type: Action["type"]; args: Action["args"]; why: string; answered?: "yes" | "no" }
export interface Exchange { request: string; reply: string | null; done: Done[]; suggestions: Suggestion[]; error: string | null; notes: string[] }

interface State {
  ask: { open: boolean; pending: string | null; log: Exchange[] };
  engine: { state: EngineState; text: string };
  progress: Progress | null;
  result: Result | null;
  error: string | null;
  marker: { bar: number; name: string } | null;
  notice: string | null;
}

declare global {
  interface Window {
    max?: { outlet: (...args: unknown[]) => void; bindInlet: (name: string, fn: (arg?: string) => void) => void };
  }
}

export const inMax = typeof window !== "undefined" && !!window.max?.outlet;

let state: State = {
  ask: { open: typeof location !== "undefined" && new URLSearchParams(location.search).get("ask") === "1", pending: null, log: [] },
  engine: { state: "starting", text: "Starting Aria" },
  progress: null, result: null, error: null, marker: null, notice: null,
};
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

export function notice(text: string | null) { set({ notice: text }); }

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
    on<{ request: string }>("ask_pending", (p) => set({ ask: { ...state.ask, open: true, pending: p.request } }));
    on<Exchange>("ask_reply", (x) => set({ ask: { ...state.ask, pending: null, log: [...state.ask.log, { ...x, notes: [] }] } }));
    on<Done>("action_done", (d) => addNote(d.text));
    on<{ ok: boolean; text: string }>("undo_done", (u) => addNote(u.text));
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

function addNote(text: string) {
  const log = [...state.ask.log];
  if (log.length) log[log.length - 1] = { ...log[log.length - 1], notes: [...log[log.length - 1].notes, text] };
  set({ ask: { ...state.ask, log } });
}

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
    set({ ask: { ...state.ask, pending: null, log: [...state.ask.log, { request: text, reply: body.reply, done, suggestions: body.suggestions ?? [], error: body.error, notes: [] }] } });
  } catch {
    set({ ask: { ...state.ask, pending: null, log: [...state.ask.log, { request: text, reply: null, done: [], suggestions: [], error: "The engine is not running.", notes: [] }] } });
  }
}

export function answerSuggestion(exchange: number, index: number, yes: boolean) {
  const log = state.ask.log.map((x, i) => i !== exchange ? x : { ...x, suggestions: x.suggestions.map((sg, k) => k !== index ? sg : { ...sg, answered: (yes ? "yes" : "no") as "yes" | "no" }) });
  set({ ask: { ...state.ask, log } });
  const sg = state.ask.log[exchange].suggestions[index];
  if (yes) send("do_action", { type: sg.type, args: sg.args });
}

export const undoLast = () => send("undo");
export const openAsk = () => { if (!send("open_ask")) window.open("../window/index.html?ask=1", "aria-window"); };

export const jumpTo = (bar: number) => send("jump_to", { bar });
export const openWindow = () => { if (!send("open_window")) window.open("../window/index.html", "aria-window"); };
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
  if (!r.start_bar) return "Your recording";
  return `Bars ${r.start_bar} to ${r.start_bar + (r.recording.bars || 16) - 1}`;
}
