// Ask Muse: you ask, Muse Spark picks tools, Aria does it in Live with Undo. Muse's own ideas
// wait for "Do it". It is a pop-up over whatever screen is open (cp-ask-pop, design screens 08 and 12),
// or its own small window when popped out. Both show the same history, which the bridge saves on this Mac.
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { answerSuggestion, askMuse, clearHistory, closeChat, hz, setAskOpen, undoLast, useAria, type Exchange, type Finding, type Suggestion } from "@/lib/aria";
import { CheckIcon, CloseIcon, MicIcon, SendIcon, UndoIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// Starting points built from what Aria found, so the first ask is one tap
function starters(findings: Finding[]): string[] {
  const out: string[] = [];
  const ringing = findings.find((f) => f.kind === "resonance" || f.kind === "harsh");
  if (ringing) out.push(`Tame the ${hz(ringing.hz!)} ${ringing.kind === "harsh" ? "harsh hits" : "ringing note"}`);
  if (findings.some((f) => f.kind === "masking" && f.masked === "vocals")) out.push("Make the vocal easier to hear");
  out.push("Add some reverb to the vocal");
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
  if (s.type === "jump_to") return `Jump to bar ${a.bar}`;
  return s.type;
}

const changed = (type: string) => type !== "jump_to" && type !== "check_mix" && type !== "undo";

/** Where the newest change Aria made is, so only that one offers Undo */
function lastChange(log: Exchange[]): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const x = log[i];
    for (let k = x.suggestions.length - 1; k >= 0; k--) if (x.suggestions[k].result?.ok) return `${i}s${k}`;
    for (let k = x.done.length - 1; k >= 0; k--) if (x.done[k].ok && changed(x.done[k].type)) return `${i}d${k}`;
  }
  return null;
}

/** The pill for a change: a check, what changed, and Undo on the newest one */
function Did({ ok, text, undo }: { ok: boolean; text: string; undo?: boolean }) {
  return (
    <div className={cn("cp-did", !ok && "is-bad")} role="status">
      {ok && <CheckIcon />}<span className="py-0.5 leading-4">{text}</span>
      {undo && <button className="cp-btn cp-btn-sm" style={{ height: 22, padding: "0 8px", marginLeft: 4 }} onClick={undoLast}><UndoIcon style={{ width: 11, height: 11 }} />Undo</button>}
    </div>
  );
}

/** The conversation: one reply per request, at most one card per suggestion, never two the same. */
export function AskThread({ className }: { className?: string }) {
  const { ask, result } = useAria();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [ask.log, ask.pending]);
  const undoAt = lastChange(ask.log);

  return (
    <div ref={scroller} className={cn("cp-msgs min-h-0 overflow-y-auto", className)}>
      {ask.log.length === 0 && !ask.pending && (
        <>
          <p className="cp-meta">Ask for a change in plain words. If you ask, it happens right away, with Undo.</p>
          <div className="cp-ask-sugs">
            {starters(result?.clarity.findings ?? []).map((s) => <button key={s} className="cp-btn cp-btn-sm" onClick={() => askMuse(s)}>{s}</button>)}
          </div>
        </>
      )}

      {ask.log.map((x, i) => {
        const seen = new Set<string>();
        // Older history kept a yes's outcome as a note, not on the suggestion: show it as the pill
        const notes = [...x.notes];
        return (
          <div key={i} className="cp-msgs">
            <div className="cp-bubble is-user">{x.request}</div>
            {x.reply ? <div className="cp-bubble is-bot"><span>{x.reply}</span></div>
              : x.error ? <Did ok={false} text={x.error} /> : null}
            {x.done.map((d, k) => <Did key={k} ok={d.ok} text={d.text} undo={undoAt === `${i}d${k}`} />)}
            {/* Calls Aria skipped, so a reply never looks done when it wasn't */}
            {x.reply && (x.problems ?? []).map((p, k) => <Did key={"p" + k} ok={false} text={p} />)}
            {x.suggestions.map((s, k) => {
              const what = describeSuggestion(s);
              if (seen.has(what)) return null;
              seen.add(what);
              if (s.answered === "yes") {
                const text = s.result?.text ?? notes.shift() ?? `Doing it: ${what}`;
                return <Did key={"s" + k} ok={s.result?.ok ?? true} text={text} undo={undoAt === `${i}s${k}`} />;
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

const VOICE_SOON = "Voice is coming soon. Type for now.";

/** Voice input. Not hooked up yet: the button is in place, and the box says so when it's pressed. */
export function useVoice(placeholder: string, soonText = VOICE_SOON) {
  const [soon, setSoon] = useState(false);
  useEffect(() => { if (soon) { const t = setTimeout(() => setSoon(false), 2500); return () => clearTimeout(t); } }, [soon]);
  return { placeholder: soon ? soonText : placeholder, press: () => setSoon(true) };
}

export function AskInput({ autoFocus }: { autoFocus?: boolean }) {
  const { ask } = useAria();
  const [text, setText] = useState("");
  const voice = useVoice("Ask, or tell Muse what to change");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  return (
    <form className="cp-composer" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { askMuse(text); setText(""); } }}>
      <button type="button" className="cp-icon-btn" aria-label="Ask by voice" onClick={voice.press}><MicIcon /></button>
      <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={voice.placeholder} aria-label="Ask Muse" />
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

function Head({ onClose }: { onClose: () => void }) {
  const { ask, result } = useAria();
  return (
    <div className="cp-ask-head">
      <b>Ask Muse</b><span className="cp-ask-ctx">{result ? "about Mix check" : "about your set"}</span>
      {ask.log.length > 0 && <ClearButton />}
      <button className="cp-icon-btn cp-ask-x" style={ask.log.length ? { marginLeft: 0 } : undefined} aria-label="Close" onClick={onClose}><CloseIcon /></button>
    </div>
  );
}

/** Ask Muse popped out into its own small window that floats over Live. It paints its own ground. */
export function ChatWindow() {
  return (
    <div className="cp-stage is-tight" style={{ height: "100vh", minHeight: 0 }}>
      <section className="cp-ask-pop is-static cp-chat" style={{ height: "calc(100vh - 32px)", boxSizing: "border-box" }} aria-label="Ask Muse">
        <Head onClose={closeChat} />
        <AskThread className="flex-1" />
        <AskInput autoFocus />
      </section>
    </div>
  );
}

/** The pop-up over the current screen, anchored bottom left by the rail's Ask Muse button. */
export function AskMuse({ narrow }: { narrow?: boolean }) {
  const { ask } = useAria();
  if (!ask.open) return null;
  return (
    <section className="cp-ask-pop" role="dialog" aria-label="Ask Muse"
             style={narrow ? { position: "fixed", left: 12, right: 12, bottom: 12, width: "auto", maxHeight: "calc(100vh - 80px)" }
                           : { maxHeight: "calc(100% - 44px)" }}>
      <Head onClose={() => setAskOpen(false)} />
      <AskThread />
      <AskInput autoFocus />
    </section>
  );
}
