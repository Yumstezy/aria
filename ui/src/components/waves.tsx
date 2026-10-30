// Where the problems are in the mix: the measured spectrum on a frequency axis, with each problem as a
// numbered zone and a matching chip underneath. With two or more parts playing, each part gets its own
// line (the ones a problem is about stand out); with one, the whole mix is the line. Curves are smoothed
// for display only; the engine's numbers stay as measured.
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { motion } from "motion/react";
import { describe, hz, hzRange, partColor, partNames, soundName, type Finding, type Spectra } from "@/lib/aria";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { BANDS } from "@/lib/problems";
import { cn } from "@/lib/utils";
import { Plot, PlotGrid, dbTicksOf, tilt } from "@/components/plot";

// Short names for the tooltip, so it stays small
const SHORT: Record<string, string> = { vocals: "Vocal", other: "Synths", bass: "Bass", drums: "Drums", mix: "Mix" };

const W = 640, H = 270, PAD_B = 24, PAD_T = 34, LO = 30, HI = 16000, FLOOR_DB = -60, PIN_GAP = 24;
const TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const X = (hz: number) => ((Math.log10(hz) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * W;
const Y = (db: number) => PAD_T + (1 - (Math.max(db, FLOOR_DB) - FLOOR_DB) / -FLOOR_DB) * (H - PAD_T - PAD_B);

const hzShort = (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

export function smoothValues(v: number[]) {
  return v.map((x, i) => ((v[i - 1] ?? x) + 2 * x + (v[i + 1] ?? x)) / 4);
}

// Catmull-Rom through the points, as cubic Beziers
export function path(pts: [number, number][]) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ` +
         `${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** bare: just the picture and the ruler; the page shows the problems and the legend itself (Ember layout). */
export function Waves({ spectra, findings, split, onZone, bare }: {
  spectra: Spectra; findings: Finding[]; split: boolean; onZone: (f: Finding) => void; bare?: boolean;
}) {
  const involved = new Set<string>();
  findings.forEach((f) => { if (f.kind === "masking") involved.add(f.masked!); if (f.kind === "bass_click") involved.add("bass"); if (f.kind === "clash") f.tracks!.forEach((t) => involved.add(t)); });
  const playing = split ? partNames(spectra) : [];   // split sounds, or the producer's tracks (Aria Ear)
  const color = (n: string) => partColor(n, playing.indexOf(n));
  const showParts = playing.length >= 2;   // one part playing is the mix: draw it once, as the mix
  const names = showParts ? playing : ["mix"];
  // Every finding with a place on the axis, numbered for the pins and the chips
  const zones = findings.map((f) => {
    const point = f.kind === "resonance" || f.kind === "harsh";
    const lo = point ? f.hz! * 0.92 : f.hz_range[0], hi = point ? f.hz! * 1.08 : f.hz_range[1];
    const amount = f.kind === "masking" ? `${f.gap_db!.toFixed(0)} dB` : f.kind === "bass_click" ? "clicks" : f.kind === "clash" ? ""
      : f.kind === "reference" ? `${f.diff_db! > 0 ? "+" : "−"}${Math.abs(f.diff_db!).toFixed(0)} dB vs ref` : `+${f.size_db!.toFixed(0)} dB`;
    const zlo = Math.max(LO, lo), zhi = Math.min(HI, hi);
    return { f, lo: zlo, hi: zhi, pin: (X(zlo) + X(zhi)) / 2, where: point ? hz(f.hz!) : hzRange(f.hz_range), amount };
  });
  // Pins on wide, overlapping zones would sit on each other: keep them a pin apart, left to right
  [...zones].sort((a, b) => a.pin - b.pin).forEach((z, i, all) => { if (i) z.pin = Math.max(z.pin, all[i - 1].pin + PIN_GAP); });
  zones.forEach((z) => { z.pin = Math.min(z.pin, W - 11); });
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

  // Waves with their label positions, labels nudged so none overlap. Worked out once per result,
  // not on every pointer move.
  // Drawn with Pro-Q's tilt, then shifted so the mix's highest point is 0 dB again (the hover shows the real levels)
  const lift = Math.max(...spectra.mix.map((v, i) => v + tilt(spectra.hz[i])));
  const waves = useMemo(() => { const out = names.map((n) => {
    const values = smoothValues((n === "mix" ? spectra.mix : spectra.parts[n]!).map((v, i) => v + tilt(spectra.hz[i]) - lift));
    const line = path(spectra.hz.map((h, i) => [X(h), Y(values[i])]));
    const peak = values.indexOf(Math.max(...values));
    return { n, line, quiet: showParts && involved.size > 0 && !involved.has(n),
             label: { x: 0, y: Y(values[peak]) - 6, w: soundName(n).length * 6.2, at: X(spectra.hz[peak]) } };
  });
  // Labels stay inside the picture by their own width, so long track names don't clip
  out.forEach((wv) => { wv.label.x = Math.min(W - wv.label.w / 2 - 4, Math.max(wv.label.w / 2 + 4, wv.label.at)); });
  [...out].sort((a, b) => b.label.y - a.label.y).forEach((wv, i, all) => {
    all.slice(0, i).forEach((p) => {
      if (Math.abs(p.label.x - wv.label.x) < (wv.label.w + p.label.w) / 2 + 4 && Math.abs(p.label.y - wv.label.y) < 13) {
        wv.label.y = Math.min(wv.label.y, p.label.y - 13);
      }
    });
    wv.label.y = Math.max(PAD_T - 2, wv.label.y);
  });
  return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectra, findings, split]);

  const tooltip = hover && (
    <ChartTooltip x={hover.left} y={hover.top}
      title={hz(spectra.hz[hover.i])}
      rows={names.slice().reverse().map((n) => {
        const v = (n === "mix" ? spectra.mix : spectra.parts[n]!)[hover.i];
        return { label: SHORT[n] ?? soundName(n), value: v <= FLOOR_DB ? "silent" : `${v.toFixed(0)} dB`, color: getComputedStyle(svgRef.current!).getPropertyValue(color(n).slice(4, -1)) };
      })} />
  );

  // Bare (Ember, the window's Mix check): the Pro-Q look of every chart (components/plot.tsx). Hz along the
  // bottom and dB down the right inside the plot, 0 dB at the mix's loudest point, numbered pins over each problem.
  if (bare) {
    const ticks = dbTicksOf(FLOOR_DB, 12, Y);
    return (
      <div className="flex flex-col gap-2">
        <Plot height={H} dbTicks={ticks} pins={zones.map((z, i) => ({ n: i + 1, f: Math.sqrt(z.lo * z.hi), title: `${describe(z.f).name}, ${z.where}` }))}
              onPin={(n) => onZone(zones[n - 1].f)}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Each part's frequency curve"
               onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <PlotGrid height={H} dbTicks={ticks} />
            {zones.map((z, i) => (
              <g key={i} className="group cursor-pointer" onClick={() => onZone(z.f)}>
                <rect x={X(z.lo)} y={0} width={Math.max(6, X(z.hi) - X(z.lo))} height={H} fill="var(--hot)" className="opacity-0 transition-opacity group-hover:opacity-[0.1]" />
                <rect x={X(z.lo)} y={PAD_T - 8} width={Math.max(6, X(z.hi) - X(z.lo))} height={3} rx={1.5} fill="var(--hot)" opacity={0.85} />
              </g>
            ))}
            {waves.map((wv, i) => (
              <motion.g key={wv.n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }}>
                <path d={`${wv.line}L${W},${H}L0,${H}Z`} fill={color(wv.n)} opacity={wv.quiet ? 0.02 : 0.06} />
                <motion.path d={wv.line} fill="none" stroke={color(wv.n)} strokeWidth={1.75} opacity={wv.quiet ? 0.35 : 1} vectorEffect="non-scaling-stroke"
                             initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.3, 0.8, 0.2, 1], delay: 0.2 + i * 0.06 }} />
              </motion.g>
            ))}
            {hover && <line x1={X(spectra.hz[hover.i])} x2={X(spectra.hz[hover.i])} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />}
          </svg>
        </Plot>
        {tooltip}
        {split && playing.length === 1 && <span className="text-xs text-ink-muted">Only the {soundName(playing[0]).toLowerCase()} is playing in these bars.</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${bare ? H - PAD_B + 2 : H}`} className="block h-auto w-full" role="img" aria-label="Each part's frequency curve"
           onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={PAD_T - 6} y2={H - PAD_B} stroke="var(--hairline)" />
            {!bare && <text x={X(t)} y={H - 6} textAnchor="middle" className="fill-ink-faint font-mono text-[10.5px]">{t >= 1000 ? `${t / 1000}k` : t}</text>}
          </g>
        ))}

        {zones.map((z, i) => (
          <g key={i} className="cursor-pointer [&:hover>rect]:opacity-35" onClick={() => onZone(z.f)}>
            <rect x={X(z.lo)} y={PAD_T - 6} width={Math.max(6, X(z.hi) - X(z.lo))} height={H - PAD_B - PAD_T + 6} fill="var(--hot)" opacity={0.09} />
            <circle cx={z.pin} cy={14} r={10} fill="var(--hot)" />
            <text x={z.pin} y={18} textAnchor="middle" fill="var(--tile-core)" className="text-[11px] font-bold">{i + 1}</text>
          </g>
        ))}

        {waves.map((wv, i) => (
          <motion.g key={wv.n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }}>
            <path d={`${wv.line}L${W},${H - PAD_B}L0,${H - PAD_B}Z`} fill={color(wv.n)} opacity={wv.quiet ? 0.02 : 0.06} />
            <motion.path d={wv.line} fill="none" stroke={color(wv.n)} strokeWidth={1.75} opacity={wv.quiet ? 0.35 : 1}
                         initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.3, 0.8, 0.2, 1], delay: 0.2 + i * 0.06 }} />
            {showParts && !bare && <text x={wv.label.x} y={wv.label.y} textAnchor="middle" fill={color(wv.n)} opacity={wv.quiet ? 0.5 : 1} className="text-[11.5px] font-semibold">{soundName(wv.n)}</text>}
          </motion.g>
        ))}
        {hover && <line x1={X(spectra.hz[hover.i])} x2={X(spectra.hz[hover.i])} y1={PAD_T - 6} y2={H - PAD_B} stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.5} />}
      </svg>

      {/* What each stretch of the picture is called, low to high, so 200 or 5k means something.
          Bare (Ember): names only, the numbers on hover and in the pointer's tooltip (Ian: "a little cluttered"). */}
      <div className="flex" aria-label="Frequency ranges">
        {BANDS.map((b, i) => {
          const lo = Math.max(LO, b.lo), hi = Math.min(HI, b.hi);
          const range = i === BANDS.length - 1 ? `${hzShort(b.lo)}+` : `${hzShort(b.lo)} to ${hzShort(b.hi)}`;
          return (
            <div key={b.name} className="flex min-w-0 flex-col items-center gap-0.5 overflow-hidden whitespace-nowrap py-1 text-center" title={`${b.name}: ${range} Hz`}
                 style={{ width: `${((X(hi) - X(lo)) / W) * 100}%`, borderLeft: i ? "1px solid var(--hairline)" : undefined }}>
              <span className={cn("leading-3", bare ? "text-[10.5px] text-ink-faint" : "text-[11px] font-semibold text-ink-muted")}>{b.name}</span>
              {!bare && <span className="font-mono text-[9.5px] leading-3 text-ink-faint">{range}</span>}
            </div>
          );
        })}
      </div>

      {tooltip}

      {/* The problems, numbered like the pins. Tap one to read about it. */}
      {zones.length > 0 && !bare && (
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z, i) => (
            <button key={i} onClick={() => onZone(z.f)}
                    className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold"
                    style={{ background: "color-mix(in srgb, var(--on-tile) 12%, transparent)", color: "var(--on-tile)" }}>
              <i className="grid size-[18px] place-items-center rounded-full text-[10px] font-bold not-italic" style={{ background: "var(--hot)", color: "var(--tile-core)" }}>{i + 1}</i>
              {describe(z.f).name} · {z.where}{z.amount && ` · ${z.amount}`}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3.5 text-xs text-ink-muted">
        {showParts && !bare && names.map((n) => (
          <span key={n} className="inline-flex items-center gap-1.5"><i className="h-[3px] w-3.5 rounded-sm" style={{ background: color(n) }} />{soundName(n)}</span>
        ))}
        {split && playing.length === 1 && <span>Only the {soundName(playing[0]).toLowerCase()} is playing in these bars.</span>}
      </div>
    </div>
  );
}
