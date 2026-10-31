// Groove match (build step 9, Oct 30): line a loop's hits up with a straight grid or another loop. Two cards say what
// is picked (from the clip selected in Live), one row sets how much, and the result is a timing chart: every hit's
// offset before (blue) and after (gold), with the 5 ms band that counts as in time.
import { useState } from "react";
import { GrooveIcon, CheckIcon } from "@/components/icons";
import { THEIRS, YOURS } from "@/components/ref-chart";
import { grooveAB, groovePick, grooveRun, undoLast, useAriaSel, vocalAnalyze, vocalApply, type GrooveClip, type GrooveResult, type VocalSync } from "@/lib/aria";
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

/** One bar the way Live shows it (Ian, Oct 31: the dots looked "like random dots placed wherever"): the loop being
    followed on top (or the 16ths, for the straight grid), then this loop before and after, as waveforms, with a line
    through every spot a hit belongs. Off-time hits sit off the lines before and on them after. Beat zooms into the
    beat with the worst hit, where a 15 ms flam is wide enough to see. */
function GroovePicture({ r, followName }: { r: GrooveResult; followName: string }) {
  const p = r.picture;
  const [zoom, setZoom] = useState<"bar" | "beat">("beat");
  if (!p) return null;
  const beat = p.step_sec * 4;
  // the beat holding the hit that was furthest off, in this bar
  const inBar = r.before.hits.filter((h) => h.sec >= p.start_sec && h.sec < p.start_sec + p.bar_sec);
  const worst = inBar.reduce((a, h) => (!a || Math.abs(h.offset_ms) > Math.abs(a.offset_ms) ? h : a), null as null | { sec: number; offset_ms: number });
  const b = worst ? Math.min(3, Math.floor((worst.sec - p.start_sec) / beat)) : 0;
  const from = zoom === "beat" ? Math.max(0, b * beat - p.step_sec * 0.5) : 0, len = zoom === "beat" ? beat + p.step_sec : p.bar_sec;
  const unpack = (packed: string) => Array.from(packed, (c) => Math.max(0, p.levels.indexOf(c)) / 63);
  const W = 640, ROW = 46, rows = [p.anchor ? { name: followName, env: unpack(p.anchor), color: "var(--ink-muted)" } : null,
    { name: "Before", env: unpack(p.before), color: THEIRS }, { name: "After", env: unpack(p.after), color: YOURS }].filter(Boolean) as { name: string; env: number[]; color: string }[];
  const per = p.point_ms / 1000;   // seconds between points
  const H = rows.length * ROW + (p.anchor ? 0 : 14);
  const X = (sec: number) => ((sec - from) / len) * W;
  const wave = (env: number[], top: number) => {
    const a = Math.max(0, Math.floor(from / per)), z = Math.min(env.length, Math.ceil((from + len) / per));
    const mid = top + ROW / 2, amp = ROW / 2 - 5;
    const pts = [];
    for (let i = a; i < z; i++) pts.push([X(i * per), env[i]]);
    const up = pts.map(([x, v], k) => `${k ? "L" : "M"}${x.toFixed(1)},${(mid - v * amp).toFixed(1)}`).join("");
    const down = pts.reverse().map(([x, v]) => `L${x.toFixed(1)},${(mid + v * amp).toFixed(1)}`).join("");
    return `${up}${down}Z`;
  };
  const grid = [];
  for (let k = 0; k <= 16; k++) grid.push(k * p.step_sec);
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-ink-muted">{zoom === "beat" ? `Beat ${b + 1} of the bar with the worst hit` : "The bar with the worst hit"}</span>
        <div className="cp-seg ml-auto" role="group" aria-label="Zoom">
          <button aria-pressed={zoom === "beat"} onClick={() => setZoom("beat")}>Beat</button>
          <button aria-pressed={zoom === "bar"} onClick={() => setZoom("bar")}>Bar</button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[12px]" style={{ background: "color-mix(in srgb, var(--ground) 55%, transparent)", border: "1px solid var(--hairline)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="The loop before and after, against the spots its hits belong">
          {grid.map((t, k) => <line key={k} x1={X(t)} x2={X(t)} y1={0} y2={H} stroke="var(--hairline)" strokeOpacity={k % 4 === 0 ? 1 : 0.5} />)}
          {rows.map((row, i) => (
            <g key={row.name}>
              {i > 0 && <line x1={0} x2={W} y1={i * ROW} y2={i * ROW} stroke="var(--hairline)" />}
              <path d={wave(row.env, i * ROW)} fill={row.color} opacity={0.85} />
            </g>
          ))}
          {p.lines_sec.map((t) => <line key={t} x1={X(t)} x2={X(t)} y1={0} y2={H} stroke="var(--good)" strokeWidth={1.4} strokeDasharray="3 3" />)}
          {!p.anchor && grid.map((t, k) => <rect key={k} x={X(t) - 1} y={H - 10} width={2} height={k % 4 === 0 ? 8 : 5} fill="var(--ink-faint)" />)}
        </svg>
        <div className="pointer-events-none absolute inset-0 font-mono text-[10px] leading-3" aria-hidden="true">
          {rows.map((row, i) => (
            <span key={row.name} className="absolute left-2 max-w-[45%] truncate rounded px-0.5" style={{ top: `calc(${((i * ROW + 4) / H) * 100}%)`, color: row.color, background: "color-mix(in srgb, var(--ground) 70%, transparent)" }}>{row.name}</span>
          ))}
        </div>
      </div>
      <span className="text-[12px] text-ink-faint">Dashed lines: where each hit belongs{p.anchor ? `, on ${followName}'s timing` : ", the 16ths"}.</span>
    </div>
  );
}

