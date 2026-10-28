// A row of tick marks lit up to a share: "how much of the time". A picture instead of a sentence.
// Plain lines with one CSS fade (no per-tick animation objects), so many gauges stay cheap.
import { memo } from "react";

export const TickGauge = memo(function TickGauge({ share, ticks = 36, label }: { share: number; ticks?: number; label?: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, share)) * ticks);
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${ticks * 8} 20`} className="block h-5 w-full animate-[tickfade_.6s_ease-out_both]" preserveAspectRatio="none" role="img" aria-label={label}>
        {Array.from({ length: ticks }, (_, i) => (
          <line key={i} x1={i * 8 + 4} x2={i * 8 + 4} y1={i % 6 === 0 ? 2 : 8} y2={20}
                stroke={i < lit ? "var(--watch)" : "var(--track)"} strokeWidth={1.8} strokeLinecap="round" />
        ))}
      </svg>
      {label && <span className="font-mono text-[11px] text-ink-faint">{label}</span>}
    </div>
  );
});
