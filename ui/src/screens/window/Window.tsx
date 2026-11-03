// The Aria window: the side rail and the bento (design/screens/11 and 12), Home and Mix check
// (Simple and Detailed). Picture first, a short line second, numbers when asked for (DESIGN.md).
// Before the first check every card shows its layout greyed out and says what comes next.
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mark } from "@/components/brand";
import { Waves } from "@/components/waves";
import { TickGauge } from "@/components/tick-gauge";
import { CountUp } from "@/components/count-up";
import { AskMuse } from "@/components/ask-muse";
import { MiniWaves } from "@/components/mini-waves";
import { GlowCard, type Accent } from "@/components/ui/glow-card";
import { RefChart, RefLegend, THEIRS, YOURS } from "@/components/ref-chart";
import { Plot, PlotGrid, dbTicksOf, plotX, tilt } from "@/components/plot";
import { path } from "@/components/waves";
import { ProblemThumb } from "@/components/problem-thumb";
import { GrooveScreen } from "./Groove";
import { KINDS, KindMark, findingIcon, rangeOf } from "@/components/problem-mark";
import { AnalyzerIcon, ArrangementIcon, BackIcon, BuriedIcon, ClashIcon, ChatIcon, CheckIcon, ClickIcon, CloseIcon, DockLeftIcon, DockRightIcon, EarIcon, ExpandIcon, GrooveIcon, LayoutIcon, MinimizeIcon, HarshIcon, HomeIcon, MicIcon, MixIcon, MoonIcon, MudIcon,
         ReferenceIcon, RingIcon, SunIcon, SwapIcon, GoodMixIcon } from "@/components/icons";
import { BANDS, bandsWith, barsOf, problemsOf, statusWord, type Problem } from "@/lib/problems";
import { fixAgain, heardFixed, problemKey, send, undoLast, wantsMore, type Exchange, type FixState, type GoodMixes, type GoodMixFeature } from "@/lib/aria";
import { onScope } from "@/lib/aria";
import { ANALYZER_HZ, askMuse, addArrangementMarkers, barsLabel, checkMix, clearReference, editArrangement, hearSong, onAnalyzer, recheck, stopHearing, closeChat, closeWindow, fixIt, hz, hzRange, jumpTo, shortName, lastDock, listenTracks, minimize, notice, openChat, referenceOf, restore, setAskOpen, setReferenceFile, setTheme, setWindowMode, stopListening,
         partColor, partNames, soundName, useAria, useAriaSel, useViewport, type Kind, type Part, type RefCompare, type Result, type SongParts } from "@/lib/aria";
import { cn } from "@/lib/utils";

type View = "home" | "mixcheck" | "arrangement" | "analyzer" | "groove" | "reference";

// Docked (a narrow panel beside Live) keeps the rail as icons and stacks the bento in one column.
// Short as well as narrow means Ask Muse is popped out under it: show only what to fix.
const NARROW_PX = 760, COMPACT_PX = 480, TAB_PX = 120;
const span = (narrow: boolean, n: number) => (narrow ? "span-12" : `span-${n}`);
const n = (v: number) => ({ "--n": v }) as CSSProperties;

export function AriaWindow() {
  const { engine, progress, result, error, notice: note, session } = useAria();
  const [view, setView] = useState<View>("home");
  const [grooveMode, setGrooveMode] = useState<"loops" | "vocal">("loops");
  // Ask Muse ran a groove match or a vocal sync: show its result
  const goto = useAriaSel((s) => s.goto);
  useEffect(() => {
    if (goto?.view === "groove") { setView("groove"); setGrooveMode(goto.mode === "vocal" ? "vocal" : "loops"); }
  }, [goto?.n]);
  const [detailed, setDetailed] = useState(false);
  const [open, setOpen] = useState(0);
  const [width, height] = useViewport();
  const narrow = width < NARROW_PX, compact = narrow && height < COMPACT_PX;
  // Docked and compact windows float over Live: glass that shows Live through it
  useEffect(() => { document.documentElement.classList.toggle("see-through", narrow); }, [narrow]);

  // A new result opens Mix check with the first problem ("fix first") open.
  // A new result opens Mix check with Fix first open. The same result sent again (a page loading) changes nothing.
  const resultPath = result?.recording.path;
  useEffect(() => { if (resultPath) { setView("mixcheck"); setOpen(0); } }, [resultPath]);
  const openMixCheck = useCallback(() => setView("mixcheck"), []);

  if (width < TAB_PX) return <MinTab />;
  if (compact) return <Compact />;

  const status = progress ? `${progress.text}${progress.detail ? ` · ${progress.detail}` : ""}` : error ?? note;
  // The one setup step that can go wrong after install: Aria hears only what comes before it on Main
  const chain = session?.chain;
  const placeWarning = chain && !chain.on_main ? "Put Aria on Main" : chain?.after.length ? "Move Aria last on Main" : null;
  // The check ran off the end of the song: say so, so the empty last bars aren't a mystery
  const silentBars = result?.song_end_bar && result.start_bar ? result.start_bar + (result.recording.bars || 16) - 1 - result.song_end_bar : 0;
  const pastEnd = view === "mixcheck" && silentBars > 0
    ? `Your song ends at bar ${result!.song_end_bar}, so ${silentBars === 1 ? "the last bar was" : `the last ${silentBars} bars were`} silence.` : null;

  return (
    <div className={cn("cp-stage", narrow && "is-flush")} style={narrow ? undefined : { height: "100vh", minHeight: 0 }}>
      <div className="cp-glass cp-window" style={{ height: narrow ? "100vh" : "100%", gridTemplateColumns: narrow ? "60px minmax(0, 1fr)" : undefined }}>
        <Rail view={view} setView={setView} narrow={narrow} />
        <main className="cp-main overflow-y-auto" style={narrow ? { padding: 14 } : undefined}>
          <header className="grid gap-2">
            <div className="flex items-center gap-2.5" style={{ minHeight: 32 }}>
              <span className="flex items-center gap-2 text-[14px] text-ink-muted">
                {view === "mixcheck" ? <MixIcon style={{ width: 16, height: 16 }} /> : view === "reference" ? <ReferenceIcon style={{ width: 16, height: 16 }} />
                  : view === "arrangement" ? <ArrangementIcon style={{ width: 16, height: 16 }} /> : view === "analyzer" ? <AnalyzerIcon style={{ width: 16, height: 16 }} />
                  : view === "groove" ? <GrooveIcon style={{ width: 16, height: 16 }} />
                  : <HomeIcon style={{ width: 16, height: 16 }} />}
                {view === "mixcheck" ? "Mix check" : view === "reference" ? "Reference" : view === "arrangement" ? "Arrangement" : view === "analyzer" ? "Live analyzer" : view === "groove" ? "Groove match" : "Home"}</span>
              <div className="ml-auto flex items-center gap-2">
                {!narrow && view === "mixcheck" && result && (
                  <div className="cp-seg" role="group" aria-label="View">
                    <button aria-pressed={!detailed} onClick={() => setDetailed(false)}>Simple</button>
                    <button aria-pressed={detailed} onClick={() => setDetailed(true)}>Detailed</button>
                  </div>
                )}
                <button className="cp-btn cp-btn-primary" disabled={!!progress} onClick={checkMix}>{progress ? "Checking" : result ? (narrow ? "Check" : "Check again") : "Check mix"}</button>
                {narrow ? (
                  <>
                    <LayoutMenu mode={lastDock()} />
                    <IconButton label="Minimize to the edge" onClick={minimize}><MinimizeIcon style={{ width: 15, height: 15 }} /></IconButton>
                    <IconButton label="Close" onClick={closeWindow}><CloseIcon style={{ width: 15, height: 15 }} /></IconButton>
                  </>
                ) : <LayoutMenu mode="full" />}
              </div>
            </div>
            {view !== "home" && <h1 className="cp-title" style={{ fontSize: narrow ? 28 : 34, lineHeight: narrow ? "34px" : "40px" }}>
              {view === "mixcheck" ? (result ? barsLabel(result) : "Not checked yet") : view === "reference" ? "Reference" : view === "arrangement" ? "Arrangement" : view === "analyzer" ? "Live analyzer" : view === "groove" ? "Groove match" : "Home"}
              <span className="text-ink-faint">{view === "mixcheck" ? (result ? `${result.part ? ` ${result.part}` : ""}${result.recording.tempo ? ` ${Math.round(result.recording.tempo)} BPM` : ""}` : "")
                : view === "reference" || view === "arrangement" || view === "analyzer" ? "" : session ? ` ${Math.round(session.tempo)} BPM` : ""}</span>
            </h1>}
            {narrow && view === "mixcheck" && result && (
              <div className="cp-seg justify-self-start" role="group" aria-label="View">
                <button aria-pressed={!detailed} onClick={() => setDetailed(false)}>Simple</button>
                <button aria-pressed={detailed} onClick={() => setDetailed(true)}>Detailed</button>
              </div>
            )}
          </header>
          {(status || engine.state !== "up" || placeWarning || pastEnd) && (
            <div className="cp-row flex-wrap" role="status">
              {engine.state !== "up" && <span className={cn("cp-tag", engine.state === "starting" ? "cp-tag-idle" : "cp-tag-hot")}>{engine.state === "starting" ? "Starting Aria" : "Engine not running"}</span>}
              {placeWarning && <span className="cp-tag cp-tag-hot" title="Aria only hears what comes before it on the Main track.">{placeWarning}</span>}
              {pastEnd && <span className="cp-meta">{pastEnd}</span>}
              {status && <span className="cp-meta" style={error ? { color: "var(--hot)" } : undefined}>{status}</span>}
            </div>
          )}

          {(view === "home" || view === "mixcheck") && <KeyTracks />}
          {view === "home" ? <Home narrow={narrow} onOpen={openMixCheck} go={setView} />
            : view === "arrangement" ? <ArrangementScreen narrow={narrow} onReference={() => setView("reference")} />
            : view === "analyzer" ? <LiveAnalyzer narrow={narrow} />
            : view === "groove" ? <GrooveScreen narrow={narrow} mode={grooveMode} setMode={setGrooveMode} />
            : view === "reference" ? <ReferenceScreen narrow={narrow} onOpen={openMixCheck} />
            : !result ? <EmptyCheck narrow={narrow} />
            : detailed ? <Detailed r={result} narrow={narrow} />
            : <Simple r={result} open={open} setOpen={setOpen} narrow={narrow} />}
        </main>
        <AskMuse narrow={narrow} />
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button className="cp-icon-btn" style={{ width: 32, height: 32, borderRadius: 10, background: pressed ? "var(--well)" : "transparent" }}
            title={label} aria-label={label} aria-expanded={pressed} onClick={onClick}>{children}</button>
  );
}

/** Every way to lay out the window, in one place: full, docked left or right, and Ask Muse popped out or back.
    The current layout is ticked. Minimize and close sit beside it as their own buttons (Ian). */
function LayoutMenu({ mode, chatOut }: { mode: "full" | "left" | "right"; chatOut?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", away);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", away); };
  }, [open]);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const item = (label: string, icon: ReactNode, fn: () => void, on = false) => (
    <button key={label} role="menuitemradio" aria-checked={on} onClick={pick(fn)}
            className="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-semibold hover:bg-well"
            style={{ color: on ? "var(--ink)" : "var(--ink-muted)" }}>
      <span style={{ width: 16, height: 16, display: "grid", placeItems: "center" }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {on && <CheckIcon style={{ width: 14, height: 14, color: "var(--action)" }} />}
    </button>
  );
  return (
    <div ref={box} className="relative">
      <IconButton label="Layout" pressed={open} onClick={() => setOpen(!open)}><LayoutIcon style={{ width: 17, height: 17 }} /></IconButton>
      {open && (
        <div role="menu" aria-label="Layout" className="absolute right-0 top-10 z-[950] w-[224px]"
             style={{ background: "var(--card)", border: "1px solid var(--card-edge)", borderRadius: 16, boxShadow: "var(--shadow-tile)", padding: 6 }}>
          {item("Full window", <ExpandIcon style={{ width: 15, height: 15 }} />, () => setWindowMode("full"), mode === "full" && !chatOut)}
          {item("Docked left", <DockLeftIcon style={{ width: 16, height: 16 }} />, () => setWindowMode("left"), mode === "left" && !chatOut)}
          {item("Docked right", <DockRightIcon style={{ width: 16, height: 16 }} />, () => setWindowMode("right"), mode === "right" && !chatOut)}
          <div style={{ height: 1, background: "var(--hairline)", margin: "6px 4px" }} />
          {chatOut ? item("Back to one window", <BackIcon style={{ width: 14, height: 14 }} />, closeChat)
                   : item("Pop out Ask Muse", <ChatIcon style={{ width: 15, height: 15 }} />, openChat)}
        </div>
      )}
    </div>
  );
}

