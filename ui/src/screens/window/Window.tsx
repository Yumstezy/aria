// The Aria window: the side rail and the bento (design/screens/11 and 12), Home and Mix check
// (Simple and Detailed). Picture first, a short line second, numbers when asked for (DESIGN.md).
// Before the first check every card shows its layout greyed out and says what comes next.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mark } from "@/components/brand";
import { Waves } from "@/components/waves";
import { TickGauge } from "@/components/tick-gauge";
import { CountUp } from "@/components/count-up";
import { AskMuse } from "@/components/ask-muse";
import { MiniWaves } from "@/components/mini-waves";
import { AnalyzerIcon, BackIcon, BuriedIcon, ChatIcon, CheckIcon, ClickIcon, CloseIcon, DockLeftIcon, DockRightIcon, ExpandIcon, LayoutIcon, MinimizeIcon, GrooveIcon, HarshIcon, HomeIcon, MicIcon, MixIcon, MoonIcon, MudIcon,
         ReferenceIcon, RingIcon, SunIcon } from "@/components/icons";
import { BANDS, bandsWith, barsOf, problemsOf, statusWord, type Problem } from "@/lib/problems";
import { barsLabel, checkMix, closeChat, closeWindow, describe, fixIt, hz, jumpTo, lastDock, minimize, notice, openChat, restore, setAskOpen, setTheme, setWindowMode,
         soundName, useAria, useViewport, type Kind, type Result } from "@/lib/aria";
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
  useEffect(() => { if (result) { setView("mixcheck"); setOpen(0); } }, [result]);

  if (width < TAB_PX) return <MinTab />;
  if (compact) return <Compact />;

  const status = progress ? `${progress.text}${progress.detail ? ` · ${progress.detail}` : ""}` : error ?? note;
  const sessionLine = session ? `This session · ${Math.round(session.tempo)} BPM · ${session.signature[0]}/${session.signature[1]}` : "This session";

  return (
    <div className={cn("cp-stage", narrow && "is-flush")} style={narrow ? undefined : { height: "100vh", minHeight: 0 }}>
      <div className="cp-glass cp-window" style={{ height: narrow ? "100vh" : "100%", gridTemplateColumns: narrow ? "60px minmax(0, 1fr)" : undefined }}>
        <Rail view={view} setView={setView} narrow={narrow} />
        <main className="cp-main overflow-y-auto" style={narrow ? { padding: 14 } : undefined}>
          <header className={cn("cp-spread", narrow && "flex-wrap")}>
            <div className={cn(narrow && "flex w-full items-start justify-between")}>
              <div>
                <span className="cp-cap">{view === "mixcheck" ? (result ? barsLabel(result) : "Not checked yet") : sessionLine}</span>
                <h1 className="cp-title" style={{ marginTop: 4 }}>{view === "mixcheck" ? "Mix check" : "Home"}</h1>
              </div>
              {narrow && (
                <div className="cp-row" style={{ gap: 2 }}>
                  <LayoutMenu mode={lastDock()} />
                  <IconButton label="Minimize to the edge" onClick={minimize}><MinimizeIcon style={{ width: 15, height: 15 }} /></IconButton>
                  <IconButton label="Close" onClick={closeWindow}><CloseIcon style={{ width: 15, height: 15 }} /></IconButton>
                </div>
              )}
            </div>
            <div className="cp-row flex-wrap justify-end">
              {view === "mixcheck" && result && (
                <div className="cp-seg" role="group" aria-label="View">
                  <button aria-pressed={!detailed} onClick={() => setDetailed(false)}>Simple</button>
                  <button aria-pressed={detailed} onClick={() => setDetailed(true)}>Detailed</button>
                </div>
              )}
              <button className="cp-btn cp-btn-primary" disabled={!!progress} onClick={checkMix}>{progress ? "Checking" : result ? "Check again" : "Check mix"}</button>
              {!narrow && <LayoutMenu mode="full" />}
            </div>
          </header>
          {(status || engine.state !== "up") && (
            <div className="cp-row flex-wrap" role="status">
              {engine.state !== "up" && <span className={cn("cp-tag", engine.state === "starting" ? "cp-tag-idle" : "cp-tag-hot")}>{engine.state === "starting" ? "Starting Aria" : "Engine not running"}</span>}
              {status && <span className="cp-meta" style={error ? { color: "var(--hot)" } : undefined}>{status}</span>}
            </div>
          )}

          {view === "home" ? <Home narrow={narrow} onOpen={() => setView("mixcheck")} />
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

function Rail({ view, setView, narrow }: { view: View; setView: (v: View) => void; narrow: boolean }) {
  const { theme, ask } = useAria();
  const item = (id: View | null, label: string, icon: ReactNode) => (
    <a key={label} href="#" title={label} aria-current={id === view ? "page" : undefined} style={narrow ? { justifyContent: "center", padding: 0 } : undefined}
       onClick={(e: MouseEvent) => { e.preventDefault(); if (id) setView(id); else notice(`${label} is coming soon.`); }}>
      {icon}{!narrow && label}
    </a>
  );
  return (
    <aside className="cp-rail" style={narrow ? { padding: "16px 8px", alignItems: "stretch" } : undefined}>
      <div className="cp-mark" style={narrow ? { justifyContent: "center" } : undefined}><Mark size={26} />{!narrow && <b>Aria</b>}</div>
      <nav className="cp-nav" aria-label="Tools">
        {item("home", "Home", <HomeIcon />)}
        {item("mixcheck", "Mix check", <MixIcon />)}
        {item(null, "Live analyzer", <AnalyzerIcon />)}
        {item(null, "Groove match", <GrooveIcon />)}
        {item(null, "Reference", <ReferenceIcon />)}
      </nav>
      {narrow ? (
        <button className="cp-icon-btn" style={{ marginTop: "auto", alignSelf: "center" }} title={theme === "sky" ? "Switch to dark" : "Switch to light"}
                aria-label={theme === "sky" ? "Switch to dark" : "Switch to light"} onClick={() => setTheme(theme === "sky" ? "night" : "sky")}>
          {theme === "sky" ? <MoonIcon /> : <SunIcon />}
        </button>
      ) : (
        <div className="cp-seg" role="group" aria-label="Appearance" style={{ alignSelf: "flex-start", marginTop: "auto", marginBottom: 14 }}>
          <button aria-pressed={theme === "sky"} onClick={() => setTheme("sky")}>Light</button>
          <button aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Dark</button>
        </div>
      )}
      <div className="cp-ask-dock">
        <button className="cp-ask-btn" aria-expanded={ask.open} aria-label="Ask Muse" style={narrow ? { justifyContent: "center", padding: 0 } : undefined}
                onClick={() => setAskOpen(!ask.open)}><MicIcon />{!narrow && "Ask Muse"}</button>
        {!narrow && <span className="cp-meta" title="In Live, press Cmd+K, click Ask key on the Aria strip, then press a key.">or press your mapped key</span>}
      </div>
    </aside>
  );
}

// ---------- Home ----------

function Home({ narrow, onOpen }: { narrow: boolean; onOpen: () => void }) {
  const { engine, result, session, ask } = useAria();
  const list = result ? problemsOf(result) : [];
  const steps: [string, boolean][] = [
    ["Aria engine is running", engine.state === "up"],
    ["Aria is last on your Main track", !!session && session.chain.on_main && !session.chain.after.length],
    ["Play the busiest part, press Check mix", !!result],
    ["Ask Muse to fix what it finds", ask.log.length > 0],
  ];
  const next = steps.findIndex(([, done]) => !done);
  const tool = (label: string, icon: ReactNode, tag: ReactNode, onClick: () => void) => (
    <a className={cn("cp-tile cp-card", span(narrow, 3))} href="#" style={{ minHeight: 118, gap: 8 }} onClick={(e) => { e.preventDefault(); onClick(); }}>
      <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 12, background: "var(--well)", color: "var(--action)" }}>{icon}</span>
      <span className="cp-tile-title">{label}</span>
      <span className="cp-push">{tag}</span>
    </a>
  );
  const soon = (label: string) => () => notice(`${label} is coming soon.`);

  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-hero", span(narrow, 7))} style={{ minHeight: narrow ? 0 : 286, gap: 10 }}>
        <span className="cp-cap">Your song</span>
        {result ? (
          <>
            <span style={{ fontSize: 28, lineHeight: "32px", fontWeight: 600, letterSpacing: "-.02em" }}>
              {list.length === 0 ? "Nothing sticks out" : `${list.length} ${list.length === 1 ? "thing" : "things"} to fix`}
            </span>
            <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--on-tile-muted)" }}>{barsLabel(result)}. {list.slice(0, 3).map((p) => p.name).join(", ")}{list.length > 3 ? " and more" : ""}</span>
            {result.clarity.spectra && <div className="cp-push" style={{ height: 64 }}><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode === "split"} /></div>}
            <div className={result.clarity.spectra ? "" : "cp-push"}><button className="cp-btn cp-btn-light" onClick={onOpen}>See what to fix</button></div>
          </>
        ) : (
          <>
            <span style={{ fontSize: 28, lineHeight: "32px", fontWeight: 600, letterSpacing: "-.02em" }}>Not checked yet</span>
            <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--on-tile-muted)", maxWidth: 460 }}>
              Aria listens to 16 bars of your song and finds sounds that clash or stick out. Muse Spark says how to fix each one, and fixes it when you say yes.
            </span>
            <div className="cp-empty cp-push" style={{ flexDirection: "row", alignItems: "center", gap: 14, color: "var(--on-tile)" }}>
              <MixIcon style={{ width: 22, height: 22, flex: "none" }} />
              <div style={{ display: "grid", gap: 2 }}>
                <b style={{ fontSize: 14 }}>Play the busiest part, then press Check mix</b>
                <span style={{ fontSize: 12, color: "var(--on-tile-muted)" }}>Buried sounds, mud, harsh hits, ringing notes and bass clicks</span>
              </div>
            </div>
          </>
        )}
      </section>

      <section className={cn("cp-tile cp-card", span(narrow, 5))} style={{ minHeight: narrow ? 0 : 286, gap: 16 }}>
        <span className="cp-cap">Get started</span>
        <ul className="cp-check">
          {steps.map(([label, done], i) => <li key={label} className={done ? "is-done" : i === next ? "is-next" : ""}><i />{label}</li>)}
        </ul>
        <span className="cp-meta cp-push">Nothing in your set changes until you ask Muse or say yes.</span>
      </section>

      {tool("Mix check", <MixIcon style={{ width: 20, height: 20 }} />,
            !result ? <span className="cp-tag cp-tag-idle">Not run yet</span>
              : list.length ? <span className="cp-tag cp-tag-hot">{list.length} to fix</span> : <span className="cp-tag cp-tag-good">Clear</span>, onOpen)}
      {tool("Live analyzer", <AnalyzerIcon style={{ width: 20, height: 20 }} />, <span className="cp-tag cp-tag-idle">Coming soon</span>, soon("Live analyzer"))}
      {tool("Groove match", <GrooveIcon style={{ width: 20, height: 20 }} />, <span className="cp-tag cp-tag-idle">Coming soon</span>, soon("Groove match"))}
      {tool("Reference", <ReferenceIcon style={{ width: 20, height: 20 }} />, <span className="cp-tag cp-tag-idle">Coming soon</span>, soon("Reference"))}

      <WhereItHappens r={result} narrow={narrow} onPick={onOpen} />
    </div>
  );
}

