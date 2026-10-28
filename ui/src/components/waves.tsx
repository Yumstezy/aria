// Where the problems are in the mix: the measured spectrum on a frequency axis, with each problem as a
// numbered zone and a matching chip underneath. With two or more parts playing, each part gets its own
// line (the ones a problem is about stand out); with one, the whole mix is the line. Curves are smoothed
// for display only; the engine's numbers stay as measured.
import { useRef, useState, type PointerEvent } from "react";
import { motion } from "motion/react";
import { describe, soundName, type Finding, type Spectra } from "@/lib/aria";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { BANDS } from "@/lib/problems";

// Short names for the tooltip, so it stays small
const SHORT: Record<string, string> = { vocals: "Vocal", other: "Synths", bass: "Bass", drums: "Drums", mix: "Mix" };

const W = 640, H = 270, PAD_B = 24, PAD_T = 34, LO = 30, HI = 16000, FLOOR_DB = -60;
const ORDER = ["drums", "bass", "other", "vocals"];   // drawn back to front
const TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const X = (hz: number) => ((Math.log10(hz) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * W;
const Y = (db: number) => PAD_T + (1 - (Math.max(db, FLOOR_DB) - FLOOR_DB) / -FLOOR_DB) * (H - PAD_T - PAD_B);

const hzShort = (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

function smoothValues(v: number[]) {
  return v.map((x, i) => ((v[i - 1] ?? x) + 2 * x + (v[i + 1] ?? x)) / 4);
}

// Catmull-Rom through the points, as cubic Beziers
function path(pts: [number, number][]) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ` +
         `${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function Waves({ spectra, findings, split, onZone }: {
  spectra: Spectra; findings: Finding[]; split: boolean; onZone: (f: Finding) => void;
}) {
  const involved = new Set<string>();
  findings.forEach((f) => { if (f.kind === "masking") involved.add(f.masked!); if (f.kind === "bass_click") involved.add("bass"); });
  const playing = split ? ORDER.filter((n) => spectra.parts[n]) : [];
  const silent = split ? ORDER.filter((n) => !spectra.parts[n]) : [];
  const showParts = playing.length >= 2;   // one part playing is the mix: draw it once, as the mix
  const names = showParts ? playing : ["mix"];
  // Every finding with a place on the axis, numbered for the pins and the chips
  const zones = findings.map((f) => {
    const point = f.kind === "resonance" || f.kind === "harsh";
    const lo = point ? f.hz! * 0.92 : f.hz_range[0], hi = point ? f.hz! * 1.08 : f.hz_range[1];
    const amount = f.kind === "masking" ? `${f.gap_db!.toFixed(0)} dB` : f.kind === "bass_click" ? "clicks" : `+${f.size_db!.toFixed(0)} dB`;
    return { f, lo: Math.max(LO, lo), hi: Math.min(HI, hi), where: point ? hzShort(Math.round(f.hz!)) + " Hz" : `${hzShort(Math.round(f.hz_range[0]))}–${hzShort(Math.round(f.hz_range[1]))} Hz`, amount };
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; left: number; top: number } | null>(null);

  // Hover: the nearest measured point under the pointer, with each part's real level there.
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const hzAt = 10 ** (Math.log10(LO) + (x / W) * (Math.log10(HI) - Math.log10(LO)));
    let i = 0;
    spectra.hz.forEach((h, k) => { if (Math.abs(Math.log(h / hzAt)) < Math.abs(Math.log(spectra.hz[i] / hzAt))) i = k; });
    setHover({ i, left: e.clientX, top: e.clientY });
  };

  // Waves with their label positions, labels nudged so none overlap
  const waves = names.map((n) => {
    const values = smoothValues(n === "mix" ? spectra.mix : spectra.parts[n]!);
    const line = path(spectra.hz.map((h, i) => [X(h), Y(values[i])]));
    const peak = values.indexOf(Math.max(...values));
    return { n, line, quiet: showParts && involved.size > 0 && !involved.has(n),
             label: { x: Math.min(W - 50, Math.max(50, X(spectra.hz[peak]))), y: Y(values[peak]) - 6, w: soundName(n).length * 6.2 } };
  });
  [...waves].sort((a, b) => b.label.y - a.label.y).forEach((wv, i, all) => {
    all.slice(0, i).forEach((p) => {
      if (Math.abs(p.label.x - wv.label.x) < (wv.label.w + p.label.w) / 2 + 4 && Math.abs(p.label.y - wv.label.y) < 13) {
        wv.label.y = Math.min(wv.label.y, p.label.y - 13);
      }
    });
    wv.label.y = Math.max(PAD_T - 2, wv.label.y);
  });

  return (
    <div className="flex flex-col gap-2.5">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Each part's frequency curve"
           onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={PAD_T - 6} y2={H - PAD_B} stroke="var(--hairline)" />
            <text x={X(t)} y={H - 6} textAnchor="middle" className="fill-ink-faint font-mono text-[10.5px]">{t >= 1000 ? `${t / 1000}k` : t}</text>
          </g>
        ))}

        {zones.map((z, i) => (
          <g key={i} className="cursor-pointer [&:hover>rect]:opacity-35" onClick={() => onZone(z.f)}>
            <rect x={X(z.lo)} y={PAD_T - 6} width={Math.max(6, X(z.hi) - X(z.lo))} height={H - PAD_B - PAD_T + 6} fill="var(--hot)" opacity={0.22} />
            <circle cx={(X(z.lo) + X(z.hi)) / 2} cy={14} r={10} fill="var(--hot)" />
            <text x={(X(z.lo) + X(z.hi)) / 2} y={18} textAnchor="middle" fill="var(--tile-core)" className="text-[11px] font-bold">{i + 1}</text>
          </g>
        ))}

        {waves.map((wv, i) => (
          <motion.g key={wv.n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }}>
            <path d={`${wv.line}L${W},${H - PAD_B}L0,${H - PAD_B}Z`} fill={`var(--part-${wv.n})`} opacity={wv.quiet ? 0.06 : 0.2} />
            <motion.path d={wv.line} fill="none" stroke={`var(--part-${wv.n})`} strokeWidth={2} opacity={wv.quiet ? 0.35 : 1}
                         initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.3, 0.8, 0.2, 1], delay: 0.2 + i * 0.06 }} />
            {showParts && <text x={wv.label.x} y={wv.label.y} textAnchor="middle" fill={`var(--part-${wv.n})`} opacity={wv.quiet ? 0.5 : 1} className="text-[11.5px] font-semibold">{soundName(wv.n)}</text>}
          </motion.g>
        ))}
        {hover && <line x1={X(spectra.hz[hover.i])} x2={X(spectra.hz[hover.i])} y1={PAD_T - 6} y2={H - PAD_B} stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.5} />}
      </svg>

      {/* What each stretch of the picture is called, low to high, so 200 or 5k means something */}
      <div className="flex" aria-label="Frequency ranges">
        {BANDS.map((b, i) => {
          const lo = Math.max(LO, b.lo), hi = Math.min(HI, b.hi);
          return (
            <div key={b.name} className="flex min-w-0 flex-col items-center gap-0.5 overflow-hidden whitespace-nowrap py-1 text-center"
                 style={{ width: `${((X(hi) - X(lo)) / W) * 100}%`, borderLeft: i ? "1px solid var(--hairline)" : undefined }}>
              <span className="text-[11px] font-semibold leading-3 text-ink-muted">{b.name}</span>
              <span className="font-mono text-[9.5px] leading-3 text-ink-faint">{hzShort(b.lo)}–{hzShort(b.hi)}</span>
            </div>
          );
        })}
      </div>

      {hover && (
        <ChartTooltip x={hover.left} y={hover.top}
          title={spectra.hz[hover.i] >= 1000 ? `${(spectra.hz[hover.i] / 1000).toFixed(1)} kHz` : `${spectra.hz[hover.i]} Hz`}
          rows={names.slice().reverse().map((n) => {
            const v = (n === "mix" ? spectra.mix : spectra.parts[n]!)[hover.i];
            return { label: SHORT[n] ?? soundName(n), value: v <= FLOOR_DB ? "silent" : `${v.toFixed(0)} dB`, color: getComputedStyle(svgRef.current!).getPropertyValue(`--part-${n}`) };
          })} />
      )}

      {/* The problems, numbered like the pins. Tap one to read about it. */}
      {zones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z, i) => (
            <button key={i} onClick={() => onZone(z.f)}
                    className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold"
                    style={{ background: "color-mix(in srgb, var(--on-tile) 12%, transparent)", color: "var(--on-tile)" }}>
              <i className="grid size-[18px] place-items-center rounded-full text-[10px] font-bold not-italic" style={{ background: "var(--hot)", color: "var(--tile-core)" }}>{i + 1}</i>
              {describe(z.f).name} · {z.where} · {z.amount}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3.5 text-xs text-ink-muted">
        {showParts && names.map((n) => (
          <span key={n} className="inline-flex items-center gap-1.5"><i className="h-[3px] w-3.5 rounded-sm" style={{ background: `var(--part-${n})` }} />{soundName(n)}</span>
        ))}
        {split && playing.length === 1 && <span>Only the {soundName(playing[0]).toLowerCase()} is playing in these bars.</span>}
        {split && playing.length > 1 && silent.length > 0 && <span className="text-ink-faint">Not playing here: {silent.map((n) => soundName(n).toLowerCase()).join(", ")}</span>}
      </div>
    </div>
  );
}
