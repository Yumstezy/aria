// A small picture of one problem, instead of words: the clashing (or covering) parts' real curves around
// where it happens, or the EQ cut Muse wants when it gave one. Every point is measured (result.clarity.spectra).
import { memo } from "react";
import { partColor, partNames, type EqFix, type Spectra } from "@/lib/aria";
import type { Problem } from "@/lib/problems";

const W = 200, H = 90, FS = 96000;

function eqPath(fix: EqFix, w: number, h: number, lo: number, hi: number) {
  const A = 10 ** (fix.gain_db / 40), w0 = (2 * Math.PI * fix.freq_hz) / FS, c = Math.cos(w0), al = Math.sin(w0) / (2 * Math.max(0.1, fix.q));
  const k = [1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A];
  const db = (f: number) => {
    const x = (2 * Math.PI * f) / FS, c1 = Math.cos(x), s1 = Math.sin(x), c2 = Math.cos(2 * x), s2 = Math.sin(2 * x);
    const nr = k[0] + k[1] * c1 + k[2] * c2, ni = -(k[1] * s1 + k[2] * s2), dr = k[3] + k[4] * c1 + k[5] * c2, di = -(k[4] * s1 + k[5] * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  };
  const range = Math.max(6, Math.abs(fix.gain_db) + 2);
  return Array.from({ length: 80 }, (_, i) => lo * (hi / lo) ** (i / 79))
    .map((f, i) => `${i ? "L" : "M"}${((i / 79) * w).toFixed(1)},${(h / 2 - (db(f) / range) * (h / 2 - 8)).toFixed(1)}`).join("");
}

export const ProblemThumb = memo(function ProblemThumb({ p, spectra }: { p: Problem; spectra?: Spectra }) {
  const f = p.findings[0];
  const names = spectra ? partNames(spectra) : [];
  const who = (f.kind === "clash" ? f.tracks! : f.kind === "masking" ? [f.masked!, f.by!] : []).filter((n) => names.includes(n));
  const point = f.hz ?? Math.sqrt(f.hz_range[0] * f.hz_range[1]);
  const lo = Math.max(30, Math.min(f.hz_range[0], point) / 3), hi = Math.min(16000, Math.max(f.hz_range[1], point) * 3);
  const X = (h: number) => ((Math.log(h) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * W;
  const zone = <rect x={X(f.hz_range[0])} y={0} width={Math.max(4, X(f.hz_range[1]) - X(f.hz_range[0]))} height={H} fill="var(--hot)" opacity={0.12} />;

  // Muse's EQ cut, when it gave one and no parts are named
  if (p.fix && !who.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="block size-full" preserveAspectRatio="none" role="img" aria-label="The EQ cut Muse suggests">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--hairline)" />
        <path d={eqPath(p.fix, W, H, lo, hi)} fill="none" stroke="var(--trk-1)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  if (!spectra) return null;
  // The parts in it, or the whole mix, between a third and three times the problem's range
  const idx = spectra.hz.map((h, i) => [h, i] as const).filter(([h]) => h >= lo && h <= hi).map(([, i]) => i);
  const series = (who.length ? who : ["mix"]).map((n) => {
    const raw = n === "mix" ? spectra.mix : spectra.parts[n]!;
    const v = idx.map((i) => { const w = [i - 2, i - 1, i, i + 1, i + 2].map((j) => raw[Math.min(raw.length - 1, Math.max(0, j))]); return w.reduce((s, x) => s + x, 0) / w.length; });
    return { n, v };
  });
  const all = series.flatMap((s) => s.v), mx = Math.max(...all), mn = Math.max(Math.min(...all), mx - 30);
  const Y = (d: number) => 10 + (1 - (Math.max(mn, d) - mn) / (mx - mn || 1)) * (H - 20);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block size-full" preserveAspectRatio="none" role="img" aria-label={`${who.join(" and ") || "The mix"} around ${p.where}`}>
      {zone}
      {series.map((s) => (
        <path key={s.n} d={idx.map((i, k) => `${k ? "L" : "M"}${X(spectra.hz[i]).toFixed(1)},${Y(s.v[k]).toFixed(1)}`).join("")}
              fill="none" stroke={s.n === "mix" ? "var(--ink-muted)" : partColor(s.n, names.indexOf(s.n))} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
});
