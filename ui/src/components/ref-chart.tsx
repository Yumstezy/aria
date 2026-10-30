// Your mix against your reference (build step 8, Ian Oct 29: "the reference in one color while yours in the
// other, where their track excels and yours doesn't"). Both songs at the same loudness on one frequency axis:
// yours in gold, the reference in blue, the gap shaded in the color of whichever is fuller there.
// Every point is measured (result.reference.curve); the lines are smoothed for display only.
// Pins, the Hz axis and the labels are HTML over the drawing, so they keep their size at any width.
import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { hz, type RefCompare } from "@/lib/aria";
import { BANDS } from "@/lib/problems";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { path, smoothValues } from "@/components/waves";

export const YOURS = "var(--trk-0)", THEIRS = "var(--cool)";
const W = 640, LO = 30, HI = 16000;
const TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const tick = (t: number) => (t >= 1000 ? `${t / 1000}k` : `${t}`);

export interface Zone { n: number; lo: number; hi: number; where?: string; amount?: string; amountColor?: string }

/** height: the drawing's height for its 640 width (it scales with the card, keeping its shape).
    zones: the problems, numbered as in the list, each with where it hits and by how much.
    bands: the seven bands' differences, shown with their names under the axis (the Reference screen).
    zoom: just this stretch of frequencies, for the small picture of one problem (lines only). */
