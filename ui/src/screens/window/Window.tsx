// The Aria window, a floating window inside Live: Home and Mix check (Simple and Detailed).
// Picture first, a short line second, numbers and long text only when asked for (DESIGN.md).
import { useEffect, useState, type ReactNode } from "react";
import { AudioWaveform, ChartNoAxesColumn, Columns2, Grip, House, Mic } from "lucide-react";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Button, Cap, Mark } from "@/components/brand";
import { Waves } from "@/components/waves";
import { Problems, problemsOf } from "@/components/problems";
import { barsLabel, checkMix, notice, soundName, useAria, type Result } from "@/lib/aria";
import { cn } from "@/lib/utils";

type View = "home" | "mixcheck";

export function AriaWindow() {
  const { engine, progress, result, error, notice: note } = useAria();
  const [view, setView] = useState<View>("home");
  const [detailed, setDetailed] = useState(false);
  const [open, setOpen] = useState(0);

  // A new result opens Mix check with the first problem ("fix first") open.
  useEffect(() => { if (result) { setView("mixcheck"); setOpen(0); } }, [result]);

  const status = progress ? `${progress.text}${progress.detail ? ` · ${progress.detail}` : ""}` : error ?? note;

  return (
    <div className="aria-lights min-h-full p-8">
      <div className="grid h-[calc(100vh-64px)] min-h-[700px] grid-cols-[184px_minmax(0,1fr)] overflow-hidden rounded-[28px] shadow-[var(--shadow-tile),var(--shadow-rim)]"
           style={{ background: "color-mix(in srgb, var(--glass) 55%, transparent)", backdropFilter: "blur(24px) saturate(140%)" }}>
        <Rail view={view} setView={setView} />

        <main className="flex min-w-0 flex-col gap-4 overflow-y-auto p-[22px] pl-5">
          <header className="flex items-center justify-between gap-3">
            <div>
              <Cap>{result ? `${barsLabel(result)} · ${result.clarity.mode === "split" ? "split into parts" : "full mix only"}` : "This session"}</Cap>
              <h1 className="m-0 mt-1 text-[22px] font-bold leading-[26px] tracking-[-0.03em]">{view === "mixcheck" ? "Mix check" : "Home"}</h1>
            </div>
            <div className="flex items-center gap-2.5">
              {status && <span className={cn("max-w-[360px] truncate text-xs", error ? "text-hot" : "text-ink-muted")} role="status">{status}</span>}
              {engine.state !== "up" && (
                <span className={cn("whitespace-nowrap rounded-full bg-well px-2.5 py-0.5 text-[11px] font-semibold", engine.state === "starting" ? "text-ink-muted" : "text-hot")}>
                  {engine.state === "starting" ? "Starting Aria" : "Engine not running"}
                </span>
              )}
              {view === "mixcheck" && result && (
                <div className="inline-flex gap-0.5 rounded-full bg-well p-[3px]" role="group" aria-label="View">
                  {(["Simple", "Detailed"] as const).map((label) => {
                    const on = (label === "Detailed") === detailed;
                    return <button key={label} aria-pressed={on} onClick={() => setDetailed(label === "Detailed")}
                                   className={cn("h-[26px] rounded-full px-3 text-xs font-semibold", on ? "bg-[var(--card)] text-ink shadow" : "text-ink-muted")}>{label}</button>;
                  })}
                </div>
              )}
              <Button variant="primary" disabled={!!progress} onClick={checkMix}>{result ? "Check again" : "Check mix"}</Button>
            </div>
          </header>

          {view === "home" ? <Home result={result} engineUp={engine.state === "up"} onOpen={() => setView("mixcheck")} />
            : !result ? <Empty />
            : detailed ? <Detailed r={result} />
            : <Simple r={result} open={open} setOpen={setOpen} />}
        </main>
      </div>
    </div>
  );
}