/** The start of the vocal as a level picture (Ian, Oct 30): beat 1 in gold, and the kick's hits as ticks along the
    bottom where they'll land once synced (or the bar's beats, with no kick), so the producer sees whether the words sit
    on the kicks and moves beat 1 by a beat if not. */
function VocalPicture({ v }: { v: VocalSync }) {
  const W = 640, H = 120, p = v.picture, n = p.levels_db.length;
  const len = n * p.step_sec, X = (t: number) => ((t - p.start_sec) / len) * W, Y = (db: number) => H - 14 - ((Math.max(-48, db) + 48) / 48) * (H - 22);
  const inside = (t: number) => t >= p.start_sec && t <= p.start_sec + len;
  const top = p.levels_db.map((d, i) => `${i ? "L" : "M"}${((i / n) * W).toFixed(1)},${Y(d).toFixed(1)}`).join("");
  const spb = 60 / v.beats_tempo;
  const beats: number[] = [];
  for (let k = -16; k <= 32; k++) if (inside(v.first_beat_sec + k * spb)) beats.push(k);
  const kicks = v.sync.kicks_sec.filter(inside);
  return (
    <div className="relative overflow-hidden rounded-[12px]" style={{ background: "color-mix(in srgb, var(--ground) 55%, transparent)", border: "1px solid var(--hairline)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="The start of the vocal, with beat 1 and the kicks">
        {beats.map((k) => <line key={k} x1={X(v.first_beat_sec + k * spb)} x2={X(v.first_beat_sec + k * spb)} y1={0} y2={H} stroke="var(--track)" strokeOpacity={k % 4 === 0 ? 0.7 : 0.25} />)}
        <path d={`${top}L${W},${H}L0,${H}Z`} fill="var(--ink)" opacity={0.12} />
        <path d={top} fill="none" stroke="var(--ink-muted)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        {kicks.map((t, i) => <rect key={i} x={X(t) - 2} y={H - 10} width={4} height={8} rx={1.5} fill="var(--hot)" />)}
        <line x1={X(v.first_beat_sec)} x2={X(v.first_beat_sec)} y1={0} y2={H} stroke={YOURS} strokeWidth={2} />
      </svg>
      <div className="pointer-events-none absolute inset-0 font-mono text-[10px] leading-3" aria-hidden="true">
        <span className="absolute top-1.5" style={{ left: `calc(${(X(v.first_beat_sec) / W) * 100}% + 4px)`, color: YOURS }}>beat 1</span>
      </div>
    </div>
  );
}

// "Ab minor (G# minor)": a flat key with its sharp name too, as key sites write it
const SHARP: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
const keyName = (k: string) => { const [note, mode] = k.split(" "); const alt = SHARP[note]; return alt ? `${k} (${alt.replace("#", "♯")} ${mode})` : k.replace("#", "♯"); };

/** Vocal sync (Oct 30, redone after Ian's try: "unwarp it and find the original key and BPM, then sync it to the
    kick"): the vocal is read from its file as it was recorded, its original tempo and key shown, and Sync puts its
    beat 1 on the kick at the nearest bar and stretches it so its beats land on the kicks after (Live's own warping,
    Live's earlier markers cleared). Without a kick clip, Live's grid. The clip changes in place, with Undo. */
function VocalPanel({ narrow }: { narrow: boolean }) {
  const g = useAriaSel((s) => s.groove);
  const v = g.vocal_sync, busy = !!g.busy;
  const [tempoText, setTempoText] = useState("");
  const [askTempo, setAskTempo] = useState(false);
  const typed = Number(tempoText) >= 40 && Number(tempoText) <= 300 ? Number(tempoText) : null;
  const ours = v && v.tempo_source === "you" ? v.tempo : null;
  const fmt = (t: number) => (Number.isInteger(t) ? `${t}` : t.toFixed(1));
  // Other tempos it could be, one tap each: Aria's next readings, and the song's own (for a vocal from this project)
  const others = v ? [...v.readings.map((x) => x.bpm), v.song_tempo].filter((b, i, a) => Math.abs(b - v.tempo) > 0.4 && a.findIndex((c) => Math.abs(c - b) < 0.4) === i) : [];
  const kickNote = !g.kick ? "No kick picked: Live's grid" : v?.sync.kick_found ? `Beat 1 on the kick at bar ${v.sync.bar}${v.sync.kick_offset_ms ? `, ${Math.abs(v.sync.kick_offset_ms)} ms ${v.sync.kick_offset_ms > 0 ? "after" : "before"} Live's grid` : ""}`
    : v ? `No kick near bar ${v.sync.bar}: Live's grid` : "";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <ClipCard label="Vocal" clip={g.vocal} onPick={() => groovePick("vocal")} busy={busy} />
        <ClipCard label="Sync to the kick" clip={g.kick} onPick={() => groovePick("kick")} busy={busy} />
      </div>
      {v && g.vocal && (
        <section className="cp-tile cp-card" style={{ gap: 12 }}>
          <div className="grid gap-0.5">
            <span className="cp-cap">Original</span>
            <span className="text-[24px] font-medium">{fmt(v.tempo)} BPM</span>
            {v.key && <span className="text-[16px] text-ink">{keyName(v.key)}</span>}
            <span className="cp-meta">tempo {v.tempo_source === "file name" ? "from the file name" : v.tempo_source === "you" ? "as you set it" : "measured"}{v.beats_tempo !== v.tempo ? `, counted as ${fmt(v.beats_tempo)}` : ""} · plays at {fmt(v.song_tempo)} once synced</span>
          </div>
          {others.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px] text-ink-muted">Not it? Try</span>
              {others.map((b) => (
                <button key={b} className="cp-btn cp-btn-sm" disabled={busy} onClick={() => vocalAnalyze(b, v.beat_shift)}>
                  {Math.abs(b - v.song_tempo) < 0.01 ? `your song's ${fmt(b)}` : fmt(b)}</button>
              ))}
            </div>
          )}
          <VocalPicture v={v} />
          <span className="cp-meta">{kickNote}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button className="cp-btn cp-btn-sm" disabled={busy} onClick={() => vocalAnalyze(ours, v.beat_shift - 1)}>Beat 1 earlier</button>
            <button className="cp-btn cp-btn-sm" disabled={busy} onClick={() => vocalAnalyze(ours, v.beat_shift + 1)}>Beat 1 later</button>
            <button className="text-[12.5px] text-ink-muted underline-offset-2 hover:underline" onClick={() => setAskTempo(!askTempo)}>Wrong tempo?</button>
            <button className="cp-btn cp-btn-primary ml-auto" disabled={busy} onClick={vocalApply}>{g.vocal_applied ? "Sync again" : g.kick ? "Sync to the kick" : "Sync to the grid"}</button>
          </div>
          {askTempo && (
            <div className="flex flex-wrap items-center gap-2">
              <input className="h-8 w-[84px] rounded-[9px] border border-hairline bg-transparent px-2 font-mono text-[12.5px]" inputMode="decimal" placeholder={fmt(v.tempo)}
                     value={tempoText} onChange={(e) => setTempoText(e.target.value)} aria-label="The vocal's original tempo" />
              <button className="cp-btn cp-btn-sm" disabled={busy || !typed} onClick={() => vocalAnalyze(typed, v.beat_shift)}>Use this tempo</button>
            </div>
          )}
          {g.vocal_applied && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--good)" }}><CheckIcon style={{ width: 16, height: 16 }} />{g.kick && v.sync.kick_found ? "On the kick" : "On the grid"}, playing at {fmt(v.song_tempo)} BPM</span>
              <button className="cp-btn cp-btn-sm ml-auto" onClick={undoLast}>Undo</button>
            </div>
          )}
        </section>
      )}
      {(g.busy || g.error) && <span className="cp-meta" style={g.error ? { color: "var(--hot)" } : undefined}>{g.error ?? g.busy}</span>}
      {!g.vocal && (
        <section className="cp-tile cp-card" style={{ gap: 10, minHeight: 120, placeItems: "center" }}>
          <GrooveIcon style={{ width: 28, height: 28, opacity: 0.5 }} />
          <span className="cp-meta">A vocal off the beat? Click its clip in Live and pick it, then your kick.</span>
        </section>
      )}
    </div>
  );
}

