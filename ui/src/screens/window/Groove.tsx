// Groove match (build step 9, Oct 30): line a loop's hits up with a straight grid or another loop. Two cards say what
// is picked (from the clip selected in Live), one row sets how much, and the result is a timing chart: every hit's
// offset before (blue) and after (gold), with the 5 ms band that counts as in time.
import { useState } from "react";
import { GrooveIcon, CheckIcon } from "@/components/icons";
import { THEIRS, YOURS } from "@/components/ref-chart";
import { grooveAB, groovePick, grooveRun, undoLast, useAriaSel, type GrooveClip, type GrooveResult } from "@/lib/aria";
import { cn } from "@/lib/utils";

function ClipCard({ label, clip, onPick, busy }: { label: string; clip: GrooveClip | null; onPick: () => void; busy: boolean }) {
  return (
    <section className="cp-tile cp-card" style={{ gap: 10 }}>
      <span className="cp-cap">{label}</span>
      {clip ? (
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate text-[17px] font-medium">{clip.name || clip.track_name}</span>
          <span className="ae-mono truncate">{clip.track_name}</span>
        </div>
      ) : <span className="text-[14px] text-ink-muted">Click its clip in Live</span>}
      <div><button className="cp-btn cp-btn-sm" disabled={busy} onClick={onPick}>{clip ? "Use another clip" : "Use selected clip"}</button></div>
    </section>
  );
}

/** Every bar folded into one (Ian, Oct 30: spread over the whole loop the dots "don't show us much"): a column per
    16th, each hit's offset in its column, before (blue) left of after (gold), over the 5 ms band that counts as in
    time. A part that drags or rushes shows as a column of dots above or below the band. */
