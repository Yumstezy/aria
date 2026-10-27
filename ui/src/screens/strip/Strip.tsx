// The device strip on Main, 400 x 169 (design/screens/10-strip-states.png). Two areas:
// left, the Aria mark, Check mix, Ask and Open window; right, one card that always shows the next
// step or the one thing to fix. Ask opens Ask Muse in its own window; the full results live there too.
import type { CSSProperties } from "react";
import { Mark } from "@/components/brand";
import { MicIcon } from "@/components/icons";
import { checkMix, fixIt, jumpTo, openChat, openWindow, useAria, type Result } from "@/lib/aria";
import { barGroups, barsOf, problemsOf, statusWord } from "@/lib/problems";

const STEP: Record<string, string> = { record: "Listening to 16 bars", analyze: "Splitting and asking Muse" };

function Card() {
  const { engine, progress, result, error, session } = useAria();
  const engineDown = engine.state === "down" || engine.state === "error";

  if (progress) {
    const share = progress.total ? Math.min(1, (progress.done ?? 0) / progress.total) : null;
    return (
      <section className="cp-tile cp-card" style={{ gap: 6 }} role="status">
        <div className="cp-spread"><span className="cp-cap">Mix check</span><span className="cp-tag cp-tag-idle">Checking</span></div>
        <b style={{ fontSize: 13, lineHeight: "17px" }}>{STEP[progress.step] ?? "Getting ready"}</b>
        <div className="h-2 overflow-hidden rounded-full bg-well">
          <i className="block h-full rounded-full bg-action transition-[width] duration-200 ease-linear" style={{ width: `${(share ?? 0.08) * 100}%` }} />
        </div>
        <span className="cp-meta cp-push" style={{ fontSize: 11, lineHeight: "15px" }}>{progress.step === "record" ? `Keep playing. ${progress.detail ?? ""}` : "This takes a few seconds."}</span>
      </section>
    );
  }

  if (error || engineDown) {
    return (
      <section className="cp-tile cp-card" style={{ gap: 6 }} role="status">
        <div className="cp-spread"><span className="cp-cap">Mix check</span><span className="cp-tag cp-tag-hot">{engineDown ? "Engine off" : "Didn't finish"}</span></div>
        <span className="cp-body line-clamp-4" style={{ fontSize: 12, lineHeight: "16px" }}>{error ?? engine.text}</span>
      </section>
    );
  }

  if (result) return <AfterCheck r={result} />;

  // Ready to check. Where Aria sits matters: a limiter after it changes what it hears.
  const misplaced = session && (!session.chain.on_main ? "Not on Main" : session.chain.after.length ? "Move Aria last" : null);
  return (
    <section className="cp-tile cp-card" style={{ gap: 6 }}>
      <div className="cp-spread"><span className="cp-cap">Mix check</span>
        <span className={misplaced ? "cp-tag cp-tag-hot" : "cp-tag cp-tag-idle"}>{misplaced || (engine.state === "starting" ? "Starting" : "Ready")}</span></div>
      <b style={{ fontSize: 13, lineHeight: "17px" }}>Play the busiest part</b>
      {!!session?.markers.length && (
        <div className="cp-secrow" aria-label="Your markers">
          {session.markers.slice(0, 8).map((m, i, all) => (
            <button key={i} style={{ "--n": all[i + 1] ? all[i + 1].bar - m.bar : 8 } as CSSProperties} onClick={() => jumpTo(m.bar)} title={`Jump to ${m.name}, bar ${m.bar}`}>{m.name}</button>
          ))}
        </div>
      )}
      <span className="cp-meta cp-push" style={{ fontSize: 11, lineHeight: "15px" }}>Then press Check mix. Aria listens to 16 bars.</span>
    </section>
  );
}

function AfterCheck({ r }: { r: Result }) {
  const list = problemsOf(r);
  const p = list[0];
  const groups = barGroups(r, p);
  const row = (
    <div className="cp-secrow" aria-label="The bars Aria checked">
      {groups.map((g) => (
        <button key={g.from} className={g.hot ? "is-hot" : ""} style={{ "--n": g.to - g.from + 1 } as CSSProperties}
                onClick={() => jumpTo(g.from)} title={`Hear bars ${g.from} to ${g.to} in Live`}>{g.from}</button>
      ))}
    </div>
  );
  if (!p) {
    return (
      <section className="cp-tile cp-card" style={{ gap: 6 }}>
        <div className="cp-spread"><span className="cp-cap">Mix check</span><span className="cp-tag cp-tag-good">Clear</span></div>
        <b style={{ fontSize: 14, lineHeight: "18px" }}>Nothing sticks out</b>
        {row}
        <span className="cp-meta cp-push" style={{ fontSize: 11 }}>Check another part of the song next.</span>
      </section>
    );
  }
  return (
    <section className="cp-tile cp-card" style={{ gap: 6 }}>
      <div className="cp-spread"><span className="cp-cap">Fix first</span><span className="cp-tag cp-tag-hot">{statusWord(p)}</span></div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <b className="truncate" style={{ fontSize: 14, lineHeight: "18px" }}>{p.name}</b>
        <span className="cp-meta shrink-0" style={{ fontSize: 11 }}>{barsOf(p)}</span>
      </div>
      {row}
      <div className="cp-row cp-push" style={{ gap: 8 }}>
        <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => { fixIt(p); openChat(); }}>Fix it</button>
        {list.length > 1 && <button className="cp-meta hover:underline" style={{ fontSize: 11, background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={openWindow}>
          {list.length - 1} more in the window</button>}
      </div>
    </section>
  );
}

export function Strip() {
  const { progress, ask } = useAria();
  return (
    <div className="cp-stage is-flush" style={{ width: 400, height: 169, minHeight: 0 }}>
      <div className="cp-glass cp-strip is-mini">
        <div className="flex flex-col" style={{ gap: 7 }}>
          <div className="cp-mark"><Mark size={22} /><b>Aria</b></div>
          <button className="cp-btn cp-btn-primary cp-btn-block" disabled={!!progress} onClick={checkMix}>{progress ? "Checking" : "Check mix"}</button>
          <button className="cp-voice" style={{ height: 28, padding: "0 10px 0 6px", alignSelf: "flex-start" }} onClick={openChat} aria-label="Ask Muse">
            <span className="cp-voice-icon"><MicIcon /></span>
            <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2 }}>{ask.pending ? "Asking" : "Ask"}</span>
          </button>
          <button className="cp-meta cp-push text-left hover:underline" style={{ fontSize: 11, background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={openWindow}>Open window</button>
        </div>
        <Card />
      </div>
    </div>
  );
}
