// Ask Muse: you ask, Muse Spark picks tools, Aria does it in Live with Undo. Muse's own ideas
// wait for "Do it". Two places: inline at the bottom of Mix check, and a pop-up anywhere else
// (design screen 08). Both show the same history, which the bridge saves on this Mac.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, Mic, SquareArrowOutUpRight, Undo2, X } from "lucide-react";
import { answerSuggestion, askMuse, clearHistory, hz, openChat, setAskOpen, undoLast, useAria, type Finding, type Suggestion } from "@/lib/aria";
import { cn } from "@/lib/utils";

// Starting points built from what Aria found, so the first ask is one tap
function starters(findings: Finding[], startBar?: number): string[] {
  const out: string[] = [];
  const ringing = findings.find((f) => f.kind === "resonance" || f.kind === "harsh");
  if (ringing) out.push(`Tame the ${hz(ringing.hz!)} ${ringing.kind === "harsh" ? "harsh hits" : "ringing note"}`);
  if (findings.some((f) => f.kind === "masking" && f.masked === "vocals")) out.push("How do I make the vocal easier to hear?");
  if (startBar) out.push(`Mark bar ${startBar} as Check`);
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
  if (s.type === "eq_band") return describeEq(a);
  if (s.type === "track_eq") return `"${a.track}": ${describeEq(a)}`;
  if (s.type === "track_volume") return `"${a.track}" ${Number(a.change_db) > 0 ? "up" : "down"} ${Math.abs(Number(a.change_db))} dB`;
  if (s.type === "add_marker") return `Marker "${a.name}" at bar ${a.bar}`;
  if (s.type === "jump_to") return `Jump to bar ${a.bar}`;
  return s.type;
}

