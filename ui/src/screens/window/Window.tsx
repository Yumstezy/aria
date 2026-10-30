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
import { ProblemThumb } from "@/components/problem-thumb";
import { AnalyzerIcon, BackIcon, BuriedIcon, ClashIcon, ChatIcon, CheckIcon, ClickIcon, CloseIcon, DockLeftIcon, DockRightIcon, EarIcon, ExpandIcon, GrooveIcon, LayoutIcon, MinimizeIcon, HarshIcon, HomeIcon, MicIcon, MixIcon, MoonIcon, MudIcon,
         ReferenceIcon, RingIcon, SunIcon } from "@/components/icons";
import { BANDS, bandsWith, barsOf, problemsOf, statusWord, type Problem } from "@/lib/problems";
import { barsLabel, checkMix, closeChat, closeWindow, fixIt, hz, jumpTo, shortName, lastDock, listenTracks, minimize, notice, openChat, restore, setAskOpen, setTheme, setWindowMode, stopListening,
         partColor, partNames, soundName, useAria, useAriaSel, useViewport, type Kind, type Result } from "@/lib/aria";
import { cn } from "@/lib/utils";

type View = "home" | "mixcheck";

// Docked (a narrow panel beside Live) keeps the rail as icons and stacks the bento in one column.
// Short as well as narrow means Ask Muse is popped out under it: show only what to fix.
const NARROW_PX = 760, COMPACT_PX = 480, TAB_PX = 120;
const span = (narrow: boolean, n: number) => (narrow ? "span-12" : `span-${n}`);
const n = (v: number) => ({ "--n": v }) as CSSProperties;

