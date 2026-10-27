// A row of tick marks lit up to a share: "how much of the time". A picture instead of a sentence.
import { motion } from "motion/react";

export function TickGauge({ share, ticks = 36, label }: { share: number; ticks?: number; label?: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, share)) * ticks);
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${ticks * 8} 20`} className="block h-5 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
        {Array.from({ length: ticks }, (_, i) => (
          <motion.line key={i} x1={i * 8 + 4} x2={i * 8 + 4} y1={i % 6 === 0 ? 2 : 8} y2={20}
                       stroke={i < lit ? "var(--watch)" : "var(--track)"} strokeWidth={1.8} strokeLinecap="round"
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.012, duration: 0.3 }} />
        ))}
      </svg>
      {label && <span className="font-mono text-[11px] text-ink-faint">{label}</span>}
    </div>
  );
}