function Rail({ view, setView }: { view: View; setView: (v: View) => void }) {
  const item = (id: View | null, label: string, icon: ReactNode) => (
    <button key={label} onClick={() => (id ? setView(id) : notice(`${label} is not ready yet.`))} aria-current={id === view ? "page" : undefined}
            className={cn("flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-semibold text-ink-muted",
                          id === view && "bg-[var(--card)] text-ink shadow")}>
      {icon}{label}
    </button>
  );
  return (
    <aside className="flex flex-col gap-5 border-r border-hairline px-4 py-[22px]">
      <div className="flex items-center gap-2.5"><Mark size={26} /><b className="text-sm tracking-tight">Aria</b></div>
      <nav className="grid gap-1" aria-label="Tools">
        {item("home", "Home", <House size={18} />)}
        {item("mixcheck", "Mix check", <AudioWaveform size={18} />)}
        {item(null, "Live analyzer", <ChartNoAxesColumn size={18} />)}
        {item(null, "Groove match", <Grip size={18} />)}
        {item(null, "Reference", <Columns2 size={18} />)}
      </nav>
      <div className="mt-auto grid gap-1.5">
        <Button variant="primary" className="h-11 w-full text-sm" onClick={() => notice("Ask Muse is coming next.")}><Mic size={16} /> Ask Muse</Button>
        <span className="text-xs text-ink-faint">or hold your mapped key</span>
      </div>
    </aside>
  );
}

function Home({ result, engineUp, onOpen }: { result: Result | null; engineUp: boolean; onOpen: () => void }) {
  const steps = ["Start the Aria engine", "Put Aria last on your Main track", "Play the busiest part of your song", "Press Check mix"];
  const done = [engineUp, false, false, !!result];
  return (
    <div className="grid grid-cols-12 gap-3">
      <LiquidGlass as="section" className="col-span-7 flex min-h-[340px] flex-col gap-3 p-5">
        <Cap>Get started</Cap>
        <h2 className="m-0 max-w-[440px] text-[28px] font-semibold leading-8 tracking-[-0.02em]">Make every sound in your mix easy to hear</h2>
        <p className="m-0 text-[13px] leading-[18px] text-ink-muted">Aria listens to your song, finds what's buried, muddy or clicking, and Muse Spark tells you how to fix it.</p>
        <ol className="m-0 mt-auto grid list-none gap-3 p-0">
          {steps.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2.5 text-sm", done[i] ? "text-ink" : "text-ink-muted")}>
              <i className={cn("grid size-[18px] place-items-center rounded-full border-2", done[i] ? "border-transparent bg-good" : "border-hairline")}>
                {done[i] && <svg viewBox="0 0 10 8" width="9" height="7"><path d="M1 4l2.5 2.5L9 1" stroke="var(--ground)" strokeWidth="2" fill="none" /></svg>}
              </i>{s}
            </li>
          ))}
        </ol>
      </LiquidGlass>
      <LiquidGlass as="section" className="col-span-5 flex min-h-[340px] flex-col gap-2.5 p-5">
        <Cap>Latest Mix check</Cap>
        {result ? (
          <>
            <h2 className="m-0 text-xl font-semibold leading-[25px]">{verdict(result)}</h2>
            <p className="m-0 text-[13px] leading-[18px] text-ink-muted">{result.advice?.summary ?? result.advice_error}</p>
            <Button variant="primary" className="mt-auto self-start" onClick={onOpen}>Open results</Button>
          </>
        ) : <p className="m-0 text-[13px] text-ink-muted">Nothing yet. Your latest result shows up here after you press Check mix.</p>}
      </LiquidGlass>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border-[1.5px] border-dashed border-hairline bg-well p-4 text-[13px] text-ink-muted">
      <b className="text-ink">No Mix check yet.</b> Play the busiest part of your song and press Check mix. Aria listens to 8 bars.
    </div>
  );
}

const verdict = (r: Result) => {
  const n = problemsOf(r).length;
  return n === 0 ? "Nothing sticks out" : n === 1 ? "1 thing to fix" : `${n} things to fix`;
};

