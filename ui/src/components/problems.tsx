// What to fix: one row per problem with a short line; open a row for Muse's full note, the
// numbers, and the actions. The same sound covered in two ranges is one problem.
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/brand";
import { describe, hzRange, jumpTo, notice, type EqFix, type Finding, type Note, type Result } from "@/lib/aria";
import { cn } from "@/lib/utils";

export interface Problem { name: string; where: string; short: string; findings: Finding[]; notes: Note[]; fix: EqFix | null; bar: number }

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
    return {
      name: d.name,
      where: f.kind === "masking" ? hzRange([lo, hi]) : d.where,
      // Before Muse answers, or if it couldn't, describe the measurement itself.
      short: notes.map((n) => n.short).find(Boolean) ?? d.about,
      findings, notes, fix: notes.map((n) => n.fix).find(Boolean) ?? null, bar: f.bars[0],
    };
  });
}

export function Problems({ list, open, setOpen }: { list: Problem[]; open: number; setOpen: (i: number) => void }) {
  if (!list.length) {
    return (
      <p className="m-0 flex items-center gap-2 py-2 text-[13px] text-ink-muted">
        <span className="rounded-full bg-well px-2 py-0.5 text-[11px] font-semibold text-good">Clear</span>
        Nothing sticks out in these bars.
      </p>
    );
  }
  return (
    <ol className="m-0 grid list-none gap-1.5 p-0">
      {list.map((p, i) => {
        const isOpen = open === i;
        return (
          <li key={p.name + i} className="rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" style={{ background: "var(--glass-row)" }}>
            <button className="grid w-full grid-cols-[10px_minmax(0,1fr)_14px] items-start gap-2.5 rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                    aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
              <i className="mt-1.5 size-2 rounded-full bg-watch" />
              <span className="grid min-w-0 gap-0.5">
                <span className="flex items-center gap-2">
                  <b className="text-sm font-semibold">{p.name}</b>
                  <span className="whitespace-nowrap rounded-full bg-well px-1.5 font-mono text-[11px] leading-[18px] text-ink-muted">{p.where}</span>
                </span>
                <span className="text-[12.5px] leading-[17px] text-ink-muted">{p.short}</span>
              </span>
              <ChevronDown size={14} className={cn("mt-1 text-ink-faint transition-transform duration-150", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div key="more" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }} className="overflow-hidden">
                  <div className="grid gap-2 pb-3 pl-8 pr-3">
                    {p.notes.map((n, k) => <p key={k} className="m-0 text-[13px] leading-[18px]">{n.text}</p>)}
                    <div className="flex flex-wrap gap-1.5">
                      {p.findings.map((f, k) => {
                        const d = describe(f);
                        return <span key={k} className="whitespace-nowrap rounded-full bg-well px-2 font-mono text-[11px] leading-[18px] text-ink-muted">
                          {d.where} · {d.size} · bars {f.bars[0]}{f.bars[1] !== f.bars[0] ? `–${f.bars[1]}` : ""}</span>;
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Button small className="bg-well text-ink" onClick={() => jumpTo(p.bar)}>Hear it in Live</Button>
                      {p.fix && <Button small variant="primary" onClick={() => notice("Fix it for me is coming next.")}>Fix it for me</Button>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
}
