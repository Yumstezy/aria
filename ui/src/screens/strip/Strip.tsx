// The device strip on Main. Small and simple like Live's own devices (EQ Eight, Utility,
// Limiter): Check and Ask on the left, a thumbnail of the result on the right. Everything
// detailed lives in the window, one click away. 169 px tall (Live's device height).
import { ArrowUpRight, Mic } from "lucide-react";
import { GradientCard } from "@/components/ui/gradient-card";
import { MiniWaves } from "@/components/mini-waves";
import { CountUp } from "@/components/count-up";
import { checkMix, notice, openWindow, useAria } from "@/lib/aria";
import { problemsOf } from "@/lib/problems";
import { cn } from "@/lib/utils";

// Chip text: the shortest honest label for each problem
function chip(name: string, value: string, unit: string) {
  const word = name === "Vocal buried" ? "Vocal" : name === "Bass click" ? "Click" : name.split(" ")[0];
  return unit.startsWith("%") ? word : `${word} ${unit === "dB under" ? "−" : ""}${parseFloat(value).toFixed(0)}`;
}

export function Strip() {
  const { engine, progress, result, error } = useAria();
  const list = result ? problemsOf(result) : [];
  const chain = result?.chain;
  const engineDown = engine.state === "down" || engine.state === "error";
  const warning = engineDown ? "Engine not running"
    : chain && (!chain.on_main ? "Not on Main" : chain.after.length ? "Move Aria last" : null);
  const busy = !!progress;

  return (
    <div className="aria-lights flex h-[169px] gap-3 overflow-hidden p-3">
      <div className="flex w-[84px] shrink-0 flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 self-start pl-1">
          <svg viewBox="0 0 26 26" width={16} height={16} aria-hidden="true"><rect width="26" height="26" rx="8" fill="var(--action)" /><path d="M8 10v6M11.5 7v12M15 9v8M18.5 11v4" stroke="var(--on-action)" strokeWidth="2" strokeLinecap="round" /></svg>
          <b className="text-xs tracking-tight">Aria</b>
        </div>
        <button onClick={checkMix} disabled={busy} aria-label={result ? "Check again" : "Check mix"}
                className={cn("grid size-[68px] place-items-center rounded-full bg-action text-on-action shadow-[0_10px_22px_-8px_var(--action-glow),inset_0_1px_0_rgba(255,255,255,0.35)]",
                              "transition-transform duration-150 active:scale-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]")}>
          <span className="text-[13px] font-semibold leading-4">{busy ? "…" : result ? "Again" : "Check"}</span>
        </button>
        <button onClick={() => notice("Ask Muse is coming next.")} aria-label="Ask Muse"
                className="flex h-7 items-center gap-1 rounded-full bg-white/8 px-2.5 text-[11.5px] font-semibold text-ink-muted ring-1 ring-white/10">
          <Mic size={12} /> Ask
        </button>
      </div>

      <GradientCard className="min-w-0 flex-1 px-3.5 py-2.5">
        <div className="flex h-full flex-col">
          {error || (!result && (engine.state === "down" || engine.state === "error")) ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Mix check</span>
              <p className="m-0 mt-1 line-clamp-4 text-xs leading-4 text-hot">{error ?? "The Aria engine isn't running."}</p>
            </>
          ) : busy ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Mix check</span>
              <span className="mt-auto text-sm font-semibold">{progress!.step === "record" ? "Listening" : progress!.step === "analyze" ? "Splitting and asking Muse" : "Getting ready"}</span>
              <span className="font-mono text-[11px] text-ink-faint">{progress!.detail ?? ""}</span>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
                <i className="block h-full rounded-full bg-white transition-[width] duration-200 ease-linear"
                   style={{ width: progress!.total ? `${Math.min(100, (100 * (progress!.done ?? 0)) / progress!.total)}%` : "100%" }} />
              </div>
            </>
          ) : result ? (
            <>
              <div className="flex items-start justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[30px] font-extralight leading-none tracking-[-0.04em]"><CountUp value={list.length} /></span>
                  <span className="text-xs font-medium text-ink-muted">{list.length ? "to fix" : "Clear"}</span>
                </div>
                <button onClick={openWindow} aria-label="Open the Aria window" title="Open the Aria window"
                        className="grid size-7 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20 transition-colors hover:bg-white/25">
                  <ArrowUpRight size={15} />
                </button>
              </div>
              {warning && <span className="mt-0.5 text-[11px] font-semibold text-hot" title={engineDown ? engine.text : chain!.after.length ? `Aria hears your mix before ${chain!.after.join(", ")}.` : `Aria is on "${chain!.track}".`}>{warning}</span>}
              <div className="mt-auto">
                {result.clarity.spectra && <MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode === "split"} />}
                <div className="mt-1 flex gap-1 overflow-hidden">
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
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Mix check</span>
                <button onClick={openWindow} aria-label="Open the Aria window" className="grid size-7 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20"><ArrowUpRight size={15} /></button>
              </div>
              <p className="m-0 mt-auto text-xs leading-4 text-ink-muted">{engine.state === "starting" ? "Starting Aria…" : "Play your song, then press Check."}</p>
            </>
          )}
        </div>
      </GradientCard>
    </div>
  );
}