/** The side menu (Ember, Oct 29): Ask Muse first, then where to go, then the tracks Aria heard, each with how
    many problems it's in. Docked, it's icons only. Every planned tool is listed (Ian); the unbuilt ones are dimmed and say coming soon when tapped. */
const Rail = memo(function Rail({ view, setView, narrow }: { view: View; setView: (v: View) => void; narrow: boolean }) {
  const theme = useAriaSel((s) => s.theme), askOpen = useAriaSel((s) => s.ask.open), result = useAriaSel((s) => s.result);
  const list = useTodo(result);
  const spectra = result?.clarity.spectra, names = spectra ? partNames(spectra) : [];
  const tracksMode = (result?.clarity.mode as string) === "tracks";
  const silent = spectra && tracksMode ? Object.keys(spectra.parts).filter((k) => !spectra.parts[k]) : [];
  const count = (name: string) => list.filter((p) => p.findings.some((f) => f.tracks?.includes(name) || f.masked === name || (f.kind === "bass_click" && name === "bass"))).length;
  const item = (id: View | null, label: string, icon: ReactNode, end?: ReactNode) => (
    <a key={label} href="#" title={id ? label : `${label}: coming soon`} aria-current={id === view ? "page" : undefined}
       style={{ ...(narrow ? { justifyContent: "center", padding: 0 } : {}), ...(id ? {} : { opacity: 0.45 }) }}
       onClick={(e: MouseEvent) => { e.preventDefault(); if (id) setView(id); else notice(`${label} is coming soon.`); }}>
      {icon}{!narrow && <span className="truncate">{label}</span>}{!narrow && end}
    </a>
  );
  return (
    <aside className="cp-rail" style={narrow ? { padding: "16px 8px", alignItems: "stretch", gap: 6 } : undefined}>
      <div className="cp-mark" style={narrow ? { justifyContent: "center", marginBottom: 8 } : { padding: "0 8px 12px" }}><Mark size={narrow ? 24 : 22} />{!narrow && <b style={{ fontSize: 17, fontWeight: 600 }}>Aria</b>}</div>
      {!narrow && (
        <button className="flex h-10 items-center gap-2.5 whitespace-nowrap rounded-[11px] border px-2.5 text-[14px] text-ink-muted" aria-expanded={askOpen}
                style={{ borderColor: "var(--glass-edge)", background: "var(--card)" }} onClick={() => setAskOpen(!askOpen)}
                title="In Live, press Cmd+K, click Ask key on the Aria strip, then press a key.">
          <MicIcon style={{ width: 16, height: 16 }} />Ask Muse
          <span className="ml-auto rounded-md border px-1.5 font-mono text-[11px]" style={{ borderColor: "var(--glass-edge)" }}>key</span>
        </button>
      )}
      {!narrow && <div className="ae-sec" style={{ borderTop: 0 }}>Navigation</div>}
      <nav className="cp-nav" aria-label="Tools">
        {item("home", "Home", <HomeIcon />)}
        {item("mixcheck", "Mix check", <MixIcon />, list.length ? <span className="ae-count">{list.length}</span> : null)}
        {/* Ian, Oct 31: the tools in the order they're used */}
        {item("groove", "Groove match", <GrooveIcon />)}
        {item("reference", "Reference", <ReferenceIcon />)}
        {item("arrangement", "Arrangement", <ArrangementIcon />)}
        {item("analyzer", "Live analyzer", <AnalyzerIcon />)}
      </nav>
      {!narrow && names.length > 0 && (
        <>
          <div className="ae-sec">{tracksMode ? "Your tracks" : "Parts Aria heard"}</div>
          <div className="cp-nav">
            {names.map((name, i) => (
              <a key={name} href="#" title={soundName(name)} onClick={(e) => { e.preventDefault(); setView("mixcheck"); }}>
                <span className="ae-dot" style={{ color: partColor(name, i) }} /><span className="truncate">{soundName(name)}</span><span className="ae-count">{count(name)}</span>
              </a>
            ))}
            {silent.map((name) => (
              <a key={name} href="#" style={{ color: "var(--ink-faint)" }} title={`${name} was silent in these bars`} onClick={(e) => e.preventDefault()}>
                <span className="ae-dot" style={{ color: "var(--track)" }} /><span className="truncate">{name}</span><span className="ae-count">silent</span>
              </a>
            ))}
          </div>
        </>
      )}
      {narrow ? (
        <>
          <button className="cp-icon-btn" style={{ marginTop: "auto", alignSelf: "center", background: "transparent" }} title={theme === "sky" ? "Switch to dark" : "Switch to light"}
                  aria-label={theme === "sky" ? "Switch to dark" : "Switch to light"} onClick={() => setTheme(theme === "sky" ? "night" : "sky")}>
            {theme === "sky" ? <MoonIcon /> : <SunIcon />}
          </button>
          <button className="cp-ask-btn" aria-expanded={askOpen} aria-label="Ask Muse" style={{ justifyContent: "center", padding: 0 }} onClick={() => setAskOpen(!askOpen)}><MicIcon /></button>
        </>
      ) : (
        <div className="cp-seg" role="group" aria-label="Appearance" style={{ marginTop: "auto", display: "flex" }}>
          <button className="flex-1" aria-pressed={theme === "sky"} onClick={() => setTheme("sky")}>Light</button>
          <button className="flex-1" aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Dark</button>
        </div>
      )}
    </aside>
  );
});

// ---------- Home ----------

/** Home, like the website (Ian, Oct 29: "the website should be your reference"): a big calm headline that says the
    state of the song in words, then cards. Before a check, what Aria listens for; after one, what to fix, each a card
    that opens Mix check on it. Then the two other places: Arrangement and Reference. */
const Home = memo(function Home({ narrow, onOpen, go }: { narrow: boolean; onOpen: () => void; go: (v: View) => void }) {
  const result = useAriaSel((s) => s.result), progress = useAriaSel((s) => !!s.progress);
  const arr = useAriaSel((s) => s.arrangement), ref = useAriaSel(referenceOf);
  const list = useTodo(result);
  const accentOf = (p: Problem): Accent => (compared(p) ? (refColor(p) === YOURS ? "gold" : "blue") : "hot");
  const chip = { width: 36, height: 36, borderRadius: 11 };
  return (
    <div className="grid gap-10 pt-2">
      <div className="grid gap-4">
        <h2 className="m-0 font-medium tracking-[-0.035em]" style={{ fontSize: narrow ? 34 : 52, lineHeight: 1.04 }}>
          {!result ? <>Your mix, checked.<br /><span className="text-ink-faint">Play the busiest part, press Check.</span></>
            : list.length ? <>{list.length} {list.length === 1 ? "thing" : "things"} to fix<br /><span className="text-ink-faint">in {barsLabel(result).toLowerCase()}{result.part ? `, your ${result.part.toLowerCase()}` : ""}.</span></>
            : <>Nothing sticks out.<br /><span className="text-ink-faint">Check another part next.</span></>}
        </h2>
        {!result && <div><button className="cp-btn cp-btn-primary" disabled={progress} onClick={checkMix}>{progress ? "Checking" : "Check mix"}</button></div>}
      </div>

      {result && list.length > 0 ? (
        <div className={cn("grid gap-3", narrow ? "grid-cols-1" : "grid-cols-3")}>
          {list.slice(0, 6).map((p, i) => (
            <button key={i} className="text-left" onClick={onOpen}>
              <GlowCard accent={accentOf(p)} className="h-full">
                <span className="ae-kind" style={{ ...chip, color: colorOf(p) }}>{iconFor(p)}</span>
                <b className="mt-4 text-[16.5px] font-medium leading-snug">{p.name}</b>
                <span className="ae-mono mt-1">{p.where}</span>
                <span className="ae-mono mt-auto pt-3" style={{ color: compared(p) ? refColor(p) : "var(--hot)" }}>{amountText(p)}</span>
              </GlowCard>
            </button>
          ))}
        </div>
      ) : !result && (
        <div className={cn("grid gap-3", narrow ? "grid-cols-2" : "grid-cols-6")}>
          {KINDS.map((k) => (
            <GlowCard key={k.kind} accent="white" className="h-full">
              <span className="ae-kind is-idle" style={chip}>{k.icon}</span>
              <b className="mt-4 text-[14.5px] font-medium leading-snug">{k.name}</b>
            </GlowCard>
          ))}
        </div>
      )}

      {!narrow ? <HomeTools go={go} /> : <div className="grid grid-cols-1 gap-3">
        <button className="text-left" onClick={() => go("arrangement")}>
          <GlowCard accent="gold" className="h-full">
            <div className="flex items-center gap-3"><span className="ae-kind is-idle" style={chip}><ArrangementIcon /></span><b className="text-[16.5px] font-medium">Arrangement</b></div>
            <p className="m-0 mt-3 text-[14px] leading-relaxed text-ink-muted">
              {arr?.mine && !arr.mine.error ? arr.mine.sections.map((x) => x.name ?? `Part ${x.label}`).join(", ") : "Aria hears your whole song and names its parts."}</p>
          </GlowCard>
        </button>
        <button className="text-left" onClick={() => go("reference")}>
          <GlowCard accent="blue" className="h-full">
            <div className="flex items-center gap-3"><span className="ae-kind is-idle" style={chip}><ReferenceIcon /></span><b className="text-[16.5px] font-medium">Reference</b></div>
            <p className="m-0 mt-3 truncate text-[14px] leading-relaxed text-ink-muted">{ref ? `Comparing with ${ref.name}` : "Pick a song you love, see how yours compares."}</p>
          </GlowCard>
        </button>
      </div>}
    </div>
  );
});

/** Home, full window only (Ian, Oct 31): Reference, Arrangement and the Live analyzer on Home itself, each as it looks
    on its own screen, small, with Open. Docked, Home keeps the two short cards. Plain cards, no glow (the glow lags). */