export function AriaWindow() {
  const { engine, progress, result, error, notice: note, session } = useAria();
  const [view, setView] = useState<View>("home");
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
              <span className="flex items-center gap-2 text-[14px] text-ink-muted">{view === "mixcheck" ? <MixIcon style={{ width: 16, height: 16 }} /> : <HomeIcon style={{ width: 16, height: 16 }} />}{view === "mixcheck" ? "Mix check" : "Home"}</span>
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
            <h1 className="cp-title" style={{ fontSize: narrow ? 28 : 34, lineHeight: narrow ? "34px" : "40px" }}>
              {view === "mixcheck" ? (result ? barsLabel(result) : "Not checked yet") : "Home"}
              <span className="text-ink-faint">{view === "mixcheck" ? (result?.recording.tempo ? ` ${Math.round(result.recording.tempo)} BPM` : "") : session ? ` ${Math.round(session.tempo)} BPM` : ""}</span>
            </h1>
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

          <KeyTracks />
          {view === "home" ? <Home narrow={narrow} onOpen={openMixCheck} />
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
  const list = result ? problemsOf(result) : [];
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
        {item(null, "Live analyzer", <AnalyzerIcon />)}
        {item(null, "Groove match", <GrooveIcon />)}
        {item(null, "Reference", <ReferenceIcon />)}
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

/** Home (Ember, Oct 29): no setup steps (Ian: "everything should be self explanatory"). Before a check, the
    kinds of problem Aria finds, as icons, and Check mix. After one, how many to fix and the real picture. */
const Home = memo(function Home({ narrow, onOpen }: { narrow: boolean; onOpen: () => void }) {
  const result = useAriaSel((s) => s.result), progress = useAriaSel((s) => !!s.progress);
  const list = result ? problemsOf(result) : [];

  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-hero", span(narrow, 12))} style={{ gap: 12 }}>
        <span className="cp-cap">Your song</span>
        {result ? (
          <>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <span className="ae-big"><CountUp value={list.length} /></span>
              <span className="pb-1.5 text-[15px] text-ink-muted">{list.length ? "to fix" : "Nothing sticks out"}</span>
              <div className="flex gap-1.5 pb-1">{list.map((p, i) => <span key={i} className="ae-kind" title={p.name}>{iconFor(p)}</span>)}</div>
              <span className="ae-mono ml-auto pb-1.5">{barsLabel(result)}</span>
            </div>
            {result.clarity.spectra && <div style={{ height: narrow ? 72 : 96 }}><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode !== "master"} /></div>}
            <div><button className="cp-btn cp-btn-light" onClick={onOpen}>See what to fix</button></div>
          </>
        ) : (
          <>
            <span className="ae-big">Not checked yet</span>
            <div className="ae-kinds">
              {KINDS.map((k) => <span key={k.kind} title={k.name}><span className="ae-kind is-idle">{k.icon}</span>{k.name}</span>)}
            </div>
            <div><button className="cp-btn cp-btn-primary" disabled={progress} onClick={checkMix}>{progress ? "Checking" : "Check mix"}</button></div>
          </>
        )}
      </section>

      <WhereItHappens r={result} narrow={narrow} onPick={onOpen} />
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

const KINDS: { kind: Kind; name: string; icon: ReactNode }[] = [
  { kind: "masking", name: "Buried sounds", icon: <BuriedIcon /> },
  { kind: "buildup", name: "Mud", icon: <MudIcon /> },
  { kind: "harsh", name: "Harsh hits", icon: <HarshIcon /> },
  { kind: "resonance", name: "Ringing notes", icon: <RingIcon /> },
  { kind: "bass_click", name: "Bass clicks", icon: <ClickIcon /> },
  { kind: "clash", name: "Clashing tracks", icon: <ClashIcon /> },
];
// Mud is measured as synths buried in the low mids, so it gets the mud icon, not the buried one
const iconFor = (p: Problem) => KINDS.find((x) => x.kind === (p.name === "Mud" ? "buildup" : p.findings[0].kind))!.icon;

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

/** Mix check, Simple (Ember, Oct 29): three small cards (how many, fix first with its picture, who Aria heard),
    then the picture beside a short numbered list. A row opens to Muse's words and the buttons. */
const Simple = memo(function Simple({ r, open, setOpen, narrow }: { r: Result; open: number; setOpen: (i: number) => void; narrow: boolean }) {
  const list = problemsOf(r);
  const first = list[0];
  const spectra = r.clarity.spectra, names = spectra ? partNames(spectra) : [];
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
            <div className="mt-2 flex flex-wrap gap-1.5">{list.map((p, i) => <button key={i} className="ae-kind" title={p.name} aria-label={p.name} onClick={() => setOpen(i)}>{iconFor(p)}</button>)}</div>
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
                  <span className="ae-mono" style={{ color: "var(--hot)" }}>{amountText(first)}</span>
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
                <span style={{ fontSize: 22, fontWeight: 500 }}>Nothing sticks out</span>
                <span className="text-[13px] text-ink-muted">{r.advice?.summary ?? "Check another part of the song next."}</span>
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

      <div className="grid gap-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1.55fr) minmax(0, 1fr)", alignItems: "start" }}>
        <Rise i={3}>
          <section className="cp-tile cp-card" style={{ gap: 8 }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className="text-[14px] font-medium text-ink">{list.length ? "Where the problems are" : "Your mix"}</span>
              <div className="ml-auto">{legend}</div>
            </div>
            {spectra
              ? <Waves spectra={spectra} findings={r.clarity.findings} split={r.clarity.mode !== "master"} bare
                       onZone={(f) => setOpen(list.findIndex((p) => p.findings.includes(f)))} />
              : <p className="cp-meta">The picture appears after the next Check mix.</p>}
          </section>
        </Rise>
        {list.length > 0 && (
          <Rise i={4}>
            <section className="cp-tile cp-card" style={{ paddingTop: 4, paddingBottom: 4, gap: 0 }}>
              {list.map((p, i) => (
                <div key={p.name + i}>
                  <button className="ae-row" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                    <span className="ae-pin">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[14px] font-medium"><span className="truncate">{p.name}</span>
                        {whoOf(p).map((n) => <span key={n} className="ae-dot" style={{ color: partColor(n, names.indexOf(n)), width: 7, height: 7 }} />)}</span>
                      <span className="ae-mono block truncate">{p.where}</span>
                    </span>
                    <span className="ae-mono whitespace-nowrap">{amountText(p)}</span>
                    <span className="flex items-center gap-1.5 text-ink-muted"><span className="ae-kind" style={{ width: 28, height: 28 }}>{iconFor(p)}</span>
                      <BackIcon style={{ width: 13, height: 13, transform: open === i ? "rotate(90deg)" : "rotate(180deg)", transition: "transform 160ms" }} /></span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                        <div className="grid gap-2.5 pb-3.5 pl-[38px]">
                          <p className="m-0 text-[13.5px] text-ink">{p.short}</p>
                          {p.notes.map((note, k) => <p key={k} className="m-0 text-[12.5px] leading-[18px] text-ink-muted">{note.text}</p>)}
                          <span className="ae-mono">{barsOf(p)}</span>
                          <div className="flex gap-1.5">
                            <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => fixWithMuse(p)}>Fix it</button>
                            <button className="cp-btn cp-btn-sm" onClick={() => jumpTo(p.bar)}>Hear it in Live</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </section>
          </Rise>
        )}
      </div>
    </div>
  );
});

function Stat({ label, value, unit, why }: { label: string; value: number | null | undefined; unit: string; why?: string }) {
  const missing = value === null || value === undefined;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="cp-cap">{label}</span>
      {missing ? <span className="cp-meta" style={{ lineHeight: "28px" }} title={why}>Not measured</span>
        : <span className="cp-figure-sm">{value}<small>{unit}</small></span>}
    </div>
  );
}

const Detailed = memo(function Detailed({ r, narrow }: { r: Result; narrow: boolean }) {
  const m = r.measured, why = m.unmeasured;
  const f1 = (x: number | null | undefined) => (x === null || x === undefined ? null : Number(x.toFixed(1)));
  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-card", span(narrow, 7))} style={{ gap: 12 }}>
        <span className="cp-cap">The numbers</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-3">
          <Stat label="Loudness" value={f1(m.integrated_lufs)} unit="LUFS" why={why.integrated_lufs || why.all} />
          <Stat label="True peak" value={f1(m.true_peak_dbtp)} unit="dBTP" why={why.all} />
          {["bass", "mids", "treble"].map((b) => <Stat key={b} label={b} value={f1(m.bands_db[b])} unit="dB" why={why[`bands_db.${b}`] || why.all} />)}
          {["bass", "mids", "treble"].map((b) => <Stat key={"w" + b} label={`Width ${b}`} value={m.width[b] === null || m.width[b] === undefined ? null : Math.round(m.width[b]! * 100)} unit="%" why={why[`width.${b}`] || why.all} />)}
        </div>
        <p className="cp-meta">Loudness and peak are here for reference. Aria's advice is about clarity.</p>
        <p className="cp-meta">Found by Aria's measurement rules (version 1). The mix model we're training on rated mixes joins in once it beats its baselines.</p>
      </section>
      {r.clarity.stems && (
        <section className={cn("cp-tile cp-card", span(narrow, 5))} style={{ gap: 12 }}>
          <span className="cp-cap">Each part against the mix</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {Object.entries(r.clarity.stems).map(([k, v]) => <Stat key={k} label={soundName(k)} value={f1(v)} unit="dB vs mix" />)}
          </div>
          <p className="cp-meta">Split by {r.clarity.split_by ?? "Demucs"}. A sound more than 20 dB under the mix counts as not playing.</p>
        </section>
      )}
      <section className="cp-tile cp-card span-12" style={{ gap: 8 }}>
        <span className="cp-cap">Everything Muse Spark said</span>
        <ul className="cp-body m-0 grid gap-1.5 pl-[18px]">
          {r.advice ? r.advice.notes.map((note, i) => <li key={i}>{note.text}</li>) : <li style={{ color: "var(--ink-muted)" }}>{r.advice_error ?? "No advice."}</li>}
        </ul>
      </section>
    </div>
  );
});

/** Minimized: a small tab on the docked edge. Tap it to bring the window back as it was. */
function MinTab() {
  const { result, progress } = useAria();
  const n = result ? problemsOf(result).length : 0;
  const left = lastDock() === "left";
  return (
    <button onClick={restore} title="Bring Aria back" aria-label="Bring Aria back"
            className="flex h-screen w-full flex-col items-center justify-center gap-2.5"
            style={{ background: "color-mix(in srgb, var(--ground) 86%, transparent)", border: "1px solid var(--glass-edge)", color: "var(--ink)",
                     borderRadius: left ? "0 16px 16px 0" : "16px 0 0 16px", boxShadow: "var(--shadow-tile)", cursor: "pointer" }}>
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
  const list = result ? problemsOf(result) : [];
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
              <span className="cp-figure"><CountUp value={list.length} /><small>{list.length === 1 ? "thing to fix" : list.length ? "things to fix" : "Nothing sticks out"}</small></span>
              {result.clarity.spectra && <div className="ml-auto h-10 w-[150px]"><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode !== "master"} /></div>}
            </div>
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {list.map((p, i) => (
                <button key={i} onClick={() => jumpTo(p.bar)} title={`${p.short} Tap to hear it in Live.`}
                        className={cn("flex h-[38px] shrink-0 items-center gap-2.5 text-left text-ink", i > 0 && "border-t border-hairline")}>
                  <span className="flex-1 truncate text-[13px] font-semibold">{p.name}</span>
                  <span className="cp-tag cp-tag-hot">{statusWord(p)}</span>
                  <span className="cp-meta whitespace-nowrap text-right" style={{ fontFamily: "var(--font-mono)" }}>{barsOf(p)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
