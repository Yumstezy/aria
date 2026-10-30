// The design's own icons (design/screens/11 and 12), so the rail and the pop-up match the screenshots.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const HomeIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></svg>;
export const MixIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M3 15c3 0 3-7 6-7s3 9 6 9 3-6 6-6" /></svg>;
export const AnalyzerIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M4 20V11M9 20V5M14 20v-8M19 20V8" /></svg>;
export const GrooveIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    {[5, 10, 15, 20].map((x) => <circle key={x} cx={x} cy="8" r="1.8" />)}
    {[6.5, 11.5, 16.5].map((x) => <circle key={x} cx={x} cy="16" r="1.8" />)}
  </svg>
);
export const ReferenceIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><rect x="3" y="6" width="5" height="12" rx="1.5" /><rect x="10" y="6" width="11" height="12" rx="1.5" /></svg>;
export const MicIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2} {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const CloseIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2.2} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const SendIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2.25} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const CheckIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2.4} {...p}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
export const UndoIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2} {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>;
export const PopOutIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;

export const ArrangementIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><rect x="3" y="8" width="5" height="8" rx="1.5" /><rect x="9.5" y="8" width="7" height="8" rx="1.5" /><rect x="18" y="8" width="3" height="8" rx="1.2" /></svg>;
export const GoodMixIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M4 16c3-6 5-8 8-8s5 2 8 8" /><path d="M8 20h8" /><circle cx="12" cy="8" r="1.5" /></svg>;
export const EarIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M7 9.5a5 5 0 0 1 10 0c0 3-2.4 4-3.3 5.8-.7 1.5-1 3.7-3.4 3.7A2.8 2.8 0 0 1 7.5 16" /><path d="M10 9.5a2 2 0 0 1 4 0" /></svg>;

// Mix check's kinds of problem, for the tiles
export const BuriedIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={1.9} {...p}><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 10l4 4M21 10l-4 4" /></svg>;
export const MudIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={1.9} {...p}><path d="M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 10c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" /></svg>;
export const ClashIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></svg>;
export const HarshIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={1.9} {...p}><path d="M3 12h3l2-5 3 10 3-8 2 3h5" /></svg>;
export const RingIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={1.9} {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
export const ClickIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={1.9} {...p}><path d="M3 17h4l2-10 2 10h10" /></svg>;
export const DockLeftIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>;
export const DockRightIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></svg>;
export const BackIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2.2} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const MinimizeIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2.2} {...p}><path d="M6 12h12" /></svg>;
export const LayoutIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M14 4v16M14 12h7" /></svg>;
export const SunIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>;
export const MoonIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
export const ExpandIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2} {...p}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>;
export const SwapIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2} {...p}><path d="M7 7h13l-4-4M17 17H4l4 4" /></svg>;
export const ChatIcon = (p: P) => <svg viewBox="0 0 24 24" {...line} strokeWidth={2} {...p}><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>;
