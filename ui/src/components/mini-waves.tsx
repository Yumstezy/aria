// A thumbnail of the window's "Where each part sits": the same measured curves, no labels,
// problem zones shaded. Sized for the device strip.
import { partColor, partNames, type Finding, type Spectra } from "@/lib/aria";

const W = 220, H = 52, LO = 30, HI = 16000, FLOOR_DB = -60;
const X = (hz: number) => ((Math.log10(hz) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * W;
const Y = (db: number) => 2 + (1 - (Math.max(db, FLOOR_DB) - FLOOR_DB) / -FLOOR_DB) * (H - 4);

function path(pts: [number, number][]) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const smooth = (v: number[]) => v.map((x, i) => ((v[i - 1] ?? x) + 2 * x + (v[i + 1] ?? x)) / 4);

export function MiniWaves({ spectra, findings, split }: { spectra: Spectra; findings: Finding[]; split: boolean }) {
  const involved = new Set(findings.flatMap((f) => (f.kind === "masking" ? [f.masked!] : f.kind === "bass_click" ? ["bass"] : f.kind === "clash" ? f.tracks! : [])));
  const names = split && partNames(spectra).length ? partNames(spectra) : ["mix"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      {findings.filter((f) => f.kind !== "bass_click").map((f, i) => {
        const point = f.kind === "resonance" || f.kind === "harsh";
        const lo = point ? f.hz! * 0.92 : f.hz_range[0], hi = point ? f.hz! * 1.08 : f.hz_range[1];
        return <rect key={i} x={X(lo)} y={0} width={Math.max(3, X(hi) - X(lo))} height={H} fill="var(--hot)" opacity={0.16} />;
      })}
      {names.map((n) => {
        const v = smooth(n === "mix" ? spectra.mix : spectra.parts[n]!);
        const line = path(spectra.hz.map((h, i) => [X(h), Y(v[i])]));
        const quiet = split && involved.size > 0 && !involved.has(n);
        return (
          <g key={n}>
            <path d={`${line}L${W},${H}L0,${H}Z`} fill={partColor(n, names.indexOf(n))} opacity={quiet ? 0.05 : 0.18} />
            <path d={line} fill="none" stroke={partColor(n, names.indexOf(n))} strokeWidth={1.4} opacity={quiet ? 0.3 : 1} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
