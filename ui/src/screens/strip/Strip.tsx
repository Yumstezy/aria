// The device on Main: just the buttons, glassy and muted so it sits with Live's own devices (Ian, Oct 28).
// Check mix shows its progress inside the button; Ask opens Ask Muse in its own window; Open window opens the
// results, with a small count once a check has found something. Everything else lives in the window.
// 150 x 169. The bottom row is Live's own "Ask key" control (device/tools/make_aria_amxd.py), for a mapped key.
import type { ReactNode } from "react";
import { Mark } from "@/components/brand";
import { MicIcon } from "@/components/icons";
import { checkMix, openChat, openWindow, useAriaSel } from "@/lib/aria";
import { problemsOf } from "@/lib/problems";
import { cn } from "@/lib/utils";

const STEP: Record<string, string> = { record: "Listening", analyze: "Checking", play: "Starting", start: "Starting" };

function Button({ onClick, disabled, label, title, accent, children }: {
  onClick: () => void; disabled?: boolean; label: string; title?: string; accent?: boolean; children: ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={title ?? label}
            className={cn("aria-strip-btn relative flex w-full items-center gap-2 overflow-hidden px-2.5 text-left text-[12px] font-semibold", accent && "is-accent")}>
      {children}
    </button>
  );
}

export function Strip() {
  const progress = useAriaSel((s) => s.progress), result = useAriaSel((s) => s.result);
  const pending = useAriaSel((s) => s.ask.pending), engine = useAriaSel((s) => s.engine.state);
  const error = useAriaSel((s) => s.error), engineText = useAriaSel((s) => s.engine.text);
  const share = progress?.total ? Math.min(1, (progress.done ?? 0) / progress.total) : null;
  const found = result ? problemsOf(result).length : null;
  const down = engine === "down" || engine === "error";
  const step = progress ? STEP[progress.step] ?? "Checking" : null;
  return (
    <div className="aria-strip flex flex-col" style={{ width: 150, height: 169, padding: 10, gap: 6, boxSizing: "border-box" }}>
      <div className="flex items-center gap-1.5" style={{ height: 20 }}>
        <Mark size={16} /><b className="text-[12px] tracking-tight">Aria</b>
        {(down || error) && <i className="ml-auto size-1.5 rounded-full bg-hot" title={down ? engineText : error ?? ""} />}
      </div>
      <Button accent onClick={checkMix} disabled={!!progress} label={step ?? "Check mix"}
              title={progress ? progress.text : down ? engineText : error ?? "Play the busiest part, then check"}>
        {/* the check's progress fills the button itself */}
        {progress && <i className="aria-strip-fill absolute inset-y-0 left-0 transition-[width] duration-[250ms] ease-linear"
                        style={{ width: `${(share ?? 0.12) * 100}%` }} />}
        <span className="relative">{step ? `${step}${progress!.step === "record" && progress!.detail ? ` ${progress!.detail}` : "…"}` : "Check mix"}</span>
      </Button>
      <Button onClick={openChat} label="Ask Muse" title={pending ? `Muse is on it: ${pending}` : "Ask Muse"}>
        <MicIcon style={{ width: 13, height: 13, flex: "none" }} /><span>{pending ? "Asking…" : "Ask"}</span>
      </Button>
      <Button onClick={openWindow} label="Open window">
        <span>Open window</span>
        {found !== null && <span className="aria-strip-count ml-auto" title={found ? `${found} to fix` : "Nothing sticks out"}>{found || "✓"}</span>}
      </Button>
    </div>
  );
}
