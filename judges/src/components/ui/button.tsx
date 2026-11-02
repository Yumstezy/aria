// M3 Expressive button (Ian picked it, Nov 1), in Aria's colors instead of Material's purple: white filled, Aria blue
// tertiary, green "go", glassy tonal. The corners morph when pressed and a ripple spreads from where it was touched.
// A plain <button> (or <a> with href) with its own press state, in place of the Base UI primitive the original used,
// so the page needs one small dependency (class-variance-authority) rather than a UI library.
//
// Each size sets three corner radii as CSS variables:
//   --btn-r          resting corner (round = half the height, square = size-specific)
//   --btn-r-pressed  corner while pressed (the M3E shape morph)
import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type PointerEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button state-layer relative inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-(--btn-r) border border-transparent whitespace-nowrap focus-ring transition-shape outline-none select-none no-underline disabled:pointer-events-none disabled:cursor-default disabled:border-transparent! disabled:bg-white/10! disabled:text-white/38! disabled:shadow-none! data-press:rounded-(--btn-r-pressed) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&>*:not([data-slot=ripple])]:relative [&>*:not([data-slot=ripple])]:z-1",
  {
    variants: {
      variant: {
        /* M3 names */
        filled: "bg-primary text-on-primary hover:shadow-elevation-1 data-press:shadow-none",
        tonal: "bg-secondary-container text-on-secondary-container hover:shadow-elevation-1 data-press:shadow-none",
        elevated: "bg-surface-container-low text-on-surface shadow-elevation-1 hover:shadow-elevation-2 data-press:shadow-elevation-1",
        outlined: "border-outline-variant bg-transparent text-on-surface-variant",
        text: "bg-transparent text-on-surface disabled:bg-transparent!",
        /* shadcn names */
        default: "bg-primary text-on-primary hover:shadow-elevation-1 data-press:shadow-none",
        secondary: "bg-secondary-container text-on-secondary-container hover:shadow-elevation-1 data-press:shadow-none",
        tertiary: "bg-tertiary-container text-on-tertiary-container hover:shadow-elevation-1 data-press:shadow-none",
        go: "bg-go text-on-go hover:shadow-elevation-1 data-press:shadow-none",
        outline: "border-outline-variant bg-transparent text-on-surface-variant aria-expanded:bg-white/8",
        ghost: "bg-transparent text-on-surface-variant disabled:bg-transparent! aria-expanded:bg-white/8",
        destructive: "bg-error text-on-error hover:shadow-elevation-1 data-press:shadow-none",
        link: "state-layer-transparent bg-transparent text-on-surface underline-offset-4 hover:underline disabled:bg-transparent!",
      },
      size: {
        xs: "h-8 gap-2 px-4 type-label-large [--btn-r-pressed:8px] [--btn-r-square:12px] [--btn-r:16px] [&_svg:not([class*='size-'])]:size-4",
        sm: "h-10 gap-2 px-4 type-label-large [--btn-r-pressed:8px] [--btn-r-square:12px] [--btn-r:20px] [&_svg:not([class*='size-'])]:size-5",
        default: "h-10 gap-2 px-5 type-label-large [--btn-r-pressed:8px] [--btn-r-square:12px] [--btn-r:20px] [&_svg:not([class*='size-'])]:size-5",
        md: "h-14 gap-2 px-6 type-title-medium [--btn-r-pressed:12px] [--btn-r-square:16px] [--btn-r:28px] [&_svg:not([class*='size-'])]:size-6",
        lg: "h-24 gap-3 px-12 type-headline-small [--btn-r-pressed:16px] [--btn-r-square:28px] [--btn-r:48px] data-[variant=outline]:border-2 data-[variant=outlined]:border-2 [&_svg:not([class*='size-'])]:size-8",
        "icon-xs": "size-8 [--btn-r-pressed:8px] [--btn-r-square:12px] [--btn-r:16px] [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-10 [--btn-r-pressed:8px] [--btn-r-square:12px] [--btn-r:20px] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10 [--btn-r-pressed:8px] [--btn-r-square:12px] [--btn-r:20px] [&_svg:not([class*='size-'])]:size-5",
        "icon-md": "size-14 [--btn-r-pressed:12px] [--btn-r-square:16px] [--btn-r:28px] [&_svg:not([class*='size-'])]:size-6",
      },
      shape: {
        round: "",
        square: "[--btn-r:var(--btn-r-square)]",
      },
    },
    defaultVariants: { variant: "default", size: "default", shape: "round" },
  },
);

// The ripple: a circle grows from where the button was pressed and fades as it lets go
function Ripple({ disabled }: { disabled?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const [waves, setWaves] = useState<{ id: number; x: number; y: number; r: number; out: boolean }[]>([]);
  useEffect(() => {
    const el = host.current?.parentElement;
    if (!el || disabled) return;
    let id = 0;
    const down = (e: globalThis.PointerEvent) => {
      const b = el.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      const r = Math.hypot(Math.max(x, b.width - x), Math.max(y, b.height - y));
      const me = ++id;
      setWaves((w) => [...w, { id: me, x, y, r, out: false }]);
      const up = () => {
        setWaves((w) => w.map((v) => (v.id === me ? { ...v, out: true } : v)));
        setTimeout(() => setWaves((w) => w.filter((v) => v.id !== me)), 450);
        window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, [disabled]);
  return (
    <span ref={host} data-slot="ripple" aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      {waves.map((w) => (
        <span key={w.id} className="ripple-wave absolute rounded-full bg-current" data-out={w.out || undefined}
              style={{ left: w.x - w.r, top: w.y - w.r, width: w.r * 2, height: w.r * 2 }} />
      ))}
    </span>
  );
}

type Common = VariantProps<typeof buttonVariants> & { disableRipple?: boolean; className?: string };
type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

// Pressed while the pointer is down on it, for the corner morph
function usePress() {
  const [press, setPress] = useState(false);
  return {
    "data-press": press || undefined,
    onPointerDown: () => setPress(true),
    onPointerUp: () => setPress(false),
    onPointerLeave: () => setPress(false),
    onPointerCancel: () => setPress(false),
  } as const;
}

function Button(props: ButtonProps | LinkProps) {
  const { className, variant = "default", size = "default", shape = "round", disableRipple, children, ...rest } = props;
  const press = usePress();
  const cls = cn(buttonVariants({ variant, size, shape }), className);
  const merge = <E,>(own?: (e: PointerEvent<E>) => void, mine?: () => void) => (e: PointerEvent<E>) => { mine?.(); own?.(e); };
  const ripple = <Ripple disabled={disableRipple || variant === "link"} />;
  if ("href" in rest && rest.href !== undefined) {
    const a = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a data-slot="button" data-variant={variant} data-size={size} {...a} className={cls} data-press={press["data-press"]}
         onPointerDown={merge(a.onPointerDown, press.onPointerDown)} onPointerUp={merge(a.onPointerUp, press.onPointerUp)}
         onPointerLeave={merge(a.onPointerLeave, press.onPointerLeave)} onPointerCancel={merge(a.onPointerCancel, press.onPointerCancel)}>
        {ripple}{children}
      </a>
    );
  }
  const b = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" data-slot="button" data-variant={variant} data-size={size} {...b} className={cls} data-press={press["data-press"]}
            onPointerDown={merge(b.onPointerDown, press.onPointerDown)} onPointerUp={merge(b.onPointerUp, press.onPointerUp)}
            onPointerLeave={merge(b.onPointerLeave, press.onPointerLeave)} onPointerCancel={merge(b.onPointerCancel, press.onPointerCancel)}>
      {ripple}{children}
    </button>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
export default Button;
