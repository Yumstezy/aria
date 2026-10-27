// The placeholder mark (the logo isn't chosen yet, CLAUDE.md) and small shared controls.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} aria-hidden="true">
      <rect width="26" height="26" rx="8" fill="var(--action)" />
      <path d="M8 10v6M11.5 7v12M15 9v8M18.5 11v4" stroke="var(--on-action)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type Variant = "primary" | "light" | "ghost";
export function Button({ variant = "ghost", small, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[transform,box-shadow] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:scale-[0.97] disabled:opacity-45",
        small ? "h-[26px] px-2.5 text-[11.5px]" : "h-8 px-4 text-xs",
        variant === "primary" && "bg-action text-on-action shadow-[0_10px_22px_-8px_var(--action-glow)]",
        variant === "light" && "bg-white text-[#0c1e3c] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.45)]",
        variant === "ghost" && "bg-transparent text-ink-muted hover:bg-well",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Cap({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-ink-muted", className)}>{children}</span>;
}
