// A small chart tooltip, rendered at the top of the page (a portal) so no card can cover it,
// and flipped left or down when it would run off the edge. After the analytics bento Ian shared.
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TipRow { label: string; value: string; color?: string }

export function ChartTooltip({ x, y, title, rows }: { x: number; y: number; title: string; rows: TipRow[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 12, top: y - 12 });
  useLayoutEffect(() => {
    const r = box.current!.getBoundingClientRect();
    let left = x + 12, top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 12;
    if (top < 8) top = y + 14;
    setPos({ left, top });
  }, [x, y, title]);
  return createPortal(
    <div ref={box} role="tooltip"
         className="pointer-events-none fixed z-[1000] whitespace-nowrap rounded-[10px] px-2 py-1.5 text-[11px] leading-4"
         style={{ ...pos, background: "var(--solid)", color: "var(--on-solid)", boxShadow: "var(--shadow-tile), var(--shadow-rim-tile)" }}>
      <div className="mb-0.5" style={{ color: "var(--on-solid-muted)" }}>{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--on-solid-muted)" }}>
            {r.color && <i className="inline-block size-2 rounded-[2px]" style={{ background: r.color }} />}{r.label}
          </span>
          <b className="font-mono font-medium tabular-nums">{r.value}</b>
        </div>
      ))}
    </div>,
    document.body,
  );
}
