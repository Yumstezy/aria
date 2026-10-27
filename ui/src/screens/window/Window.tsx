// The Aria window, a floating window inside Live: Home and Mix check (Simple and Detailed).
// Picture first, a short line second, numbers and long text only when asked for (DESIGN.md).
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioWaveform, ChartNoAxesColumn, Columns2, Grip, House, Maximize2, Mic, PanelRight } from "lucide-react";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Button, Cap, Mark } from "@/components/brand";
import { Waves } from "@/components/waves";
import { GradientCard } from "@/components/ui/gradient-card";
import { TickGauge } from "@/components/tick-gauge";
import { CountUp } from "@/components/count-up";
import { Segmented } from "@/components/ui/segmented";
import { AskMuse, InlineAsk } from "@/components/ask-muse";
import { problemsOf, type Problem } from "@/lib/problems";
import { barsLabel, checkMix, describe, jumpTo, notice, setAskOpen, setWindowMode, soundName, useAria, useAriaSnapshot, type Result } from "@/lib/aria";
import { cn } from "@/lib/utils";

type View = "home" | "mixcheck";

// Side mode (a narrow panel beside Live) stacks everything in one column.
const NARROW_PX = 760;
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_PX);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < NARROW_PX);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return narrow;
}
const wide = (narrow: boolean, cls: string) => (narrow ? "col-span-12" : cls);

export function AriaWindow() {
  const { engine, progress, result, error, notice: note } = useAria();
  const [view, setView] = useState<View>("home");
  const [detailed, setDetailed] = useState(false);
  const [open, setOpen] = useState(0);
  const narrow = useNarrow();

  // A new result opens Mix check with the first problem ("fix first") open.
  useEffect(() => { if (result) { setView("mixcheck"); setOpen(0); } }, [result]);

  const status = progress ? `${progress.text}${progress.detail ? ` · ${progress.detail}` : ""}` : error ?? note;

  return (
    <div className={cn("aria-lights min-h-full", narrow ? "p-0" : "p-8")}>
      <div className={cn("grid overflow-hidden", narrow ? "h-screen grid-cols-1"
                         : "h-[calc(100vh-64px)] min-h-[700px] grid-cols-[184px_minmax(0,1fr)] rounded-[28px] shadow-[var(--shadow-tile),var(--shadow-rim)]")}
           style={{ background: "color-mix(in srgb, var(--glass) 55%, transparent)", backdropFilter: "blur(24px) saturate(140%)" }}>
        {!narrow && <Rail view={view} setView={setView} />}

        <main className={cn("flex min-w-0 flex-col gap-4 overflow-y-auto", narrow ? "p-3.5" : "p-[22px] pl-5")}>
          {narrow && (
            <div className="flex items-center gap-2">
              <Mark size={22} />
              <Segmented label="Screen" items={["Home", "Mix check"] as const} value={view === "home" ? "Home" : "Mix check"}
                         onChange={(v) => setView(v === "Home" ? "home" : "mixcheck")} />
              <button onClick={() => setWindowMode("full")} title="Full window" aria-label="Full window"
                      className="ml-auto grid size-8 place-items-center rounded-full text-ink-muted hover:bg-well"><Maximize2 size={15} /></button>
            </div>
          )}
          <header className={cn("flex justify-between gap-3", narrow ? "flex-col items-stretch" : "items-center")}>
            <div>
              <h1 className={cn("m-0 font-bold tracking-[-0.03em]", narrow ? "text-[22px] leading-7" : "text-[28px] leading-8")}>{view === "mixcheck" ? "Mix check" : "Home"}</h1>
              <span className="mt-0.5 block text-[15px] font-medium tracking-[-0.01em] text-ink-faint">
                {view === "mixcheck" && result ? barsLabel(result) : "This session"}
              </span>
            </div>
            <div className={cn("flex items-center gap-2.5", narrow && "flex-wrap")}>
              {status && <span className={cn("max-w-[360px] truncate text-xs", error ? "text-hot" : "text-ink-muted", narrow && "basis-full")} role="status">{status}</span>}
              {engine.state !== "up" && (
                <span className={cn("whitespace-nowrap rounded-full bg-well px-2.5 py-0.5 text-[11px] font-semibold", engine.state === "starting" ? "text-ink-muted" : "text-hot")}>
                  {engine.state === "starting" ? "Starting Aria" : "Engine not running"}
                </span>
              )}
              {view === "mixcheck" && result && (
                <Segmented label="View" items={["Simple", "Detailed"] as const} value={detailed ? "Detailed" : "Simple"} onChange={(v) => setDetailed(v === "Detailed")} />
              )}
              <Button variant="primary" disabled={!!progress} onClick={checkMix}>{result ? "Check again" : "Check mix"}</Button>
              {!narrow && (
                <button onClick={() => setWindowMode("side")} title="Dock beside Live" aria-label="Dock beside Live"
                        className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-well"><PanelRight size={17} /></button>
              )}
            </div>
          </header>

          {view === "home" ? <Home result={result} engineUp={engine.state === "up"} onOpen={() => setView("mixcheck")} narrow={narrow} />
            : !result ? <Empty />
            : detailed ? <Detailed r={result} narrow={narrow} />
            : <Simple r={result} open={open} setOpen={setOpen} narrow={narrow} />}
          {view === "mixcheck" && <InlineAsk />}
        </main>
      </div>
      <AskMuse narrow={narrow} />
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
        <Button variant="primary" className="h-11 w-full text-sm" onClick={() => setAskOpen(!useAriaSnapshot().ask.open)}><Mic size={16} /> Ask Muse</Button>
        <span className="text-xs text-ink-faint">or hold your mapped key</span>
      </div>
    </aside>
  );
}

