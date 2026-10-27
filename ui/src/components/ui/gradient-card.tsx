// Gradient hero card: a vertical gradient with a dark blurred core and a bright rim, after the
// cards in the finance bento Ian liked. Colours come from Aria's hero tokens (DESIGN.md: the blue
// hero tile, white text). Use it for the one main picture on a screen.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PRESETS = {
  blue: { top: "var(--tile-top)", base: "var(--tile-base)", bottom: "var(--tile-bottom)", core: "var(--tile-core)" },
  graphite: { top: "#7d8aa3", base: "#273247", bottom: "#3d4a63", core: "#05080f" },
};

export function GradientCard({ children, className, tone = "blue" }: { children: ReactNode; className?: string; tone?: keyof typeof PRESETS }) {
  const p = PRESETS[tone];
  return (
    <section className={cn("on-hero relative isolate overflow-hidden rounded-[28px] text-white", className)}>
      <div className="absolute inset-0 -z-20" style={{ background: `linear-gradient(180deg, ${p.top} 0%, ${p.base} 36%, ${p.base} 74%, ${p.bottom} 100%)` }} />
      <div className="absolute -z-10 rounded-[90px] blur-[60px]" style={{ left: "10%", right: "10%", top: "16%", bottom: "-6%", background: p.core }} />
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
      {children}
    </section>
  );
}