function HomeTools({ go }: { go: (v: View) => void }) {
  const result = useAriaSel((s) => s.result), arr = useAriaSel((s) => s.arrangement), ref = useAriaSel(referenceOf), hearing = useAriaSel((s) => s.hearing);
  const head = (icon: ReactNode, title: string, view: View, extra?: ReactNode) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="ae-kind is-idle" style={{ width: 30, height: 30 }}>{icon}</span>
      <b className="text-[15px] font-medium">{title}</b>
      {extra && <span className="min-w-0 truncate text-[12.5px] text-ink-muted">{extra}</span>}
      <button className="cp-btn cp-btn-sm ml-auto" onClick={() => go(view)}>Open</button>
    </div>
  );
  const parts = arr?.mine && !arr.mine.error ? arr.mine.sections : null;
  const total = parts ? parts.reduce((n, p) => n + p.bars, 0) || 1 : 1;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
      <section className="cp-tile cp-card" style={{ gap: 10 }}>
        {head(<ReferenceIcon />, "Reference", "reference", ref?.name)}
        {result?.reference?.curve ? (
          <>
            <RefLegend name={result.reference.name} />
            <RefChart r={result.reference} height={170} />
          </>
        ) : <p className="cp-meta m-0">{ref ? "Check your mix to compare it with this song." : "Pick a song you love to see how yours compares."}</p>}
      </section>
      <section className="cp-tile cp-card" style={{ gap: 12 }}>
        {head(<ArrangementIcon />, "Arrangement", "arrangement", parts ? `${total} bars` : undefined)}
        {parts ? (
          <>
            {/* the parts as blocks, sized by bars, in the Arrangement screen's colors */}
            <div className="flex h-12 gap-[3px] overflow-hidden rounded-[10px]">
              {parts.map((p, i) => (
                <span key={i} title={`${partName(p)}, bars ${p.start_bar} to ${p.start_bar + p.bars - 1}`} className="relative min-w-[6px] rounded-[6px]"
                      style={{ flex: p.bars, background: `color-mix(in srgb, ${partColor_(p)} 28%, transparent)`, boxShadow: `inset 0 3px 0 ${partColor_(p)}` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {parts.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                  <span className="ae-dot" style={{ color: partColor_(p) }} />{partName(p)}<span className="font-mono text-[11px] text-ink-faint">{p.start_bar}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <p className="cp-meta m-0">Aria hears your whole song once and names its parts.</p>
            <div><button className="cp-btn cp-btn-sm" disabled={!!hearing && hearing.step !== "error"} onClick={hearSong}>{hearing && hearing.step !== "error" ? hearing.text : "Hear the whole song"}</button></div>
          </div>
        )}
      </section>
      <div style={{ gridColumn: "1 / -1" }}><LiveAnalyzer narrow={false} compact onOpen={() => go("analyzer")} /></div>
    </div>
  );
}

/* ---------- Arrangement (build step 8b) ---------- */

// One color per kind of part, the same in both songs, so your drop and their drop match at a glance
// Each kind of part its own color (Ian, Oct 30: "use some different colors to represent different things"); drops gold
const PART_COLOR: Record<string, string> = {
  Intro: "var(--trk-5)", Build: "var(--trk-4)", Drop: "var(--trk-0)", Break: "var(--trk-1)", Bridge: "var(--trk-2)", Outro: "var(--trk-3)",
};
const LABEL_COLOR = ["var(--trk-1)", "var(--trk-0)", "var(--trk-2)", "var(--trk-3)", "var(--trk-4)", "var(--trk-5)"];
const partColor_ = (p: Part) => (p.name ? PART_COLOR[p.name] : LABEL_COLOR[(p.label.charCodeAt(0) - 65) % LABEL_COLOR.length]);
const partName = (p: Part) => p.name ?? `Part ${p.label}`;

const timeOf = (bars: number, tempo: number | null) => {
  if (!tempo) return "";
  const sec = Math.round((bars * 4 * 60) / tempo);
  return ` · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

/** One song's parts, like clips in Ableton's Arrangement: each part a block with a colored name strip on its own
    full-width timeline (songs differ in length and tempo, so they're matched by name, not by bar), the bar each part
    starts on under it, and the parts as a list, which carries the words when the window is narrow. */
const PART_NAMES = ["Intro", "Build", "Drop", "Break", "Bridge", "Outro"];

function SongLane({ title, song, narrow, outline, editable }: { title: string; song: SongParts; narrow: boolean; outline?: (p: Part) => boolean; editable?: boolean }) {
  const parts = song.sections, total = parts.reduce((n, p) => n + p.bars, 0) || 1;
  const rename = (i: number, name: string) => editArrangement(parts.map((p, k) => (k === i ? { ...p, name } : p)));
  // Move where part i starts: the part before it grows or shrinks to match, no part under 4 bars
  const move = (i: number, d: number) => editArrangement(parts.map((p, k) =>
    k === i - 1 ? { ...p, bars: p.bars + d } : k === i ? { ...p, start_bar: p.start_bar + d, bars: p.bars - d } : p));
  const first = parts[0]?.start_bar ?? 1;
  const at = (bar: number) => ((bar - first) / total) * 100;
  return (
    <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ gap: 12 }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="truncate text-[14px] font-medium text-ink" title={title}>{title}</span>
        <span className="font-mono text-[11.5px] text-ink-faint">{total} bars{timeOf(total, song.tempo)}{song.tempo ? ` · ${Math.round(song.tempo)} BPM` : ""}</span>
        <span className="ml-auto font-mono text-[11px] text-ink-faint">{(song as SongParts & { edited?: boolean }).edited ? "named by Muse Spark, edited by you" : song.names_by ? "named by Muse Spark" : song.names_error}</span>
      </div>
      {/* the timeline */}
      <div className="relative" style={{ height: narrow ? 34 : 64 }}>
        {parts.map((p) => {
          const c = partColor_(p), wide = p.bars / total >= (narrow ? 1 : 0.075);
          return (
            <div key={p.start_bar} title={`${partName(p)}: bars ${p.start_bar} to ${p.start_bar + p.bars - 1}`}
                 className="absolute inset-y-0 overflow-hidden rounded-[8px]"
                 style={{ left: `calc(${at(p.start_bar)}% + 1px)`, width: `calc(${(p.bars / total) * 100}% - 2px)`,
                          background: `color-mix(in srgb, ${c} 16%, var(--card-2))`, boxShadow: outline?.(p) ? `inset 0 0 0 1.5px ${c}` : undefined }}>
              <div className="flex h-[18px] items-center px-2" style={{ background: c }}>
                {wide && <span className="truncate text-[11px] font-semibold" style={{ color: "var(--on-action)" }}>{partName(p)}</span>}
              </div>
              {!narrow && wide && <div className="px-2 pt-1.5 font-mono text-[10.5px] text-ink-muted">{p.bars} bars</div>}
            </div>
          );
        })}
      </div>
      {/* where each part starts, like Live's markers */}
      <div className="relative -mt-1 h-3.5">
        {parts.filter((p, i, all) => {
          // skip a number that would crowd the one before it (the list below has every bar)
          const gap = narrow ? 9 : 3.5;
          let last = -Infinity;
          for (const q of all.slice(0, i + 1)) if (at(q.start_bar) - last >= gap) last = at(q.start_bar);
          return last === at(p.start_bar);
        }).map((p, i) => (
          <span key={p.start_bar} className={cn("absolute font-mono text-[10px] text-ink-faint", i && "-translate-x-1/2")} style={{ left: `${at(p.start_bar)}%` }}>{p.start_bar}</span>
        ))}
      </div>
      {/* the parts in words; on your song, each name is a menu and each edge moves by 4 bars (Ian, Oct 30) */}
      <div className={cn("grid gap-x-6 gap-y-1.5 border-t border-hairline pt-3", narrow || editable ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3")}>
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2.5 flex-none rounded-[3px]" style={{ background: partColor_(p) }} />
            {editable ? (
              <select className="rounded-[7px] border border-hairline bg-transparent px-1.5 py-0.5 font-medium text-ink" value={p.name ?? ""}
                      aria-label={`Name of the part at bar ${p.start_bar}`} onChange={(e) => rename(i, e.target.value)}>
                {!p.name && <option value="">{partName(p)}</option>}
                {PART_NAMES.map((n) => <option key={n} value={n} style={{ background: "var(--card)" }}>{n}</option>)}
              </select>
            ) : <span className="font-medium text-ink">{partName(p)}</span>}
            <span className="ml-auto font-mono text-[11.5px] text-ink-muted">bars {p.start_bar} to {p.start_bar + p.bars - 1}</span>
            {editable && (
              <span className="flex gap-1" title="Move where this part starts by 4 bars">
                <button className="cp-btn cp-btn-ghost cp-btn-sm px-1.5 font-mono" disabled={i === 0 || parts[i - 1].bars <= 4} onClick={() => move(i, -4)} aria-label={`Start ${partName(p)} 4 bars earlier`}>−4</button>
                <button className="cp-btn cp-btn-ghost cp-btn-sm px-1.5 font-mono" disabled={i === 0 || p.bars <= 4} onClick={() => move(i, 4)} aria-label={`Start ${partName(p)} 4 bars later`}>+4</button>
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Arrangement: the song's parts, yours above the reference's. One button, here only (Ian): Hear the whole song. */
const ArrangementScreen = memo(function ArrangementScreen({ narrow, onReference }: { narrow: boolean; onReference: () => void }) {
  const arr = useAriaSel((s) => s.arrangement), hearing = useAriaSel((s) => s.hearing), ref = useAriaSel(referenceOf);
  const busy = !!hearing && hearing.step !== "error";
  const share = hearing?.total ? Math.min(1, (hearing.done ?? 0) / hearing.total) : 0;
  const mine = arr?.mine && !arr.mine.error ? arr.mine : null;
  const theirs = arr?.ref && !arr.ref.error ? arr.ref : null;

  // Listening, or nothing heard yet. Before: only the button and one short line, which goes once the song is heard (Ian)
  if (busy || !mine) {
    const err = hearing?.step === "error" ? hearing.text : arr?.mine.error;
    return (
      <div className="grid gap-5 pt-2">
        {busy ? (
          <GlowCard accent="gold">
            <div className="relative h-2 overflow-hidden rounded-full bg-well">
              <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-linear" style={{ width: `${Math.max(2, share * 100)}%`, background: "var(--trk-0)" }} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-[15px] text-ink" role="status">{hearing!.text}</span>
              {hearing!.step === "record" && <button className="cp-btn cp-btn-ghost cp-btn-sm ml-auto" onClick={stopHearing}>Stop</button>}
            </div>
          </GlowCard>
        ) : (
          <div className="grid justify-items-start gap-3">
            <button className="cp-btn cp-btn-primary" onClick={hearSong}><ArrangementIcon style={{ width: 16, height: 16 }} />Hear the whole song</button>
            <span className="text-[13.5px]" style={{ color: err ? "var(--hot)" : "var(--ink-muted)" }}>
              {err ?? "Aria plays your song from bar 1 to the end once, finds its parts and names them. Nothing in your song changes."}</span>
          </div>
        )}
      </div>
    );
  }

  const mineNames = new Set(mine.sections.map((p) => p.name).filter(Boolean));
  return (
    <div className="cp-bento">
      <SongLane title="Your song" song={mine} narrow={narrow} editable />
      {theirs ? <SongLane title={theirs.song ?? "Your reference"} song={theirs} narrow={narrow} outline={(p) => !!p.name && mineNames.has(p.name)} />
        : <button className={cn("cp-tile cp-card text-left text-[13.5px] text-ink-muted hover:text-ink", span(narrow, 12))} onClick={onReference}>
            {ref ? "Reading your reference's parts" : "Pick a reference song to see its parts here, and compare part by part"}</button>}
      <div className={cn("flex flex-wrap items-center gap-2", span(narrow, 12))}>
        <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={addArrangementMarkers}>Add {mine.sections.length} markers to Live</button>
        <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={hearSong}>Hear it again</button>
        {!narrow && <span className="cp-meta ml-auto">Every Mix check now knows which part it heard{theirs ? ", and compares it with the same part of your reference" : ""}.</span>}
      </div>
    </div>
  );
});

/** Reference (build step 8, Ian: compare first). Live's web view takes no dropped files, so the song is chosen
    from Finder. After: the song, Change and Remove, and the last check against it: both curves, then each band. */
const ReferenceScreen = memo(function ReferenceScreen({ narrow, onOpen }: { narrow: boolean; onOpen: () => void }) {
  const ref = useAriaSel(referenceOf), result = useAriaSel((s) => s.result), progress = useAriaSel((s) => !!s.progress);
  const picker = useRef<HTMLInputElement>(null);
  const compared = result?.reference && ref && result.reference.path === ref.path ? result.reference : null;
  const list = result ? problemsOf(result) : [];
  const refProblems = list.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => p.findings[0].kind === "reference");
  const choose = (
    <input ref={picker} type="file" accept=".wav,.aif,.aiff,.flac,.mp3,.ogg,audio/*" className="hidden"
           onChange={(e) => { const f = e.target.files?.[0]; if (f) setReferenceFile(f); e.target.value = ""; }} />
  );
  if (!ref) {
    return (
      <div className="cp-bento">
        <section className={cn("cp-tile cp-card", span(narrow, 12))}>
          {choose}
          <button className="grid w-full place-items-center gap-3 rounded-[14px] border-2 border-dashed py-14 text-center"
                  style={{ borderColor: "var(--track)", background: "transparent", color: "var(--ink)", cursor: "pointer" }} onClick={() => picker.current?.click()}>
            <span className="ae-kind is-idle" style={{ width: 44, height: 44, borderRadius: 13 }}><ReferenceIcon style={{ width: 22, height: 22 }} /></span>
            <b className="text-[17px] font-medium">A song you want yours to sound like</b>
            <span className="cp-btn cp-btn-primary cp-btn-sm">Choose a song</span>
          </button>
        </section>
      </div>
    );
  }
  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
        {choose}
        <span className="ae-kind" style={{ width: 40, height: 40, borderRadius: 12, color: THEIRS }}><ReferenceIcon style={{ width: 20, height: 20 }} /></span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="cp-cap">Your reference</span>
          <span className="break-words text-[16px] font-medium leading-5" title={ref.path}>{ref.name}</span>
        </div>
        <IconButton label="Choose another song" onClick={() => picker.current?.click()}><SwapIcon style={{ width: 15, height: 15 }} /></IconButton>
        <IconButton label="Stop comparing with this song" onClick={clearReference}><CloseIcon style={{ width: 15, height: 15 }} /></IconButton>
      </section>

      <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ gap: 12 }}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="cp-cap" title="Both songs at the same loudness. Blue is where the reference is fuller, gold where yours is.">
            {compared && result ? barsLabel(result) : "Against your reference"}</span>
          {compared && <div className="ml-auto min-w-0"><RefLegend name={ref.name} /></div>}
        </div>
        {compared ? (compared.error || !compared.curve ? <p className="cp-meta">{compared.error ?? "Nothing to compare."}</p> : (
          <>
            {result?.advice?.summary && <p className="m-0 text-[16px] leading-[22px] text-ink">{result.advice.summary}</p>}
            <RefChart r={compared} height={narrow ? 340 : 250} zones={refProblems.map(({ p, n }) => zoneOf(p, n))} />
          </>
        )) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="cp-meta">{result ? "Your last check was before this song was picked." : "Not checked yet."}</span>
            <button className="cp-btn cp-btn-primary cp-btn-sm" disabled={progress} onClick={checkMix}>{progress ? "Checking" : "Check mix"}</button>
          </div>
        )}
      </section>

      {compared && !compared.error && (
        <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ paddingTop: 6, paddingBottom: 6, gap: 0 }}>
          {refProblems.length ? refProblems.map(({ p, n }) => (
            <div key={n} className="grid items-center gap-3 border-t border-hairline py-3 first:border-t-0" style={{ gridTemplateColumns: "26px minmax(0, 1fr) auto" }}>
              <MarkOf p={p} />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{p.name}</span>
                <span className="ae-mono">{p.where} <span style={{ color: refColor(p) }}>{amountText(p)}</span></span>
              </span>
              <span className="flex gap-1.5">
                <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => { fixWithMuse(p); }}>Fix it</button>
                {!narrow && <button className="cp-btn cp-btn-sm" onClick={onOpen}>See it</button>}
              </span>
            </div>
          )) : <p className="cp-meta py-2.5">Nothing stands out against {ref.name} in these bars.</p>}
        </section>
      )}
    </div>
  );
});

/** Where in the mix each problem is, low to high. Before a check: the same bands, greyed out. */
function WhereItHappens({ r, narrow, onPick }: { r: Result | null; narrow: boolean; onPick?: (p: Problem) => void }) {
  const list = r ? problemsOf(r) : [];
  const bands = bandsWith(list);
  const range = (b: { lo: number; hi: number }) => `${hz(b.lo)} to ${hz(b.hi)}`;
  return (
    <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ gap: 12 }}>
      <div className="cp-spread">
        <span className="cp-cap">Where it is in the mix</span>
        {r ? <span className="font-mono text-[11.5px] text-ink-faint">low to high</span> : <span className="cp-tag cp-tag-idle">No check yet</span>}
      </div>
      <div className={cn("cp-where", !r && "is-empty", narrow && "is-wrap")}>
        {bands.map((b) => (
          <button key={b.name} className={b.found.length ? "is-hot" : ""} style={n(1)} title={range(b)}
                  onClick={() => (b.found[0] && onPick ? onPick(b.found[0]) : undefined)}>
            {b.name}
            <small>{!r ? range(b) : b.found.length ? b.found.map((p) => statusWord(p)).join(", ") : "Clear"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

/** "Name my tracks": with it on, Check mix puts an Aria Ear on each key track (by name) and names the tracks
    that clash. Set it before checking, so a song isn't checked twice. Off takes the Ears off.
    One switch; the tracks with Ears show beside it. Words only while it works or when turning on fails. */
const KeyTracks = memo(function KeyTracks() {
  const session = useAriaSel((s) => s.session), ears = useAriaSel((s) => s.ears);
  const on = session?.ears ?? [];
  const wanted = !!session?.keyTracks || on.length > 0;
  return (
    <div className="cp-row flex-wrap" style={{ gap: 8 }}>
      <button className="ae-switch" role="switch" aria-checked={wanted} disabled={ears.busy} onClick={() => (wanted ? stopListening() : listenTracks())}
              title="Check mix then says which of your tracks clash, like Kick and Bass. Aria adds a small Ear to each key track.">
        <EarIcon />Name my tracks<i />
      </button>
      {on.map((t, i) => <span key={i} className="cp-tag cp-tag-idle" title={t} style={{ maxWidth: 150 }}><EarIcon style={{ width: 11, height: 11, flex: "none" }} /><span className="truncate">{shortName(t, 18)}</span></span>)}
      {ears.text && (ears.busy || wanted) && <span className="cp-meta">{ears.text}</span>}
    </div>
  );
});

// ---------- Mix check ----------

// Mud is measured as synths buried in the low mids, so it gets the mud icon, not the buried one
/** A problem as a pin on a chart: its stretch and where it hits, numbered as in the list */
const spanOf = (p: Problem) => [Math.min(...p.findings.map((f) => f.hz_range[0])), Math.max(...p.findings.map((f) => f.hz_range[1]))] as const;
const zoneOf = (p: Problem, n: number) => ({ n, lo: spanOf(p)[0], hi: spanOf(p)[1], where: `${p.name}, ${p.where}, ${amountText(p)}`, icon: iconFor(p), color: colorOf(p) });
/** Where a problem sits, lows to highs, as a color (the same on its chart mark and its row) */
const colorOf = (p: Problem) => rangeOf(...spanOf(p)).color;
/** A problem's mark: its kind's icon in its range's color, in place of a number (Ian, Oct 30) */
const MarkOf = ({ p, size }: { p: Problem; size?: number }) => <KindMark icon={iconFor(p)} color={colorOf(p)} size={size} title={`${p.name}, ${rangeOf(...spanOf(p)).name}`} />;
/** Louder than the reference is gold (yours is fuller), quieter is blue (theirs is) */
const refColor = (p: Problem) => ((p.findings[0].diff_db ?? 0) > 0 ? YOURS : THEIRS);
const compared = (p: Problem) => p.findings[0].kind === "reference" || p.findings[0].kind === "good_mix";
const iconFor = (p: Problem) => findingIcon(p.findings[0]);

/** Before the first check: the Simple view's layout greyed out. Its shapes say what will appear; no sentences. */
const EmptyCheck = memo(function EmptyCheck({ narrow }: { narrow: boolean }) {
  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-hero", span(narrow, 7))} style={{ minHeight: narrow ? 0 : 160, gap: 10 }}>
        <span className="cp-cap">Where the problems are</span>
        <div className="cp-score cp-push">{BANDS.map((b) => <span key={b.name}><i />{b.name}</span>)}</div>
      </section>
      <section className={cn("cp-tile cp-card", span(narrow, 5))} style={{ minHeight: narrow ? 0 : 160, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 42%", gap: 12 }}>
        <div className="flex flex-col gap-1">
          <span className="cp-cap">Fix first</span>
          <span className="text-[22px] text-ink-faint">None yet</span>
          <div className="mt-auto"><button className="cp-btn cp-btn-primary cp-btn-sm" disabled>Fix it</button></div>
        </div>
        <div className="ae-thumb is-empty" />
      </section>
      {KINDS.map((k) => (
        <section key={k.kind} className={cn("cp-tile cp-card cp-stat", span(narrow, 4))}>
          <div className="cp-stat-head"><span className="cp-stat-icon">{k.icon}</span><span className="cp-stat-name">{k.name}</span></div>
          <TickGauge share={0} />
        </section>
      ))}
      <WhereItHappens r={null} narrow={narrow} />
    </div>
  );
});

/** Before and after (Oct 30): after a fix, hear the same bars again. Both takes at the same loudness: before in blue,
    after in gold, and how much each problem's range changed. */
function BeforeAfterCard({ r, narrow }: { r: Result; narrow: boolean }) {
  const ba = useAriaSel((s) => s.beforeAfter), busy = useAriaSel((s) => s.rechecking), progress = useAriaSel((s) => !!s.progress);
  const fixes = useAriaSel((s) => s.fixes);
  const list = problemsOf(r);
  const working = !!busy && busy.step !== "error";
  const share = busy?.total ? Math.min(1, (busy.done ?? 0) / busy.total) : 0;
  return (
    <Rise i={5}>
      <section className="cp-tile cp-card" style={{ gap: 12 }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[14px] font-medium text-ink">Before and after</span>
          {ba && <div className="min-w-0"><RefLegend name="Before" mine="After" /></div>}
          <button className="cp-btn cp-btn-sm ml-auto" disabled={working || progress} onClick={recheck}>
            {working ? "Listening" : ba ? "Check again" : `Check bars ${r.start_bar ?? ""} to ${(r.start_bar ?? 0) + 15} again`}</button>
        </div>
        {working && (
          <div className="grid gap-2">
            <div className="relative h-1.5 overflow-hidden rounded-full bg-well"><div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: "var(--trk-0)" }} /></div>
            <span className="cp-meta" role="status">{busy!.text}</span>
          </div>
        )}
        {!working && busy?.step === "error" && <span className="cp-meta" style={{ color: "var(--hot)" }}>{busy.text}</span>}
        {!working && !ba && busy?.step !== "error" && <span className="cp-meta">After Fix it, Aria plays the same bars again and shows what changed, at the same loudness.</span>}
        {ba && !working && (
          <>
            <RefChart r={{ name: "Before", path: "", error: null, bands: [], curve: ba.curve }} height={narrow ? 300 : 170}
                      zones={list.map((p, i) => zoneOf(p, i + 1))} />
            <div className="grid gap-1.5">
              {ba.problems.filter((c) => list.some((x) => x.findings.some((f) => r.clarity.findings.indexOf(f) === c.index))).map((c) => {
                const p = list.findIndex((x) => x.findings.some((f) => r.clarity.findings.indexOf(f) === c.index));
                const name = p >= 0 ? list[p].name : `Problem ${c.index + 1}`;
                const down = (c.change_db ?? 0) < -0.4, up = (c.change_db ?? 0) > 0.4, f = r.clarity.findings[c.index];
                const better = wantsMore(f) ? up : down, worse = wantsMore(f) ? down : up;   // less sub than the good mixes: up is the fix
                return (
                  <div key={c.index} className="flex items-center gap-2.5 text-[13px]">
                    {p >= 0 && <MarkOf p={list[p]} size={22} />}
                    <span className="truncate text-ink">{name}</span>
                    <span className="ae-mono ml-auto" style={{ color: better ? "var(--good)" : worse ? "var(--hot)" : undefined }}>
                      {c.change_db === null ? "not measured" : `${fmtDb(c.change_db)} ${down ? "less" : up ? "more" : "same"}`}</span>
                    {/* What to do next (Ian, Oct 30: "there's no fix prompts"): fixed, try again stronger, or fix it */}
                    {p >= 0 && (heardFixed(f, c.change_db)
                      ? <span className="w-[92px] text-right text-[12.5px]" style={{ color: "var(--good)" }}>Fixed</span>
                      : fixes[problemKey(list[p])]
                        ? <button className="cp-btn cp-btn-sm w-[92px] justify-center" onClick={() => fixAgainWithMuse(list[p], c.change_db)}>Fix it again</button>
                        : <button className="cp-btn cp-btn-sm w-[92px] justify-center" onClick={() => fixWithMuse(list[p])}>Fix it</button>)}
                  </div>
                );
              })}
            </div>
            <span className="font-mono text-[11px] text-ink-faint">both at the same loudness · {ba.lufs.before} and {ba.lufs.after} LUFS as heard</span>
          </>
        )}
      </section>
    </Rise>
  );
}

/** Live analyzer (Oct 30): your song's sound as it plays, 31 third-octave bands from Main, drawn like every chart
    (Pro-Q tilt), with a peak line that holds a moment. Behind it, the shape of your reference
   , matched to your level, so you see where the song falls short or sticks out as it plays.
    Frames come 20 a second; the lines are drawn at the screen's own rate (Ian, Oct 30: it moved "very choppy"),
    gliding toward each frame like an analyzer's ballistics: up in about 25 ms, down in about 150 ms. The moving
    lines are written straight to the SVG, so a frame doesn't re-render React, and the dB scale only moves in 6 dB steps. */
const RISE_S = 0.025, FALL_S = 0.15, PEAK_FALL_DB_S = 12;
// The analyzer's own color, violet (Ian, Oct 31: the gold "is kinda ugly"; after the spectrum he showed from iZotope)
const AN_COLOR = "var(--trk-4)";

/** A frame's color from where its sound is: its lows (below 200 Hz, red), mids (200 Hz to 2 kHz, pink) and highs
    (above 2 kHz, cyan), mixed by their share and lifted to full brightness, so the height alone carries the level.
    A kick or bass reads red, a vocal or synth pink, hats cyan (Ian, Nov 2, after pro DJ software's waveforms). */
function bandColor(db: number[]): [number, number, number] {
  let lo = 0, mi = 0, hi = 0;
  // Weighted as the spectrum is drawn (tipped up toward the highs), or the bass wins every frame of an EDM mix
  db.forEach((d, i) => { const f = ANALYZER_HZ[i], p = 10 ** ((d + tilt(f)) / 10); if (f < 200) lo += p; else if (f < 2000) mi += p; else hi += p; });
  const t = lo + mi + hi || 1, [a, b, c] = [lo / t, mi / t, hi / t];
  const rgb = [255 * a + 240 * b + 56 * c, 64 * a + 64 * b + 196 * c, 40 * a + 200 * b + 255 * c], top = Math.max(...rgb, 1);
  return rgb.map((v) => Math.round((v * 255) / top)) as [number, number, number];
}

/** Where the sound sits, like a polar stereo meter (Ian, Oct 31): a half circle, L to R, each dot a sample pair from
    Main (scope.js): mono sits in the middle, wide spreads out, and a lopsided mix leans to one side. Out of phase
    (left and right fighting) shows red. Scaled to the loudest moment of the last seconds, so quiet songs fill it too. */
function StereoScope() {
  const cv = useRef<HTMLCanvasElement>(null), scale = useRef(0.05);
  // Phase (correlation, -1 to +1) and balance (right minus left, dB), smoothed, read 4 times a second
  const corr = useRef<number | null>(null), bal = useRef<number | null>(null);
  const [meter, setMeter] = useState<{ corr: number; bal: number } | null>(null);
  useEffect(() => { const t = setInterval(() => { if (corr.current !== null && bal.current !== null) setMeter({ corr: corr.current, bal: bal.current }); }, 250); return () => clearInterval(t); }, []);
  useEffect(() => onScope((v) => {
    const el = cv.current, ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = el.clientWidth, ch = el.clientHeight;
    if (!cw) return;
    if (el.width !== Math.round(cw * dpr)) { el.width = Math.round(cw * dpr); el.height = Math.round(ch * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(el), ground = css.getPropertyValue("--card").trim() || "#141416";
    const cx = cw / 2, cy = ch - 14, R = Math.min(cw / 2 - 8, ch - 22);
    // fade what was there, so the last few frames trail
    ctx.globalAlpha = 0.28; ctx.fillStyle = ground; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1;   // the last frames trail off
    ctx.strokeStyle = css.getPropertyValue("--track").trim() || "#444"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - R * Math.SQRT1_2, cy - R * Math.SQRT1_2); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.SQRT1_2, cy - R * Math.SQRT1_2); ctx.stroke();
    let loud = 0, lr = 0, ll = 0, rr = 0;
    for (let i = 0; i + 1 < v.length; i += 2) { loud = Math.max(loud, Math.hypot(v[i], v[i + 1])); lr += v[i] * v[i + 1]; ll += v[i] * v[i]; rr += v[i + 1] * v[i + 1]; }
    if (ll + rr > 1e-9) {
      const c = lr / Math.sqrt(ll * rr || 1e-12), b = 10 * Math.log10((rr + 1e-12) / (ll + 1e-12));
      corr.current = corr.current === null ? c : corr.current * 0.85 + c * 0.15;
      bal.current = bal.current === null ? b : bal.current * 0.85 + b * 0.15;
    }
    scale.current = Math.max(loud, scale.current * 0.97, 0.01);
    const himid = css.getPropertyValue("--rng-himid").trim() || "#3fd5e6", hot = css.getPropertyValue("--hot").trim() || "#ff8a5b";
    for (let i = 0; i + 1 < v.length; i += 2) {
      const l = v[i], r = v[i + 1], side = (r - l) * Math.SQRT1_2, mid = (l + r) * Math.SQRT1_2;
      const a = Math.atan2(side, Math.abs(mid)), rad = Math.min(1, Math.hypot(side, mid) / scale.current);
      const c = Math.abs(side) > Math.abs(mid) && rad > 0.15 ? hot : himid;   // outside the 45 degree lines: left and right pulling apart
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(cx + R * rad * Math.sin(a), cy - R * rad * Math.cos(a), 1 + rad * 0.8, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }), []);
  return (
    <div className="relative">
      <canvas ref={cv} className="block h-[118px] w-full" role="img" aria-label="Where the sound sits, left to right" />
      <span className="absolute left-1 top-[104px] font-mono text-[10px] text-ink-faint">L</span>
      <span className="absolute right-1 top-[104px] font-mono text-[10px] text-ink-faint">R</span>
      {/* Phase: +1 is safe in mono, below 0 parts cancel when summed; balance: which side is louder */}
      <div className="mt-2 grid gap-1" title="Phase: +1 means left and right agree (safe in mono). Below 0, parts cancel out when the song plays in mono.">
        <div className="relative h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, var(--hot), var(--well) 50%, var(--good))", opacity: 0.85 }}>
          {meter && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${((meter.corr + 1) / 2) * 100}%`, transition: "left 240ms", boxShadow: "0 0 0 2px var(--card)" }} />}
        </div>
        <div className="flex justify-between font-mono text-[10px] text-ink-faint"><span>-1</span><span>phase</span><span>+1</span></div>
        <div className="text-center font-mono text-[11px] text-ink-muted">
          {meter ? `${meter.corr >= 0 ? "+" : ""}${meter.corr.toFixed(2)} · ${Math.abs(meter.bal) < 0.3 ? "centered" : `${meter.bal > 0 ? "right" : "left"} +${Math.abs(meter.bal).toFixed(1)} dB`}` : "–"}
        </div>
      </div>
    </div>
  );
}