function Simple({ r, open, setOpen }: { r: Result; open: number; setOpen: (i: number) => void }) {
  const list = problemsOf(r);
  return (
    <div className="grid grid-cols-12 gap-3">
      <LiquidGlass as="section" className="col-span-12 flex items-baseline gap-4 px-5 py-4">
        <span className="whitespace-nowrap text-2xl font-bold tracking-[-0.02em]">{verdict(r)}</span>
        <span className="text-sm text-ink-muted">{r.advice?.summary ?? r.advice_error}</span>
      </LiquidGlass>
      <LiquidGlass as="section" className="col-span-7 flex flex-col gap-2.5 p-5">
        <div className="flex items-center justify-between"><Cap>Where each part sits</Cap>
          <span className="text-xs text-ink-faint">{r.clarity.mode === "split" ? "Each part, split from your mix" : "Your whole mix"}</span></div>
        {r.clarity.spectra
          ? <Waves spectra={r.clarity.spectra} findings={r.clarity.findings} split={r.clarity.mode === "split"}
                   onZone={(f) => setOpen(list.findIndex((p) => p.findings.includes(f)))} />
          : <p className="text-xs text-ink-muted">The picture appears after the next Check mix.</p>}
      </LiquidGlass>
      <LiquidGlass as="section" className="col-span-5 flex flex-col gap-2 p-5">
        <Cap>What to fix</Cap>
        <Problems list={list} open={open} setOpen={setOpen} />
      </LiquidGlass>
    </div>
  );
}

function Stat({ label, value, unit, why }: { label: string; value: number | null | undefined; unit: string; why?: string }) {
  const missing = value === null || value === undefined;
  return (
    <div className="flex flex-col gap-0.5">
      <Cap>{label}</Cap>
      <span className={missing ? "text-[13px] leading-7 text-ink-faint" : "font-mono text-[22px] leading-7"} title={missing ? why : undefined}>
        {missing ? "Not measured" : <>{value}<small className="text-xs text-ink-muted"> {unit}</small></>}
      </span>
    </div>
  );
}

function Detailed({ r }: { r: Result }) {
  const m = r.measured, why = m.unmeasured;
  const f1 = (x: number | null | undefined) => (x === null || x === undefined ? null : Number(x.toFixed(1)));
  return (
    <div className="grid grid-cols-12 gap-3">
      <LiquidGlass as="section" className="col-span-7 flex flex-col gap-3 p-5">
        <Cap>The numbers</Cap>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-3">
          <Stat label="Loudness" value={f1(m.integrated_lufs)} unit="LUFS" why={why.integrated_lufs || why.all} />
          <Stat label="True peak" value={f1(m.true_peak_dbtp)} unit="dBTP" why={why.all} />
          {["bass", "mids", "treble"].map((b) => <Stat key={b} label={b} value={f1(m.bands_db[b])} unit="dB" why={why[`bands_db.${b}`] || why.all} />)}
          {["bass", "mids", "treble"].map((b) => <Stat key={"w" + b} label={`Width ${b}`} value={m.width[b] === null || m.width[b] === undefined ? null : Math.round(m.width[b]! * 100)} unit="%" why={why[`width.${b}`] || why.all} />)}
        </div>
        <p className="m-0 text-xs text-ink-faint">Loudness and peak are here for reference. Aria's advice is about clarity.</p>
      </LiquidGlass>
      {r.clarity.stems && (
        <LiquidGlass as="section" className="col-span-5 flex flex-col gap-3 p-5">
          <Cap>Each part against the mix</Cap>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {Object.entries(r.clarity.stems).map(([k, v]) => <Stat key={k} label={soundName(k)} value={f1(v)} unit="dB vs mix" />)}
          </div>
          <p className="m-0 text-xs text-ink-faint">Split by {r.clarity.split_by ?? "Demucs"}. A sound more than 20 dB under the mix counts as not playing.</p>
        </LiquidGlass>
      )}
      <LiquidGlass as="section" className="col-span-12 flex flex-col gap-2 p-5">
        <Cap>Everything Muse Spark said</Cap>
        <ul className="m-0 grid gap-1.5 pl-[18px] text-[13px] leading-[18px]">
          {r.advice ? r.advice.notes.map((n, i) => <li key={i}>{n.text}</li>) : <li className="text-ink-muted">{r.advice_error ?? "No advice."}</li>}
        </ul>
      </LiquidGlass>
    </div>
  );
}
