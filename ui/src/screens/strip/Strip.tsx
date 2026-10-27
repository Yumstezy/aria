// The device strip on Main. Small and simple like Live's own devices; details in the window.
// Slim stacked buttons on the left (Check, Ask, Open), and a card with the count to fix, a
// thumbnail of the waves and short chips on the right. 169 px tall (Live's device height).
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Check, Mic, Play, Undo2, X } from "lucide-react";
import { GradientCard } from "@/components/ui/gradient-card";
import { MiniWaves } from "@/components/mini-waves";
import { CountUp } from "@/components/count-up";
import { askMuse, checkMix, openWindow, undoLast, useAria } from "@/lib/aria";
import { problemsOf } from "@/lib/problems";
import { cn } from "@/lib/utils";

// The shortest honest label for each problem
function chip(name: string, value: string, unit: string) {
  const word = name === "Vocal buried" ? "Vocal" : name === "Bass click" ? "Click" : name.split(" ")[0];
  return unit.startsWith("%") ? word : `${word} ${unit === "dB under" ? "−" : ""}${parseFloat(value).toFixed(0)}`;
}

const PILL = "flex h-8 w-full items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-transform duration-150 active:scale-[0.97] " +
             "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

// Ask, right in the strip: a text box, Muse's last reply, and Undo. No pop-up.
function StripAsk({ onClose }: { onClose: () => void }) {
  const { ask } = useAria();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const last = ask.log[ask.log.length - 1];
  const changed = last?.done.filter((d) => d.ok) ?? [];
  const canUndo = changed.some((d) => d.type !== "jump_to" && d.type !== "check_mix");
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Ask Muse</span>
        <button onClick={onClose} aria-label="Back to the result" className="grid size-6 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={13} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden text-xs leading-4" role="status">
        {ask.pending ? <span className="text-ink-muted">Muse is on it…</span>
          : last ? (
            <>
              <p className={`m-0 line-clamp-2 ${last.error ? "text-hot" : ""}`}>{last.reply ?? last.error ?? last.notes[last.notes.length - 1]}</p>
              {changed.length > 0 && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-[#5fdba6]/20 px-1.5 text-[10.5px] leading-[18px] text-[#bff7dc]"><Check size={10} className="shrink-0" /><span className="truncate">{changed[changed.length - 1].text}</span></span>
                  {canUndo && <button onClick={undoLast} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-1.5 text-[10.5px] font-semibold leading-[18px] text-[#0b1a3a]"><Undo2 size={10} />Undo</button>}
                </div>
              )}
              {last.notes.length > 0 && last.reply && <p className="m-0 mt-0.5 truncate text-[10.5px] text-ink-faint">{last.notes[last.notes.length - 1]}</p>}
            </>
          ) : <span className="text-ink-muted">Ask for a change, like "make the vocal easier to hear".</span>}
      </div>
      <form className="flex items-center gap-1.5 rounded-full bg-black/30 py-1 pl-3 pr-1 ring-1 ring-white/15"
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) { askMuse(text); setText(""); } }}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Muse"
               className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/45" />
        <button type="submit" disabled={!text.trim() || !!ask.pending} aria-label="Send"
                className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[#0b1a3a] disabled:opacity-35"><ArrowUp size={13} /></button>
      </form>
    </div>
  );
}

export function Strip() {
  const { engine, progress, result, error } = useAria();
  const [asking, setAsking] = useState(false);
  const busy = !!progress;
  const engineDown = engine.state === "down" || engine.state === "error";
  const chain = result?.chain;
  const warning = engineDown ? "Engine not running"
    : (chain && (!chain.on_main ? "Not on Main" : chain.after.length ? "Move Aria last" : null)) || null;
  const list = result ? problemsOf(result) : [];
  const share = progress?.total ? Math.min(1, (progress.done ?? 0) / progress.total) : 1;

  return (
    <div className="aria-lights flex h-[169px] gap-2.5 p-2.5">
      <div className="flex w-[92px] shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5 px-1 pb-1">
          <svg viewBox="0 0 26 26" width={16} height={16} aria-hidden="true"><rect width="26" height="26" rx="8" fill="var(--action)" /><path d="M8 10v6M11.5 7v12M15 9v8M18.5 11v4" stroke="var(--on-action)" strokeWidth="2" strokeLinecap="round" /></svg>
          <b className="text-xs tracking-tight">Aria</b>
        </div>
        <button onClick={checkMix} disabled={busy} className={cn(PILL, "bg-action text-on-action disabled:opacity-60")}>
          <Play size={11} fill="currentColor" />{busy ? "Checking" : result ? "Again" : "Check"}
        </button>
        <button onClick={() => setAsking(!asking)} aria-pressed={asking}
                className={cn(PILL, asking ? "bg-white text-[#0b1a3a]" : "bg-white/8 text-ink-muted ring-1 ring-white/10")}><Mic size={12} />Ask</button>
        <button onClick={openWindow} className={cn(PILL, "bg-white/8 text-ink-muted ring-1 ring-white/10")}><ArrowUpRight size={13} />Open</button>
      </div>

      <GradientCard className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex h-full flex-col">
          {asking ? <StripAsk onClose={() => setAsking(false)} /> : error ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Mix check</span>
              <p className="m-0 mt-1 line-clamp-4 text-xs leading-4 text-hot">{error}</p>
            </>
          ) : busy ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Mix check</span>
              <span className="mt-auto text-sm font-semibold">
                {progress!.step === "record" ? "Listening to 16 bars" : progress!.step === "analyze" ? "Splitting and asking Muse" : "Getting ready"}
              </span>
              <span className="font-mono text-[11px] text-ink-faint">{progress!.step === "record" ? progress!.detail : ""}</span>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
                <i className="block h-full rounded-full bg-white transition-[width] duration-200 ease-linear" style={{ width: `${share * 100}%` }} />
              </div>
            </>
          ) : result ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[26px] font-extralight leading-none tracking-[-0.04em]"><CountUp value={list.length} /></span>
                <span className="text-xs font-medium text-ink-muted">{list.length ? "to fix" : "Clear"}</span>
              </div>
              {warning && <span className="text-[11px] font-semibold text-hot" title={engineDown ? engine.text : undefined}>{warning}</span>}
              <div className="mt-auto flex flex-col gap-1">
                {result.clarity.spectra && (
                  <div className="h-11"><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode === "split"} /></div>
                )}
                <div className="flex gap-1 overflow-hidden">
                  {list.slice(0, 3).map((p, i) => (
                    <span key={i} className="whitespace-nowrap rounded-full bg-black/35 px-1.5 font-mono text-[10.5px] leading-[18px] text-white" title={p.short}>
                      {chip(p.name, p.amount.value, p.amount.unit)}
                    </span>
                  ))}
                  {list.length === 0 && <span className="text-[11px] text-ink-muted">Nothing sticks out here.</span>}
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Mix check</span>
              <p className="m-0 mt-auto text-xs leading-4 text-ink-muted">
                {engineDown ? "The Aria engine isn't running." : engine.state === "starting" ? "Starting Aria…" : "Play the busiest part of your song, then press Check."}
              </p>
            </>
          )}
        </div>
      </GradientCard>
    </div>
  );
}
