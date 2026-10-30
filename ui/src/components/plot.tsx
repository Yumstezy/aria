// The look of every frequency chart (Ian, Oct 29, after FabFilter Pro-Q): a dark plot with a fine grid, the Hz
// along the bottom and the dB down the right, both inside the plot, and nothing under it. Charts draw their
// curves into an SVG of width PLOT_W; this adds the grid lines (in the SVG) and the numbers (HTML over it, so
// they keep their size when the window is docked).
import type { ReactNode } from "react";

export const PLOT_W = 640, PLOT_LO = 30, PLOT_HI = 16000;
const LABELS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
// Every 1 to 9 of each decade, like an analyzer's grid
const MINOR = [30, 40, 60, 70, 80, 90, 300, 400, 600, 700, 800, 900, 3000, 4000, 6000, 7000, 8000, 9000];

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

/** The chart: its SVG (children) in a dark rounded plot, with the Hz along the bottom and the dB down the right.
    pins: numbered badges at the top of each problem's stretch. */
export function Plot({ height, dbTicks, pins = [], onPin, children }: {
  height: number; dbTicks: { y: number; label: string }[]; pins?: { n: number; f: number; title?: string }[]; onPin?: (n: number) => void; children: ReactNode;
}) {
  const at = (f: number) => `${(plotX(Math.min(PLOT_HI, Math.max(PLOT_LO, f))) / PLOT_W) * 100}%`;
  return (
    <div className="relative overflow-hidden rounded-[12px]" style={{ background: "color-mix(in srgb, var(--ground) 55%, transparent)", border: "1px solid var(--hairline)" }}>
      {children}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {LABELS.map((f) => (
          <span key={f} className="absolute bottom-1 -translate-x-1/2 font-mono text-[10px] leading-3 text-ink-faint" style={{ left: at(f) }}>{hzLabel(f)}</span>
        ))}
        {dbTicks.map((t, i) => (
          <span key={i} className="absolute right-1 -translate-y-1/2 rounded px-0.5 font-mono text-[10px] leading-3 text-ink-faint"
                style={{ top: `${(t.y / height) * 100}%`, background: "color-mix(in srgb, var(--ground) 75%, transparent)" }}>{t.label}</span>
        ))}
      </div>
      {pins.map((p) => (
        <button key={p.n} className="ae-pin absolute top-1.5 -translate-x-1/2" title={p.title} onClick={() => onPin?.(p.n)}
                style={{ left: at(p.f), width: 18, height: 18, fontSize: 10 }}>{p.n}</button>
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
