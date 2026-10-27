// The device strip on Main. Flat and small like Live's own devices; details in the window.
// Left: Check mix, Ask (the full chat) and Open. Middle: what the check found. Right: Muse's last
// answer and an Ask box that's always there. 480 x 169 px (169 is Live's device height).
import { useState } from "react";
import { ArrowUp, ArrowUpRight, Check, MessageSquare, Play, Undo2 } from "lucide-react";
import { MiniWaves } from "@/components/mini-waves";
import { CountUp } from "@/components/count-up";
import { useVoice, VoiceButton } from "@/components/ask-muse";
import { askMuse, barsLabel, checkMix, jumpTo, openChat, openWindow, outcome, undoLast, useAria } from "@/lib/aria";
import { problemsOf, type Problem } from "@/lib/problems";
import { cn } from "@/lib/utils";

// A plain name and the one number, short enough for three to fit
function chip(p: Problem) {
  const name = p.name === "Synths and keys buried" ? "Synths buried" : p.name === "Drums and loops buried" ? "Drums buried" : p.name;
  if (p.amount.unit.startsWith("%")) return name;
  return `${name} ${p.amount.unit === "dB under" ? "−" : ""}${Math.abs(parseFloat(p.amount.value)).toFixed(0)}`;
}

const BUTTON = "flex h-8 w-full items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[11.5px] font-semibold transition-colors active:scale-[0.98] " +
               "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]";
const QUIET = "bg-[var(--glass-row)] text-ink ring-1 ring-[var(--hairline)] hover:bg-white/12";
const LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint";

// Muse's last answer in one line, with the last change and Undo
function LastAnswer() {
  const { ask } = useAria();
  const last = ask.log[ask.log.length - 1];
  if (ask.pending) return <p className="m-0 line-clamp-3 text-[11px] leading-[14px] text-ink-muted" role="status">Muse is on it: “{ask.pending}”</p>;
  if (!last) return <p className="m-0 text-[11px] leading-[14px] text-ink-faint">Ask for any change, like “compress the vocal”. Undo is always there.</p>;
  const changed = last.done.filter((d) => d.ok && d.type !== "jump_to" && d.type !== "check_mix" && d.type !== "undo");
  if (!changed.length) {
    const o = outcome(last);
    return <p className={cn("m-0 line-clamp-4 text-[11px] leading-[14px]", o.bad ? "text-hot" : "text-ink-muted")} title={o.text} role="status">{o.text}</p>;
  }
  const text = changed[changed.length - 1].text;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1" role="status">
      <span className="flex min-w-0 gap-1 text-[11px] leading-[14px] text-ink-muted" title={text}>
        <Check size={11} className="mt-px shrink-0 text-good" /><span className="line-clamp-3">{text}</span>
      </span>
      <button onClick={undoLast} className="inline-flex h-[18px] shrink-0 items-center gap-0.5 rounded-full px-2 text-[10.5px] font-semibold text-ink ring-1 ring-[var(--hairline)] hover:bg-white/10">
        <Undo2 size={10} />Undo
      </button>
    </div>
  );
}

function AskBox() {
  const { ask } = useAria();
  const [text, setText] = useState("");
  const voice = useVoice("Ask Muse", "Voice soon");
  return (
    <form className="flex h-7 items-center gap-1.5 rounded-full bg-black/25 pl-0.5 pr-0.5 ring-1 ring-[var(--hairline)] focus-within:ring-white/30"
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) { askMuse(text); setText(""); } }}>
      <VoiceButton small onPress={voice.press} />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={voice.placeholder} aria-label="Ask Muse"
             className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink-faint" />
      <button type="submit" disabled={!text.trim() || !!ask.pending} aria-label="Send"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-action text-on-action disabled:opacity-30"><ArrowUp size={12} /></button>
    </form>
  );
}

