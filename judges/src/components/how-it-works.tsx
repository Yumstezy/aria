// "How it works" (Oct 31): replaces the Proof list, which Ian said "doesn't really show what we do". One real problem
// followed through Aria's loop: it hears it, Muse Spark says it, the fix happens in Live, Aria measures again.
// Every line and number comes from real.json: Mix check on Ian's drop against a reference track (steps 1 to 3; Ian, Oct 31: call it what it is, not the song's
// name, so Muse's summary shows [the reference track] where it named the file), and Before
// and after on our test mix with a planted harsh boost (step 4), as the step says.
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import real from "@/real.json";

const CW = 640, CH = 300, PAD = { l: 38, r: 12, t: 16, b: 26 };
const F_LO = 30, F_HI = 16000;
const fx = (f: number) => PAD.l + (Math.log10(f / F_LO) / Math.log10(F_HI / F_LO)) * (CW - PAD.l - PAD.r);

function scaleY(series: number[][]) {
  const all = series.flat();
  const lo = Math.floor(Math.min(...all) / 6) * 6, hi = Math.ceil(Math.max(...all) / 6) * 6;
  return { lo, hi, y: (db: number) => PAD.t + ((hi - db) / (hi - lo)) * (CH - PAD.t - PAD.b) };
}
const path = (hz: number[], db: number[], y: (v: number) => number) =>
  hz.map((f, i) => `${i ? "L" : "M"}${fx(f).toFixed(1)} ${y(db[i]).toFixed(1)}`).join("");

const kHz = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(1)}k` : `${f}`);

function Axes({ lo, hi, y }: { lo: number; hi: number; y: (v: number) => number }) {
  const ticks = [];
  for (let d = lo; d <= hi; d += 12) ticks.push(d);
  return (
    <g fontSize="10.5" fill="rgba(255,255,255,0.35)" fontFamily="ui-monospace, Menlo, monospace">
      {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
        <g key={f}><line x1={fx(f)} x2={fx(f)} y1={PAD.t} y2={CH - PAD.b} stroke="rgba(255,255,255,0.06)" /><text x={fx(f)} y={CH - 8} textAnchor="middle">{kHz(f)}</text></g>
      ))}
      {ticks.map((d) => <text key={d} x={PAD.l - 6} y={y(d) + 3.5} textAnchor="end">{d}</text>)}
    </g>
  );
}

function Band({ range, y0, y1, color, label }: { range: number[]; y0: number; y1: number; color: string; label?: string }) {
  const a = fx(range[0]), b = fx(range[1]);
  return (
    <g>
      <rect x={a - 3} y={y0} width={b - a + 6} height={y1 - y0} fill={color} opacity={0.16} rx={3} />
      {label && <text x={(a + b) / 2} y={y0 - 5} textAnchor="middle" fontSize="11.5" fill={color} fontWeight={500}>{label}</text>}
    </g>
  );
}

function Legend({ items }: { items: [string, string, boolean?][] }) {
  return (
    <div className="flex flex-wrap gap-4 text-[12.5px] text-muted">
      {items.map(([t, c, dashed]) => (
        <span key={t} className="flex items-center gap-2"><span className="h-0 w-5" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${c}` }} />{t}</span>
      ))}
    </div>
  );
}

/* step 1: the spectrum of Ian's drop against the reference, the harsh spot marked */
function Hear() {
  const h = real.hear, s = scaleY([h.mine, h.ref]);
  return (
    <>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="block w-full">
        <Axes {...s} />
        <Band range={h.harsh.hz_range} y0={PAD.t + 14} y1={CH - PAD.b} color="#ff8a5b" label="Harsh bursts" />
        <path d={path(h.hz, h.ref, s.y)} fill="none" stroke="#6ea8ff" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85} />
        <path d={path(h.hz, h.mine, s.y)} fill="none" stroke="#f5c451" strokeWidth={2} />
      </svg>
      <Legend items={[["Your drop", "#f5c451"], ["Reference track", "#6ea8ff", true]]} />
    </>
  );
}

/* step 2: Muse Spark's own words for it, and the action it returned */
function Explain() {
  const n = real.note;
  return (
    <div className="grid gap-4">
      <div className="flex items-baseline gap-2 text-[14px]"><b className="font-semibold">Muse Spark</b><span className="font-mono text-[12px] text-faint">advice on the harsh spot</span></div>
      <div className="rounded-[16px] bg-white px-5 py-4 text-[16px] leading-relaxed text-black">
        <b className="font-semibold">{n.short}.</b> {n.text}
      </div>
      <div className="rounded-[14px] border border-edge bg-card-2 px-4 py-3 font-mono text-[13px] leading-relaxed text-muted">
        <span className="text-faint">// the action it returned, from a fixed menu</span><br />
        {"{ "}<span className="text-ink">"type"</span>: <span className="text-gold">"{n.fix.type}"</span>, <span className="text-ink">"freq_hz"</span>: <span className="text-gold">{n.fix.freq_hz}</span>, <span className="text-ink">"gain_db"</span>: <span className="text-gold">{n.fix.gain_db}</span>, <span className="text-ink">"q"</span>: <span className="text-gold">{n.fix.q}</span>{" }"}
      </div>
      <p className="m-0 mt-2 text-[14px] leading-relaxed text-faint">Its summary of the whole check: <span className="text-muted">"{real.summary}"</span></p>
    </div>
  );
}

