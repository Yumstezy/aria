// A drawing of Aria running in Live, for the page until the demo video exists. Redrawn Oct 31 to look like Live 12
// itself (Ian sent a screenshot of his Live: "this is something I was rather looking for"). The window around Aria is
// drawn, so the caption says so. What's in it is real:
//   - the clips are Ian's song BELIEVE IT, one track per stem, their waveforms from the stems' own peaks
//     (live-arrangement.json, bars 25 to 56)
//   - the locators are the parts Aria found on those stems and Muse Spark named (Build 29, Drop 45)
//   - the browser shows Aria where install.sh puts it
//   - the docked window and the device are screenshots of Aria; EQ Eight shows the fix Muse Spark returned
//     for the harsh spot (3620 Hz, -3.5 dB, Q 6)
// Mixer values are Live's defaults (0 dB, C), not made-up levels.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import song from "@/live-arrangement.json";

const W = 1200, H = 760;                       // drawn at this size, then scaled to fit
const SIDE = 118, LIST = 192;                  // browser: sidebar and file list
const HEAD = 236;                              // track headers on the right
const LANES = W - SIDE - LIST - HEAD;          // 654 px of arrangement
const BARS = song.to_bar - song.from_bar;      // 32 bars in view
const PX = LANES / BARS;                       // px per bar
const ROW = 44, RULER = 36, MAIN_ROW = 30;
const PLAYHEAD_BAR = 47;

// Live's clip colors, one per track
const COLORS = ["#ff3636", "#f66c03", "#ffa529", "#fff034", "#87ff67", "#5cffe8", "#10a4ee", "#886ce4", "#ff94a6"];
const MAIN_COLOR = "#e8c547";

const bx = (bar: number) => (bar - song.from_bar) * PX;

/* ---------- control bar ---------- */
function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("rounded-[2px] bg-[#1b1b1b] px-1.5 py-[2px] text-[#d8d8d8]", className)}>{children}</span>;
}

function ControlBar() {
  return (
    <div className="flex h-[32px] flex-none items-center gap-2 border-b border-black/70 bg-[#2f2f2f] px-2 font-mono text-[11px] text-[#bdbdbd]">
      <Field>Link</Field><Field>Tap</Field>
      <Field className="text-[#f2f2f2]">{song.tempo.toFixed(2)}</Field>
      <span className="tracking-[-1px] text-[#8a8a8a]">||||</span>
      <Field>4 / 4</Field>
      <span className="text-[#8a8a8a]">● ○</span>
      <Field>1 Bar ▾</Field>
      <div className="mx-auto flex items-center gap-1.5">
        <Field className="whitespace-nowrap px-2 text-center">{PLAYHEAD_BAR} . 1 . 1</Field>
        <span className="grid h-[20px] w-[24px] place-items-center rounded-[2px] bg-[#7cd38a] text-[9px] text-black">▶</span>
        <span className="grid h-[20px] w-[24px] place-items-center rounded-[2px] bg-[#1b1b1b] text-[9px]">■</span>
        <span className="grid h-[20px] w-[24px] place-items-center rounded-[2px] bg-[#1b1b1b] text-[10px] text-[#ff5a52]">●</span>
        <Field className="ml-2">{song.from_bar} . 1 . 1</Field>
        <Field>{BARS} . 0 . 0</Field>
      </div>
      <Field>Key</Field><Field>MIDI</Field>
      <span className="text-[#8a8a8a]">48 kHz</span>
    </div>
  );
}

/* ---------- browser ---------- */
function Glyph({ c = "#8a8a8a", round }: { c?: string; round?: boolean }) {
  return <span className={cn("size-[8px] flex-none", round ? "rounded-full" : "rounded-[2px]")} style={{ background: c }} />;
}