function Home({ result, engineUp, onOpen, narrow }: { result: Result | null; engineUp: boolean; onOpen: () => void; narrow: boolean }) {
  const steps = ["Start the Aria engine", "Put Aria last on your Main track", "Play the busiest part of your song", "Press Check mix"];
  const done = [engineUp, false, false, !!result];
  return (
    <div className="grid grid-cols-12 gap-3">
      <LiquidGlass as="section" className={cn(wide(narrow, "col-span-7"), "flex min-h-[340px] flex-col gap-3 p-5")}>
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
      <LiquidGlass as="section" className={cn(wide(narrow, "col-span-5"), "flex flex-col gap-2.5 p-5", !narrow && "min-h-[340px]")}>
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
      <b className="text-ink">No Mix check yet.</b> Play the busiest part of your song and press Check mix. Aria listens to 16 bars.
    </div>
  );
}

const verdict = (r: Result) => {
  const n = problemsOf(r).length;
  return n === 0 ? "Nothing sticks out" : n === 1 ? "1 thing to fix" : `${n} things to fix`;
};

const EASE = [0.32, 0.72, 0, 1] as const;

/** Cards rise in one after another when a result arrives. */
function Rise({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ opacity: { duration: 0.7, delay: i * 0.06 }, default: { duration: 0.9, ease: EASE, delay: i * 0.06 } }}>
      {children}
    </motion.div>
  );
}

