// Your mix against your reference (build step 8, Ian Oct 29: "the reference in one color while yours in the
// other, where their track excels and yours doesn't"). Both songs at the same loudness on one frequency axis:
// yours in gold, the reference in blue, the gap shaded in the color of whichever is fuller there. Drawn in the
// Pro-Q style of every chart (components/plot.tsx): Hz along the bottom, dB down the right, 0 dB at the louder
// song's peak, both tipped up 4.5 dB an octave as Pro-Q draws them. Every point is measured (result.reference.curve); the lines are smoothed for display only.
import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { hz, type RefCompare } from "@/lib/aria";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { path, smoothValues } from "@/components/waves";
import { PLOT_HI, PLOT_LO, PLOT_W as W, Plot, PlotGrid, dbTicksOf, plotX as X, tilt } from "@/components/plot";

export const YOURS = "var(--trk-0)", THEIRS = "var(--cool)";
const PAD_T = 14, PAD_B = 20, STEP_DB = 6;   // the problem numbers have their own row above the drawing (plot.tsx)

export interface Zone { n: number; lo: number; hi: number; where?: string }

/** height: the drawing's height for its 640 width (it scales with the card, keeping its shape).
    zones: the problems, numbered as in the list: a shaded stretch with its number at the top. */
export function RefChart({ r, height = 240, zones = [], onZone, range }: {
  r: RefCompare; height?: number; zones?: Zone[]; onZone?: (n: number) => void;
  /** where most of the comparison songs sit (the good mixes' 10th to 90th percentile), drawn as a soft blue band */
  range?: { lo: number[]; hi: number[] };
}) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const H = height;

  const shape = useMemo(() => {
    const c = r.curve!;
    const pick = c.hz.map((h, i) => [h, i] as const).filter(([h]) => h >= PLOT_LO / 1.15 && h <= PLOT_HI * 1.15);
    // Drawn with Pro-Q's tilt (both songs the same, so the gap between them is untouched)
    const mine = smoothValues(pick.map(([h, i]) => c.mine[i] + tilt(h))), ref = smoothValues(pick.map(([h, i]) => c.ref[i] + tilt(h)));
    // 0 dB is the louder song's peak; the floor sits under the quietest point between 40 Hz and 12 kHz
    // (the deep sub and top air roll off), in whole 6 dB steps, so the curves fill the plot
    const top = Math.max(...mine, ...ref);
    const inner = pick.flatMap(([h], k) => (h >= 40 && h <= 12000 ? [mine[k] - top, ref[k] - top] : []));
    const floor = -STEP_DB * Math.min(8, Math.max(4, Math.ceil((-Math.min(...inner) + 3) / STEP_DB)));
    const Y = (db: number) => PAD_T + (1 - (Math.max(db - top, floor) - floor) / -floor) * (H - PAD_T - PAD_B);
    const pts = (v: number[]) => pick.map(([h], k) => [X(h), Y(v[k])] as [number, number]);
    const pm = pts(mine), m = path(pm), t = path(pts(ref));
    const band = range ? (() => {
      const lo = smoothValues(pick.map(([h, i]) => range.lo[i] + tilt(h))), hi = smoothValues(pick.map(([h, i]) => range.hi[i] + tilt(h)));
      return `${path(pts(hi))}${path(pts(lo).reverse()).replace(/^M/, "L")}Z`;
    })() : null;
    const back = (v: number[]) => path(pts(v).reverse()).replace(/^M/, "L");
    return { m, t, between: `${m}${back(ref)}Z`, aboveMine: `${m}L${W},0L0,0Z`, aboveRef: `${t}L${W},0L0,0Z`,
             mineArea: `${m}L${pm[pm.length - 1][0]},${H}L${pm[0][0]},${H}Z`, band, ticks: dbTicksOf(floor, STEP_DB, (db) => Y(db + top)) };
  }, [r, H, range]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const b = svg.current!.getBoundingClientRect();
    const f = Math.exp(Math.log(PLOT_LO) + ((e.clientX - b.left) / b.width) * (Math.log(PLOT_HI) - Math.log(PLOT_LO)));
    const c = r.curve!;
    let i = 0;
    c.hz.forEach((h, k) => { if (Math.abs(Math.log(h / f)) < Math.abs(Math.log(c.hz[i] / f))) i = k; });
    setHover({ i, x: e.clientX, y: e.clientY });
  };
  const css = (v: string) => (svg.current ? getComputedStyle(svg.current).getPropertyValue(v.slice(4, -1)) : undefined);

  return (
    <>
      <Plot height={H} dbTicks={shape.ticks} pins={zones.map((z) => ({ n: z.n, lo: z.lo, hi: z.hi, title: z.where }))} onPin={onZone}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Your mix and ${r.name}, at the same loudness`}
             onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <clipPath id={`${id}-am`}><path d={shape.aboveMine} /></clipPath>
            <clipPath id={`${id}-ar`}><path d={shape.aboveRef} /></clipPath>
          </defs>
          <PlotGrid height={H} dbTicks={shape.ticks} />
          {shape.band && <path d={shape.band} fill={THEIRS} opacity={0.12} />}
          {/* The gap: blue where the reference is fuller (above your line), gold where yours is */}
          <path d={shape.between} fill={THEIRS} opacity={0.3} clipPath={`url(#${id}-am)`} />
          <path d={shape.between} fill={YOURS} opacity={0.3} clipPath={`url(#${id}-ar)`} />
          <path d={shape.mineArea} fill={YOURS} opacity={0.04} />
          <path d={shape.t} fill="none" stroke={THEIRS} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          <path d={shape.m} fill="none" stroke={YOURS} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          {hover && <line x1={X(r.curve!.hz[hover.i])} x2={X(r.curve!.hz[hover.i])} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />}
        </svg>
      </Plot>
      {hover && (() => {
        const c = r.curve!, d = c.mine[hover.i] - c.ref[hover.i];
        return <ChartTooltip x={hover.x} y={hover.y} title={`${hz(c.hz[hover.i])}  ${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} dB`}
                             rows={[{ label: r.name, value: `${c.ref[hover.i].toFixed(0)} dB`, color: css(THEIRS) }, { label: "Yours", value: `${c.mine[hover.i].toFixed(0)} dB`, color: css(YOURS) }]} />;
      })()}
    </>
  );
}

/** "● Yours  ● THE WEEKEND.wav" */
export function RefLegend({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-muted">
      <span className="inline-flex items-center gap-1.5"><span className="ae-dot" style={{ color: YOURS }} />Yours</span>
      <span className="inline-flex min-w-0 items-center gap-1.5"><span className="ae-dot" style={{ color: THEIRS }} /><span className="truncate">{name}</span></span>
    </div>
  );
}
