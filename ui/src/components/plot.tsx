// The look of every frequency chart (Ian, Oct 29, after FabFilter Pro-Q): a dark plot with a fine grid, the Hz
// along the bottom and the dB down the right, both inside the plot, and nothing under it. Charts draw their
// curves into an SVG of width PLOT_W; this adds the grid lines (in the SVG) and the numbers (HTML over it, so
// they keep their size when the window is docked).
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const PLOT_W = 640, PLOT_LO = 30, PLOT_HI = 16000;
const LABELS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
// Every 1 to 9 of each decade, like an analyzer's grid
const MINOR = [30, 40, 60, 70, 80, 90, 300, 400, 600, 700, 800, 900, 3000, 4000, 6000, 7000, 8000, 9000];

/** Pro-Q's default analyzer tilt (Ian, Oct 29: Aria's curves should read like the analyzers producers know). Music
    has less energy up top, so drawn flat the highs fall off a cliff; tipped up 4.5 dB an octave around 1 kHz, a
    balanced mix reads about level. Drawing only: the numbers Aria reports, and the hover, stay as measured. */
export const TILT_DB_PER_OCT = 4.5;
// Pro-Q tilts a per-bin spectrum. Aria's levels are each band's summed power, and fractional-octave bands get
// twice as wide every octave, which already adds 3 dB an octave (Ian, Oct 29: drawn at the full 4.5 the bass sat far
// under the highs, unlike his analyzer). So the extra tilt on Aria's numbers is the rest: 4.5 - 3.01.
const BAND_SUM_DB_PER_OCT = 10 * Math.log10(2);
export const tilt = (f: number) => (TILT_DB_PER_OCT - BAND_SUM_DB_PER_OCT) * Math.log2(f / 1000);

export const plotX = (f: number) => ((Math.log(f) - Math.log(PLOT_LO)) / (Math.log(PLOT_HI) - Math.log(PLOT_LO))) * PLOT_W;
const hzLabel = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

/** The grid, for inside the chart's <svg>: faint lines every step of each decade, stronger at the labels,
    and a line at each dB tick (y in the SVG's units). */
export function PlotGrid({ height, dbTicks }: { height: number; dbTicks: { y: number }[] }) {
  return (
    <g aria-hidden="true">
      {MINOR.map((f) => <line key={f} x1={plotX(f)} x2={plotX(f)} y1={0} y2={height} stroke="var(--hairline)" strokeOpacity={0.5} />)}
      {LABELS.map((f) => <line key={f} x1={plotX(f)} x2={plotX(f)} y1={0} y2={height} stroke="var(--track)" strokeOpacity={0.6} />)}
      {dbTicks.map((t, i) => <line key={i} x1={0} x2={PLOT_W} y1={t.y} y2={t.y} stroke="var(--hairline)" />)}
    </g>
  );
}

export interface Pin { n: number; lo: number; hi: number; title?: string }

/** The chart: its SVG (children) in a dark rounded plot, with the Hz along the bottom and the dB down the right.
    pins: each problem's number over its stretch, with a thin strip under the numbers showing the stretch; pointing at
    a number shades its stretch. Numbers that would touch are pushed apart, so they stay readable when docked. */
export function Plot({ height, dbTicks, pins = [], onPin, children }: {
  height: number; dbTicks: { y: number; label: string }[]; pins?: Pin[]; onPin?: (n: number) => void; children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hot, setHot] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth || 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frac = (f: number) => plotX(Math.min(PLOT_HI, Math.max(PLOT_LO, f))) / PLOT_W;
  const at = (f: number) => `${frac(f) * 100}%`;
  // Number positions in px, left to right, at least 22 px apart and inside the plot
  const placed = [...pins].map((p) => ({ ...p, x: frac(Math.sqrt(p.lo * p.hi)) * width })).sort((a, b) => a.x - b.x);
  placed.forEach((p, i) => { p.x = Math.max(p.x, 14, i ? placed[i - 1].x + 22 : 0); });
  for (let i = placed.length - 1; i >= 0; i--) placed[i].x = Math.min(placed[i].x, width - 14 - (placed.length - 1 - i) * 22);
  const shade = pins.find((p) => p.n === hot);
  return (
    <div ref={box} className="relative overflow-hidden rounded-[12px]" style={{ background: "color-mix(in srgb, var(--ground) 55%, transparent)", border: "1px solid var(--hairline)" }}>
      {children}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {shade && <div className="absolute inset-y-0" style={{ left: at(shade.lo), width: `${(frac(shade.hi) - frac(shade.lo)) * 100}%`, background: "color-mix(in srgb, var(--hot) 10%, transparent)" }} />}
        {pins.map((p) => <div key={p.n} className="absolute h-[3px] rounded-full" style={{ top: 28, left: at(p.lo), width: `max(5px, ${(frac(p.hi) - frac(p.lo)) * 100}%)`, background: "var(--hot)", opacity: hot === null || hot === p.n ? 0.85 : 0.35 }} />)}
        {/* the tilt, in the top corner when there's room and no problem number there */}
        {width >= 420 && !placed.some((p) => p.x < 100) &&
          <span className="absolute left-2 top-1.5 font-mono text-[10px] leading-3 text-ink-faint" title="Drawn tipped up 4.5 dB per octave, like Pro-Q. The numbers stay as measured.">+{TILT_DB_PER_OCT} dB/oct</span>}
        {LABELS.map((f) => (
          <span key={f} className="absolute bottom-1 -translate-x-1/2 font-mono text-[10px] leading-3 text-ink-faint" style={{ left: at(f) }}>{hzLabel(f)}</span>
        ))}
        {dbTicks.map((t, i) => (
          <span key={i} className="absolute right-1 -translate-y-1/2 rounded px-0.5 font-mono text-[10px] leading-3 text-ink-faint"
                style={{ top: `${(t.y / height) * 100}%`, background: "color-mix(in srgb, var(--ground) 75%, transparent)" }}>{t.label}</span>
        ))}
      </div>
      {placed.map((p) => (
        <button key={p.n} className="ae-pin absolute top-1.5 -translate-x-1/2" title={p.title} onClick={() => onPin?.(p.n)}
                onPointerEnter={() => setHot(p.n)} onPointerLeave={() => setHot(null)}
                style={{ left: p.x, width: 18, height: 18, fontSize: 10 }}>{p.n}</button>
      ))}
    </div>
  );
}

/** dB ticks every step from 0 down to the floor, placed by the chart's own Y */
export function dbTicksOf(floor: number, step: number, Y: (db: number) => number) {
  const out = [];
  for (let db = 0; db > floor + step / 2; db -= step) out.push({ y: Y(db), label: db === 0 ? "0" : `−${-db}` });
  return out;
}
