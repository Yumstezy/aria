// Segmented control with a highlight that slides between options (from the analytics bento).
import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({ items, value, onChange, label }: { items: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="relative flex gap-0.5 rounded-[14px] border border-white/12 bg-white/8 p-[3px]">
      {items.map((it) => (
        <button key={it} role="tab" type="button" aria-selected={it === value} onClick={() => onChange(it)}
                className={cn("relative h-7 min-w-11 rounded-[11px] px-3 text-[12.5px] font-semibold transition-colors duration-200",
                              "focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]", it === value ? "text-[#0b0b0c]" : "text-ink-muted")}>
          {it === value && <motion.span layoutId={id} className="absolute inset-0 rounded-[11px] bg-white" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{it}</span>
        </button>
      ))}
    </div>
  );
}