/* step 3: that action, set on EQ Eight in Live */
function Fix() {
  const { freq_hz: f0, gain_db: g, q } = real.note.fix;
  const lo = -12, hi = 6, y = (db: number) => PAD.t + ((hi - db) / (hi - lo)) * (CH - PAD.t - PAD.b);
  let d = "";
  for (let i = 0; i <= 240; i++) {
    const f = F_LO * Math.pow(F_HI / F_LO, i / 240);
    d += `${i ? "L" : "M"}${fx(f).toFixed(1)} ${y(g / (1 + Math.pow(q * (f / f0 - f0 / f), 2))).toFixed(1)}`;
  }
  return (
    <>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="block w-full">
        <Axes lo={lo} hi={hi} y={y} />
        <line x1={PAD.l} x2={CW - PAD.r} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.2)" />
        <path d={`${d}L${fx(F_HI)} ${y(0)}L${fx(F_LO)} ${y(0)}Z`} fill="rgba(245,196,81,0.16)" />
        <path d={d} fill="none" stroke="#f5c451" strokeWidth={2} />
        <circle cx={fx(f0)} cy={y(g)} r={6} fill="#f5c451" />
        <text x={fx(f0)} y={y(g) + 22} textAnchor="middle" fontSize="12" fill="#f5c451">{f0} Hz, {g} dB</text>
      </svg>
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
        <span className="rounded-[8px] border border-edge bg-card-2 px-2.5 py-1 text-ink">EQ Eight on Main</span>
        <span>Bell · Q {q}</span>
        <span className="ml-auto rounded-[8px] border border-edge px-2.5 py-1">Undo</span>
      </div>
    </>
  );
}

/* step 4: Before and after, same bars, same loudness */
function Prove() {
  const p = real.prove, s = scaleY([p.before, p.after]);
  return (
    <>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="block w-full">
        <Axes {...s} />
        <Band range={p.hz_range} y0={PAD.t + 14} y1={CH - PAD.b} color="#4ade80" label={`${p.change_db} dB · Fixed`} />
        <path d={path(p.hz, p.before, s.y)} fill="none" stroke="#6ea8ff" strokeWidth={1.6} opacity={0.85} />
        <path d={path(p.hz, p.after, s.y)} fill="none" stroke="#f5c451" strokeWidth={2} />
      </svg>
      <Legend items={[["Before", "#6ea8ff"], ["After, at the same loudness", "#f5c451"]]} />
    </>
  );
}

const STEPS: { key: string; title: string; text: ReactNode; view: () => ReactNode }[] = [
  { key: "Hear", title: "Aria hears it.", view: Hear,
    text: <>Mix check records bars of your Main track and finds the sounds that clash or stick out, and exactly where. In Ian's drop: sharp bursts around {real.hear.harsh.hz} Hz, {real.hear.harsh.bursts_per_bar} times a bar, bars {real.hear.harsh.bars[0]} to {real.hear.harsh.bars[1]}.</> },
  { key: "Explain", title: "Muse Spark says it plainly.", view: Explain,
    text: <>Muse Spark gets only the measured numbers and writes what's wrong the way a producer would say it. Then it picks the fix, as an action from a fixed menu.</> },
  { key: "Fix", title: "The fix happens in Live.", view: Fix,
    text: <>Aria checks the action against its limits, sets Live's own EQ Eight on your Main track, and keeps an Undo. Ask for a change and it happens right away; a suggestion waits for your yes.</> },
  { key: "Prove", title: "Then Aria proves it worked.", view: Prove,
    text: <>Check again plays the same bars and compares them at the same loudness. 3 dB or more lower is Fixed. On our test mix with a planted harsh boost, that range came back {Math.abs(real.prove.change_db)} dB lower.</> },
];

const STEP_MS = 7000;

export function HowItWorks() {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);   // steps move on by themselves until someone picks one
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setAt((at + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [at, auto]);
  const View = STEPS[at].view;

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="grid content-start gap-2">
        {STEPS.map((s, i) => (
          <button key={s.key} type="button" onClick={() => { setAt(i); setAuto(false); }}
                  className={cn("relative overflow-hidden rounded-[16px] border p-5 text-left transition-colors",
                    i === at ? "border-white/20 bg-card-2" : "border-transparent hover:bg-card")}>
            <span className="font-mono text-[12px] text-faint">{i + 1} · {s.key}</span>
            <b className={cn("mt-1 block text-[19px] font-medium tracking-[-0.02em]", i !== at && "text-muted")}>{s.title}</b>
            {i === at && <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-muted">{s.text}</p>}
            {i === at && auto && (
              <motion.span key={`bar${at}`} className="absolute bottom-0 left-0 h-[2px] bg-white/50" initial={{ width: "0%" }} animate={{ width: "100%" }}
                           transition={{ duration: STEP_MS / 1000, ease: "linear" }} />
            )}
          </button>
        ))}
      </div>
      <div className="relative grid min-h-[440px] items-center overflow-hidden rounded-[22px] border border-edge bg-card p-5 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div key={at} className="grid gap-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
            <View />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
