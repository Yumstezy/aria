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
import { RefChart, RefLegend, THEIRS, YOURS } from "@/components/ref-chart";
import { ProblemThumb } from "@/components/problem-thumb";
import { AnalyzerIcon, BackIcon, BuriedIcon, ClashIcon, ChatIcon, CheckIcon, ClickIcon, CloseIcon, DockLeftIcon, DockRightIcon, EarIcon, ExpandIcon, GrooveIcon, LayoutIcon, MinimizeIcon, HarshIcon, HomeIcon, MicIcon, MixIcon, MoonIcon, MudIcon,
         ReferenceIcon, RingIcon, SunIcon } from "@/components/icons";
import { BANDS, bandsWith, barsOf, problemsOf, statusWord, type Problem } from "@/lib/problems";
import { barsLabel, checkMix, clearReference, closeChat, closeWindow, fixIt, hz, jumpTo, shortName, lastDock, listenTracks, minimize, notice, openChat, referenceOf, restore, setAskOpen, setReferenceFile, setTheme, setWindowMode, stopListening,
         partColor, partNames, soundName, useAria, useAriaSel, useViewport, type Kind, type RefCompare, type Result } from "@/lib/aria";
import { cn } from "@/lib/utils";

type View = "home" | "mixcheck" | "reference";

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
              <span className="flex items-center gap-2 text-[14px] text-ink-muted">
                {view === "mixcheck" ? <MixIcon style={{ width: 16, height: 16 }} /> : view === "reference" ? <ReferenceIcon style={{ width: 16, height: 16 }} /> : <HomeIcon style={{ width: 16, height: 16 }} />}
                {view === "mixcheck" ? "Mix check" : view === "reference" ? "Reference" : "Home"}</span>
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
              {view === "mixcheck" ? (result ? barsLabel(result) : "Not checked yet") : view === "reference" ? "Reference" : "Home"}
              <span className="text-ink-faint">{view === "mixcheck" ? (result?.recording.tempo ? ` ${Math.round(result.recording.tempo)} BPM` : "") : view === "reference" ? "" : session ? ` ${Math.round(session.tempo)} BPM` : ""}</span>
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

          {view !== "reference" && <KeyTracks />}
          {view === "home" ? <Home narrow={narrow} onOpen={openMixCheck} />
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
        {item("reference", "Reference", <ReferenceIcon />)}
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

/** Each band against the reference in one slim row: the difference in dB, blue where the reference is fuller
    and gold where yours is, once it's 2 dB or more. The picture above shows where; this says by how much. */
function RefBandRow({ r }: { r: RefCompare }) {
  return (
    <div className="flex" aria-label="Each band against the reference">
      {r.bands.map((b, i) => {
        const d = b.diff_db, off = d !== null && Math.abs(d) >= 2;
        return (
          <span key={b.name} className="ae-mono min-w-0 truncate text-center text-[11px]" title={`${b.name}, ${hz(b.lo)} to ${hz(b.hi)}`}
                style={{ flex: 1, color: off ? (d! > 0 ? YOURS : THEIRS) : "var(--ink-faint)", borderLeft: i ? "1px solid var(--hairline)" : undefined }}>
            {d === null ? "none" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)}`}
          </span>
        );
      })}
    </div>
  );
}

/** Reference (build step 8, Ian: compare first). Live's web view takes no dropped files, so the song is chosen
    from Finder. After: the song, Change and Remove, and the last check against it: both curves, then each band. */
const ReferenceScreen = memo(function ReferenceScreen({ narrow, onOpen }: { narrow: boolean; onOpen: () => void }) {
  const ref = useAriaSel(referenceOf), result = useAriaSel((s) => s.result), progress = useAriaSel((s) => !!s.progress);
  const picker = useRef<HTMLInputElement>(null);
  const compared = result?.reference && ref && result.reference.path === ref.path ? result.reference : null;
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
      <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14 }}>
        {choose}
        <span className="ae-kind" style={{ width: 40, height: 40, borderRadius: 12, color: "var(--ink)" }}><ReferenceIcon style={{ width: 20, height: 20 }} /></span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="cp-cap">Your reference</span>
          <span className="truncate text-[17px] font-medium" title={ref.path}>{ref.name}</span>
        </div>
        <button className="cp-btn cp-btn-sm" onClick={() => picker.current?.click()}>Change</button>
        <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={clearReference}>Remove</button>
      </section>
      <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ gap: 12 }}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[14px] font-medium text-ink" title="Both songs at the same loudness. Blue is where the reference is fuller, gold where yours is.">
            {compared && result ? barsLabel(result) : "Against your reference"}</span>
          {compared && <div className="ml-auto min-w-0"><RefLegend name={ref.name} /></div>}
        </div>
        {compared ? (compared.error || !compared.curve ? <p className="cp-meta">{compared.error ?? "Nothing to compare."}</p> : (
          <>
            <RefChart r={compared} height={narrow ? 300 : 230} zones={refZones(result!)} />
            <RefBandRow r={compared} />
          </>
        )) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="cp-meta">{result ? "Your last check was before this song was picked." : "Not checked yet."}</span>
            <button className="cp-btn cp-btn-primary cp-btn-sm" disabled={progress} onClick={checkMix}>{progress ? "Checking" : "Check mix"}</button>
          </div>
        )}
        {compared && !compared.error && result && problemsOf(result).some((p) => p.findings[0].kind === "reference") && (
          <div><button className="cp-btn cp-btn-light cp-btn-sm" onClick={onOpen}>See what to fix</button></div>
        )}
      </section>
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
/** The reference problems as pins for the comparison picture, numbered as in the problem list */
const refZones = (r: Result) => problemsOf(r).flatMap((p, i) => p.findings[0].kind === "reference" ? [{ n: i + 1, lo: p.findings[0].hz_range[0], hi: p.findings[0].hz_range[1] }] : []);
/** Louder than the reference is gold (yours is fuller), quieter is blue (theirs is) */
const refColor = (p: Problem) => ((p.findings[0].diff_db ?? 0) > 0 ? YOURS : THEIRS);
const iconFor = (p: Problem) => p.findings[0].kind === "reference" ? <ReferenceIcon style={{ color: refColor(p) }} />
  : KINDS.find((x) => x.kind === (p.name === "Mud" ? "buildup" : p.findings[0].kind))!.icon;

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
                  <span className="ae-mono" style={{ color: first.findings[0].kind === "reference" ? refColor(first) : "var(--hot)" }}>{amountText(first)}</span>
                  <div className="mt-auto flex gap-1.5 pt-2">
                    <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => fixWithMuse(first)}>Fix it</button>
                    {!narrow && <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={() => jumpTo(first.bar)}>Hear it</button>}
                  </div>
                </div>
                <div className="ae-thumb relative">{first.findings[0].kind === "reference" && r.reference?.curve
                  ? <div className="absolute inset-2" title={`Yours (gold) and ${r.reference.name} (blue)`}>
                      <RefChart r={r.reference} zoom={[first.findings[0].hz_range[0] / 3, first.findings[0].hz_range[1] * 3]} height={120}
                                zones={[{ n: 1, lo: first.findings[0].hz_range[0], hi: first.findings[0].hz_range[1] }]} /></div>
                  : <ProblemThumb p={first} spectra={spectra} />}</div>
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

      {r.reference && !r.reference.error && r.reference.curve && (
        <Rise i={3}>
          <section className="cp-tile cp-card" style={{ gap: 10 }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[14px] font-medium text-ink" title="Both songs at the same loudness. Blue is where the reference is fuller, gold where yours is.">Against your reference</span>
              <div className="ml-auto min-w-0"><RefLegend name={r.reference.name} /></div>
            </div>
            <RefChart r={r.reference} height={narrow ? 260 : 170} zones={refZones(r)} onZone={(n) => setOpen(n - 1)} />
          </section>
        </Rise>
      )}

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
      <section className={cn("cp-tile cp-card", span(narrow, stems.length ? 12 : 6))} style={{ gap: 0, paddingTop: 12, paddingBottom: 6 }}>
        <span className="cp-cap pb-1" title="Found by Aria's measurement rules (version 1). The mix model we're training on rated mixes joins in once it beats its baselines.">Everything Muse Spark said</span>
        {r.advice ? r.advice.notes.map((note, i) => (
          <div key={i} className="grid items-start gap-3 border-t border-hairline py-2.5 first-of-type:border-t-0" style={{ gridTemplateColumns: "26px minmax(0, 1fr)" }}>
            <span className="ae-pin">{i + 1}</span>
            <span className="text-[13.5px] leading-[20px] text-ink">{note.text}</span>
          </div>
        )) : <p className="cp-meta py-2">{r.advice_error ?? "No advice."}</p>}
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
              <span className="cp-figure"><CountUp value={list.length} /><small>{list.length ? "to fix" : "Nothing sticks out"}</small></span>
              {result.clarity.spectra && <div className="ml-auto h-10 w-[150px]"><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode !== "master"} /></div>}
            </div>
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {list.map((p, i) => (
                <button key={i} onClick={() => jumpTo(p.bar)} title={`${p.short} Tap to hear it in Live.`}
                        className={cn("flex h-[42px] shrink-0 items-center gap-2.5 text-left text-ink", i > 0 && "border-t border-hairline")}>
                  <span className="ae-kind" style={{ width: 26, height: 26 }}>{iconFor(p)}</span>
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