/** The last 30 s of loudness as a line (Oct 31): rising, holding or dipping at a glance. Scaled to its own range. */
function LoudnessLine({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="mt-auto h-9" />;
  const lo = Math.min(...values) - 1, hi = Math.max(...values) + 1, W = 200, H = 36;
  const pts = values.map((v, i) => [((i + 120 - values.length) / 119) * W, H - 3 - ((v - lo) / (hi - lo)) * (H - 6)] as [number, number]);
  const d = path(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-auto block h-9 w-full" aria-label="Loudness over the last 30 seconds">
      <path d={`${d}L${pts[pts.length - 1][0]},${H}L${pts[0][0]},${H}Z`} fill={AN_COLOR} opacity={0.15} />
      <path d={d} fill="none" stroke={AN_COLOR} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
const WAVE_FRAMES = 160;   // 8 s at 20 frames a second
function LiveAnalyzer({ narrow, compact, onOpen }: { narrow: boolean; compact?: boolean; onOpen?: () => void }) {
  const result = useAriaSel((s) => s.result);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState<number[] | null>(null);   // the live average, refreshed once a second, for the target line
  const [top, setTop] = useState(0);
  const latest = useRef<number[] | null>(null), shown = useRef<number[] | null>(null), peak = useRef<number[] | null>(null), avg = useRef<number[] | null>(null);
  const liveEl = useRef<SVGPathElement>(null), fillEl = useRef<SVGPathElement>(null), peakEl = useRef<SVGPathElement>(null);
  const target = result?.reference?.curve ? { name: result.reference.name, hz: result.reference.curve.hz, v: result.reference.curve.ref }
    : null;
  const hz = ANALYZER_HZ.filter((h) => h <= 16000);
  const W = 640, H = compact ? 170 : narrow ? 360 : 260, n = hz.length;
  const floor = top - 54;
  const X = (f: number) => plotX(f), Y = (db: number) => 8 + (1 - (Math.max(db, floor) - floor) / (top - floor)) * (H - 28);
  const draw = (vals: number[]) => vals.slice(0, n).map((v, i) => v + tilt(hz[i]));
  const line = (v: number[]) => path(v.map((d, i) => [X(hz[i]), Y(d)] as [number, number]));
  const geo = useRef({ line, draw, top, n, H, X });
  geo.current = { line, draw, top, n, H, X };

  // Width, loudness and the waveform (Oct 31), after the 31 bands in each frame
  const [stats, setStats] = useState<{ lufs: number | null; width: number | null; peak?: number | null; history?: number[] } | null>(null);
  const waveTop = useRef(-120), waveAt = useRef(0), lufsHistory = useRef<number[]>([]), peakHold = useRef<number[]>([]);
  const wave = useRef<{ db: number; rgb: [number, number, number] }[]>([]), waveEl = useRef<HTMLCanvasElement>(null), power = useRef<number | null>(null), widthAvg = useRef<number | null>(null);
  useEffect(() => onAnalyzer((frame) => {
    const f = frame.slice(0, ANALYZER_HZ.length), [width, lufs, peak] = frame.slice(ANALYZER_HZ.length);
    latest.current = f;
    avg.current = f.map((v, i) => (avg.current ? avg.current[i] * 0.97 + v * 0.03 : v));   // a few seconds' average
    if (lufs !== undefined) {
      // Loudness over about the last 3 s: the momentary readings' power, averaged (20 frames a second)
      const p = lufs > -100 ? 10 ** ((lufs + 0.691) / 10) : 0;
      power.current = power.current === null ? p : power.current * 0.983 + p * 0.017;
      if (width !== null && width !== undefined) widthAvg.current = widthAvg.current === null ? width : widthAvg.current * 0.95 + width * 0.05;
      // Each bar: the frame's overall level (all bands, 2048 samples), which moves with the beat; a mastered drop's peak
      // sits near 0 dB all the time and made every bar the same
      const level = 10 * Math.log10(f.reduce((a, d) => a + 10 ** (d / 10), 0) + 1e-12);
      waveTop.current = Math.max(level, waveTop.current - 0.05);
      wave.current = [...wave.current.slice(-(WAVE_FRAMES - 1)), { db: level - waveTop.current, rgb: bandColor(f) }];
      waveAt.current = performance.now();
      peakHold.current = [...peakHold.current.slice(-59), peak ?? -120];   // the last 3 s of peaks
    }
  }), []);
  useEffect(() => {
    let raf = 0, last = performance.now(), lastLevel = 0, lastStats = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const f = latest.current;
      if (!f) return;
      const s = shown.current ?? f.slice(), p = peak.current ?? f.slice();
      const up = 1 - Math.exp(-dt / RISE_S), down = 1 - Math.exp(-dt / FALL_S);
      for (let i = 0; i < f.length; i++) {
        s[i] += (f[i] - s[i]) * (f[i] > s[i] ? up : down);
        p[i] = Math.max(s[i], p[i] - PEAK_FALL_DB_S * dt);
      }
      shown.current = s; peak.current = p;
      const g = geo.current, live = g.draw(s), pk = g.draw(p);
      const d = g.line(live);
      liveEl.current?.setAttribute("d", d);
      fillEl.current?.setAttribute("d", `${d}L${g.X(hz[g.n - 1])},${g.H}L${g.X(hz[0])},${g.H}Z`);
      peakEl.current?.setAttribute("d", g.line(pk));
      // The scale: the loudest drawn peak plus 3 dB, in 6 dB steps; it comes down only when the song is 9 dB quieter
      const want = Math.ceil((Math.max(-6, ...pk) + 3) / 6) * 6;
      if (want > g.top || want < g.top - 9) setTop(want);
      if (now - lastLevel > 1000) { lastLevel = now; setLevel(avg.current); setPlaying(true); }
      // The waveform: the last WAVE_FRAMES frames, newest on the right, mirrored, like pro DJ
      // software (Ian, Nov 2): each frame's level (all bands), which moves with the beat, colored by where its sound is
      // (bandColor)
      const cv = waveEl.current;
      if (cv && wave.current.length > 1) {
        const ctx = cv.getContext("2d"), dpr = window.devicePixelRatio || 1, cw = cv.clientWidth, ch = cv.clientHeight;
        if (ctx && cw) {
          if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cw, ch);
          // Smooth scroll: between frames everything slides left by the time since the last one (50 ms a step), so it
          // moves every screen frame like the spectrum, not in jumps
          const w = wave.current, step = cw / (WAVE_FRAMES - 1), mid = ch / 2;
          const slide = Math.min(1, (now - waveAt.current) / 50) * step;
          const xOf = (i: number) => (i + WAVE_FRAMES - w.length) * step - slide;
          // Heights are linear amplitude against the loudest of the last seconds, like DJ software, so a beat's
          // few dB of movement show as shape. Only the level: a mastered drop's sample peak sits near 0 dB every frame.
          const hOf = (db: number) => Math.max(0.5, Math.min(1, 10 ** (db / 20)) * (mid - 3));
          // Each frame's slice runs to the next frame's, so the shape is continuous (Max sends 20 frames a second;
          // separate bars read as a barcode), and each slice keeps its own frame's color
          const slice = (x0: number, h0: number, x1: number, h1: number) => {
            ctx.beginPath(); ctx.moveTo(x0, mid - h0); ctx.lineTo(x1, mid - h1); ctx.lineTo(x1, mid + h1); ctx.lineTo(x0, mid + h0); ctx.closePath(); ctx.fill();
          };
          for (let i = 0; i < w.length - 1; i++) {
            const x0 = xOf(i), x1 = xOf(i + 1) + 0.5, a = w[i], b = w[i + 1], rgb = a.rgb.join(",");
            if (x1 < 0) continue;
            ctx.fillStyle = `rgb(${rgb})`;
            slice(x0, hOf(a.db), x1, hOf(b.db));
          }
          // the newest moment glows at the right edge
          const last = w[w.length - 1], lx = xOf(w.length - 1);
          ctx.shadowBlur = 10; ctx.shadowColor = `rgb(${last.rgb.join(",")})`; ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(lx - 1, mid - hOf(last.db), 2, hOf(last.db) * 2); ctx.shadowBlur = 0;
        }
      }
      if (now - lastStats > 250) {
        lastStats = now;
        const p = power.current, lufs = p && p > 0 ? Math.round(10 * (-0.691 + 10 * Math.log10(p))) / 10 : null;
        if (lufs !== null) lufsHistory.current = [...lufsHistory.current.slice(-119), lufs];   // 30 s, 4 a second
        const pk = peakHold.current.length ? Math.max(...peakHold.current) : null;
        setStats({ lufs, width: widthAvg.current === null ? null : Math.round(widthAvg.current), peak: pk === null || pk < -100 ? null : Math.round(pk * 10) / 10, history: lufsHistory.current });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The target's shape at the analyzer's bands, moved to the live average's level (between 100 Hz and 5 kHz)
  let tgt: number[] | null = null;
  if (target && level) {
    const at = (f: number) => { let k = 0; target.hz.forEach((h, j) => { if (Math.abs(Math.log(h / f)) < Math.abs(Math.log(target.hz[k] / f))) k = j; }); return target.v[k]; };
    const shape = hz.map(at);
    const mid = hz.map((h, i) => [h, i] as const).filter(([h]) => h >= 100 && h <= 5000).map(([, i]) => i);
    const shift = mid.reduce((a, i) => a + (level[i] - shape[i]), 0) / mid.length;
    tgt = draw(shape.map((v) => v + shift));
  }
  const ticks = dbTicksOf(-48, 12, (db) => Y(db + top - 3));
  return (
    <div className={cn("grid gap-3", !compact && "pt-1")}>
      {/* Loudness, width and the waveform of Main as it plays (Ian, Oct 31) */}
      {!compact && <div className="grid gap-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 0.7fr) minmax(0, 1fr) minmax(0, 1.5fr)" }}>
        <section className="cp-tile cp-card" style={{ gap: 2 }} title="Loudness as BS.1770 measures it, over about the last 3 seconds (LUFS).">
          <span className="cp-cap">Loudness</span>
          <span className="ae-big">{stats?.lufs ?? "–"}<span className="ml-1.5 text-[15px] text-ink-muted">LUFS</span></span>
          <span className="cp-meta">last 3 s{stats?.peak !== undefined && stats?.peak !== null ? ` · peak ${stats.peak} dB` : ""}</span>
          <LoudnessLine values={stats?.history ?? []} />
        </section>
        <section className="cp-tile cp-card" style={{ gap: 4 }} title="Where your sound sits: every dot is a moment of sound, mono in the middle, wider to the sides. The number is the side's share of mid plus side.">
          <div className="flex items-baseline gap-2"><span className="cp-cap">Width</span>
            <span className="ml-auto font-mono text-[13px] text-ink">{stats?.width ?? "–"}%</span></div>
          <StereoScope />
        </section>
        <section className="cp-tile cp-card" style={{ gap: 6, gridColumn: narrow ? "1 / -1" : undefined }}>
          <div className="flex items-baseline gap-2"><span className="cp-cap">Waveform</span>
            <span className="ml-auto flex gap-2.5 font-mono text-[10.5px] text-ink-faint">
              <span style={{ color: "rgb(255,64,40)" }}>lows</span><span style={{ color: "rgb(240,64,200)" }}>mids</span><span style={{ color: "rgb(56,196,255)" }}>highs</span></span></div>
          <canvas ref={waveEl} className="block h-[132px] w-full" role="img" aria-label="Main's waveform, the last 8 seconds, colored by where its sound is" />
          <span className="cp-meta">last 8 s</span>
        </section>
      </div>}
      <section className="cp-tile cp-card" style={{ gap: 12 }}>
        {compact && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="ae-kind is-idle" style={{ width: 30, height: 30 }}><AnalyzerIcon /></span>
            <b className="text-[15px] font-medium">Live analyzer</b>
            <span className="font-mono text-[12px] text-ink-muted">{stats?.lufs ?? "–"} LUFS · width {stats?.width ?? "–"}%</span>
            <button className="cp-btn cp-btn-sm ml-auto" onClick={onOpen}>Open</button>
          </div>
        )}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[14px] font-medium text-ink">{playing ? "Playing now" : "Play your song"}</span>
          {/* What each line is (Ian, Oct 30: "what is the grey line supposed to signify") */}
          <div className="ml-auto flex min-w-0 flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5" title="Your Main track right now"><i className="h-[3px] w-3.5 rounded-sm" style={{ background: AN_COLOR }} />Now</span>
            <span className="inline-flex items-center gap-1.5" title="The loudest each range got in the last moment"><i className="h-[2px] w-3.5 rounded-sm bg-ink opacity-50" />Peaks</span>
            {target && <span className="inline-flex min-w-0 items-center gap-1.5" title="Your reference's shape, moved to your level"><i className="w-3.5 border-t-2 border-dashed" style={{ borderColor: "var(--ink-muted)" }} /><span className="truncate">{target.name}</span></span>}
          </div>
        </div>
        <Plot height={H} dbTicks={ticks}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Your song's sound right now">
            <PlotGrid height={H} dbTicks={ticks} />
            <defs><linearGradient id="an-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={AN_COLOR} stopOpacity={0.55} /><stop offset="1" stopColor={AN_COLOR} stopOpacity={0.08} /></linearGradient></defs>
            <path ref={fillEl} fill="url(#an-fill)" />
            <path ref={liveEl} fill="none" stroke={AN_COLOR} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            {tgt && <path d={line(tgt)} fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.7} vectorEffect="non-scaling-stroke" />}
            <path ref={peakEl} fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.45} vectorEffect="non-scaling-stroke" />
          </svg>
        </Plot>
        {!playing && <span className="cp-meta">Press play in Live. The analyzer listens to your Main track while this screen is open.</span>}
      </section>
    </div>
  );
}