/** The conversation. `last` limits it to the newest few exchanges (inline view). */
export function AskThread({ last, className }: { last?: number; className?: string }) {
  const { ask, result } = useAria();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [ask.log.length, ask.pending]);

  const first = last ? Math.max(0, ask.log.length - last) : 0;
  const lastWithChange = (() => {
    for (let i = ask.log.length - 1; i >= 0; i--) if (ask.log[i].done.some((d) => d.ok && d.type !== "jump_to" && d.type !== "check_mix")) return i;
    return -1;
  })();

  return (
    <div ref={scroller} className={cn("flex min-h-0 flex-col gap-2.5 overflow-y-auto", className)}>
      {ask.log.length === 0 && !ask.pending && (
        <div className="flex flex-col gap-2 py-1">
          <p className="m-0 text-[13px] text-white/60">Ask for a change in plain words. If you ask, it happens right away, with Undo.</p>
          <div className="flex flex-wrap gap-1.5">
            {starters(result?.clarity.findings ?? [], result?.start_bar).map((s) => (
              <button key={s} onClick={() => askMuse(s)} className="rounded-full bg-white/10 px-2.5 py-1 text-left text-xs font-medium text-white/85 ring-1 ring-white/10 hover:bg-white/15">{s}</button>
            ))}
          </div>
        </div>
      )}

      {first > 0 && <button onClick={() => setAskOpen(true)} className="self-center text-[11.5px] text-white/50 hover:text-white/80">{first} earlier · show all</button>}

      {ask.log.slice(first).map((x, j) => {
        const i = first + j;
        return (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="self-end rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] text-[#0b1a3a]">{x.request}</div>
            {(x.reply || x.error) && (
              <div className={cn("max-w-[92%] self-start rounded-2xl rounded-bl-md px-3 py-2 text-[13px] leading-[18px]", x.reply ? "bg-[var(--tile-base)]" : "bg-white/8 text-[#ffb07a]")}>
                {x.reply ?? x.error}
              </div>
            )}
            {x.done.map((d, k) => (
              <div key={k} className={cn("flex items-center gap-2 self-start rounded-full px-2.5 py-1 text-xs", d.ok ? "bg-[#5fdba6]/15 text-[#8ff0c4]" : "bg-white/8 text-[#ffb07a]")}>
                {d.ok && <Check size={12} />}<span>{d.text}</span>
                {d.ok && i === lastWithChange && k === x.done.length - 1 && (
                  <button onClick={undoLast} className="ml-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-[#0b1a3a]"><Undo2 size={11} />Undo</button>
                )}
              </div>
            ))}
            {/* Calls Aria skipped, so a reply never looks done when it wasn't */}
            {x.reply && (x.problems ?? []).map((p, k) => (
              <span key={"p" + k} className="self-start rounded-full bg-white/8 px-2.5 py-1 text-xs text-[#ffb07a]">{p}</span>
            ))}
            {x.suggestions.map((s, k) => (
              <div key={"s" + k} className="flex flex-col gap-1.5 self-start rounded-2xl bg-white/8 p-2.5 text-xs ring-1 ring-white/10">
                <span className="text-white/60">Muse suggests</span>
                <b className="text-[13px] font-semibold">{describeSuggestion(s)}</b>
                <span className="text-white/70">{s.why}</span>
                {s.answered ? <span className="text-white/50">{s.answered === "yes" ? "Done." : "Skipped."}</span> : (
                  <div className="flex gap-1.5">
                    <button onClick={() => answerSuggestion(i, k, true)} className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#0b1a3a]">Do it</button>
                    <button onClick={() => answerSuggestion(i, k, false)} className="rounded-full px-2.5 py-1 font-semibold text-white/70 hover:bg-white/10">Not now</button>
                  </div>
                )}
              </div>
            ))}
            {x.notes.map((n, k) => <span key={"n" + k} className="self-start text-[11.5px] text-white/50">{n}</span>)}
          </div>
        );
      })}

      {ask.pending && (
        <div className="flex flex-col gap-1.5">
          <div className="self-end rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] text-[#0b1a3a]">{ask.pending}</div>
          <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-[var(--tile-base)] px-3 py-2.5" aria-label="Muse is thinking">
            {[0, 1, 2].map((d) => <motion.i key={d} className="size-1.5 rounded-full bg-white/80" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export function AskInput({ autoFocus, className }: { autoFocus?: boolean; className?: string }) {
  const { ask } = useAria();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  return (
    <form className={cn("flex items-center gap-2", className)} onSubmit={(e) => { e.preventDefault(); if (text.trim()) { askMuse(text); setText(""); } }}>
      <button type="button" disabled title="Voice is coming next" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8 text-white/35"><Mic size={14} /></button>
      <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Muse to change something"
             className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40" />
      <button type="submit" disabled={!text.trim() || !!ask.pending} aria-label="Send"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#0b1a3a] disabled:opacity-35"><ArrowUp size={15} /></button>
    </form>
  );
}

const PANEL = { background: "rgba(16, 22, 38, 0.86)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" };

/** Inline at the bottom of Mix check: the newest exchanges and the prompt. */
export function InlineAsk() {
  const { ask } = useAria();
  return (
    <section className="flex flex-col gap-2 overflow-hidden rounded-[24px] px-4 pb-2 pt-3.5 text-white ring-1 ring-white/12" style={PANEL} aria-label="Ask Muse">
      <div className="flex items-center gap-2">
        <b className="text-sm">Ask Muse</b>
        <span className="text-xs text-white/50">about this check</span>
        <div className="ml-auto flex items-center gap-1">
          {ask.log.length > 0 && <button onClick={() => setAskOpen(true)} className="rounded-full px-2 py-0.5 text-xs text-white/55 hover:bg-white/10 hover:text-white">History</button>}
          <button onClick={openChat} title="Pop out into its own window" aria-label="Pop out Ask Muse"
                  className="grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"><SquareArrowOutUpRight size={14} /></button>
        </div>
      </div>
      <AskThread last={2} className="max-h-[320px]" />
      <AskInput className="border-t border-white/10 pt-2" />
    </section>
  );
}

/** Clear, asking once more before it deletes the history. */
function ClearButton({ className }: { className?: string }) {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (sure) { const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); } }, [sure]);
  return (
    <button onClick={() => { if (sure) { clearHistory(); setSure(false); } else setSure(true); }}
            className={cn("rounded-full px-2 py-0.5 text-xs hover:bg-white/10", sure ? "text-[#ffb07a]" : "text-white/50 hover:text-white", className)}>
      {sure ? "Clear all?" : "Clear"}
    </button>
  );
}

/** Ask Muse popped out into its own small window that floats over Live. */
export function ChatWindow() {
  const { ask, result } = useAria();
  return (
    <div className="aria-lights flex h-screen flex-col text-white">
      <div className="flex h-full flex-col" style={{ background: "rgba(16, 22, 38, 0.55)" }}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
          <b className="text-sm">Ask Muse</b>
          <span className="text-xs text-white/50">{result ? "about Mix check" : "about your set"}</span>
          {ask.log.length > 0 && <ClearButton className="ml-auto" />}
        </div>
        <AskThread className="flex-1 px-4 pb-2" />
        <AskInput autoFocus className="border-t border-white/10 px-3 py-2.5" />
      </div>
    </div>
  );
}

/** The pop-up: the whole history. */
export function AskMuse({ narrow }: { narrow?: boolean }) {
  const { ask, result } = useAria();
  return (
    <AnimatePresence>
      {ask.open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className={cn("fixed z-[900] flex flex-col overflow-hidden rounded-[24px] text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/12",
                        narrow ? "inset-x-3 bottom-3 top-16" : "bottom-[148px] left-[56px] max-h-[min(560px,calc(100vh-140px))] w-[380px]")}
          style={PANEL} role="dialog" aria-label="Ask Muse"
        >
          <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
            <b className="text-sm">Ask Muse</b>
            <span className="text-xs text-white/50">{result ? "about Mix check" : "about your set"}</span>
            {ask.log.length > 0 && <ClearButton className="ml-auto" />}
            <button onClick={() => setAskOpen(false)} aria-label="Close" className={cn("grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10", !ask.log.length && "ml-auto")}><X size={15} /></button>
          </div>
          <AskThread className="flex-1 px-4 pb-2" />
          <AskInput autoFocus className="border-t border-white/10 px-3 py-2.5" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