function TimingChart({ r, tempo, narrow }: { r: GrooveResult; tempo: number | null; narrow: boolean }) {
  const W = 640, H = narrow ? 260 : 200, PAD = 8;
  // The scale fits the loop: at least ±15 ms, in 5 ms steps, so 12 ms off doesn't sit on the band
  const worst = Math.max(0, ...r.before.hits.map((h) => Math.abs(h.offset_ms)), ...r.after.hits.map((h) => Math.abs(h.offset_ms)));
  const SPAN = Math.max(15, Math.ceil((worst * 1.25) / 5) * 5);
  const steps = r.grid?.steps_per_bar ?? 16, step = r.grid?.step_sec ?? (tempo ? 15 / tempo : 0.125), b1 = r.grid?.beat1_sec ?? 0;
  const col = (W - 2 * PAD) / steps;
  const at = (sec: number) => ((Math.round((sec - b1) / step) % steps) + steps) % steps;
  const X = (k: number, side: number) => PAD + (k + 0.5) * col + side * Math.min(7, col * 0.18);
  const Y = (ms: number) => H / 2 - (Math.max(-SPAN, Math.min(SPAN, ms)) / SPAN) * (H / 2 - 14);
  return (
    <div className="relative overflow-hidden rounded-[12px]" style={{ background: "color-mix(in srgb, var(--ground) 55%, transparent)", border: "1px solid var(--hairline)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="How far each hit is from its 16th, every bar folded into one, before and after">
        {Array.from({ length: steps / 4 }, (_, b) => b % 2 === 1 && <rect key={b} x={PAD + b * 4 * col} y={0} width={4 * col} height={H} fill="var(--ink)" opacity={0.03} />)}
        {Array.from({ length: steps + 1 }, (_, k) => <line key={k} x1={PAD + k * col} x2={PAD + k * col} y1={0} y2={H} stroke={k % 4 === 0 ? "var(--track)" : "var(--hairline)"} strokeOpacity={k % 4 === 0 ? 0.7 : 0.5} />)}
        <rect x={0} y={Y(5)} width={W} height={Y(-5) - Y(5)} fill="var(--good)" opacity={0.13} />
        <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--good)" strokeOpacity={0.45} />
        {r.before.hits.map((h, i) => <circle key={`b${i}`} cx={X(at(h.sec), -1)} cy={Y(h.offset_ms)} r={narrow ? 6 : 5} fill={THEIRS} opacity={0.85}><title>{`Before: ${Math.abs(h.offset_ms)} ms ${h.offset_ms > 0 ? "late" : "early"}`}</title></circle>)}
        {r.after.hits.map((h, i) => <circle key={`a${i}`} cx={X(at(h.sec), 1)} cy={Y(h.offset_ms)} r={narrow ? 6 : 5} fill={YOURS} opacity={0.9}><title>{`After: ${Math.abs(h.offset_ms)} ms ${h.offset_ms > 0 ? "late" : "early"}`}</title></circle>)}
      </svg>
      <div className="pointer-events-none absolute inset-0 font-mono text-[10px] leading-3 text-ink-faint" aria-hidden="true">
        <span className="absolute left-2 top-1.5" title={`The top is ${SPAN} ms late`}>late</span>
        <span className="absolute bottom-1.5 left-2" title={`The bottom is ${SPAN} ms early`}>early</span>
        <span className="absolute left-2 -translate-y-1/2 rounded px-0.5" style={{ top: "50%", color: "var(--good)", background: "color-mix(in srgb, var(--ground) 70%, transparent)" }}>±5 ms</span>
        {Array.from({ length: steps / 4 }, (_, b) => (
          <span key={b} className="absolute bottom-1.5" style={{ left: `calc(${((PAD + b * 4 * col) / W) * 100}% + 4px)`, display: b ? undefined : "none" }}>{b + 1}</span>
        ))}
      </div>
    </div>
  );
}

/** The answer in one picture (Ian, Oct 30: the dot chart was "so hard to comprehend"): how far off the worst hit
    was before and is after, as two bars on one scale, with the 5 ms mark under which nobody hears it. */
function OffBars({ r }: { r: GrooveResult }) {
  const top = Math.max(10, r.before.max_ms ?? 0, r.after.max_ms ?? 0) * 1.1;
  const pct = (ms: number | null) => `${Math.max(0, Math.min(100, ((ms ?? 0) / top) * 100))}%`;
  const row = (label: string, ms: number | null, color: string) => (
    <div className="grid items-center gap-3" style={{ gridTemplateColumns: "3.6rem minmax(0, 1fr) 4rem" }}>
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="relative h-3 rounded-full" style={{ background: "var(--well)" }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: ms ? `max(6px, ${pct(ms)})` : "6px", background: color }} />
      </span>
      <span className="ae-mono text-right">{ms === null ? "?" : `${ms} ms`}</span>
    </div>
  );
  return (
    <div className="grid gap-1.5">
      <div className="relative grid gap-2.5">
        {row("Before", r.before.max_ms, THEIRS)}
        {row("After", r.after.max_ms, YOURS)}
        {/* the 5 ms line: under it, nobody hears a flam */}
        <div className="pointer-events-none absolute inset-y-[-4px]" style={{ left: "calc(3.6rem + 12px)", right: "calc(4rem + 12px)" }} aria-hidden="true">
          <span className="absolute inset-y-0 border-l border-dashed" style={{ left: pct(5), borderColor: "var(--good)" }} />
        </div>
      </div>
      <span className="text-[11.5px]" style={{ paddingLeft: "calc(3.6rem + 12px)", color: "var(--good)" }}>
        <span style={{ marginLeft: pct(5), display: "inline-block", transform: "translateX(-50%)" }}>5 ms: can't hear it</span>
      </span>
    </div>
  );
}