const EASE = [0.32, 0.72, 0, 1] as const;

/** Cards rise in one after another when a result arrives. */
function Rise({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <motion.div className={cn(className, "grid")} initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ opacity: { duration: 0.7, delay: i * 0.06 }, default: { duration: 0.9, ease: EASE, delay: i * 0.06 } }}>
      {children}
    </motion.div>
  );
}

const amountText = (p: Problem) => (p.amount.unit.startsWith("%") ? `${p.amount.value}%` : p.amount.unit === "dB under" ? `−${p.amount.value} dB` : `${p.amount.value} dB`);
const fixWithMuse = (p: Problem) => { fixIt(p); setAskOpen(true); };
const fixAgainWithMuse = (p: Problem, change: number | null) => { fixAgain(p, change); setAskOpen(true); };
// Fix my whole mix (Nov 1): Muse fixes the strongest problems, Aria checks the same bars, Muse tries again on the rest
const fixAllWithMuse = () => { askMuse("Fix my whole mix"); setAskOpen(true); };

/** To fix and done (Oct 30, Ian: fixed problems "stay in the way"): a problem Muse made a change for leaves To fix;
    one Check again found barely changed ("still") comes back. */
function splitFixes(list: Problem[], fixes: Record<string, FixState>) {
  const f = (p: Problem) => fixes[problemKey(p)];
  return { todo: list.filter((p) => !f(p) || f(p).state === "still"), done: list.filter((p) => f(p) && f(p).state !== "still") };
}
const useTodo = (r: Result | null) => { const fixes = useAriaSel((s) => s.fixes); return r ? splitFixes(problemsOf(r), fixes).todo : []; };