function Sidebar() {
  const lib = ["All", "Sounds", "Drums", "Instruments", "Audio Effects", "MIDI Effects", "Modulators", "Max for Live", "Plug-ins", "Clips", "Samples", "Grooves", "Tunings", "Templates"];
  const Head = ({ t }: { t: string }) => <div className="mb-1 mt-2.5 text-[9.5px] text-[#7a7a7a]">{t}</div>;
  const Row = ({ t, on, c, round }: { t: string; on?: boolean; c?: string; round?: boolean }) => (
    <div className={cn("flex items-center gap-1.5 rounded-[2px] px-1 py-[2.5px]", on ? "bg-[#4b4b4b] text-white" : "text-[#b4b4b4]")}><Glyph c={c} round={round} />{t}</div>
  );
  return (
    <div className="flex-none overflow-hidden border-r border-black/60 bg-[#232323] px-1.5 text-[10.5px]" style={{ width: SIDE }}>
      <Head t="Collections" />
      <Row t="Favorites" c="#ff4d4d" round />
      <Head t="Library" />
      {lib.map((t) => <Row key={t} t={t} />)}
      <Head t="Places" />
      <Row t="Packs" />
      <Row t="User Library" on c="#cfcfcf" />
      <Row t="Current Project" />
      <Row t="Add Folder…" />
    </div>
  );
}

function FileList() {
  const path = ["User Library", "Presets", "Audio Effects", "Max Audio Effect", "Aria"];
  const Item = ({ name, on }: { name: string; on?: boolean }) => (
    <div className={cn("flex items-center gap-2 border-b border-black/30 px-2 py-[7px]", on && "bg-[#d9d9d9] text-black")}>
      <span className={cn("grid size-[26px] flex-none place-items-center rounded-[3px]", on ? "bg-black text-white" : "bg-[#3a3a3a] text-white")}><span className="mark size-[15px]" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[11px]">{name}</span>
        <span className={cn("block text-[9.5px]", on ? "text-black/60" : "text-[#8a8a8a]")}>Max Audio Effect</span>
      </span>
    </div>
  );
  return (
    <div className="flex flex-none flex-col border-r border-black/60 bg-[#2a2a2a] text-[#d0d0d0]" style={{ width: LIST }}>
      <div className="flex items-center gap-3 px-2 pb-1.5 pt-2 text-[#8a8a8a]"><span>‹</span><span>›</span></div>
      <div className="mx-2 mb-2 rounded-[10px] bg-[#1b1b1b] px-2.5 py-[3px] text-[10.5px] text-[#7a7a7a]">Search</div>
      <div className="px-2 pb-1.5 text-[9.5px] leading-[1.5] text-[#8a8a8a]">{path.join("  ›  ")}</div>
      <Item name="Aria" on />
      <Item name="Aria Ear" />
    </div>
  );
}

/* ---------- arrangement ---------- */
// A clip per part of the song a stem plays in, cut where Aria's parts change, trimmed to whole bars
function clips(peaks: number[]) {
  const per = song.per_bar, cuts = [song.from_bar, ...song.parts.map((p) => p.bar).filter((b) => b > song.from_bar && b < song.to_bar), song.to_bar];
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const live: number[] = [];
    for (let b = cuts[k]; b < cuts[k + 1]; b++) {
      const i = (b - song.from_bar) * per;
      if (peaks.slice(i, i + per).some((v) => v > 0)) live.push(b);
    }
    if (live.length) out.push([live[0], live[live.length - 1] + 1]);
  }
  return out;
}

function Wave({ peaks, a, b, w, h }: { peaks: number[]; a: number; b: number; w: number; h: number }) {
  const per = song.per_bar, i0 = (a - song.from_bar) * per, i1 = (b - song.from_bar) * per, n = i1 - i0;
  const mid = h / 2, top: string[] = [], bot: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * w, amp = (peaks[i0 + i] / 99) * (mid - 1);
    top.push(`${x.toFixed(1)} ${(mid - amp).toFixed(1)}`);
    bot.unshift(`${x.toFixed(1)} ${(mid + amp).toFixed(1)}`);
  }
  return <svg width={w} height={h} className="block"><path d={`M0 ${mid}L${top.join("L")}L${w} ${mid}L${bot.join("L")}Z`} fill="rgba(0,0,0,0.78)" /></svg>;
}