export function Strip() {
  const { engine, progress, result, error } = useAria();
  const busy = !!progress;
  const engineDown = engine.state === "down" || engine.state === "error";
  const chain = result?.chain;
  const warning = engineDown ? "Engine not running"
    : (chain && (!chain.on_main ? "Not on Main" : chain.after.length ? "Move Aria last" : null)) || null;
  const list = result ? problemsOf(result) : [];
  const share = progress?.total ? Math.min(1, (progress.done ?? 0) / progress.total) : 1;

  return (
    <div className="flex h-[169px] gap-2 bg-ground p-2 text-ink">
      <div className="flex w-[88px] shrink-0 flex-col gap-1">
        <div className="flex h-6 items-center gap-1.5 px-0.5">
          <svg viewBox="0 0 26 26" width={15} height={15} aria-hidden="true"><rect width="26" height="26" rx="7" fill="var(--action)" /><path d="M8 10v6M11.5 7v12M15 9v8M18.5 11v4" stroke="var(--on-action)" strokeWidth="2" strokeLinecap="round" /></svg>
          <b className="text-xs tracking-tight">Aria</b>
        </div>
        <button onClick={checkMix} disabled={busy} className={cn(BUTTON, "bg-action text-on-action hover:brightness-110 disabled:opacity-60")}>
          <Play size={10} fill="currentColor" />{busy ? "Checking" : "Check mix"}
        </button>
        <button onClick={openChat} className={cn(BUTTON, QUIET)}><MessageSquare size={12} />Ask</button>
        <button onClick={openWindow} className={cn(BUTTON, QUIET)}><ArrowUpRight size={13} />Open</button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-2xl bg-[var(--glass-row)] p-2.5 ring-1 ring-[var(--hairline)]">
        <div className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <>
              <span className={LABEL}>Mix check</span>
              <p className="m-0 mt-0.5 line-clamp-3 text-[11.5px] leading-[15px] text-hot">{error}</p>
            </>
          ) : busy ? (
            <>
              <span className={LABEL}>Mix check</span>
              <span className="mt-auto text-[12.5px] font-semibold">
                {progress!.step === "record" ? "Listening to 16 bars" : progress!.step === "analyze" ? "Splitting and asking Muse" : "Getting ready"}
                <span className="ml-1.5 font-mono text-[11px] font-normal text-ink-faint">{progress!.step === "record" ? progress!.detail : ""}</span>
              </span>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/12">
                <i className="block h-full rounded-full bg-action transition-[width] duration-200 ease-linear" style={{ width: `${share * 100}%` }} />
              </div>
            </>
          ) : result ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <button onClick={openWindow} title="See the details" className="flex items-baseline gap-1 rounded hover:text-white">
                  <span className="text-[17px] font-semibold leading-none tracking-[-0.02em]"><CountUp value={list.length} /></span>
                  <span className="text-[11.5px] font-medium text-ink-muted">{list.length === 1 ? "thing to fix" : list.length ? "things to fix" : "Nothing to fix"}</span>
                </button>
                {warning ? <span className="ml-auto truncate text-[10.5px] font-semibold text-hot" title={engineDown ? engine.text : undefined}>{warning}</span>
                  : <span className="ml-auto truncate text-[10.5px] text-ink-faint">{barsLabel(result)}</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {list.slice(0, 3).map((p, i) => (
                  <button key={i} onClick={() => jumpTo(p.bar)} title={`${p.short} Jump to bar ${p.bar}.`}
                          className="shrink-0 whitespace-nowrap rounded-full bg-black/30 px-2 text-[10.5px] font-medium leading-[18px] text-ink ring-1 ring-[var(--hairline)] hover:bg-white/12">
                    {chip(p)}
                  </button>
                ))}
              </div>
              {result.clarity.spectra && (
                <div className="mt-1 min-h-0 flex-1"><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode === "split"} /></div>
              )}
            </>
          ) : (
            <>
              <span className={LABEL}>Mix check</span>
              {warning && <span className="text-[10.5px] font-semibold text-hot" title={engine.text}>{warning}</span>}
              <p className="m-0 mt-auto text-[11.5px] leading-[15px] text-ink-muted">
                {engineDown ? "The Aria engine isn't running." : engine.state === "starting" ? "Starting Aria…" : "Play the busiest part, then press Check mix."}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex w-[150px] shrink-0 flex-col gap-1.5 rounded-2xl bg-[var(--glass-row)] p-2 ring-1 ring-[var(--hairline)]">
        <span className={cn(LABEL, "px-0.5")}>Ask Muse</span>
        <div className="min-h-0 flex-1 overflow-hidden px-0.5"><LastAnswer /></div>
        <AskBox />
      </div>
    </div>
  );
}