/** Mix check, Simple (Ember, Oct 29): three small cards (how many, fix first with its picture, who Aria heard),
    then the picture beside a short numbered list. A row opens to Muse's words and the buttons. */
const Simple = memo(function Simple({ r, open, setOpen, narrow }: { r: Result; open: number; setOpen: (i: number) => void; narrow: boolean }) {
  const fixes = useAriaSel((s) => s.fixes), undoNext = useAriaSel((s) => s.undoNext), askLog = useAriaSel((s) => s.ask.log);
  const { todo: list, done } = splitFixes(problemsOf(r), fixes);
  const first = list[0];
  const spectra = r.clarity.spectra, names = spectra ? partNames(spectra) : [];
  // A mark on the chart or in To fix (Ian, Oct 30): open that problem's explanation, close the others, and bring it
  // into view once it has opened (the row grows for about 220 ms)
  const show = (i: number) => {
    if (i < 0) return;
    setOpen(i);
    setTimeout(() => document.getElementById(`problem-${i}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 260);
  };
  const tracksMode = (r.clarity.mode as string) === "tracks";
  const whoOf = (p: Problem) => p.findings.flatMap((f) => (f.kind === "clash" ? f.tracks! : f.kind === "masking" ? [f.masked!] : [])).filter((n, k, a) => names.includes(n) && a.indexOf(n) === k);
  const legend = names.length >= 2 && (
    <div className="flex flex-wrap gap-3.5 text-[12.5px] text-ink-muted">
      {names.map((n, i) => <span key={n} className="inline-flex items-center gap-1.5"><span className="ae-dot" style={{ color: partColor(n, i) }} />{soundName(n)}</span>)}
    </div>
  );
  return (
    <div className="grid gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 0.75fr) minmax(0, 1.6fr)" : "minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <Rise i={0}>
          <section className="cp-tile cp-card" style={{ gap: 2 }}>
            <span className="cp-cap">To fix</span>
            <span className="ae-big"><CountUp value={list.length} /></span>
            <div className="mt-2 flex flex-wrap gap-1.5">{list.map((p, i) => <button key={i} className="ae-kind" style={{ color: colorOf(p) }} title={p.name} aria-label={p.name} onClick={() => show(i)}>{iconFor(p)}</button>)}</div>
            {list.length > 1 && <button className="cp-btn cp-btn-sm mt-auto self-start" style={{ marginTop: 10 }} onClick={fixAllWithMuse}>Fix all {list.length}</button>}
          </section>
        </Rise>
        <Rise i={1}>
          <section className="cp-tile cp-card" style={{ minHeight: narrow ? 0 : 150, display: "grid", gridTemplateColumns: first ? `minmax(0, 1fr) ${narrow ? "34%" : "42%"}` : "1fr", gap: 12 }}>
            {first ? (
              <>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="cp-cap">Fix first</span>
                  <span style={{ fontSize: narrow ? 17 : 22, lineHeight: narrow ? "22px" : "28px", fontWeight: 500, letterSpacing: "-.01em" }}>{first.name}</span>
                  <span className="ae-mono">{first.where}</span>
                  <span className="ae-mono" style={{ color: compared(first) ? refColor(first) : "var(--hot)" }}>{amountText(first)}</span>
                  <div className="mt-auto flex gap-1.5 pt-2">
                    <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => fixWithMuse(first)}>Fix it</button>
                    {!narrow && <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={() => jumpTo(first.bar)}>Hear it</button>}
                  </div>
                </div>
                <div className="ae-thumb"><ProblemThumb p={first} spectra={spectra} /></div>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="cp-cap">This check</span>
                {/* Everything changed isn't the same as nothing found: say what's left to do (hear it again) */}
                {done.length ? (
                  <>
                    <span style={{ fontSize: 22, fontWeight: 500 }}>{done.every((p) => fixes[problemKey(p)]?.state === "fixed") ? "All fixed" : `${done.length} changed`}</span>
                    <span className="text-[13px] text-ink-muted">{done.every((p) => fixes[problemKey(p)]?.state === "fixed") ? "Check another part of the song next." : "Check the same bars again to hear if it worked."}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 22, fontWeight: 500 }}>Nothing sticks out</span>
                    <span className="text-[13px] text-ink-muted">{r.advice?.summary ?? "Check another part of the song next."}</span>
                  </>
                )}
              </div>
            )}
          </section>
        </Rise>
        {!narrow && (
          <Rise i={2}>
            <section className="cp-tile cp-card" style={{ gap: 2 }}>
              <span className="cp-cap">{tracksMode ? "Listening to" : "Split into"}</span>
              <span className="ae-big">{names.length || 1}<span className="ml-1.5 text-[15px] text-ink-muted">{tracksMode ? "tracks" : names.length ? "parts" : "mix"}</span></span>
              <div className="mt-2 flex">
                {(names.length ? names : ["mix"]).map((n, i) => (
                  <span key={n} title={soundName(n)} className="grid size-[30px] place-items-center rounded-full text-[11px] font-semibold"
                        style={{ background: names.length ? partColor(n, i) : "var(--ink-muted)", color: "var(--on-action)", border: "2px solid var(--card)", marginRight: -8 }}>
                    {soundName(n).charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </section>
          </Rise>
        )}
      </div>

      {r.good_mixes && !r.reference && <Rise i={3}><GoodMixCard g={r.good_mixes} narrow={narrow} /></Rise>}

      {r.reference && !r.reference.error && r.reference.curve && (
        <Rise i={3}>
          <section className="cp-tile cp-card" style={{ gap: 10 }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[14px] font-medium text-ink" title="Both songs at the same loudness. Blue is where the reference is fuller, gold where yours is.">{r.reference.part ? `Against their ${r.reference.part}` : "Against your reference"}</span>
              <div className="ml-auto min-w-0"><RefLegend name={r.reference.name} /></div>
            </div>
            <RefChart r={r.reference} height={narrow ? 340 : 220} zones={list.map((p, i) => zoneOf(p, i + 1))} onZone={(n) => show(n - 1)} />
          </section>
        </Rise>
      )}

      <BeforeAfterCard r={r} narrow={narrow} />

      <div className="grid gap-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1.55fr) minmax(0, 1fr)", alignItems: "start" }}>
        {!(r.reference && !r.reference.error && r.reference.curve) && <Rise i={3}>
          <section className="cp-tile cp-card" style={{ gap: 8 }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className="text-[14px] font-medium text-ink">{list.length ? "Where the problems are" : "Your mix"}</span>
              <div className="ml-auto">{legend}</div>
            </div>
            {spectra
              ? <Waves spectra={spectra} findings={list.flatMap((p) => p.findings)} split={r.clarity.mode !== "master"} bare
                       onZone={(f) => show(list.findIndex((p) => p.findings.includes(f)))} />
              : <p className="cp-meta">The picture appears after the next Check mix.</p>}
          </section>
        </Rise>}
        {(list.length > 0 || done.length > 0) && (
          <Rise i={4}>
            <section className="cp-tile cp-card" style={{ paddingTop: 4, paddingBottom: 4, gap: 0 }}>
              {list.map((p, i) => (
                <div key={p.name + i} id={`problem-${i}`} style={{ scrollMarginTop: 12, scrollMarginBottom: 12 }}>
                  <button className="ae-row" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                    <MarkOf p={p} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[14px] font-medium"><span className="truncate">{p.name}</span>
                        {whoOf(p).map((n) => <span key={n} className="ae-dot" style={{ color: partColor(n, names.indexOf(n)), width: 7, height: 7 }} />)}</span>
                      <span className="ae-mono block truncate">{p.where}</span>
                    </span>
                    <span className="ae-mono whitespace-nowrap">{amountText(p)}</span>
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <BackIcon style={{ width: 13, height: 13, transform: open === i ? "rotate(90deg)" : "rotate(180deg)", transition: "transform 160ms" }} /></span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                        <div className="grid gap-2.5 pb-3.5 pl-[38px]">
                          {fixes[problemKey(p)]?.state === "still" && (
                            <p className="m-0 text-[12.5px]" style={{ color: "var(--hot)" }}>
                              Still there after the fix: {fmtDb(fixes[problemKey(p)].change_db ?? null)}. Muse can try a stronger fix.</p>
                          )}
                          <p className="m-0 text-[13.5px] text-ink">{p.short}</p>
                          {p.notes.map((note, k) => <p key={k} className="m-0 text-[12.5px] leading-[18px] text-ink-muted">{note.text}</p>)}
                          <span className="ae-mono">{barsOf(p)}</span>
                          <div className="flex gap-1.5">
                            {fixes[problemKey(p)]?.state === "still"
                              ? <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => fixAgainWithMuse(p, fixes[problemKey(p)].change_db ?? null)}>Fix it again</button>
                              : <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => fixWithMuse(p)}>Fix it</button>}
                            <button className="cp-btn cp-btn-sm" onClick={() => jumpTo(p.bar)}>Hear it in Live</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {done.length > 0 && <DoneGroup done={done} fixes={fixes} undoAt={undoNext ? askLog[undoNext.i]?.at : undefined} />}
            </section>
          </Rise>
        )}
      </div>
    </div>
  );
});

const fmtDb = (v: number | null) => (v === null ? "not measured" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`);

/** The problems Muse made a change for, out of the way at the bottom of the list (Ian, Oct 30): one line that opens
    to a check per problem and what was done. Fixed once Check again measured its range FIXED_DB lower; Undo while the
    change is the next one Undo would take back. */
function DoneGroup({ done, fixes, undoAt }: { done: Problem[]; fixes: Record<string, FixState>; undoAt?: Exchange["at"] }) {
  const [shown, setShown] = useState(false);
  const fixed = done.filter((p) => fixes[problemKey(p)]?.state === "fixed").length;
  return (
    <div className="border-t border-hairline">
      <button className="flex w-full items-center gap-2.5 py-2.5 text-left text-[13px] text-ink-muted" aria-expanded={shown} onClick={() => setShown(!shown)}>
        <span className="grid size-[22px] place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--good) 18%, transparent)", color: "var(--good)" }}><CheckIcon style={{ width: 12, height: 12 }} /></span>
        {done.length} done{fixed ? `, ${fixed} confirmed fixed` : ""}
        <BackIcon className="ml-auto" style={{ width: 12, height: 12, transform: shown ? "rotate(90deg)" : "rotate(180deg)", transition: "transform 160ms" }} />
      </button>
      {shown && done.map((p) => {
        const f = fixes[problemKey(p)];
        return (
          <div key={problemKey(p)} className="grid items-center gap-2.5 pb-2.5" style={{ gridTemplateColumns: "22px minmax(0, 1fr) auto" }}>
            <span className="grid size-[22px] place-items-center opacity-70"><MarkOf p={p} size={20} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-ink">{p.name}</span>
              <span className="block truncate text-[11.5px] text-ink-faint" title={f.what}>
                {f.state === "fixed" ? `${fmtDb(f.change_db ?? null)} in its range, heard again` : `${f.what} Check again to hear it.`}</span>
            </span>
            {f.at !== undefined && f.at === undoAt ? <button className="cp-btn cp-btn-sm" onClick={undoLast}>Undo</button>
              : <span className="ae-mono" style={{ color: f.state === "fixed" ? "var(--good)" : undefined }}>{f.state === "fixed" ? "Fixed" : "Changed"}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** One measured number as a bar on a fixed scale, with the number beside it. Missing: "Not measured", no bar. */
function Meter({ label, value, unit, lo, hi, color = "var(--ink-muted)", why, mark, dot }: {
  label: string; value: number | null | undefined; unit: string; lo: number; hi: number; color?: string; why?: string; mark?: number; dot?: string;
}) {
  const missing = value === null || value === undefined;
  const at = (v: number) => `${Math.min(1, Math.max(0, (v - lo) / (hi - lo))) * 100}%`;
  return (
    <div className="grid items-center gap-3" style={{ gridTemplateColumns: "minmax(0, 7.5rem) minmax(0, 1fr) 5.5rem" }} title={missing ? why : undefined}>
      <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">{dot && <span className="ae-dot" style={{ color: dot }} />}<span className="truncate">{label}</span></span>
      <span className="relative h-1.5 rounded-full bg-well">
        {!missing && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: at(value), background: color }} />}
        {mark !== undefined && <span className="absolute -inset-y-1 w-px bg-track" style={{ left: at(mark) }} />}
      </span>
      <span className="ae-mono text-right">{missing ? "Not measured" : `${value} ${unit}`}</span>
    </div>
  );
}

/** Mix check, Detailed (Ember): the measured numbers as pictures. Loudness and peak first as two stat cards,
    then the balance, width and each part as bars, then everything Muse said. Explanations are hover titles. */
const Detailed = memo(function Detailed({ r, narrow }: { r: Result; narrow: boolean }) {
  const m = r.measured, why = m.unmeasured;
  const f1 = (x: number | null | undefined) => (x === null || x === undefined ? null : Number(x.toFixed(1)));
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100));
  const loud = f1(m.integrated_lufs), peak = f1(m.true_peak_dbtp);
  const BANDS3 = [["bass", "Bass"], ["mids", "Mids"], ["treble", "Treble"]] as const;
  const stems = r.clarity.stems ? Object.entries(r.clarity.stems) : [];
  const forReference = "Here for reference. Aria's advice is about clarity.";
  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-card", narrow ? "span-6" : "span-3")} style={{ gap: 2 }} title={forReference}>
        <span className="cp-cap">Loudness</span>
        {loud === null ? <span className="cp-meta" title={why.integrated_lufs || why.all}>Not measured</span>
          : <span className="ae-big">{loud}<span className="ml-1.5 font-mono text-[13px] text-ink-muted">LUFS</span></span>}
      </section>
      <section className={cn("cp-tile cp-card", narrow ? "span-6" : "span-3")} style={{ gap: 2 }} title={forReference}>
        <span className="cp-cap">True peak</span>
        {peak === null ? <span className="cp-meta" title={why.all}>Not measured</span> : (
          <>
            <span className="ae-big" style={peak > 0 ? { color: "var(--hot)" } : undefined}>{peak}<span className="ml-1.5 font-mono text-[13px] text-ink-muted">dBTP</span></span>
            {peak > 0 && <span className="ae-mono" style={{ color: "var(--hot)" }}>over 0, clips on export</span>}
          </>
        )}
      </section>
      <section className={cn("cp-tile cp-card", span(narrow, 6))} style={{ gap: 12 }}>
        <span className="cp-cap">Balance</span>
        {BANDS3.map(([k, name]) => <Meter key={k} label={name} value={f1(m.bands_db[k])} unit="dB" lo={-40} hi={0} color="var(--ink)" why={why[`bands_db.${k}`] || why.all} />)}
      </section>
      <section className={cn("cp-tile cp-card", span(narrow, 6))} style={{ gap: 12 }}>
        <span className="cp-cap" title="How wide each range is in stereo: 0% is mono.">Width</span>
        {BANDS3.map(([k, name]) => <Meter key={k} label={name} value={pct(m.width[k])} unit="%" lo={0} hi={100} color="var(--cool)" why={why[`width.${k}`] || why.all} />)}
      </section>
      {stems.length > 0 && (
        <section className={cn("cp-tile cp-card", span(narrow, 6))} style={{ gap: 12 }}>
          <div className="cp-spread">
            <span className="cp-cap" title="Each part's level against the whole mix. The line is 20 dB under: past it, a part counts as not playing.">Each part against the mix</span>
            <span className="font-mono text-[11px] text-ink-faint">split by {r.clarity.split_by?.startsWith("Demucs") ? "Demucs (Meta AI)" : r.clarity.split_by ?? "Demucs (Meta AI)"}</span>
          </div>
          {stems.map(([k, v], i) => <Meter key={k} label={soundName(k)} value={f1(v)} unit="dB" lo={-30} hi={0} mark={-20} color={partColor(k, i)} dot={partColor(k, i)} />)}
        </section>
      )}
      {r.good_mixes && <div className={span(narrow, 12)}><GoodMixCard g={r.good_mixes} narrow={narrow} all /></div>}
      <section className={cn("cp-tile cp-card", span(narrow, stems.length ? 12 : 6))} style={{ gap: 0, paddingTop: 12, paddingBottom: 6 }}>
        <span className="cp-cap pb-1" title="Found by Aria's measurement rules and, without a reference, its mix model trained on rated mixes.">Everything Muse Spark said</span>
        {r.advice ? r.advice.notes.map((note, i) => (
          <div key={i} className="grid items-start gap-3 border-t border-hairline py-2.5 first-of-type:border-t-0" style={{ gridTemplateColumns: "26px minmax(0, 1fr)" }}>
            {(() => { const f = r.clarity.findings[note.finding]; return f ? <KindMark icon={findingIcon(f)} color={rangeOf(f.hz_range[0], f.hz_range[1]).color} /> : <span className="ae-pin">{i + 1}</span>; })()}
            <span className="text-[13.5px] leading-[20px] text-ink">{note.text}</span>
          </div>
        )) : <p className="cp-meta py-2">{r.advice_error ?? "No advice."}</p>}
      </section>
    </div>
  );
});

// ---------- Against the rated mixes (Nov 2): the shape model's lean and its directions ----------

/** Each of the model's directions, by name: what it is, and the move toward the good mixes */
const GOOD_FEATURES: Record<string, { label: string; more: string; less: string; unit?: string }> = {
  band_sub_db: { label: "Sub", more: "More sub", less: "Less sub" },
  band_mid_db: { label: "Mids", more: "More mids", less: "Less mids" },
  band_himid_db: { label: "Upper mids", more: "More upper mids", less: "Less upper mids" },
  band_presence_db: { label: "Presence", more: "More presence", less: "Less presence" },
  band_brilliance_db: { label: "Highs", more: "More highs", less: "Less highs" },
  band_air_db: { label: "Air", more: "More air", less: "Less air" },
  low_power_db: { label: "Low end", more: "Stronger low end", less: "Lighter low end" },
  mid_bumpiness_db: { label: "Mid bumps", more: "Bumpier mids", less: "Smoother mids" },
  lowmid_buildup_db: { label: "Low mids", more: "Boxier low mids", less: "Cleaner low mids" },
  tilt_db_per_oct: { label: "Lows to highs", more: "Brighter overall", less: "Darker overall", unit: "dB/oct" },
  top_spread_db: { label: "Top-end bumps", more: "Bumpier top end", less: "Smoother top end" },
};
const LEAN_WORDS = { closer: "Close to good mixes", between: "Partway to good mixes", further: "Far from good mixes" };

/** One direction: the green bar is where the middle half of the good mixes sit, the dot is yours. Each row has its
    own scale, wide enough for the dot. Plain colors (Ian, Nov 3: the gold read as alarm next to the problem cards). */
const GOOD_ZONE = "color-mix(in srgb, var(--good) 40%, transparent)";
function GoodMixRow({ f, narrow }: { f: GoodMixFeature; narrow: boolean }) {
  const w = GOOD_FEATURES[f.name] ?? { label: f.name, more: "More", less: "Less" };
  const [lo, hi] = f.good_range, spanOf = Math.max(Math.abs(f.diff) * 1.2, (hi - lo) * 2, 0.1);
  const x = (v: number) => `${((Math.max(-spanOf, Math.min(spanOf, v - f.good_median)) + spanOf) / (2 * spanOf)) * 100}%`;
  const unit = w.unit ?? "dB";
  return (
    <div className="grid items-center gap-3" style={{ gridTemplateColumns: `${narrow ? "6rem" : "8.5rem"} minmax(0, 1fr) ${narrow ? "7.25rem" : "8rem"}` }}
         title={`${w.label}${f.hz ? `, ${hzRange(f.hz)}` : ""}: yours ${f.value} ${unit}, good mixes ${lo} to ${hi} ${unit}`}>
      <span className="truncate text-[13px] text-ink-muted">{w.label}</span>
      <span className="relative h-4">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />
        <span className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ left: x(lo), right: `calc(100% - ${x(hi)})`, background: GOOD_ZONE }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: x(f.value), boxShadow: "0 0 0 2px var(--card)" }} />
      </span>
      <span className="truncate text-right text-[13px]" style={{ color: f.off ? "var(--ink)" : "var(--ink-faint)" }}>
        {f.off ? (f.toward > 0 ? w.more : w.less) : "Good"}</span>
    </div>
  );
}

/** Where the shape model puts the mix (Nov 2): a lean from further to closer, never a score, then the directions.
    Simple shows the few that are off the most; Detailed shows every one. */
function GoodMixCard({ g, narrow, all }: { g: GoodMixes; narrow: boolean; all?: boolean }) {
  const rows = all ? g.features : [...g.features].filter((f) => f.off).sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0)).slice(0, 3);   // the model's strongest pulls
  const n = g.mixes ? g.mixes.good + g.mixes.bad : null;
  return (
    <section className="cp-tile cp-card" style={{ gap: 12 }}>
      <span className="cp-cap inline-flex items-center gap-1.5" title={n ? `Aria's mix model, from ${n} mixes people rated good or bad. It looks at the EQ shape only. On songs it hadn't heard, it was right ${Math.round((g.heldout_accuracy ?? 0) * 100)}% of the time. It hears only the bars you checked, so an intro or a break lands further.` : undefined}>
        <GoodMixIcon style={{ width: 14, height: 14 }} />Compared with good mixes</span>
      {g.lean === null || g.lean_word === null ? <p className="cp-meta m-0">{g.error ?? "Not compared."}</p> : (
        <>
          <div className="grid gap-2">
            <span style={{ fontSize: narrow ? 17 : 20, lineHeight: "26px", fontWeight: 500, letterSpacing: "-.01em" }}>{LEAN_WORDS[g.lean_word]}</span>
            {/* Where it lands, far to close: a plain track like the rest of the window, filled up to the dot */}
            <span className="relative h-1.5 rounded-full" style={{ background: "var(--well)" }}>
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(97, Math.max(3, g.lean * 100))}%`, background: "var(--track)" }} />
              <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${Math.min(97, Math.max(3, g.lean * 100))}%`, boxShadow: "0 0 0 2px var(--card)" }} />
            </span>
            <span className="flex justify-between text-[11.5px] text-ink-faint"><span>Far</span><span>Close</span></span>
          </div>
          {rows.length ? (
            <div className="grid gap-2.5">
              {!all && <span className="text-[13px] text-ink-muted">To get closer:</span>}
              {rows.map((f) => <GoodMixRow key={f.name} f={f} narrow={narrow} />)}
            </div>
          ) : <p className="cp-meta m-0">Every part the model checks is where good mixes are.</p>}
        </>
      )}
    </section>
  );
}

