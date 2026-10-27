// Liquid glass card, adapted from the "liquid weather glass" component Ian shared (21st.dev).
// Same four layers: the bend (blurred backdrop warped by an SVG turbulence filter), the face
// (fill and glow), the edge (inner highlights), then the content. Colours come from Aria's
// tokens so it works in Sky and Night. Dragging is off by default: nobody drags panels in a mixer.
import { useId, useState, type ReactNode, type MouseEvent } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Blur = "sm" | "md" | "lg" | "xl";

interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  draggable?: boolean;
  expandable?: boolean;
  blur?: Blur;
  radius?: string;
  /** Subtle lift on hover, for glass you can click */
  interactive?: boolean;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

const BLUR: Record<Blur, string> = { sm: "4px", md: "12px", lg: "16px", xl: "24px" };

export function GlassFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <filter id={id} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.003 0.007" numOctaves={1} result="turbulence" />
        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale={200} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

export function LiquidGlass({
  children, className, as = "div", draggable = false, expandable = false,
  blur = "xl", radius = "20px", interactive = false, onClick,
}: LiquidGlassProps) {
  const filterId = useId().replace(/:/g, "");
  const [expanded, setExpanded] = useState(false);
  const Tag = as === "section" ? motion.section : motion.div;

  return (
    <Tag
      className={cn("relative isolate", interactive && "cursor-pointer", className)}
      style={{ borderRadius: radius, background: "var(--glass-face)", boxShadow: "var(--glass-glow)" }}
      drag={draggable}
      dragConstraints={draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined}
      dragElastic={draggable ? 0.3 : undefined}
      whileHover={interactive ? { scale: 1.005 } : undefined}
      whileTap={interactive ? { scale: 0.995 } : undefined}
      data-expanded={expandable ? expanded : undefined}
      onClick={(e) => {
        if (expandable && !(e.target as HTMLElement).closest("a, button, input, select, textarea")) setExpanded(!expanded);
        onClick?.(e);
      }}
    >
      <GlassFilter id={filterId} />
      {/* Bend: the backdrop, blurred and warped */}
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          borderRadius: radius,
          backdropFilter: `blur(${BLUR[blur]}) saturate(160%)`,
          WebkitBackdropFilter: `blur(${BLUR[blur]}) saturate(160%)`,
          filter: `url(#${filterId})`,
        }}
      />
      {/* Edge: inner highlights */}
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ borderRadius: radius, boxShadow: "var(--glass-edge)" }} />
      {children}
    </Tag>
  );
}
