// The device on Main (Ian picked "Lamp", Oct 28): a status light with one word, Check and Ask side by side,
// Open window below. Flat greys and amber like a stock Live device; the pop-out window keeps Aria's own look.
// 150 x 169. The bottom row is Live's own "Ask key" control (device/tools/make_aria_amxd.py), for a mapped key.
import { checkMix, openChat, openWindow, useAriaSel } from "@/lib/aria";
import { problemsOf } from "@/lib/problems";
import { cn } from "@/lib/utils";

const STEP: Record<string, string> = { record: "Listening", analyze: "Checking", play: "Starting", start: "Starting" };

export function Strip() {
  const progress = useAriaSel((s) => s.progress), result = useAriaSel((s) => s.result);
  const pending = useAriaSel((s) => s.ask.pending), engine = useAriaSel((s) => s.engine);
  const error = useAriaSel((s) => s.error);
  const found = result ? problemsOf(result).length : null;
  const down = engine.state === "down" || engine.state === "error";
  const share = progress?.total ? Math.min(1, (progress.done ?? 0) / progress.total) : null;

  // The lamp and its one word
  const [lamp, word, why] = progress
    ? ["is-busy", `${STEP[progress.step] ?? "Checking"}${progress.step === "record" && progress.detail ? ` ${progress.detail}` : ""}`, progress.text]
    : down ? ["is-hot", "Engine off", engine.text]
    : error ? ["is-hot", "Didn't finish", error]
    : engine.state === "starting" ? ["", "Starting", engine.text]
    : found === null ? ["", "Ready", "Play the busiest part, then press Check"]
    : found ? ["is-hot", `${found} to fix`, "Open the window to see them"]
    : ["is-clear", "Clear", "Nothing sticks out in these bars"];

  return (
    <div className="aria-strip flex flex-col" style={{ width: 150, height: 169, padding: 9, gap: 7, boxSizing: "border-box" }}>
      <div className="flex items-center gap-1.5" style={{ height: 16 }} title={why}>
        <span className={cn("aria-lamp", lamp)} />
        <b className="text-[11px]">Aria</b>
        <span className="ml-auto truncate text-[9.5px] font-semibold" style={{ color: lamp === "is-busy" ? "var(--live-amber)" : lamp === "is-hot" ? "var(--live-lamp-hot)" : "var(--live-dim)" }}>{word}</span>
      </div>
      <div className="flex" style={{ gap: 5 }}>
        <button className="aria-strip-btn is-amber flex-1" style={{ height: 30, opacity: progress ? 0.8 : 1 }} disabled={!!progress} onClick={checkMix}
                aria-label="Check mix" title={progress ? progress.text : "Check mix: Aria listens to 16 bars"}>
          {progress && <i className="aria-strip-fill transition-[width] duration-[250ms] ease-linear" style={{ width: `${(share ?? 0.12) * 100}%` }} />}
          <span className="relative">Check</span>
        </button>
        <button className="aria-strip-btn flex-1" style={{ height: 30 }} onClick={openChat} aria-label="Ask Muse" title={pending ? `Muse is on it: ${pending}` : "Ask Muse"}>
          {pending ? "Asking" : "Ask"}
        </button>
      </div>
      <button className={cn("aria-strip-btn", found === null && "is-dim")} style={{ height: 24 }} onClick={openWindow} aria-label="Open window">Open window</button>
    </div>
  );
}