/** Minimized: a small tab on the docked edge. Tap it to bring the window back as it was. */
function MinTab() {
  const { result, progress } = useAria();
  const n = useTodo(result).length;   // what's left to fix, like every other count
  const left = lastDock() === "left";
  // Drag to slide it along the edge (Ian, Oct 31); a click without a drag brings Aria back
  const drag = useRef<{ y: number; moved: boolean; frame: number } | null>(null);
  const dragged = useRef(false);
  const down = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.screenY, moved: false, frame: 0 }; dragged.current = false; };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.screenY - d.y;
    if (!d.moved && Math.abs(dy) < 4) return;
    if (!d.moved) { d.moved = true; send("tab_drag_start"); }
    cancelAnimationFrame(d.frame);
    d.frame = requestAnimationFrame(() => send("tab_move", { dy }));
  };
  const up = () => { if (drag.current?.moved) { send("tab_drag_end"); dragged.current = true; } drag.current = null; };
  return (
    <button onClick={() => { if (!dragged.current) restore(); dragged.current = false; }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            title="Click to bring Aria back. Drag to move it up or down." aria-label="Bring Aria back"
            className="flex h-screen w-full touch-none select-none flex-col items-center justify-center gap-2.5"
            style={{ background: "color-mix(in srgb, var(--ground) 86%, transparent)", border: "1px solid var(--glass-edge)", color: "var(--ink)",
                     borderRadius: left ? "0 16px 16px 0" : "16px 0 0 16px", boxShadow: "var(--shadow-tile)", cursor: "grab" }}>
      {/* a grip, so it reads as something to drag */}
      <span aria-hidden="true" className="grid grid-cols-2 gap-[3px] opacity-40">{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} className="block size-[3px] rounded-full bg-current" />)}</span>
      <Mark size={22} />
      {progress ? <span className="cp-meta" style={{ fontSize: 10 }}>…</span>
        : result ? <span className={n ? "cp-tag cp-tag-hot" : "cp-tag cp-tag-good"} style={{ padding: "0 6px" }}>{n}</span> : null}
      <BackIcon style={{ width: 14, height: 14, transform: left ? "rotate(180deg)" : undefined, color: "var(--ink-muted)" }} />
    </button>
  );
}