function Simple({ r, open, setOpen, narrow }: { r: Result; open: number; setOpen: (i: number) => void; narrow: boolean }) {
  const list = problemsOf(r);
  const selected = list[open];
  const span = narrow ? (list.length > 1 ? "col-span-6" : "col-span-12")
    : list.length >= 4 ? "col-span-3" : list.length === 3 ? "col-span-4" : list.length === 2 ? "col-span-6" : "col-span-12";

  return (
    <div className="grid grid-cols-12 gap-3.5">
      <Rise i={0} className={wide(narrow, "col-span-8")}>
        <GradientCard className={cn("flex h-full flex-col gap-2", narrow ? "px-4 py-4" : "min-h-[376px] px-6 py-5")}>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold tracking-[-0.02em]">Where each part sits</span>
            <span className="text-xs text-ink-faint">{r.clarity.mode === "split" ? "Hover to see each part's level" : "Your whole mix"}</span>
          </div>
          {r.clarity.spectra
            ? <Waves spectra={r.clarity.spectra} findings={r.clarity.findings} split={r.clarity.mode === "split"}
                     onZone={(f) => setOpen(list.findIndex((p) => p.findings.includes(f)))} />
            : <p className="text-xs text-ink-muted">The picture appears after the next Check mix.</p>}
        </GradientCard>
      </Rise>

      <Rise i={1} className={wide(narrow, "col-span-4")}>
        <LiquidGlass as="section" radius="28px" className={cn("flex h-full flex-col", narrow ? "px-4 py-4" : "min-h-[376px] px-6 py-5")}>
          <Cap>This check</Cap>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-[64px] font-extralight leading-none tracking-[-0.04em] tabular-nums"><CountUp value={list.length} /></span>
            <span className="pb-2 text-base font-medium text-ink-muted">{list.length === 0 ? "things stick out" : list.length === 1 ? "thing to fix" : "things to fix"}</span>
          </div>
          <p className="m-0 mt-3 line-clamp-3 text-[13px] leading-[18px] text-ink-muted">{r.advice?.summary ?? r.advice_error}</p>
          <div className={narrow ? "mt-3" : "mt-auto"}>
            {list.map((p, i) => (
              <button key={i} onClick={() => setOpen(i)}
                      className={cn("flex h-[34px] w-full items-center gap-3 text-left", i > 0 && "border-t border-hairline")}>
                <i className="size-2 rounded-full bg-watch" />
                <span className="flex-1 text-[13px] font-semibold">{p.name}</span>
                <span className="font-mono text-[13px] text-ink-muted">{p.amount.unit.startsWith("%") ? `${p.amount.value}%` : p.amount.unit === "dB under" ? `−${p.amount.value} dB` : `${p.amount.value} dB`}</span>
              </button>
            ))}
            {list.length === 0 && <p className="m-0 text-[13px] text-good">Clear in these bars.</p>}
          </div>
        </LiquidGlass>
      </Rise>

      {list.map((p, i) => (
        <Rise key={p.name + i} i={2 + i} className={span}>
          <ProblemTile p={p} selected={open === i} onSelect={() => setOpen(open === i ? -1 : i)} />
        </Rise>
      ))}

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div key={open} className="col-span-12" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.25, ease: EASE }}>
            <ProblemDetail p={selected} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProblemTile({ p, selected, onSelect }: { p: Problem; selected: boolean; onSelect: () => void }) {
  return (
    <LiquidGlass as="section" radius="28px" interactive onClick={onSelect}
                 className={cn("flex h-[184px] flex-col px-5 py-4 transition-shadow", selected && "ring-2 ring-[var(--watch)]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{p.name}</span>
        <span className="whitespace-nowrap rounded-full bg-black/40 px-2 font-mono text-[11px] leading-[22px] text-white">{p.where}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[40px] font-extralight leading-none tracking-[-0.04em] tabular-nums">
          {p.amount.value.startsWith("+") && "+"}<CountUp value={Math.abs(parseFloat(p.amount.value))} decimals={p.amount.value.includes(".") ? 1 : 0} />
        </span>
        <span className="text-xs font-medium text-ink-faint">{p.amount.unit}</span>
      </div>
      <p className="m-0 mt-2 line-clamp-1 text-[12.5px] text-ink-muted">{p.short}</p>
      <div className="mt-auto"><TickGauge share={p.share} label={p.shareLabel} /></div>
    </LiquidGlass>
  );
}

function ProblemDetail({ p }: { p: Problem }) {
  return (
    <LiquidGlass as="section" radius="28px" className="flex flex-col gap-3 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-lg font-semibold tracking-[-0.02em]">{p.name}</span>
        <div className="flex gap-2">
          <Button small className="bg-well text-ink" onClick={() => jumpTo(p.bar)}>Hear it in Live</Button>
          {p.fix && <Button small variant="primary" onClick={() => notice("Fix it for me is coming next.")}>Fix it for me</Button>}
        </div>
      </div>
      {p.notes.length
        ? p.notes.map((n, k) => <p key={k} className="m-0 max-w-[760px] text-[13.5px] leading-5">{n.text}</p>)
        : <p className="m-0 text-[13px] text-ink-muted">{describe(p.findings[0]).about}</p>}
      <div className="flex flex-wrap gap-1.5">
        {p.findings.map((f, k) => {
          const d = describe(f);
          return <span key={k} className="whitespace-nowrap rounded-full bg-well px-2 font-mono text-[11px] leading-5 text-ink-muted">
            {d.where} · {d.size} · bars {f.bars[0]}{f.bars[1] !== f.bars[0] ? `–${f.bars[1]}` : ""}</span>;
        })}
      </div>
    </LiquidGlass>
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

function Detailed({ r, narrow }: { r: Result; narrow: boolean }) {
  const m = r.measured, why = m.unmeasured;
  const f1 = (x: number | null | undefined) => (x === null || x === undefined ? null : Number(x.toFixed(1)));
  return (
    <div className="grid grid-cols-12 gap-3">
      <LiquidGlass as="section" className={cn(wide(narrow, "col-span-7"), "flex flex-col gap-3 p-5")}>
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
        <LiquidGlass as="section" className={cn(wide(narrow, "col-span-5"), "flex flex-col gap-3 p-5")}>
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
