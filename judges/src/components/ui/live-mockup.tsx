// A drawing of Aria running in Live (Ian, Oct 31: "a mock up of a screenshot of the thing running in ableton"), for
// the page until the demo video exists. The DAW around it is drawn, so it says so under the picture. What's inside is
// real: the strip and the docked window are screenshots of Aria, the browser path is where install.sh puts it, the
// part markers are the ones Aria named on Ian's song, and EQ Eight shows the fix Muse Spark returned for its harsh spot.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const W = 1200, H = 760;           // drawn at this size, then scaled to fit
const BARS = 96;                   // bars 1 to 97 across the arrangement
const PLAYHEAD_BAR = 41;

// [name, color, clips as [first bar, last bar]]
const TRACKS: [string, string, [number, number][]][] = [
  ["Kick", "#ff8a5b", [[9, 20], [33, 80], [89, 96]]],
  ["Perc", "#f5c451", [[21, 32], [33, 80]]],
  ["Bass", "#a78bfa", [[33, 80], [89, 96]]],
  ["Chords", "#6ea8ff", [[1, 32], [81, 96]]],
  ["Lead", "#5eead4", [[33, 64], [65, 80]]],
  ["Vocal", "#f472b6", [[13, 32], [41, 72], [81, 96]]],
  ["Vox 2", "#f9a8d4", [[21, 32], [57, 80]]],
];
// The parts Aria found on Ian's song and added to Live as markers
const PARTS: [string, number][] = [["Intro", 1], ["Build", 21], ["Drop", 33], ["Break", 81]];

// A clip's waveform: a made-up shape, only there to read as audio
function wave(seed: number, w: number, h: number) {
  let d = "";
  const n = Math.max(8, Math.floor(w / 2));
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const a = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.9 + seed) * Math.cos(i * 0.23 + seed * 2));
    const y = (h / 2) * a * (i % 4 === 0 ? 1 : 0.6);
    d += `M${x.toFixed(1)} ${(h / 2 - y).toFixed(1)}V${(h / 2 + y).toFixed(1)}`;
  }
  return d;
}

const bx = (bar: number, width: number) => ((bar - 1) / BARS) * width;

function Light({ c }: { c: string }) {
  return <span className="size-[11px] rounded-full" style={{ background: c }} />;
}