/** While Ask Muse is popped out: the main window shrinks to what needs fixing. Tap a row to hear it. */
function Compact() {
  const { result, progress, error } = useAria();
  const list = useTodo(result);
  return (
    <div className="cp-stage is-flush">
      <section className="cp-tile cp-compact h-full" style={{ gap: 10 }}>
        <div className="cp-spread" style={{ zIndex: 5 }}>{/* above the rows, so the Layout menu covers them */}
          <div className="cp-mark"><Mark size={22} /><b>Mix check</b></div>
          <div className="cp-row" style={{ gap: 2 }}>
            <button className="cp-btn cp-btn-primary cp-btn-sm" disabled={!!progress} onClick={checkMix}>{progress ? "Checking" : result ? "Check again" : "Check mix"}</button>
            <LayoutMenu mode={lastDock()} chatOut />
            <IconButton label="Minimize to the edge" onClick={minimize}><MinimizeIcon style={{ width: 15, height: 15 }} /></IconButton>
            <IconButton label="Close" onClick={closeWindow}><CloseIcon style={{ width: 15, height: 15 }} /></IconButton>
          </div>
        </div>
        {error && <p className="cp-meta line-clamp-2" style={{ color: "var(--hot)" }}>{error}</p>}
        {!result ? <p className="cp-meta">{progress ? progress.text : "No Mix check yet. Play the busiest part of your song and press Check mix."}</p> : (
          <>
            <div className="cp-row" style={{ alignItems: "flex-end" }}>
              <span className="cp-figure"><CountUp value={list.length} /><small>{list.length ? "to fix" : "Nothing sticks out"}</small></span>
              {result.clarity.spectra && <div className="ml-auto h-10 w-[150px]"><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode !== "master"} /></div>}
            </div>
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {list.map((p, i) => (
                <button key={i} onClick={() => jumpTo(p.bar)} title={`${p.short} Tap to hear it in Live.`}
                        className={cn("flex h-[42px] shrink-0 items-center gap-2.5 text-left text-ink", i > 0 && "border-t border-hairline")}>
                  <MarkOf p={p} />
                  <span className="flex-1 truncate text-[13px] font-medium">{p.name}</span>
                  <span className="ae-mono whitespace-nowrap" style={{ color: "var(--hot)" }}>{amountText(p)}</span>
                  <span className="ae-mono whitespace-nowrap text-right text-ink-faint">{barsOf(p)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
