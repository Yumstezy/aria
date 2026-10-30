// Ask Muse: you ask, Muse Spark picks tools, Aria does it in Live with Undo. Muse's own ideas
// wait for "Do it". It is a pop-up over whatever screen is open (cp-ask-pop, design screens 08 and 12),
// or its own small window when popped out. Both show the same history, which the bridge saves on this Mac.
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { answerSuggestion, askMuse, backToWindow, clearHistory, closeChat, hz, setAskOpen, soundName, toggleVoice, undoLast, useAria, useAriaSel, type Finding, type Guide, type GuideBand, type Suggestion } from "@/lib/aria";
import { EqCurve } from "@/components/eq-curve";
import { BackIcon, CheckIcon, CloseIcon, MicIcon, SendIcon, UndoIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// Starting points built from what Aria found and what's playing, so the first ask is one tap.
// Not every song has a vocal: the reverb idea goes to whichever lead part is there.
function starters(findings: Finding[], playing: Record<string, unknown> | null): string[] {
  const out: string[] = [];
  const ringing = findings.find((f) => f.kind === "resonance" || f.kind === "harsh");
  if (ringing) out.push(`Tame the ${hz(ringing.hz!)} ${ringing.kind === "harsh" ? "harsh hits" : "ringing note"}`);
  const buried = findings.find((f) => f.kind === "masking" && f.masked !== "other");
  if (buried) out.push(`Make the ${soundName(buried.masked!).toLowerCase()} easier to hear`);
  if (findings.some((f) => f.kind === "masking" && f.masked === "other")) out.push("Clean up the mud");
  const lead = !playing ? "lead" : playing.vocals ? "vocal" : playing.other ? "synths" : null;
  if (lead) out.push(`Add some reverb to the ${lead}`);
  out.push("Check my mix again");
  return out.slice(0, 4);
}

const SHAPE: Record<string, string> = { low_cut: "Low cut", high_cut: "High cut", low_shelf: "Low shelf", high_shelf: "High shelf", notch: "Notch" };

function describeEq(a: Record<string, number | string>) {
  const at = hz(Number(a.freq_hz)), shape = String(a.shape ?? "bell");
  if (shape === "low_cut" || shape === "high_cut" || shape === "notch") return `${SHAPE[shape]} at ${at}`;
  const gain = `${Number(a.gain_db) > 0 ? "+" : ""}${a.gain_db} dB`;
  return shape === "bell" ? `${gain} at ${at}` : `${SHAPE[shape]} ${gain} at ${at}`;
}

function describeSuggestion(s: Suggestion) {
  const a = s.args;
  if (s.type === "eq_band") return `${describeEq(a)} on Main`;
  if (s.type === "track_eq") return `${describeEq(a)} on ${a.track}`;
  if (s.type === "track_volume") return `${a.track} ${Number(a.change_db) > 0 ? "up" : "down"} ${Math.abs(Number(a.change_db))} dB`;
  if (s.type === "track_device" || s.type === "track_plugin") {
    const knobs = (a.settings ?? []).map((k) => k.option ? `${k.param} ${k.option}` : k.change !== undefined ? `${k.param} ${k.change > 0 ? "+" : ""}${k.change}` : `${k.param} ${k.value}`);
    return `${s.type === "track_plugin" ? a.plugin : a.device} on ${a.track}${knobs.length ? `: ${knobs.join(", ")}` : ""}`;
  }
  if (s.type === "add_marker") return `Marker "${a.name}" at bar ${a.bar}`;
  if (s.type === "delete_marker") return `Delete the marker at bar ${a.bar}`;
  if (s.type === "track_mute") return `${a.on ? "Mute" : "Unmute"} ${a.track}`;
  if (s.type === "track_solo") return `${a.on ? "Solo" : "Unsolo"} ${a.track}`;
  if (s.type === "set_tempo") return `Tempo to ${a.bpm} BPM`;
  if (s.type === "jump_to") return `Jump to bar ${a.bar}`;
  return s.type;
}

/** The pill for a change: a check, what changed, and Undo on the one Undo will undo next (the bridge says which).
    An undone change loses its check; one still running shows no check yet. */
function Did({ ok, text, undo, undone, waiting }: { ok: boolean; text: string; undo?: boolean; undone?: boolean; waiting?: boolean }) {
  return (
    <div className={cn("cp-did", !ok && "is-bad")} role="status" style={undone || waiting ? { color: "var(--ink-faint)" } : undefined}>
      {ok && !undone && !waiting && <CheckIcon />}<span className="py-0.5 leading-4" style={undone ? { textDecoration: "line-through" } : undefined}>{text}</span>
      {undo && <button className="cp-btn cp-btn-sm" style={{ height: 22, padding: "0 8px", marginLeft: 4 }} onClick={undoLast}><UndoIcon style={{ width: 11, height: 11 }} />Undo</button>}
    </div>
  );
}

const SHAPE_NAME: Record<string, string> = { bell: "Bell", low_cut: "Low cut", high_cut: "High cut", low_shelf: "Low shelf", high_shelf: "High shelf", notch: "Notch" };
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`;
const MAX_ROWS = 6;

function bandLine(b: GuideBand) {
  const cut = b.shape === "low_cut" || b.shape === "high_cut" || b.shape === "notch";
  return `${SHAPE_NAME[b.shape] ?? b.shape} at ${hz(b.freq_hz)}${cut ? "" : `, ${signed(b.gain_db)}`}, Q ${b.q.toFixed(1)}`;
}

/** How a third-party plugin should look: the curve, then each band to set. The producer sets it in the plugin. */
function GuideCard({ g }: { g: Guide }) {
  const name = g.plugin.replace(/^FabFilter /, "");
  return (
    <div className="cp-suggest" style={{ gap: 8 }}>
      <span className="cp-cap">How it should look</span>
      <span className="cp-tile-title">{name}{g.track ? ` on ${g.track}` : ""}</span>
      <span className="cp-meta">{g.source === "preset" ? `From your preset “${g.preset}”` : "Aria's starting point"}</span>
      <EqCurve bands={g.bands} />
      <ol className="m-0 grid list-none gap-1 p-0">
        {g.bands.slice(0, MAX_ROWS).map((b) => (
          <li key={b.band} className="flex items-center gap-2 text-[12px] leading-4">
            <i className="grid size-[18px] shrink-0 place-items-center rounded-full bg-action text-[10px] font-bold not-italic text-on-action">{b.band}</i>
            <span>{bandLine(b)}{b.dynamic_db ? <span className="text-ink-faint">, moves {signed(b.dynamic_db)} with the music</span> : null}</span>
          </li>
        ))}
        {g.bands.length > MAX_ROWS && <li className="cp-meta">and {g.bands.length - MAX_ROWS} smaller bands</li>}
      </ol>
      {g.about && <span className="cp-meta line-clamp-2">{g.about}</span>}
      <span className="cp-meta">Set this in {name} yourself. Aria can't turn third-party plugins.</span>
    </div>
  );
}

/** The conversation: one reply per request, at most one card per suggestion, never two the same. */
export function AskThread({ className }: { className?: string }) {
  const ask = useAriaSel((s) => s.ask), result = useAriaSel((s) => s.result), undoNext = useAriaSel((s) => s.undoNext);
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef(-1);
  // Scroll only when something new arrives, and only if they were already near the bottom (not while reading back).
  // The first time, jump straight there.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const grew = ask.log.length > seen.current || ask.pending;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    // The history can arrive just after the pop-up opens: the first time there's something, jump to the newest
    if (seen.current <= 0) requestAnimationFrame(() => el.scrollTo({ top: 1e6 }));
    else if (grew && near) el.scrollTo({ top: 1e6, behavior: "smooth" });
    seen.current = ask.log.length;
  }, [ask.log.length, ask.pending]);
  const undoAt = undoNext ? `${undoNext.i}${undoNext.kind}${undoNext.k}` : null;

  return (
    <div ref={scroller} className={cn("cp-msgs min-h-0 overflow-y-auto", className)}>
      {ask.log.length === 0 && !ask.pending && (
        <>
          <p className="cp-meta">Ask for a change in plain words. If you ask, it happens right away, with Undo.</p>
          <div className="cp-ask-sugs">
            {starters(result?.clarity.findings ?? [], result?.clarity.spectra?.parts ?? null).map((s) => <button key={s} className="cp-btn cp-btn-sm" onClick={() => askMuse(s)}>{s}</button>)}
          </div>
        </>
      )}

      {ask.log.map((x, i) => {
        const seen = new Set<string>();
        const notes = x.notes;
        return (
          <div key={i} className="cp-msgs">
            <div className="cp-bubble is-user">{x.request}</div>
            {x.reply ? <div className="cp-bubble is-bot"><span>{x.reply}</span></div>
              : x.error ? <Did ok={false} text={x.error} /> : null}
            {(x.guides ?? []).map((g, k) => <GuideCard key={"g" + k} g={g} />)}
            {x.done.map((d, k) => <Did key={k} ok={d.ok} text={d.text} undo={undoAt === `${i}d${k}`} undone={d.undone} />)}
            {/* Calls Aria skipped, so a reply never looks done when it wasn't */}
            {x.reply && (x.problems ?? []).map((p, k) => <Did key={"p" + k} ok={false} text={p} />)}
            {x.suggestions.map((s, k) => {
              const what = describeSuggestion(s);
              if (seen.has(what)) return null;
              seen.add(what);
              if (s.answered === "yes") {
                return s.result ? <Did key={"s" + k} ok={s.result.ok} text={s.result.text} undo={undoAt === `${i}s${k}`} undone={s.result.undone} />
                  : <Did key={"s" + k} ok text={`Doing it: ${what}`} waiting />;
              }
              if (s.answered === "no") return <span key={"s" + k} className="cp-meta">Skipped: {what}</span>;
              return (
                <div key={"s" + k} className="cp-suggest">
                  <span className="cp-cap">Muse suggests</span>
                  <span className="cp-tile-title">{what}</span>
                  <span className="cp-meta">{s.why} You can undo it.</span>
                  <div className="cp-row">
                    <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => answerSuggestion(i, k, true)}>Do it</button>
                    <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={() => answerSuggestion(i, k, false)}>Not now</button>
                  </div>
                </div>
              );
            })}
            {notes.map((n, k) => <span key={"n" + k} className="cp-meta">{n}</span>)}
          </div>
        );
      })}

      {ask.pending && (
        <div className="cp-msgs">
          <div className="cp-bubble is-user">{ask.pending}</div>
          <div className="cp-bubble is-bot" aria-label="Muse is thinking" style={{ display: "flex", gap: 4, padding: "13px 14px" }}>
            {[0, 1, 2].map((d) => <motion.i key={d} className="size-1.5 rounded-full bg-on-action" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export function AskInput({ autoFocus }: { autoFocus?: boolean }) {
  const { ask, askFocus, voice } = useAria();
  const [text, setText] = useState("");
  const placeholder = voice.error ?? (voice.state === "listening" ? "Listening. Tap the mic again to send."
    : voice.state === "hearing" ? "Muse is turning that into words…" : "Ask, or tell Muse what to change");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus, askFocus]);
  return (
    <form className="cp-composer" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { askMuse(text); setText(""); } }}>
      <button type="button" className={cn("cp-icon-btn", voice.state === "listening" && "is-live")} aria-pressed={voice.state === "listening"}
              aria-label={voice.state === "listening" ? "Send what you said" : "Talk to Muse"} title={voice.state === "listening" ? "Send what you said" : "Talk to Muse"}
              disabled={voice.state === "hearing" || !!ask.pending} onClick={toggleVoice}><MicIcon /></button>
      <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Ask Muse"
             className={voice.error ? "placeholder:!text-hot" : undefined} />
      <button type="submit" className={cn("cp-icon-btn", text.trim() && "is-on")} disabled={!text.trim() || !!ask.pending} aria-label="Send"><SendIcon /></button>
    </form>
  );
}

/** Clear, asking once more before it deletes the history. */
function ClearButton() {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (sure) { const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); } }, [sure]);
  return (
    <button className="cp-btn cp-btn-ghost cp-btn-sm" style={{ marginLeft: "auto", color: sure ? "var(--hot)" : undefined }}
            onClick={() => { if (sure) { clearHistory(); setSure(false); } else setSure(true); }}>
      {sure ? "Clear all?" : "Clear"}
    </button>
  );
}

function Head({ onClose, onBack }: { onClose: () => void; onBack?: () => void }) {
  const { ask, result } = useAria();
  return (
    <div className="cp-ask-head">
      {onBack && <button className="cp-icon-btn" style={{ width: 28, height: 28, borderRadius: 10 }} title="Back to the window" aria-label="Back to the window" onClick={onBack}><BackIcon style={{ width: 14, height: 14 }} /></button>}
      <b>Ask Muse</b><span className="cp-ask-ctx">{result ? "about Mix check" : "about your set"}</span>
      {ask.log.length > 0 && <ClearButton />}
      <button className="cp-icon-btn cp-ask-x" style={ask.log.length ? { marginLeft: 0 } : undefined} aria-label="Close" onClick={onClose}><CloseIcon /></button>
    </div>
  );
}

/** Ask Muse popped out into its own small window that floats over Live. It paints its own ground. */
export function ChatWindow() {
  useEffect(() => { document.documentElement.classList.add("see-through"); }, []);
  return (
    <div className="cp-stage is-flush">
      <section className="cp-ask-pop is-static cp-chat" style={{ height: "100vh", boxSizing: "border-box" }} aria-label="Ask Muse">
        <Head onClose={closeChat} onBack={backToWindow} />
        <AskThread className="flex-1" />
        <AskInput autoFocus />
      </section>
    </div>
  );
}

/** The pop-up over the current screen, anchored bottom left by the rail's Ask Muse button. */
export function AskMuse({ narrow }: { narrow?: boolean }) {
  const open = useAriaSel((s) => s.ask.open);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAskOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;
  return (
    <section className="cp-ask-pop" role="dialog" aria-label="Ask Muse"
             // A pop-up, not a page (Ian, Oct 30: after Fix it "the Muse chat takes up the whole screen"): about half
             // the window at most, older messages scroll, and the screen behind stays in sight
             style={narrow ? { position: "fixed", left: 12, right: 12, bottom: 12, width: "auto", maxHeight: "min(52vh, 480px)" }
                           : { maxHeight: "min(560px, calc(100% - 44px))" }}>
      <Head onClose={() => setAskOpen(false)} />
      <AskThread />
      <AskInput autoFocus />
    </section>
  );
}
