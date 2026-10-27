// Where each part sits: every part's measured spectrum as a smooth filled wave on a frequency
// axis, with problem zones shaded and labelled. Parts a problem is about stand out; the rest
// step back. Curves are smoothed for display only; the engine's numbers stay as measured.
import { motion } from "motion/react";
import { describe, soundName, type Finding, type Spectra } from "@/lib/aria";

const W = 640, H = 300, PAD_B = 24, PAD_T = 26, LO = 30, HI = 16000, FLOOR_DB = -60;
const ORDER = ["drums", "bass", "other", "vocals"];   // drawn back to front
const TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const X = (hz: number) => ((Math.log10(hz) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * W;
const Y = (db: number) => PAD_T + (1 - (Math.max(db, FLOOR_DB) - FLOOR_DB) / -FLOOR_DB) * (H - PAD_T - PAD_B);

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
  const names = split ? ORDER.filter((n) => spectra.parts[n]) : ["mix"];

  // Waves with their label positions, labels nudged so none overlap
  const waves = names.map((n) => {
    const values = smoothValues(split ? spectra.parts[n]! : spectra.mix);
    const line = path(spectra.hz.map((h, i) => [X(h), Y(values[i])]));
    const peak = values.indexOf(Math.max(...values));
    return { n, line, quiet: split && involved.size > 0 && !involved.has(n),
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
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Each part's frequency curve">
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={PAD_T - 6} y2={H - PAD_B} stroke="var(--hairline)" />
            <text x={X(t)} y={H - 6} textAnchor="middle" className="fill-ink-faint font-mono text-[10.5px]">{t >= 1000 ? `${t / 1000}k` : t}</text>
          </g>
        ))}

        {findings.filter((f) => f.kind !== "bass_click").map((f, i) => {
          const point = f.kind === "resonance" || f.kind === "harsh";
          const lo = point ? f.hz! * 0.92 : f.hz_range[0], hi = point ? f.hz! * 1.08 : f.hz_range[1];
          const amount = f.kind === "masking" ? f.gap_db!.toFixed(0) : `+${f.size_db!.toFixed(0)}`;
          return (
            <g key={i} className="cursor-pointer [&:hover>rect]:opacity-20" onClick={() => onZone(f)}>
              <rect x={X(lo)} y={PAD_T - 6} width={Math.max(4, X(hi) - X(lo))} height={H - PAD_B - PAD_T + 6} fill="var(--hot)" opacity={0.12} />
              <text x={(X(lo) + X(hi)) / 2} y={14} textAnchor="middle" className="fill-hot text-[11px] font-semibold">{describe(f).name} {amount} dB</text>
            </g>
          );
        })}

        {waves.map((wv, i) => (
          <motion.g key={wv.n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }}>
            <path d={`${wv.line}L${W},${H - PAD_B}L0,${H - PAD_B}Z`} fill={`var(--part-${wv.n})`} opacity={wv.quiet ? 0.06 : 0.2} />
            <path d={wv.line} fill="none" stroke={`var(--part-${wv.n})`} strokeWidth={2} opacity={wv.quiet ? 0.35 : 1} />
            <text x={wv.label.x} y={wv.label.y} textAnchor="middle" fill={`var(--part-${wv.n})`} opacity={wv.quiet ? 0.5 : 1} className="text-[11.5px] font-semibold">{soundName(wv.n)}</text>
          </motion.g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-3.5 text-xs text-ink-muted">
        {names.map((n) => (
          <span key={n} className="inline-flex items-center gap-1.5"><i className="h-[3px] w-3.5 rounded-sm" style={{ background: `var(--part-${n})` }} />{soundName(n)}</span>
        ))}
        {split && Object.entries(spectra.parts).filter(([, v]) => !v).map(([n]) => (
          <span key={n} className="text-ink-faint">{soundName(n)}: not playing here</span>
        ))}
      </div>
    </div>
  );
}