/** Where in the mix each problem is, low to high. Before a check: the same bands, greyed out. */
function WhereItHappens({ r, narrow, onPick }: { r: Result | null; narrow: boolean; onPick?: (p: Problem) => void }) {
  const list = r ? problemsOf(r) : [];
  const bands = bandsWith(list);
  const range = (b: { lo: number; hi: number }) => `${hz(b.lo)} to ${hz(b.hi)}`;
  return (
    <section className={cn("cp-tile cp-card", span(narrow, 12))} style={{ gap: 12 }}>
      <div className="cp-spread">
        <span className="cp-cap">Where it is in the mix</span>
        {r ? <span className="cp-meta">Low to high. Tap one to see it</span> : <span className="cp-tag cp-tag-idle">No check yet</span>}
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
      {!r && (
        <div className="cp-empty" style={{ flexDirection: narrow ? "column" : "row", alignItems: narrow ? "flex-start" : "center", justifyContent: "space-between", padding: "18px 20px", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 15 }}>Your first Mix check fills this in</b>
            <span className="cp-meta">Each problem lights up where it sits, from the sub bass to the air.</span>
          </div>
          <button className="cp-btn" onClick={checkMix}>Check mix</button>
        </div>
      )}
    </section>
  );
}

// ---------- Mix check ----------

