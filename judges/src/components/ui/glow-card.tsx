// The card shell from the "interactive tech stack bento grid" (21st.dev), on its own: a dim edge, a bright edge
// that follows the cursor, and a spotlight and faint grid inside, all in one accent. Only the shell is used; the
// bento's demo content (latency, deploy log, scores) was invented data and is left out.
// Aria (Oct 29): the face is Aria's card color and the accents are Aria's (problems, yours, reference, done).
import { useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
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

// Faint grid that only shows near the cursor
const GRID_IMAGE =
  "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)";

export function GlowCard({ accent = "white", className, padded = true, children }: {
  accent?: Accent; className?: string; padded?: boolean; children: ReactNode;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const rgb = ACCENTS[accent];

  // Cursor position, measured from the card's top-left corner
  const moveTo = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPos({ x: clientX - rect.left, y: clientY - rect.top });
  };
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => moveTo(e.clientX, e.clientY, e.currentTarget);
  // Touch screens have no hover, so a finger dragging across the card lights it up too
  const handleTouch = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) { moveTo(touch.clientX, touch.clientY, e.currentTarget); setActive(true); }
  };
  const gridMask = `radial-gradient(220px circle at ${pos.x}px ${pos.y}px, black, transparent 75%)`;

  return (
    <div onMouseMove={handleMouseMove} onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
         onTouchStart={handleTouch} onTouchMove={handleTouch} onTouchEnd={() => setActive(false)}
         className={cn("relative rounded-[18px]", className)}>
      {/* Edge layer 1: dim border */}
      <div aria-hidden="true" className="absolute inset-0 rounded-[18px] bg-white/[0.08]" />
      {/* Edge layer 2: bright border that follows the cursor */}
      <div aria-hidden="true" className={cn("absolute inset-0 rounded-[18px] transition-opacity duration-500", active ? "opacity-100" : "opacity-0")}
           style={{ background: `radial-gradient(240px circle at ${pos.x}px ${pos.y}px, rgba(${rgb}, 0.9), transparent 70%)` }} />
      {/* Card face: spotlight and grid live inside it */}
      <div aria-hidden="true" className="absolute inset-px overflow-hidden rounded-[17px] bg-card">
        <div className={cn("absolute inset-0 transition-opacity duration-500", active ? "opacity-100" : "opacity-0")}
             style={{ background: `radial-gradient(380px circle at ${pos.x}px ${pos.y}px, rgba(${rgb}, 0.1), transparent 65%)` }} />
        <div className={cn("absolute inset-0 transition-opacity duration-500", active ? "opacity-100" : "opacity-0")}
             style={{ backgroundImage: GRID_IMAGE, backgroundSize: "26px 26px", maskImage: gridMask, WebkitMaskImage: gridMask }} />
      </div>
      {/* Content */}
      <div className={cn("relative z-10 flex h-full flex-col", padded && "p-5 sm:p-6")}>{children}</div>
    </div>
  );
}