export function RefChart({ r, height = 190, zones = [], bands, zoom, onZone }: {
  r: RefCompare; height?: number; zones?: Zone[]; bands?: RefCompare["bands"]; zoom?: [number, number]; onZone?: (n: number) => void;
}) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const small = !!zoom;
  const lo = zoom ? Math.max(LO, zoom[0]) : LO, hi = zoom ? Math.min(HI, zoom[1]) : HI;
  const H = height;
  const X = (f: number) => ((Math.log(f) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * W;
  const pct = (f: number) => `${(X(Math.min(hi, Math.max(lo, f))) / W) * 100}%`;

  const shape = useMemo(() => {
    const c = r.curve!;
    const pick = c.hz.map((h, i) => [h, i] as const).filter(([h]) => h >= lo / 1.15 && h <= hi * 1.15);
    const mine = smoothValues(pick.map(([, i]) => c.mine[i])), ref = smoothValues(pick.map(([, i]) => c.ref[i]));
    // Scale to the songs themselves (the deep sub and top air roll off, so they don't set the floor),
    // so the curves fill the box and their differences show
    const inner = pick.flatMap(([h], k) => (h >= 40 && h <= 12000) || small ? [mine[k], ref[k]] : []);
    const top = Math.max(...mine, ...ref) + 2;
    const range = Math.min(48, Math.max(small ? 9 : 22, top - Math.min(...inner) + 4)), floor = top - range;
    const Y = (db: number) => 4 + (1 - (Math.max(db, floor) - floor) / range) * (H - 8);
    const pts = (v: number[]) => pick.map(([h], k) => [X(h), Y(v[k])] as [number, number]);
    const pm = pts(mine), m = path(pm), t = path(pts(ref));
    const back = (v: number[]) => path(pts(v).reverse()).replace(/^M/, "L");
    return { m, t, between: `${m}${back(ref)}Z`, aboveMine: `${m}L${W},0L0,0Z`, aboveRef: `${t}L${W},0L0,0Z`,
             mineArea: `${m}L${pm[pm.length - 1][0]},${H}L${pm[0][0]},${H}Z` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, lo, hi, H, small]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const b = svg.current!.getBoundingClientRect();
    const f = Math.exp(Math.log(lo) + ((e.clientX - b.left) / b.width) * (Math.log(hi) - Math.log(lo)));
    const c = r.curve!;
    let i = 0;
    c.hz.forEach((h, k) => { if (Math.abs(Math.log(h / f)) < Math.abs(Math.log(c.hz[i] / f))) i = k; });
    setHover({ i, x: e.clientX, y: e.clientY });
  };
  const css = (v: string) => (svg.current ? getComputedStyle(svg.current).getPropertyValue(v.slice(4, -1)) : undefined);

  const drawing = (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Your mix and ${r.name}, at the same loudness`}
         onPointerMove={small ? undefined : onMove} onPointerLeave={() => setHover(null)}>
      <defs>
        <clipPath id={`${id}-am`}><path d={shape.aboveMine} /></clipPath>
        <clipPath id={`${id}-ar`}><path d={shape.aboveRef} /></clipPath>
      </defs>
      {!small && TICKS.map((t) => <line key={t} x1={X(t)} x2={X(t)} y1={0} y2={H} stroke="var(--hairline)" />)}
      {zones.map((z) => (
        <rect key={z.n} x={X(Math.max(lo, z.lo))} y={0} width={Math.max(5, X(Math.min(hi, z.hi)) - X(Math.max(lo, z.lo)))} height={H}
              fill="var(--hot)" opacity={0.1} className={onZone ? "cursor-pointer" : undefined} onClick={() => onZone?.(z.n)} />
      ))}
      {/* The gap: blue where the reference is fuller (above your line), gold where yours is */}
      <path d={shape.between} fill={THEIRS} opacity={0.3} clipPath={`url(#${id}-am)`} />
      <path d={shape.between} fill={YOURS} opacity={0.3} clipPath={`url(#${id}-ar)`} />
      <path d={shape.mineArea} fill={YOURS} opacity={0.04} />
      <path d={shape.t} fill="none" stroke={THEIRS} strokeWidth={small ? 2.2 : 1.8} vectorEffect="non-scaling-stroke" />
      <path d={shape.m} fill="none" stroke={YOURS} strokeWidth={small ? 2.2 : 1.8} vectorEffect="non-scaling-stroke" />
      {hover && <line x1={X(r.curve!.hz[hover.i])} x2={X(r.curve!.hz[hover.i])} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
  if (small) return drawing;

  return (
    <div className="flex flex-col">
      {/* The pins, over each problem's stretch */}
      {zones.length > 0 && (
        <div className="relative h-6">
          {zones.map((z) => (
            <button key={z.n} className="ae-pin absolute top-0 -translate-x-1/2" style={{ left: pct(Math.sqrt(z.lo * z.hi)), width: 20, height: 20, fontSize: 11 }}
                    title={z.where} onClick={() => onZone?.(z.n)}>{z.n}</button>
          ))}
        </div>
      )}
      {drawing}
      {/* Hz, where the grid lines are */}
      <div className="relative mt-1 h-3.5" aria-hidden="true">
        {TICKS.map((t) => <span key={t} className="absolute -translate-x-1/2 font-mono text-[10px] leading-3 text-ink-faint" style={{ left: pct(t) }}>{tick(t)}</span>)}
      </div>
      {/* The bands by name, with how far off each one is when asked */}
      <div className="mt-1.5 flex" aria-label="Frequency ranges">
        {BANDS.map((b, i) => {
          const d = bands?.[i]?.diff_db ?? null, off = d !== null && Math.abs(d) >= 2;
          return (
            <span key={b.name} className="flex min-w-0 flex-col items-center gap-0.5 overflow-visible text-center" title={`${b.name}: ${hz(b.lo)} to ${hz(b.hi)}`}
                  style={{ width: `${((X(Math.min(hi, b.hi)) - X(Math.max(lo, b.lo))) / W) * 100}%`, borderLeft: i ? "1px solid var(--hairline)" : undefined }}>
              <span className="w-full truncate text-[10.5px] text-ink-faint">{b.name}</span>
              {bands && <span className="ae-mono whitespace-nowrap text-[11px]" style={{ color: off ? (d! > 0 ? YOURS : THEIRS) : "var(--ink-faint)" }}>
                {d === null ? "none" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)}`}</span>}
            </span>
          );
        })}
      </div>
      {zones.some((z) => z.where) && <ZoneChips zones={zones} onZone={onZone} />}
      {hover && (() => {
        const c = r.curve!, d = c.mine[hover.i] - c.ref[hover.i];
        return <ChartTooltip x={hover.x} y={hover.y} title={`${hz(c.hz[hover.i])}  ${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} dB`}
                             rows={[{ label: r.name, value: `${c.ref[hover.i].toFixed(0)} dB`, color: css(THEIRS) }, { label: "Yours", value: `${c.mine[hover.i].toFixed(0)} dB`, color: css(YOURS) }]} />;
      })()}
    </div>
  );
}

/** Where each problem hits, by number: "1  140 Hz to 220 Hz  +6.8 dB" */
export function ZoneChips({ zones, onZone }: { zones: Zone[]; onZone?: (n: number) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {zones.map((z) => (
        <button key={z.n} onClick={() => onZone?.(z.n)} className="inline-flex items-center gap-2 rounded-full border border-hairline py-1 pl-1 pr-2.5 text-[12px] text-ink">
          <span className="ae-pin" style={{ width: 18, height: 18, fontSize: 10 }}>{z.n}</span>
          <span className="font-mono">{z.where}</span>
          {z.amount && <span className="font-mono" style={{ color: z.amountColor ?? "var(--hot)" }}>{z.amount}</span>}
        </button>
      ))}
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
