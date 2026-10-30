// A problem's mark (Ian, Oct 30: "use icons rather than numbers ... and different colors for frequencies"): the icon
// of its kind (mud, harsh, buried...) in the color of where it sits, lows to highs. The same mark sits over the
// problem's stretch on the charts and at the start of its row, so the eye matches them without reading.
import type { ReactNode } from "react";
import { BuriedIcon, ClashIcon, ClickIcon, HarshIcon, MudIcon, ReferenceIcon, RingIcon } from "@/components/icons";
import type { Finding, Kind } from "@/lib/aria";
import { BANDS } from "@/lib/problems";

export const KINDS: { kind: Kind; name: string; icon: ReactNode }[] = [
  { kind: "masking", name: "Buried sounds", icon: <BuriedIcon /> },
  { kind: "buildup", name: "Mud", icon: <MudIcon /> },
  { kind: "harsh", name: "Harsh hits", icon: <HarshIcon /> },
  { kind: "resonance", name: "Ringing notes", icon: <RingIcon /> },
  { kind: "bass_click", name: "Bass clicks", icon: <ClickIcon /> },
  { kind: "clash", name: "Clashing tracks", icon: <ClashIcon /> },
];

// Five colors for the seven bands, lows to highs (tokens --rng-* in styles/index.css)
const RANGE_COLOR: Record<string, string> = {
  Sub: "var(--rng-low)", Bass: "var(--rng-low)", "Low mids": "var(--rng-lowmid)", Mids: "var(--rng-mid)",
  "Upper mids": "var(--rng-himid)", Highs: "var(--rng-high)", Air: "var(--rng-high)",
};

/** The five colors as stretches of Hz, for the chart's ribbon */
export const RANGES = [
  { name: "Lows", lo: 20, hi: 150, color: "var(--rng-low)" }, { name: "Low mids", lo: 150, hi: 400, color: "var(--rng-lowmid)" },
  { name: "Mids", lo: 400, hi: 1000, color: "var(--rng-mid)" }, { name: "Upper mids", lo: 1000, hi: 4000, color: "var(--rng-himid)" },
  { name: "Highs", lo: 4000, hi: 20000, color: "var(--rng-high)" },
];

/** The band a stretch of Hz sits in (by its middle) and that band's color */
export function rangeOf(lo: number, hi: number) {
  const mid = Math.sqrt(lo * hi);
  const band = BANDS.find((b) => mid >= b.lo && mid < b.hi) ?? (mid < BANDS[0].lo ? BANDS[0] : BANDS[BANDS.length - 1]);
  return { name: band.name, color: RANGE_COLOR[band.name] };
}

/** The icon for a finding. Mud is measured as synths buried in the low mids, so it gets the mud icon. */
export function findingIcon(f: Finding): ReactNode {
  if (f.kind === "reference") return <ReferenceIcon />;
  const mud = f.kind === "masking" && f.masked === "other" && f.range === "low-mid";
  return KINDS.find((k) => k.kind === (mud ? "buildup" : f.kind))!.icon;
}

/** The mark: the icon in a round chip tinted with the range's color */
export function KindMark({ icon, color, size = 26, title }: { icon: ReactNode; color: string; size?: number; title?: string }) {
  return (
    <span className="ae-mark" title={title} style={{ width: size, height: size, color, ["--mark-icon" as string]: `${Math.round(size * 0.58)}px` }}>
      {icon}
    </span>
  );
}