function DeviceBox({ title, width, children, on = true }: { title: string; width: number; children: ReactNode; on?: boolean }) {
  return (
    <div className="flex h-full flex-none flex-col overflow-hidden rounded-[3px] border border-black/60 bg-[#363636]" style={{ width }}>
      <div className="flex h-[18px] items-center gap-1.5 bg-[#4a4a4a] px-1.5 text-[10px] text-white/85">
        <span className={cn("size-2 rounded-full", on ? "bg-[#f5c451]" : "bg-white/20")} />{title}
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

// EQ Eight's display with one bell: 3620 Hz, -3.5 dB, Q 6 (the fix in Muse Spark's note for the harsh spot)
function EqCurve({ w, h }: { w: number; h: number }) {
  const f0 = 3620, g = -3.5, q = 6;
  const x = (f: number) => (Math.log10(f / 20) / Math.log10(20000 / 20)) * w;
  const y = (db: number) => h / 2 - (db / 12) * (h / 2);
  let d = "";
  for (let i = 0; i <= 200; i++) {
    const f = 20 * Math.pow(1000, i / 200);
    const db = g / (1 + Math.pow(q * (f / f0 - f0 / f), 2));
    d += `${i ? "L" : "M"}${x(f).toFixed(1)} ${y(db).toFixed(1)}`;
  }
  return (
    <svg width={w} height={h} className="block">
      {[100, 1000, 10000].map((f) => <line key={f} x1={x(f)} x2={x(f)} y1={0} y2={h} stroke="rgba(255,255,255,0.08)" />)}
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,0.15)" />
      <path d={`${d}L${w} ${h / 2}L0 ${h / 2}Z`} fill="rgba(245,196,81,0.18)" />
      <path d={d} fill="none" stroke="#f5c451" strokeWidth={1.6} />
      <circle cx={x(f0)} cy={y(g)} r={4} fill="#f5c451" />
    </svg>
  );
}

function Mockup() {
  const ARR_W = 812, ROW = 40;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#1e1e1e] text-white" style={{ width: W, height: H }}>
      {/* title bar */}
      <div className="flex h-[28px] flex-none items-center gap-2 bg-[#2a2a2a] px-3">
        <Light c="#ff5f57" /><Light c="#febc2e" /><Light c="#28c840" />
        <span className="flex-1 text-center text-[11.5px] text-white/55">My Song</span>
      </div>
      {/* transport */}
      <div className="flex h-[38px] flex-none items-center gap-3 border-b border-black/50 bg-[#333] px-3 font-mono text-[12px]">
        <span className="rounded-[3px] bg-[#222] px-2 py-1 text-[#f5c451]">165.00</span>
        <span className="text-white/60">4 / 4</span>
        <div className="mx-auto flex items-center gap-2">
          <span className="rounded-[3px] bg-[#222] px-2 py-1 text-white/85">33 . 1 . 1</span>
          <span className="grid size-[24px] place-items-center rounded-[3px] bg-[#4ade80] text-[10px] text-black">▶</span>
          <span className="grid size-[24px] place-items-center rounded-[3px] bg-[#222] text-[10px] text-white/70">■</span>
          <span className="grid size-[24px] place-items-center rounded-[3px] bg-[#222] text-[11px] text-[#ff5f57]">●</span>
        </div>
        <span className="text-white/40">CPU 14%</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* browser: where install.sh puts Aria */}
        <div className="w-[196px] flex-none border-r border-black/50 bg-[#2a2a2a] p-2.5 text-[11.5px] text-white/60">
          <div className="mb-2 rounded-[3px] bg-[#1e1e1e] px-2 py-1 text-white/30">Search</div>
          {["Sounds", "Drums", "Instruments", "Audio Effects", "Max for Live", "Plug-ins"].map((s) => <div key={s} className="py-[3px]">{s}</div>)}
          <div className="mt-3 text-[10px] uppercase tracking-wider text-white/30">Places</div>
          <div className="py-[3px] text-white/80">User Library</div>
          <div className="pl-2.5">
            <div className="py-[3px]">Presets</div>
            <div className="pl-2.5">
              <div className="py-[3px]">Audio Effects</div>
              <div className="pl-2.5">
                <div className="py-[3px]">Max Audio Effect</div>
                <div className="pl-2.5">
                  <div className="py-[3px] text-white/80">Aria</div>
                  <div className="ml-2 flex items-center gap-1.5 rounded-[3px] bg-[#f5c451] px-1.5 py-[3px] text-black"><span className="mark size-3" />Aria</div>
                  <div className="ml-2 flex items-center gap-1.5 px-1.5 py-[3px]"><span className="mark size-3" />Aria Ear</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* arrangement */}
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#262626]">
          {/* bar ruler and Aria's part markers */}
          <div className="relative h-[40px] flex-none border-b border-black/50 bg-[#2e2e2e]" style={{ width: ARR_W }}>
            {Array.from({ length: 13 }, (_, i) => 1 + i * 8).map((b) => (
              <span key={b} className="absolute top-[3px] font-mono text-[10px] text-white/40" style={{ left: bx(b, ARR_W) + 3 }}>{b}</span>
            ))}
            {PARTS.map(([name, bar]) => (
              <span key={name} className="absolute bottom-[3px] flex items-center gap-1 text-[10.5px] text-white/85" style={{ left: bx(bar, ARR_W) }}>
                <span className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-white/80" />{name}
              </span>
            ))}
          </div>
          {TRACKS.map(([name, color, clips], t) => (
            <div key={name} className="flex border-b border-black/40" style={{ height: ROW }}>
              <div className="relative flex-none" style={{ width: ARR_W }}>
                {clips.map(([a, b], i) => {
                  const left = bx(a, ARR_W), w = bx(b + 1, ARR_W) - left - 1;
                  return (
                    <div key={i} className="absolute top-[3px] overflow-hidden rounded-[2px]" style={{ left, width: w, height: ROW - 6, background: `${color}33`, borderTop: `9px solid ${color}` }}>
                      <svg width={w} height={ROW - 15} className="block"><path d={wave(t * 7 + i, w, ROW - 15)} stroke={color} strokeWidth={1} opacity={0.75} /></svg>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-1 items-center gap-1.5 border-l border-black/50 px-2 text-[11px]" style={{ background: `${color}22` }}>
                <span className="h-full w-[3px] flex-none" style={{ background: color }} />
                <span className="truncate text-white/85">{name}</span>
              </div>
            </div>
          ))}
          <div className="flex border-b border-black/40" style={{ height: ROW }}>
            <div className="flex-none" style={{ width: ARR_W }} />
            <div className="flex flex-1 items-center gap-1.5 border-l border-black/50 bg-[#3a3a3a] px-2 text-[11px] text-white">Main</div>
          </div>
          {/* playhead */}
          <span className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: bx(PLAYHEAD_BAR, ARR_W) }} />

          {/* Aria's window, docked over Live (a real screenshot, the top of it) */}
          <div className="absolute right-[18px] top-[14px] h-[396px] w-[262px] overflow-hidden rounded-[14px] border border-white/15 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)]">
            <img src="/img/ask.png" alt="" className="block w-full" />
          </div>
        </div>
      </div>

      {/* device view: the Main track's chain, Aria last */}
      <div className="flex h-[200px] flex-none gap-1.5 border-t border-black/60 bg-[#2a2a2a] p-2">
        <div className="flex w-[90px] flex-none flex-col justify-between rounded-[3px] bg-[#3a3a3a] p-2 text-[11px]">
          <span className="text-white">Main</span>
          <span className="text-[10px] text-white/40">Track</span>
        </div>
        <DeviceBox title="EQ Eight" width={300}>
          <div className="p-2">
            <div className="overflow-hidden rounded-[2px] bg-[#1c1c1c]"><EqCurve w={282} h={112} /></div>
            <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-white/70"><span>3620 Hz</span><span>-3.5 dB</span><span>Q 6.0</span></div>
          </div>
        </DeviceBox>
        <DeviceBox title="Aria" width={164}>
          <img src="/img/strip.png" alt="" className="absolute left-[6px] top-[3px] w-[150px]" />
        </DeviceBox>
        <div className="flex-1 rounded-[3px] border border-dashed border-white/10" />
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
