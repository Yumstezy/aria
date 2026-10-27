// A number that counts up to its value when it appears (from the analytics bento). It always
// lands on the measured value; the count is decoration. Respects reduced motion.
import { useEffect, useRef } from "react";

export function CountUp({ value, decimals = 0, duration = 900 }: { value: number; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const el = ref.current!;
    const show = (v: number) => { el.textContent = v.toFixed(decimals); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { show(value); from.current = value; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const f = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / duration)), v = a + (value - a) * (1 - (1 - t) ** 3);
      show(t < 1 ? v : value);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    // Animation frames pause while the view is hidden (a collapsed device, a background
    // window). The number must still land on the measured value.
    const land = setTimeout(() => { cancelAnimationFrame(raf); show(value); from.current = value; }, duration + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(land); };
  }, [value, decimals, duration]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}