const KINDS: { kind: Kind; name: string; line: string; icon: ReactNode }[] = [
  { kind: "masking", name: "Buried sounds", line: "A sound hidden under another one.", icon: <BuriedIcon /> },
  { kind: "buildup", name: "Mud and build-up", line: "Too much piled up in one range.", icon: <MudIcon /> },
  { kind: "harsh", name: "Harsh hits", line: "Sharp peaks that sting the ear.", icon: <HarshIcon /> },
  { kind: "resonance", name: "Ringing notes", line: "One note that rings on too loud.", icon: <RingIcon /> },
  { kind: "bass_click", name: "Bass clicks", line: "Clicks where bass notes start.", icon: <ClickIcon /> },
];
// Mud is measured as synths buried in the low mids, so it gets the mud icon, not the buried one
const iconFor = (p: Problem) => KINDS.find((x) => x.kind === (p.name === "Mud" ? "buildup" : p.findings[0].kind))!.icon;

/** Before the first check: the Simple view's layout greyed out, saying what will appear and how to start. */
function EmptyCheck({ narrow }: { narrow: boolean }) {
  return (
    <div className="cp-bento">
      <section className={cn("cp-tile cp-hero", span(narrow, 7))} style={{ minHeight: narrow ? 0 : 228, gap: 10 }}>
        <span className="cp-cap">Where the problems are</span>
        <span style={{ fontSize: 34, lineHeight: "38px", fontWeight: 700, letterSpacing: "-.03em" }}>Not checked yet</span>
        <span style={{ fontSize: 14, color: "var(--on-tile-muted)" }}>Play the busiest part of your song and press Check mix. Aria listens to 16 bars.</span>
        <div className="cp-score cp-push">{BANDS.map((b) => <span key={b.name}><i />{b.name}</span>)}</div>
      </section>
      <section className={cn("cp-tile cp-solid", span(narrow, 5))} style={{ minHeight: narrow ? 0 : 228, gap: 8 }}>
        <span className="cp-cap">Fix first</span>
        <h2 className="cp-tile-title" style={{ fontSize: 20, lineHeight: "25px" }}>Nothing yet</h2>
        <p className="cp-body is-quiet" style={{ margin: 0 }}>After a check, the one thing to fix first shows here, with a button that has Muse fix it for you.</p>
      </section>
      {KINDS.map((k, i) => (
        <section key={k.kind} className={cn("cp-tile cp-card cp-stat", span(narrow, i < 3 ? 4 : 6))}>
          <div className="cp-stat-head"><span className="cp-stat-icon">{k.icon}</span><span className="cp-stat-name">{k.name}</span><span className="cp-tag cp-tag-idle cp-stat-word">Not checked</span></div>
          <p className="cp-stat-line">{k.line}</p>
          <TickGauge share={0} />
        </section>
      ))}
      <WhereItHappens r={null} narrow={narrow} />
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

const amountText = (p: Problem) => (p.amount.unit.startsWith("%") ? `${p.amount.value}% of notes` : p.amount.unit === "dB under" ? `−${p.amount.value} dB` : `${p.amount.value} dB`);
const fixWithMuse = (p: Problem) => { fixIt(p); setAskOpen(true); };

function Simple({ r, open, setOpen, narrow }: { r: Result; open: number; setOpen: (i: number) => void; narrow: boolean }) {
  const list = problemsOf(r);
  const first = list[0], selected = list[open];
  const tileSpan = list.length >= 3 ? 4 : list.length === 2 ? 6 : 12;
  return (
    <div className="cp-bento">
      <Rise i={0} className={span(narrow, 7)}>
        <section className="cp-tile cp-hero" style={{ gap: 6, minHeight: narrow ? 0 : 320 }}>
          <div className="cp-spread"><span className="cp-cap">{list.length ? "Where the problems are" : "Your mix"}</span>
            <span className="cp-meta" style={{ color: "var(--on-tile-muted)" }}>{list.length ? "Tap a number to see it" : "Hover to see the levels"}</span></div>
          {r.clarity.spectra
            ? <Waves spectra={r.clarity.spectra} findings={r.clarity.findings} split={r.clarity.mode === "split"}
                     onZone={(f) => setOpen(list.findIndex((p) => p.findings.includes(f)))} />
            : <p className="cp-meta" style={{ color: "var(--on-tile-muted)" }}>The picture appears after the next Check mix.</p>}
        </section>
      </Rise>

      <Rise i={1} className={span(narrow, 5)}>
        <section className="cp-tile cp-solid" style={{ gap: 8, minHeight: narrow ? 0 : 320 }}>
          {first ? (
            <>
              <div className="cp-spread"><span className="cp-cap">Fix first</span><span className="cp-tag cp-tag-hot">{statusWord(first)}</span></div>
              <h2 className="cp-tile-title" style={{ fontSize: 20, lineHeight: "25px" }}>{first.name}</h2>
              <span className="cp-meta">{barsOf(first)} · {first.where}</span>
              <p className="cp-body is-quiet line-clamp-4" style={{ margin: 0 }}>{first.short}</p>
              <div className="cp-row cp-push">
                <button className="cp-btn cp-btn-light" onClick={() => fixWithMuse(first)}>Fix it</button>
                <button className="cp-btn cp-btn-ghost" onClick={() => jumpTo(first.bar)}>Hear it in Live</button>
              </div>
              {list.length > 1 && <span className="cp-meta">{list.length - 1} more below</span>}
            </>
          ) : (
            <>
              <div className="cp-spread"><span className="cp-cap">This check</span><span className="cp-tag cp-tag-good">Clear</span></div>
              <h2 className="cp-tile-title" style={{ fontSize: 20, lineHeight: "25px" }}>Nothing sticks out</h2>
              <p className="cp-body is-quiet" style={{ margin: 0 }}>{r.advice?.summary ?? "Check another part of the song next."}</p>
            </>
          )}
        </section>
      </Rise>

      {list.map((p, i) => (
        <Rise key={p.name + i} i={2 + i} className={span(narrow, tileSpan)}>
          <section className={cn("cp-tile cp-card cp-stat cursor-pointer", open === i && "ring-2 ring-[var(--action)]")} onClick={() => setOpen(open === i ? -1 : i)}>
            <div className="cp-stat-head">
              <span className="cp-stat-icon">{iconFor(p)}</span>
              <span className="cp-stat-name">{p.name}</span>
              <span className="cp-tag cp-tag-hot cp-stat-word">{amountText(p)}</span>
            </div>
            <p className="cp-stat-line line-clamp-2">{p.short}</p>
            <TickGauge share={p.share} label={`${p.shareLabel} · ${barsOf(p)}`} />
          </section>
        </Rise>
      ))}

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div key={open} className="span-12 grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.25, ease: EASE }}>
            <ProblemDetail p={selected} />
          </motion.div>
        )}
      </AnimatePresence>

      <WhereItHappens r={r} narrow={narrow} onPick={(p) => setOpen(list.indexOf(p))} />
    </div>
  );
}

