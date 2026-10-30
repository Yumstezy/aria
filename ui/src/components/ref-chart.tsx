// Your mix against your reference (build step 8, Ian Oct 29: "the reference in one color while yours in the
// other, where their track excels and yours doesn't"). Both songs at the same loudness on one frequency axis:
// yours in gold, the reference in blue, the gap shaded in the color of whichever is fuller there.
// Every point is measured (result.reference.curve); the lines are smoothed for display only.
import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { hz, type RefCompare } from "@/lib/aria";
import { BANDS } from "@/lib/problems";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { path, smoothValues } from "@/components/waves";

export const YOURS = "var(--trk-0)", THEIRS = "var(--cool)";
const W = 640, LO = 30, HI = 16000, RANGE_DB = 42;

/** height: in the drawing's units (it's 640 wide and scales to the card). zones: numbered pins for the
    reference problems (numbers as in the problem list). zoom: just this stretch of frequencies, stretched to
    fill its box, for a small picture of one problem (no labels, no hover). */
export function RefChart({ r, height = 170, zones = [], zoom, onZone }: {
  r: RefCompare; height?: number; zones?: { n: number; lo: number; hi: number }[]; zoom?: [number, number]; onZone?: (n: number) => void;
}) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const small = !!zoom;
  const lo = zoom ? Math.max(LO, zoom[0]) : LO, hi = zoom ? Math.min(HI, zoom[1]) : HI;
  const PAD_T = zones.length && !small ? 26 : 6, H = height, PAD_B = 4;

  const shape = useMemo(() => {
    const c = r.curve!;
    const pick = c.hz.map((h, i) => [h, i] as const).filter(([h]) => h >= lo / 1.2 && h <= hi * 1.2);
    const mine = smoothValues(pick.map(([, i]) => c.mine[i])), ref = smoothValues(pick.map(([, i]) => c.ref[i]));
    // The whole song: a fixed 42 dB scale. One problem up close: just that slice's own range, with room around it.
    const top = Math.max(...mine, ...ref) + (zoom ? 3 : 0);
    const range = zoom ? Math.max(9, top - Math.min(...mine, ...ref) + 3) : RANGE_DB, floor = top - range;
    const X = (f: number) => ((Math.log(f) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * W;
    const Y = (db: number) => PAD_T + (1 - (Math.max(db, floor) - floor) / range) * (H - PAD_T - PAD_B);
    const pts = (v: number[]) => pick.map(([h], k) => [X(h), Y(v[k])] as [number, number]);
    const m = path(pts(mine)), t = path(pts(ref));
    const back = (v: number[]) => path(pts(v).reverse()).replace(/^M/, "L");
    return { X, m, t, between: `${m}${back(ref)}Z`, aboveMine: `${m}L${W},0L0,0Z`, aboveRef: `${t}L${W},0L0,0Z`,
             mineArea: `${m}L${W},${H}L0,${H}Z`, idx: pick.map(([, i]) => i) };
  }, [r, lo, hi, H, PAD_T, zoom]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const b = svg.current!.getBoundingClientRect();
    const f = Math.exp(Math.log(lo) + ((e.clientX - b.left) / b.width) * (Math.log(hi) - Math.log(lo)));
    const c = r.curve!;
    let i = 0;
    c.hz.forEach((h, k) => { if (Math.abs(Math.log(h / f)) < Math.abs(Math.log(c.hz[i] / f))) i = k; });
    setHover({ i, x: e.clientX, y: e.clientY });
  };
  const css = (v: string) => (svg.current ? getComputedStyle(svg.current).getPropertyValue(v.slice(4, -1)) : undefined);

  return (
    <div className={small ? "h-full" : "flex flex-col gap-1.5"}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={small ? "none" : undefined} className="block h-auto w-full" style={small ? { height: "100%" } : undefined}
           role="img" aria-label={`Your mix and ${r.name}, at the same loudness`}
           onPointerMove={small ? undefined : onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <clipPath id={`${id}-am`}><path d={shape.aboveMine} /></clipPath>
          <clipPath id={`${id}-ar`}><path d={shape.aboveRef} /></clipPath>
        </defs>
        {!small && [50, 100, 200, 500, 1000, 2000, 5000, 10000].map((t) => <line key={t} x1={shape.X(t)} x2={shape.X(t)} y1={PAD_T - 4} y2={H} stroke="var(--hairline)" />)}
        {zones.map((z) => (
          <g key={z.n} className={onZone ? "cursor-pointer" : undefined} onClick={() => onZone?.(z.n)}>
            <rect x={shape.X(Math.max(lo, z.lo))} y={small ? 0 : PAD_T - 4} width={Math.max(4, shape.X(Math.min(hi, z.hi)) - shape.X(Math.max(lo, z.lo)))} height={H} fill="var(--hot)" opacity={0.08} />
            {!small && <>
              <circle cx={(shape.X(Math.max(lo, z.lo)) + shape.X(Math.min(hi, z.hi))) / 2} cy={11} r={8} fill="var(--hot)" />
              <text x={(shape.X(Math.max(lo, z.lo)) + shape.X(Math.min(hi, z.hi))) / 2} y={15} textAnchor="middle" fill="var(--tile-core)" className="text-[10.5px] font-bold">{z.n}</text>
            </>}
          </g>
        ))}
        {/* The gap: blue where the reference is fuller (above your line), gold where yours is */}
        <path d={shape.between} fill={THEIRS} opacity={0.28} clipPath={`url(#${id}-am)`} />
        <path d={shape.between} fill={YOURS} opacity={0.28} clipPath={`url(#${id}-ar)`} />
        <path d={shape.mineArea} fill={YOURS} opacity={0.05} />
        <path d={shape.t} fill="none" stroke={THEIRS} strokeWidth={small ? 2.2 : 1.8} vectorEffect="non-scaling-stroke" />
        <path d={shape.m} fill="none" stroke={YOURS} strokeWidth={small ? 2.2 : 1.8} vectorEffect="non-scaling-stroke" />
        {hover && <line x1={shape.X(r.curve!.hz[hover.i])} x2={shape.X(r.curve!.hz[hover.i])} y1={PAD_T - 4} y2={H} stroke="currentColor" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      {!small && (
        <div className="flex" aria-label="Frequency ranges">
          {BANDS.map((b, i) => {
            const bl = Math.max(lo, b.lo), bh = Math.min(hi, b.hi);
            return <span key={b.name} className="truncate text-center text-[10.5px] text-ink-faint" title={`${b.name}: ${hz(b.lo)} to ${hz(b.hi)}`}
                         style={{ width: `${((shape.X(bh) - shape.X(bl)) / W) * 100}%`, borderLeft: i ? "1px solid var(--hairline)" : undefined }}>{b.name}</span>;
          })}
        </div>
      )}
      {hover && (() => {
        const c = r.curve!, d = c.mine[hover.i] - c.ref[hover.i];
        return <ChartTooltip x={hover.x} y={hover.y} title={`${hz(c.hz[hover.i])}  ${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} dB`}
                             rows={[{ label: r.name, value: `${c.ref[hover.i].toFixed(0)} dB`, color: css(THEIRS) }, { label: "Yours", value: `${c.mine[hover.i].toFixed(0)} dB`, color: css(YOURS) }]} />;
      })()}
    </div>
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