export function GrooveScreen({ narrow }: { narrow: boolean }) {
  const g = useAriaSel((s) => s.groove), tempo = useAriaSel((s) => s.session?.tempo ?? null);
  const [follow, setFollow] = useState<"straight" | "loop">("straight");
  const [strength, setStrength] = useState(100);
  const [nudge, setNudge] = useState(0);
  const r = g.result, busy = !!g.busy;
  const ready = !!g.moving && (follow === "straight" || !!g.anchor);
  return (
    <div className="grid gap-3 pt-1">
      <div className="grid gap-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <ClipCard label="Loop to fix" clip={g.moving} onPick={() => groovePick("moving")} busy={busy} />
        <section className="cp-tile cp-card" style={{ gap: 10 }}>
          <div className="flex items-center gap-3">
            <span className="cp-cap">Follow</span>
            <div className="cp-seg ml-auto" role="group" aria-label="Follow">
              <button aria-pressed={follow === "straight"} onClick={() => setFollow("straight")}>Straight grid</button>
              <button aria-pressed={follow === "loop"} onClick={() => setFollow("loop")}>Another loop</button>
            </div>
          </div>
          {follow === "loop" ? (
            <>
              {g.anchor ? (
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[17px] font-medium">{g.anchor.name || g.anchor.track_name}</span>
                  <span className="ae-mono truncate">{g.anchor.track_name}</span>
                </div>
              ) : <span className="text-[14px] text-ink-muted">Click its clip in Live</span>}
              <div><button className="cp-btn cp-btn-sm" disabled={busy} onClick={() => groovePick("anchor")}>{g.anchor ? "Use another clip" : "Use selected clip"}</button></div>
            </>
          ) : <span className="text-[14px] text-ink-muted">Every hit onto the nearest 16th</span>}
        </section>
      </div>

      <section className="cp-tile cp-card" style={{ gap: 12 }}>
        <div className="grid items-center gap-x-5 gap-y-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto auto" }}>
          <label className="grid gap-1.5">
            <span className="flex items-baseline justify-between"><span className="cp-cap">Strength</span><span className="ae-mono">{strength}%</span></span>
            <input type="range" min={0} max={100} step={5} value={strength} onChange={(e) => setStrength(Number(e.target.value))} aria-label="Strength" className="w-full accent-[var(--ink)]" />
          </label>
          <div className="grid gap-1.5">
            <span className="cp-cap">Nudge</span>
            <div className="flex items-center gap-1.5">
              <button className="cp-btn cp-btn-sm" aria-label="1 ms earlier" onClick={() => setNudge(Math.max(-20, nudge - 1))}>−</button>
              <span className="ae-mono w-[52px] text-center">{nudge > 0 ? "+" : nudge < 0 ? "−" : ""}{Math.abs(nudge)} ms</span>
              <button className="cp-btn cp-btn-sm" aria-label="1 ms later" onClick={() => setNudge(Math.min(20, nudge + 1))}>+</button>
            </div>
          </div>
          <button className="cp-btn cp-btn-primary" disabled={!ready || busy} onClick={() => grooveRun(follow, strength / 100, nudge)}>
            {busy ? "Matching" : r ? "Match again" : "Match it"}
          </button>
        </div>
        {(g.busy || g.error) && <span className="cp-meta" style={g.error ? { color: "var(--hot)" } : undefined}>{g.error ?? g.busy}</span>}
      </section>

      {r ? (
        <section className="cp-tile cp-card" style={{ gap: 14 }}>
          {r.in_time
            ? <span className="inline-flex items-center gap-2 text-[24px] font-medium" style={{ color: "var(--good)" }}><CheckIcon style={{ width: 22, height: 22 }} />In time</span>
            : <span className="text-[24px] font-medium">{r.after.max_ms === null ? "Couldn't measure it again" : `Still ${r.after.max_ms} ms off`}</span>}
          <OffBars r={r} />
          <span className="cp-meta">
            {r.hits_moved} of {r.hits} hits moved {r.follow === "Straight" ? "onto the grid" : `to follow ${r.follow}`}{r.after.missing ? `. ${r.after.missing} couldn't be heard again` : ""}.
          </span>
          {g.placed && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="cp-seg" role="group" aria-label="Listen to">
                <button aria-pressed={g.placed.playing === "before"} onClick={() => grooveAB("before")}>Original</button>
                <button aria-pressed={g.placed.playing === "after"} onClick={() => grooveAB("after")}>Matched</button>
              </div>
              <button className="cp-btn cp-btn-sm ml-auto" onClick={undoLast}>Undo</button>
            </div>
          )}
          <details className="group">
            <summary className="cursor-pointer select-none text-[12.5px] text-ink-muted">Every hit</summary>
            <div className="grid gap-2 pt-2.5">
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="ae-dot" style={{ color: THEIRS }} />Before</span>
                <span className="inline-flex items-center gap-1.5"><span className="ae-dot" style={{ color: YOURS }} />After</span>
                <span>one column per 16th, every bar on top of each other</span>
              </div>
              <TimingChart r={r} tempo={tempo} narrow={narrow} />
            </div>
          </details>
        </section>
      ) : !g.moving && (
        <section className={cn("cp-tile cp-card items-center")} style={{ gap: 10, minHeight: 120, placeItems: "center" }}>
          <GrooveIcon style={{ width: 28, height: 28, opacity: 0.5 }} />
          <span className="cp-meta">Two loops flamming? Pick the one to fix.</span>
        </section>
      )}
    </div>
  );
}
