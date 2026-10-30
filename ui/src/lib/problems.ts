// One problem per thing to fix: the same sound covered in two ranges is one problem.
import { describe, hzRange, type EqFix, type Finding, type Note, type Result } from "@/lib/aria";

export interface Problem {
  name: string; where: string; short: string; findings: Finding[]; notes: Note[]; fix: EqFix | null; bar: number;
  /** The one big number: how far under (masking) or over (ringing, harsh), or how many note starts click */
  amount: { value: string; unit: string };
  /** Share of the time it happens, for the tick gauge, and its label */
  share: number; shareLabel: string;
}

export function problemsOf(r: Result): Problem[] {
  const groups: { findings: Finding[]; indexes: number[] }[] = [];
  const byKey: Record<string, (typeof groups)[number]> = {};
  r.clarity.findings.forEach((f, i) => {
    const key = f.kind === "masking" ? `masking:${f.masked}` : `${f.kind}:${i}`;
    if (!byKey[key]) { byKey[key] = { findings: [], indexes: [] }; groups.push(byKey[key]); }
    byKey[key].findings.push(f);
    byKey[key].indexes.push(i);
  });
  return groups.map(({ findings, indexes }) => {
    const f = findings[0], d = describe(f);
    const notes = (r.advice?.notes ?? []).filter((n) => indexes.includes(n.finding));
    const lo = Math.min(...findings.map((x) => x.hz_range[0])), hi = Math.max(...findings.map((x) => x.hz_range[1]));
    const worst = findings.reduce((a, b) => ((b.gap_db ?? 0) < (a.gap_db ?? 0) ? b : a));
    const amount = f.kind === "clash" ? { value: String(Math.round(f.share! * 100)), unit: "% of the time" }
      : f.kind === "masking" ? { value: Math.abs(worst.gap_db!).toFixed(1), unit: "dB under" }
      : f.kind === "bass_click" ? { value: String(Math.round(f.clicky_share! * 100)), unit: "% of notes" }
      : f.kind === "reference" ? { value: `${f.diff_db! > 0 ? "+" : "−"}${Math.abs(f.diff_db!).toFixed(1)}`, unit: "dB vs reference" }
      : f.kind === "typical" ? { value: `${f.outside_db! > 0 ? "+" : "−"}${Math.abs(f.outside_db!).toFixed(1)}`, unit: "dB past good mixes" }
      : { value: `+${f.size_db!.toFixed(1)}`, unit: "dB" };
    const share = f.kind === "bass_click" ? f.clicky_share! : f.kind === "masking" ? worst.share! : f.kind === "reference" || f.kind === "typical" ? 1 : (f.share ?? 0);
    const shareLabel = f.kind === "bass_click" ? `${f.starts} note starts` : f.kind === "clash" ? `${Math.round(share * 100)}% of the time both play` : `${Math.round(share * 100)}% of the time`;
    return {
      name: d.name,
      where: f.kind === "masking" ? hzRange([lo, hi]) : d.where,
      // Before Muse answers, or if it couldn't, describe the measurement itself.
      short: notes.map((n) => n.short).find(Boolean) ?? d.about,
      findings, notes, fix: notes.map((n) => n.fix).find(Boolean) ?? null, bar: f.bars[0], amount, share, shareLabel,
    };
  });
}

/** The one status word for a problem's tag ("Too bright" in the design) */
export function statusWord(p: Problem): string {
  const f = p.findings[0];
  if (f.kind === "masking") return p.name === "Mud" ? "Muddy" : "Buried";
  if (f.kind === "reference") return (f.diff_db ?? 0) > 0 ? "Over ref" : "Under ref";
  if (f.kind === "typical") return (f.outside_db ?? 0) > 0 ? "Fuller" : "Thinner";
  return { resonance: "Ringing", buildup: "Build-up", harsh: "Harsh", bass_click: "Clicking", clash: "Clashing" }[f.kind];
}

/** The bars a check covered */
export function checkedBars(r: Result): [number, number] | null {
  if (r.clarity.bars) return r.clarity.bars;
  if (!r.start_bar) return null;
  return [r.start_bar, r.start_bar + (r.recording.bars || 16) - 1];
}

/** The checked bars in groups (about eight of them unless a size is given), each marked hot where the
    problem happens. Tap one to hear it. */
export function barGroups(r: Result, p?: Problem, size?: number): { from: number; to: number; hot: boolean }[] {
  const span = checkedBars(r);
  if (!span) return [];
  size = size ?? Math.max(1, Math.ceil((span[1] - span[0] + 1) / 8));
  const out = [];
  for (let from = span[0]; from <= span[1]; from += size) {
    const to = Math.min(span[1], from + size - 1);
    out.push({ from, to, hot: !!p && p.findings.some((f) => f.bars[0] <= to && f.bars[1] >= from) });
  }
  return out;
}

/** "bars 49 to 60" for where a problem happens */
export function barsOf(p: Problem): string {
  const lo = Math.min(...p.findings.map((f) => f.bars[0])), hi = Math.max(...p.findings.map((f) => f.bars[1]));
  return lo === hi ? `bar ${lo}` : `bars ${lo} to ${hi}`;
}

/** Where in the mix, low to high. Bands a problem's frequencies fall in are filled. */
export const BANDS = [
  { name: "Sub", lo: 20, hi: 60 }, { name: "Bass", lo: 60, hi: 150 }, { name: "Low mids", short: "Lo mid", lo: 150, hi: 400 },
  { name: "Mids", short: "Mid", lo: 400, hi: 1000 }, { name: "Upper mids", short: "Hi mid", lo: 1000, hi: 4000 },
  { name: "Highs", short: "High", lo: 4000, hi: 10000 }, { name: "Air", lo: 10000, hi: 20000 },
] as { name: string; short?: string; lo: number; hi: number }[];

export function bandsWith(list: Problem[]) {
  return BANDS.map((b) => ({ ...b, found: list.filter((p) => p.findings.some((f) => f.hz_range[0] < b.hi && f.hz_range[1] > b.lo)) }));
}