function Header({ name, color, n, main }: { name: string; color: string; n?: number; main?: boolean }) {
  return (
    <div className="flex h-full border-l border-black/70 text-[10px]" style={{ width: HEAD }}>
      <div className="flex w-[118px] flex-none items-start gap-1 px-1.5 pt-[3px] font-medium text-black" style={{ background: color }}>
        <span className="text-[8px] leading-[14px]">{main ? "" : "▸"}</span><span className="truncate leading-[14px]">{name}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-[3px] whitespace-nowrap bg-[#2c2c2c] px-1 pt-[3px] font-mono text-[9px] text-[#bdbdbd]">
        {!main && <span className="rounded-[2px] bg-[#1b1b1b] px-1 leading-[14px]">Main</span>}
        {!main && <span className="ml-auto grid h-[14px] min-w-[15px] place-items-center rounded-[2px] px-0.5 text-black" style={{ background: color }}>{n}</span>}
        {!main && <span className="grid h-[14px] w-[13px] place-items-center rounded-[2px] bg-[#454545]">S</span>}
        <span className={cn("grid h-[14px] w-[20px] place-items-center rounded-[2px] bg-[#1b1b1b] text-[#8fc8ff]", main && "ml-auto")}>0</span>
        <span className="grid h-[14px] w-[13px] place-items-center rounded-[2px] bg-[#454545]">C</span>
      </div>
    </div>
  );
}

function Grid({ h }: { h: number }) {
  return (
    <svg width={LANES} height={h} className="absolute left-0 top-0">
      {Array.from({ length: BARS + 1 }, (_, i) => (
        <line key={i} x1={i * PX} x2={i * PX} y1={0} y2={h} stroke={(song.from_bar + i - 1) % 4 === 0 ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.2)"} />
      ))}
    </svg>
  );
}

function Arrangement() {
  const lanesH = song.tracks.length * ROW + MAIN_ROW;
  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#3a3a3a]">
      {/* locators (the parts Muse Spark named) and the bar ruler */}
      <div className="flex flex-none border-b border-black/70" style={{ height: RULER }}>
        <div className="relative flex-none bg-[#2f2f2f]" style={{ width: LANES }}>
          {song.parts.filter((p) => p.bar >= song.from_bar && p.bar < song.to_bar).map((p) => (
            <span key={p.bar} className="absolute top-[2px] flex items-center gap-[3px] text-[10px] text-[#e6e6e6]" style={{ left: bx(p.bar) - 4 }}>
              <span className="h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-[#e6e6e6]" />{p.name}
            </span>
          ))}
          {Array.from({ length: BARS / 2 }, (_, i) => song.from_bar + 1 + i * 2).map((b) => (
            <span key={b} className="absolute bottom-[3px] font-mono text-[9.5px] text-[#9a9a9a]" style={{ left: bx(b) + 2 }}>{b}</span>
          ))}
        </div>
        <div className="flex-1 border-l border-black/70 bg-[#2c2c2c]" />
      </div>

      <div className="relative flex-none" style={{ height: lanesH }}>
        <Grid h={lanesH} />
        {song.tracks.map((t, r) => {
          const color = COLORS[r % COLORS.length];
          return (
            <div key={t.name} className="relative flex border-b border-black/50" style={{ height: ROW }}>
              <div className="relative flex-none" style={{ width: LANES }}>
                {clips(t.peaks).map(([a, b]) => {
                  const left = bx(a), w = bx(b) - left - 1;
                  return (
                    <div key={a} className="absolute top-[1px] overflow-hidden rounded-[2px] border border-black/50" style={{ left, width: w, height: ROW - 3, background: color }}>
                      <div className="h-[11px] truncate bg-black/15 px-1 text-[8.5px] leading-[11px] text-black/85">{t.clip}</div>
                      <Wave peaks={t.peaks} a={a} b={b} w={w - 2} h={ROW - 16} />
                    </div>
                  );
                })}
              </div>
              <Header name={t.name} color={color} n={r + 1} />
            </div>
          );
        })}
        <div className="flex" style={{ height: MAIN_ROW }}>
          <div className="flex-none" style={{ width: LANES }} />
          <Header name="Main" color={MAIN_COLOR} main />
        </div>
        {/* playhead */}
        <span className="absolute top-0 w-px bg-white/90" style={{ left: bx(PLAYHEAD_BAR), height: lanesH - MAIN_ROW }} />
      </div>
      <div className="grid flex-1 place-items-center text-[10.5px] text-[#8a8a8a]" style={{ width: LANES }}>Drop Files and Devices Here</div>

      {/* Aria's window, docked over the arrangement (a real screenshot, the top of it) */}
      <div className="absolute left-[12px] top-[44px] h-[392px] w-[236px] overflow-hidden rounded-[14px] border border-white/15 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)]">
        <img src="/img/ask.png" alt="" className="block w-full" />
      </div>
    </div>
  );
}

