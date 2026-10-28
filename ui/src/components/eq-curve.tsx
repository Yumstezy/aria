// How an EQ should look: the summed response of its bands, drawn like an EQ plugin's display,
// with each band as a numbered point. The bands are real: from the producer's preset, or Muse's
// stated starting point. Each band is a standard biquad (RBJ cookbook), so shapes look as they sound.
import { hz, type GuideBand } from "@/lib/aria";

const W = 360, H = 132, PAD_B = 16, LO = 20, HI = 20000, FS = 96000, STEPS = 180;
const X = (f: number) => ((Math.log10(f) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * W;

function biquad(b: GuideBand, gain = b.gain_db) {
  const A = 10 ** (gain / 40), w0 = (2 * Math.PI * Math.min(b.freq_hz, FS / 2.2)) / FS, cos = Math.cos(w0);
  const q = b.shape.endsWith("shelf") ? Math.max(0.3, b.q) : Math.max(0.1, b.q);
  const al = Math.sin(w0) / (2 * q), sa = 2 * Math.sqrt(A) * al;
  switch (b.shape) {
    case "low_shelf": return [A * (A + 1 - (A - 1) * cos + sa), 2 * A * (A - 1 - (A + 1) * cos), A * (A + 1 - (A - 1) * cos - sa), A + 1 + (A - 1) * cos + sa, -2 * (A - 1 + (A + 1) * cos), A + 1 + (A - 1) * cos - sa];
    case "high_shelf": return [A * (A + 1 + (A - 1) * cos + sa), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - sa), A + 1 - (A - 1) * cos + sa, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - sa];
    case "low_cut": return [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + al, -2 * cos, 1 - al];
    case "high_cut": return [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + al, -2 * cos, 1 - al];
    case "notch": return [1, -2 * cos, 1, 1 + al, -2 * cos, 1 - al];
    default: return [1 + al * A, -2 * cos, 1 - al * A, 1 + al / A, -2 * cos, 1 - al / A];   // bell
  }
}

function db(c: number[], f: number) {
  const w = (2 * Math.PI * f) / FS, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = c[0] + c[1] * c1 + c[2] * c2, ni = -(c[1] * s1 + c[2] * s2);
  const dr = c[3] + c[4] * c1 + c[5] * c2, di = -(c[4] * s1 + c[5] * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

const freqs = Array.from({ length: STEPS }, (_, i) => LO * (HI / LO) ** (i / (STEPS - 1)));
const total = (coefs: number[][], f: number) => coefs.reduce((s, c) => s + db(c, f), 0);

export function EqCurve({ bands }: { bands: GuideBand[] }) {
  const coefs = bands.map((b) => biquad(b));
  const moving = bands.some((b) => b.dynamic_db);
  const moved = bands.map((b) => biquad(b, b.gain_db + (b.dynamic_db || 0)));
  const peak = Math.max(6, ...bands.map((b) => Math.abs(b.gain_db) + Math.abs(b.dynamic_db || 0)));
  const range = Math.min(24, Math.ceil(peak / 3) * 3 + 3);
  const Y = (d: number) => ((range - Math.max(-range, Math.min(range, d))) / (2 * range)) * (H - PAD_B);
  const line = (c: number[][]) => freqs.map((f, i) => `${i ? "L" : "M"}${X(f).toFixed(1)},${Y(total(c, f)).toFixed(1)}`).join("");
  const main = line(coefs);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img"
         aria-label={`EQ curve: ${bands.map((b) => `${b.shape.replace("_", " ")} at ${hz(b.freq_hz)}`).join(", ")}`}>
      <rect x={0} y={0} width={W} height={H - PAD_B} rx={10} fill="var(--well)" />
      {[100, 1000, 10000].map((f) => <line key={f} x1={X(f)} x2={X(f)} y1={0} y2={H - PAD_B} stroke="var(--hairline)" />)}
      <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--track)" />
      {moving && <path d={line(moved)} fill="none" stroke="var(--watch)" strokeWidth={1.5} strokeDasharray="4 3" />}
      <path d={`${main}L${W},${Y(0)}L0,${Y(0)}Z`} fill="var(--action)" opacity={0.14} />
      <path d={main} fill="none" stroke="var(--action)" strokeWidth={2} />
      {bands.map((b, i) => {
        const x = X(b.freq_hz), y = Y(total(coefs, b.freq_hz));
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={8} fill="var(--action)" stroke="var(--card)" strokeWidth={1.5} />
            <text x={x} y={y + 3.5} textAnchor="middle" fill="var(--on-action)" style={{ fontSize: 9.5, fontWeight: 700 }}>{b.band}</text>
          </g>
        );
      })}
      {[[100, "100"], [1000, "1k"], [10000, "10k"]].map(([f, t]) => (
        <text key={t} x={X(f as number)} y={H - 3} textAnchor="middle" fill="var(--ink-faint)" style={{ fontSize: 9.5, fontWeight: 600 }}>{t}</text>
      ))}
      <text x={W - 4} y={11} textAnchor="end" fill="var(--ink-faint)" style={{ fontSize: 9, fontWeight: 600 }}>±{range} dB</text>
    </svg>
  );
}
