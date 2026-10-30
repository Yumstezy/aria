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

/** Each hit's offset across the loop: before in blue, after in gold, the in-time band in green */
function TimingChart({ r, tempo }: { r: GrooveResult; tempo: number | null }) {
  const W = 640, H = 170, SPAN = 30;
  const end = Math.max(...r.before.hits.map((h) => h.sec), ...r.after.hits.map((h) => h.sec), 0.001) * 1.04;
  const X = (sec: number) => 8 + (sec / end) * (W - 16), Y = (ms: number) => H / 2 - (Math.max(-SPAN, Math.min(SPAN, ms)) / SPAN) * (H / 2 - 10);
  const bar = tempo ? 240 / tempo : null;
  const bars = bar ? Array.from({ length: Math.floor(end / bar) + 1 }, (_, k) => k * bar) : [];
  return (
    <div className="relative overflow-hidden rounded-[12px]" style={{ background: "color-mix(in srgb, var(--ground) 55%, transparent)", border: "1px solid var(--hairline)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="How far each hit is from where it should be, before and after">
        <rect x={0} y={Y(5)} width={W} height={Y(-5) - Y(5)} fill="var(--good)" opacity={0.12} />
        <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--good)" strokeOpacity={0.5} />
        {bars.map((b) => <line key={b} x1={X(b)} x2={X(b)} y1={0} y2={H} stroke="var(--track)" strokeOpacity={0.6} />)}
        {r.before.hits.map((h, i) => {
          const a = r.after.hits[i];
          return a ? <line key={`l${i}`} x1={X(h.sec)} x2={X(a.sec)} y1={Y(h.offset_ms)} y2={Y(a.offset_ms)} stroke="var(--ink-faint)" strokeOpacity={0.5} /> : null;
        })}
        {r.before.hits.map((h, i) => <circle key={`b${i}`} cx={X(h.sec)} cy={Y(h.offset_ms)} r={4} fill={THEIRS}><title>{`${h.offset_ms > 0 ? "late" : "early"} ${Math.abs(h.offset_ms)} ms before`}</title></circle>)}
        {r.after.hits.map((h, i) => <circle key={`a${i}`} cx={X(h.sec)} cy={Y(h.offset_ms)} r={4} fill={YOURS}><title>{`${Math.abs(h.offset_ms)} ms after`}</title></circle>)}
      </svg>
      <div className="pointer-events-none absolute inset-0 font-mono text-[10px] leading-3 text-ink-faint" aria-hidden="true">
        <span className="absolute right-1.5 top-1.5">late</span>
        <span className="absolute bottom-1.5 right-1.5">early</span>
        {bars.map((b, k) => <span key={b} className="absolute bottom-1.5" style={{ left: `calc(${(X(b) / W) * 100}% + 4px)` }}>{k + 1}</span>)}
      </div>
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
        <section className="cp-tile cp-card" style={{ gap: 12 }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {r.in_time
              ? <span className="inline-flex items-center gap-2 text-[22px] font-medium" style={{ color: "var(--good)" }}><CheckIcon style={{ width: 20, height: 20 }} />In time</span>
              : <span className="text-[22px] font-medium">{r.after.max_ms} ms off</span>}
            <span className="ae-mono">was {r.before.avg_ms} ms on average, {r.before.max_ms} at worst · now {r.after.avg_ms}, {r.after.max_ms} · {r.hits_moved} of {r.hits} hits moved</span>
            <div className="ml-auto flex min-w-0 flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5"><span className="ae-dot" style={{ color: THEIRS }} />Before</span>
              <span className="inline-flex items-center gap-1.5"><span className="ae-dot" style={{ color: YOURS }} />After</span>
            </div>
          </div>
          <TimingChart r={r} tempo={tempo} />
          {g.placed && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="cp-seg" role="group" aria-label="Listen to">
                <button aria-pressed={g.placed.playing === "before"} onClick={() => grooveAB("before")}>Original</button>
                <button aria-pressed={g.placed.playing === "after"} onClick={() => grooveAB("after")}>Matched</button>
              </div>
              <span className="cp-meta">New track under the original. The original is kept, muted.</span>
              <button className="cp-btn cp-btn-sm ml-auto" onClick={undoLast}>Undo</button>
            </div>
          )}
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