/* ---------- device view: the Main track's chain ---------- */
function Device({ title, width, children }: { title: string; width: number; children: ReactNode }) {
  return (
    <div className="flex h-full flex-none flex-col overflow-hidden rounded-[3px] border border-black/70 bg-[#323232]" style={{ width }}>
      <div className="flex h-[18px] flex-none items-center gap-1.5 bg-[#464646] px-1.5 text-[10px] text-[#e6e6e6]">
        <span className="size-[9px] rounded-full bg-[#ffb532]" />{title}
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

// EQ Eight with one bell on: 3620 Hz, -3.5 dB, Q 6 (the fix in Muse Spark's note for the harsh spot)
function EqEight() {
  const f0 = 3620, g = -3.5, q = 6, w = 300, h = 104;
  const x = (f: number) => (Math.log10(f / 20) / Math.log10(20000 / 20)) * w;
  const y = (db: number) => h / 2 - (db / 15) * (h / 2);
  let d = "";
  for (let i = 0; i <= 200; i++) {
    const f = 20 * Math.pow(1000, i / 200);
    d += `${i ? "L" : "M"}${x(f).toFixed(1)} ${y(g / (1 + Math.pow(q * (f / f0 - f0 / f), 2))).toFixed(1)}`;
  }
  return (
    <div className="p-2">
      <div className="overflow-hidden rounded-[2px] bg-[#1b1b1b]">
        <svg width={w} height={h} className="block">
          {[100, 1000, 10000].map((f) => <line key={f} x1={x(f)} x2={x(f)} y1={0} y2={h} stroke="rgba(255,255,255,0.08)" />)}
          <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,0.14)" />
          <path d={d} fill="none" stroke="#ffb532" strokeWidth={1.5} />
          <circle cx={x(f0)} cy={y(g)} r={6} fill="none" stroke="#ffb532" strokeWidth={1.2} />
          <text x={x(f0)} y={y(g) + 3} textAnchor="middle" fontSize="8" fill="#ffb532">4</text>
        </svg>
      </div>
      <div className="mt-1.5 flex items-center gap-1 font-mono text-[9.5px] text-[#bdbdbd]">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <span key={n} className={cn("grid h-[14px] w-[14px] place-items-center rounded-[2px]", n === 4 ? "bg-[#ffb532] text-black" : "bg-[#1b1b1b] text-[#6a6a6a]")}>{n}</span>
        ))}
        <span className="ml-auto">3.62 kHz</span><span>-3.50 dB</span><span>6.00</span>
      </div>
    </div>
  );
}

function DeviceView() {
  return (
    <div className="flex h-[196px] flex-none gap-1 border-t border-black/80 bg-[#262626] p-1.5">
      <Device title="EQ Eight" width={318}><EqEight /></Device>
      <Device title="Aria" width={164}>
        <img src="/img/strip.png" alt="" className="absolute left-[6px] top-[2px] w-[150px]" />
      </Device>
      <div className="grid flex-1 place-items-center rounded-[3px] text-[10.5px] text-[#7a7a7a]">Drop Audio Effects Here</div>
    </div>
  );
}

function Mockup() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#1e1e1e] text-white" style={{ width: W, height: H }}>
      {/* the Mac window's title bar */}
      <div className="flex h-[24px] flex-none items-center gap-[7px] bg-[#1c1c1c] px-2.5">
        <span className="size-[11px] rounded-full bg-[#ff5f57]" /><span className="size-[11px] rounded-full bg-[#febc2e]" /><span className="size-[11px] rounded-full bg-[#28c840]" />
        <span className="flex-1 pr-12 text-center text-[11px] text-[#9a9a9a]">BELIEVE IT</span>
      </div>
      <ControlBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <FileList />
        <Arrangement />
      </div>
      <DeviceView />
      <div className="flex h-[16px] flex-none items-center justify-end gap-3 border-t border-black/80 bg-[#2f2f2f] px-2 font-mono text-[9px] text-[#8a8a8a]">
        <span>Main</span>
      </div>
    </div>
  );
}

// Scales the drawing to the width it's given
export function LiveMockup({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={cn("relative w-full", className)} style={{ height: H * scale }}>
      <div className="absolute left-0 top-0 origin-top-left shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]" style={{ transform: `scale(${scale})` }} role="img"
           aria-label="A drawing of Ableton Live with Aria on the Main track: Aria in the browser, its window docked over the arrangement, and its device after EQ Eight">
        <Mockup />
      </div>
    </div>
  );
}
