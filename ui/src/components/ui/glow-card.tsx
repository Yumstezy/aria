// The card shell from the "interactive tech stack bento grid" (21st.dev), on its own: a dim edge, a bright edge
// that follows the cursor, and a spotlight and faint grid inside, all in one accent. Only the shell is used; the
// bento's demo content (latency, deploy log, scores) was invented data and is left out.
// In the app (Oct 29): the same card as the website (Ian: "the website should be your reference"), on the theme's card color.
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Accent = "hot" | "gold" | "blue" | "good" | "white";

// Spotlight colors, as "r, g, b"
const ACCENTS: Record<Accent, string> = {
  hot: "255, 138, 91",
  gold: "245, 196, 81",
  blue: "110, 168, 255",
  good: "74, 222, 128",
  white: "237, 237, 239",
};

// Oct 31 (Ian: hovering the cards lagged, and scrolling over them stuck): the cursor's place goes into two CSS
// variables at most once a screen frame, so moving the mouse never re-renders the card or what's in it, and the
// masked grid (the costliest layer to repaint in Live's web view) is gone.
export function GlowCard({ accent = "white", className, padded = true, children }: {
  accent?: Accent; className?: string; padded?: boolean; children: ReactNode;
}) {
  const [active, setActive] = useState(false);
  const box = useRef<HTMLDivElement>(null), frame = useRef(0);
  const rgb = ACCENTS[accent];

  // Cursor position, measured from the card's top-left corner
  const moveTo = (clientX: number, clientY: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = box.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${clientX - rect.left}px`);
      el.style.setProperty("--gy", `${clientY - rect.top}px`);
    });
  };

  return (
    <div ref={box} onPointerMove={(e) => moveTo(e.clientX, e.clientY)} onPointerEnter={() => setActive(true)} onPointerLeave={() => setActive(false)}
         className={cn("relative rounded-[18px]", className)}>
      {/* Edge layer 1: dim border */}
      <div aria-hidden="true" className="absolute inset-0 rounded-[18px]" style={{ background: "var(--card-edge)" }} />
      {/* Edge layer 2: bright border that follows the cursor */}
      <div aria-hidden="true" className={cn("absolute inset-0 rounded-[18px] transition-opacity duration-500", active ? "opacity-100" : "opacity-0")}
           style={{ background: `radial-gradient(240px circle at var(--gx, 50%) var(--gy, 50%), rgba(${rgb}, 0.9), transparent 70%)` }} />
      {/* Card face, with the spotlight inside it */}
      <div aria-hidden="true" className="absolute inset-px overflow-hidden rounded-[17px]" style={{ background: "var(--card)" }}>
        {active && <div className="absolute inset-0" style={{ background: `radial-gradient(380px circle at var(--gx, 50%) var(--gy, 50%), rgba(${rgb}, 0.1), transparent 65%)` }} />}
      </div>
      {/* Content */}
      <div className={cn("relative z-10 flex h-full flex-col", padded && "p-5 sm:p-6")}>{children}</div>
    </div>
  );
}
