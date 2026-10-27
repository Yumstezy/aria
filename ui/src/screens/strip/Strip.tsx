// The device strip on Main: 169 px tall (Live's device height), about 700 px wide.
// Check mix and Ask on the left, what sticks out in the middle, Muse's advice on the right.
import { Mic } from "lucide-react";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Button, Cap, Mark } from "@/components/brand";
import { addMarker, barsLabel, checkMix, describe, jumpTo, notice, openWindow, useAria } from "@/lib/aria";

export function Strip() {
  const { engine, progress, result, error, marker } = useAria();
  const findings = result?.clarity.findings ?? [];
  const chain = result?.chain;
  const chainWarning = chain && (!chain.on_main ? "Not on Main" : chain.after.length ? "Move Aria last" : null);

  return (
    <div className="aria-lights h-[169px] overflow-hidden">
      <div className="grid h-full grid-cols-[134px_minmax(0,1fr)_206px] gap-3 rounded-3xl p-3"
           style={{ background: "color-mix(in srgb, var(--glass) 50%, transparent)" }}>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5"><Mark /><b className="text-[13px] tracking-tight">Aria</b></div>
          <Button variant="primary" className="w-full" disabled={!!progress} onClick={checkMix}>
            {result ? "Check again" : "Check mix"}
          </Button>
          <Button variant="ghost" className="self-start bg-well" onClick={() => notice("Ask Muse is coming next.")}>
            <Mic size={14} /> Ask
          </Button>
          {engine.state !== "up" && (
            <span className={`mt-auto self-start whitespace-nowrap rounded-full bg-well px-2 py-0.5 text-[10.5px] font-semibold ${engine.state === "starting" ? "text-ink-muted" : "text-hot"}`}
                  title={engine.text}>
              {engine.state === "starting" ? "Starting Aria" : "Engine not running"}
            </span>
          )}
        </div>

        <LiquidGlass className="flex min-h-0 flex-col gap-1.5 px-3.5 py-3" radius="16px">
          {error ? (
            <div className="flex flex-1 flex-col justify-center gap-1 text-[13px]">
              <b>Mix check stopped</b>
              <span className="text-hot">{error}</span>
            </div>
          ) : progress ? (
            <div className="flex flex-1 flex-col gap-1.5">
              <Cap>Mix check</Cap>
              <b className="text-sm font-semibold" role="status">{progress.text}</b>
              <div className="h-1.5 overflow-hidden rounded-full bg-well">
                <i className="block h-full rounded-full bg-action transition-[width] duration-200 ease-linear"
                   style={{ width: progress.total ? `${Math.min(100, (100 * (progress.done ?? 0)) / progress.total)}%` : "100%" }} />
              </div>
              <span className="font-mono text-xs text-ink-faint">{progress.detail}</span>
            </div>
          ) : result ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <Cap>What sticks out</Cap>
                {chainWarning
                  ? <span className="rounded-full bg-well px-2 text-[11px] font-semibold text-hot" title={chain!.after.length ? `Aria hears your mix before ${chain!.after.join(", ")}.` : `Aria is on "${chain!.track}".`}>{chainWarning}</span>
                  : <span className="font-mono text-xs text-ink-faint">{barsLabel(result)}</span>}
              </div>
              {findings.length === 0 ? (
                <p className="m-0 flex items-center gap-2 text-xs text-ink-muted">
                  <span className="rounded-full bg-well px-2 font-semibold text-good">Clear</span> Nothing sticks out in these bars.
                </p>
              ) : (
                <ol className="m-0 grid list-none gap-1 p-0">
                  {findings.slice(0, 3).map((f, i) => {
                    const d = describe(f);
                    return (
                      <li key={i}>
                        <button onClick={() => jumpTo(f.bars[0])} title={`${d.about} Bars ${f.bars[0]} to ${f.bars[1]}. Click to jump there.`}
                                className="grid w-full grid-cols-[82px_minmax(0,1fr)_54px] items-baseline gap-1 rounded-lg px-2 py-1 text-left transition-transform duration-150 hover:scale-[1.005]"
                                style={{ background: "var(--glass-row)" }}>
                          <span className="truncate text-[11.5px] font-semibold text-watch">{d.name}</span>
                          <span className="truncate font-mono text-[11.5px]">{d.where}</span>
                          <span className="text-right font-mono text-[11.5px] text-ink-muted">{d.size}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-hairline px-3 text-[13px] text-ink-muted">
              <b className="font-semibold text-ink">Nothing measured yet.</b>
              Press Check mix. Aria listens to 8 bars of your song.
            </div>
          )}
        </LiquidGlass>

        <LiquidGlass className="flex min-h-0 flex-col gap-1.5 px-3.5 py-3" radius="16px">
          <Cap>{progress?.step === "analyze" ? "Muse Spark is writing" : result && !result.advice ? "No advice" : "Advice by Muse Spark"}</Cap>
          <p className={`m-0 line-clamp-3 text-xs leading-4 ${result && !result.advice ? "text-ink-muted" : ""}`}>
            {result ? (result.advice?.summary ?? result.advice_error ?? "Muse Spark did not answer.") : "Muse Spark explains what to fix after a Mix check."}
          </p>
          <div className="mt-auto flex gap-1.5">
            <Button variant="light" small onClick={openWindow}>Open window</Button>
            {result?.start_bar && (
              <Button variant="ghost" small onClick={() => addMarker(result.start_bar!)}>
                {marker ? `Marked bar ${marker.bar}` : `Mark bar ${result.start_bar}`}
              </Button>
            )}
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}
