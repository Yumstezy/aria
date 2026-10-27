// Ask Muse: a pop-up over the window (design screen 08), never a page. You ask, Muse Spark
// picks tools, Aria does it in Live with Undo. Muse's own ideas wait for "Do it".
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, Mic, Undo2, X } from "lucide-react";
import { answerSuggestion, askMuse, hz, setAskOpen, undoLast, useAria, type Finding, type Suggestion } from "@/lib/aria";
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

function describeSuggestion(s: Suggestion) {
  const a = s.args;
  if (s.type === "eq_band") return `${Number(a.gain_db) > 0 ? "+" : ""}${a.gain_db} dB at ${hz(Number(a.freq_hz))}`;
  if (s.type === "add_marker") return `Marker "${a.name}" at bar ${a.bar}`;
  if (s.type === "jump_to") return `Jump to bar ${a.bar}`;
  return s.type;
}

export function AskMuse() {
  const { ask, result } = useAria();
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [ask.log.length, ask.pending]);
  useEffect(() => { if (ask.open) input.current?.focus(); }, [ask.open]);

  const submit = (t: string) => { if (!t.trim()) return; askMuse(t); setText(""); };
  const lastWithChange = (() => {
    for (let i = ask.log.length - 1; i >= 0; i--) if (ask.log[i].done.some((d) => d.ok && d.type !== "jump_to" && d.type !== "check_mix")) return i;
    return -1;
  })();

  return (
    <AnimatePresence>
      {ask.open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="fixed bottom-[148px] left-[56px] z-[900] flex max-h-[min(560px,calc(100vh-140px))] w-[380px] flex-col overflow-hidden rounded-[24px] text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/12"
          style={{ background: "rgba(16, 22, 38, 0.86)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }}
          role="dialog" aria-label="Ask Muse"
        >
          <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
            <b className="text-sm">Ask Muse</b>
            <span className="text-xs text-white/50">{result ? "about Mix check" : "about your set"}</span>
            <button onClick={() => setAskOpen(false)} aria-label="Close" className="ml-auto grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={15} /></button>
          </div>

          <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-2">
            {ask.log.length === 0 && !ask.pending && (
              <div className="flex flex-col gap-2 py-1">
                <p className="m-0 text-[13px] text-white/60">Ask for a change in plain words. If you ask, it happens right away, with Undo.</p>
                <div className="flex flex-wrap gap-1.5">
                  {starters(result?.clarity.findings ?? [], result?.start_bar).map((s) => (
                    <button key={s} onClick={() => submit(s)} className="rounded-full bg-white/10 px-2.5 py-1 text-left text-xs font-medium text-white/85 ring-1 ring-white/10 hover:bg-white/15">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {ask.log.map((x, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="self-end rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] text-[#0b1a3a]">{x.request}</div>
                {(x.reply || x.error) && (
                  <div className={cn("max-w-[92%] self-start rounded-2xl rounded-bl-md px-3 py-2 text-[13px] leading-[18px]", x.error ? "bg-white/8 text-[#ffb07a]" : "bg-[var(--tile-base)]")}>
                    {x.reply ?? x.error}
                  </div>
                )}
                {x.done.map((d, k) => (
                  <div key={k} className={cn("flex items-center gap-2 self-start rounded-full px-2.5 py-1 text-xs", d.ok ? "bg-[#5fdba6]/15 text-[#8ff0c4]" : "bg-white/8 text-white/60")}>
                    {d.ok && <Check size={12} />}<span>{d.text}</span>
                    {d.ok && i === lastWithChange && k === x.done.length - 1 && (
                      <button onClick={undoLast} className="ml-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-[#0b1a3a]"><Undo2 size={11} />Undo</button>
                    )}
                  </div>
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
            ))}

            {ask.pending && (
              <div className="flex flex-col gap-1.5">
                <div className="self-end rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] text-[#0b1a3a]">{ask.pending}</div>
                <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-[var(--tile-base)] px-3 py-2.5" aria-label="Muse is thinking">
                  {[0, 1, 2].map((d) => <motion.i key={d} className="size-1.5 rounded-full bg-white/80" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}
                </div>
              </div>
            )}
          </div>

          <form className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
            <button type="button" disabled title="Voice is coming next" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8 text-white/35"><Mic size={14} /></button>
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Muse to change something"
                   className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40" />
            <button type="submit" disabled={!text.trim() || !!ask.pending} aria-label="Send"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#0b1a3a] disabled:opacity-35"><ArrowUp size={15} /></button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