function ProblemDetail({ p }: { p: Problem }) {
  return (
    <section className="cp-tile cp-card" style={{ gap: 12 }}>
      <div className="cp-spread flex-wrap">
        <span className="cp-tile-title">{p.name}</span>
        <div className="cp-row">
          <button className="cp-btn" onClick={() => jumpTo(p.bar)}>Hear it in Live</button>
          <button className="cp-btn cp-btn-primary" onClick={() => fixWithMuse(p)}>Fix it</button>
        </div>
      </div>
      {p.notes.length
        ? p.notes.map((note, k) => <p key={k} className="cp-body" style={{ maxWidth: 760 }}>{note.text}</p>)
        : <p className="cp-body" style={{ color: "var(--ink-muted)" }}>{describe(p.findings[0]).about}</p>}
      <div className="cp-row flex-wrap" style={{ gap: 6 }}>
        {p.findings.map((f, k) => {
          const d = describe(f);
          return <span key={k} className="cp-tag" style={{ fontFamily: "var(--font-mono)" }}>{d.where} · {d.size} · bars {f.bars[0]}{f.bars[1] !== f.bars[0] ? `–${f.bars[1]}` : ""}</span>;
        })}
      </div>
    </section>
  );
}

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

function Detailed({ r, narrow }: { r: Result; narrow: boolean }) {
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
}

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
              {result.clarity.spectra && <div className="ml-auto h-10 w-[150px]"><MiniWaves spectra={result.clarity.spectra} findings={result.clarity.findings} split={result.clarity.mode === "split"} /></div>}
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