export function GrooveScreen({ narrow, mode, setMode }: { narrow: boolean; mode: "loops" | "vocal"; setMode: (m: "loops" | "vocal") => void }) {
  return (
    <div className="grid gap-3 pt-1">
      <div className="cp-seg justify-self-start" role="group" aria-label="What to put in time">
        <button aria-pressed={mode === "loops"} onClick={() => setMode("loops")}>Loops</button>
        <button aria-pressed={mode === "vocal"} onClick={() => setMode("vocal")}>Vocal</button>
      </div>
      {mode === "vocal" ? <VocalPanel narrow={narrow} /> : <LoopsPanel narrow={narrow} />}
    </div>
  );
}

function LoopsPanel({ narrow }: { narrow: boolean }) {
  const g = useAriaSel((s) => s.groove), tempo = useAriaSel((s) => s.session?.tempo ?? null);
  const [follow, setFollow] = useState<"straight" | "loop">("straight");
  const [strength, setStrength] = useState(100);
  const [nudge, setNudge] = useState(0);
  const r = g.result, busy = !!g.busy;
  const ready = !!g.moving && (follow === "straight" || !!g.anchor);
  return (
    <div className="grid gap-3">
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
          <span className="text-[14px] text-ink">
            Worst hit: {r.before.max_ms ?? "?"} ms off, now {r.after.max_ms ?? "?"} ms. {r.hits_moved} of {r.hits} hits moved {r.follow === "Straight" ? "onto the grid" : `to follow ${r.follow}`}{r.after.missing ? `. ${r.after.missing} couldn't be heard again` : ""}.
          </span>
          <GroovePicture r={r} followName={r.follow === "Straight" ? "Grid" : r.follow} />
          {g.placed && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="cp-seg" role="group" aria-label="Listen to">
                <button aria-pressed={g.placed.playing === "before"} onClick={() => grooveAB("before")}>Original</button>
                <button aria-pressed={g.placed.playing === "after"} onClick={() => grooveAB("after")}>Matched</button>
              </div>
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
