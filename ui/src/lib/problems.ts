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
    const amount = f.kind === "masking" ? { value: Math.abs(worst.gap_db!).toFixed(1), unit: "dB under" }
      : f.kind === "bass_click" ? { value: String(Math.round(f.clicky_share! * 100)), unit: "% of notes" }
      : { value: `+${f.size_db!.toFixed(1)}`, unit: "dB" };
    const share = f.kind === "bass_click" ? f.clicky_share! : f.kind === "masking" ? worst.share! : (f.share ?? 0);
    const shareLabel = f.kind === "bass_click" ? `${f.starts} note starts` : `${Math.round(share * 100)}% of the time`;
    return {
      name: d.name,
      where: f.kind === "masking" ? hzRange([lo, hi]) : d.where,
      // Before Muse answers, or if it couldn't, describe the measurement itself.
      short: notes.map((n) => n.short).find(Boolean) ?? d.about,
      findings, notes, fix: notes.map((n) => n.fix).find(Boolean) ?? null, bar: f.bars[0], amount, share, shareLabel,
    };
  });
}
