// "Where does your mix land?" (Nov 3, Ian: new ideas on the demo page so judges get a feel for the product). Switch
// between the sample song's rough mix and finished mix and see where Aria's mix model puts each one, with Muse
// Spark's words about it. Nothing is simulated: demo-lean.json is a real Mix check of both files through the engine
// (judges/scripts/make_lean_data.py), and the rows are drawn the way the app's "Compared with good mixes" card is.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import lean from "@/demo-lean.json";

type Feature = { name: string; value: number; good_median: number; good_range: number[]; toward: number; off: boolean; diff: number; strength: number };
type Mix = { key: string; name: string; file: string; lean: number; lean_word: string; features: Feature[]; muse_summary: string | null; muse_notes: { short: string; text: string }[] };
const MIXES = lean.mixes as Mix[];

// The app's names for the model's directions (ui/src/screens/window/Window.tsx GOOD_FEATURES)
const NAMES: Record<string, { label: string; more: string; less: string }> = {
  band_sub_db: { label: "Sub", more: "More sub", less: "Less sub" },
  band_mid_db: { label: "Mids", more: "More mids", less: "Less mids" },
  band_himid_db: { label: "Upper mids", more: "More upper mids", less: "Less upper mids" },
  band_presence_db: { label: "Presence", more: "More presence", less: "Less presence" },
  band_brilliance_db: { label: "Highs", more: "More highs", less: "Less highs" },
  band_air_db: { label: "Air", more: "More air", less: "Less air" },
  low_power_db: { label: "Low end", more: "Stronger low end", less: "Lighter low end" },
  mid_bumpiness_db: { label: "Mid bumps", more: "Bumpier mids", less: "Smoother mids" },
  lowmid_buildup_db: { label: "Low mids", more: "Boxier low mids", less: "Cleaner low mids" },
  tilt_db_per_oct: { label: "Lows to highs", more: "Brighter overall", less: "Darker overall" },
  top_spread_db: { label: "Top-end bumps", more: "Bumpier top end", less: "Smoother top end" },
};
const WORDS: Record<string, string> = { closer: "Close to good mixes", between: "Partway to good mixes", further: "Far from good mixes" };

// The four directions the model pulls on hardest in the rough mix, the same rows for both mixes so they can move
const ROWS = [...MIXES[0].features].filter((f) => f.off).sort((a, b) => b.strength - a.strength).slice(0, 4).map((f) => f.name);

function Row({ name, mix }: { name: string; mix: Mix }) {
  const f = mix.features.find((x) => x.name === name)!;
  const w = NAMES[name] ?? { label: name, more: "More", less: "Less" };
  const [lo, hi] = f.good_range;
  // one scale for both mixes, wide enough for either dot
  const span = Math.max(...MIXES.map((m) => Math.abs(m.features.find((x) => x.name === name)!.diff) * 1.2), (hi - lo) * 2, 0.1);
  const x = (v: number) => `${((Math.max(-span, Math.min(span, v - f.good_median)) + span) / (2 * span)) * 100}%`;
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,9.5rem)] items-center gap-4">
      <span className="truncate text-[14px] text-muted">{w.label}</span>
      <span className="relative h-5">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />
        <span className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ left: x(lo), right: `calc(100% - ${x(hi)})`, background: "color-mix(in srgb, var(--color-good) 40%, transparent)" }} />
        <motion.span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ boxShadow: "0 0 0 3px var(--color-card)" }}
                     initial={false} animate={{ left: x(f.value) }} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
      </span>
      <span className={cn("truncate text-right text-[14px]", f.off ? "text-ink" : "text-faint")}>{f.off ? (f.toward > 0 ? w.more : w.less) : "Good"}</span>
    </div>
  );
}

export function MixLands() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const mix = MIXES[i];
  const pos = Math.min(97, Math.max(3, mix.lean * 100));

  // Switching mixes while playing keeps the same moment, so the difference is easy to hear
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const t = a.currentTime, was = !a.paused;
    a.src = encodeURI(`/demo/${mix.key} mix.m4a`);
    a.currentTime = t;
    if (was) a.play().catch(() => setPlaying(false));
  }, [mix.key]);
  useEffect(() => () => audio.current?.pause(), []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { a.pause(); setPlaying(false); }
  };

  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <audio ref={audio} src={encodeURI(`/demo/${MIXES[0].key} mix.m4a`)} loop preload="none" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <div className="rounded-[22px] border border-edge bg-card p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-card-2 p-1" role="tablist" aria-label="Which mix">
            {MIXES.map((m, k) => (
              <button key={m.key} role="tab" aria-selected={k === i} onClick={() => setI(k)}
                      className={cn("rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors", k === i ? "bg-white text-black" : "text-muted hover:text-ink")}>
                {m.name}
              </button>
            ))}
          </div>
          <button onClick={toggle} className="ml-auto rounded-full border border-edge px-4 py-1.5 text-[14px] text-ink transition-colors hover:bg-card-2">
            {playing ? "Pause" : "Hear it"}
          </button>
        </div>

        <p className="mt-7 text-[13px] text-faint">Compared with good mixes</p>
        <AnimatePresence mode="wait">
          <motion.p key={mix.lean_word + mix.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                    className="mt-1 text-[24px] font-medium tracking-[-0.02em]">{WORDS[mix.lean_word] ?? mix.lean_word}</motion.p>
        </AnimatePresence>
        <div className="relative mt-4 h-1.5 rounded-full bg-card-2">
          <motion.span className="absolute inset-y-0 left-0 rounded-full bg-white/20" initial={false} animate={{ width: `${pos}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          <motion.span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ boxShadow: "0 0 0 3px var(--color-card)" }}
                       initial={false} animate={{ left: `${pos}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-faint"><span>Far</span><span>Close</span></div>

        <p className="mt-7 text-[14px] text-muted">To get closer:</p>
        <div className="mt-3 grid gap-3">{ROWS.map((n) => <Row key={n} name={n} mix={mix} />)}</div>
        <p className="mt-5 text-[12px] leading-relaxed text-faint">Green is where the middle half of the good mixes sit. The dot is this mix.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-[22px] border border-edge bg-card p-6 sm:p-7">
          <p className="text-[13px] text-faint">Muse Spark, on the {mix.name.toLowerCase()}</p>
          <AnimatePresence mode="wait">
            <motion.div key={mix.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-3 flex flex-col gap-3">
              {mix.muse_summary && <p className="self-start rounded-[16px] bg-ink px-4 py-2.5 text-[15px] leading-snug text-black">{mix.muse_summary}</p>}
              {mix.muse_notes.map((n) => (
                <div key={n.short} className="rounded-[14px] bg-card-2 px-4 py-3">
                  <p className="text-[15px] font-medium">{n.short}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{n.text}</p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="rounded-[22px] border border-edge bg-card p-6 text-[14px] leading-relaxed text-muted sm:p-7">
          <p><span className="text-ink">A lean, not a score.</span> The model learned from 63 mixes our testers rated good or bad, on the shape of the sound alone. On songs it hadn’t heard, it told good from bad 75% of the time, so it points the way instead of grading.</p>
          <p className="mt-3">The finished mix still lands on the far side, closer than the rough one. The model hears only the 16 bars Aria checked.</p>
        </div>
      </div>
      <p className="text-[12px] text-faint lg:col-span-2">Recorded from a real Mix check of <code>{MIXES[0].file}</code> and <code>{MIXES[1].file}</code> through Aria’s engine and Muse Spark ({lean.made}, commit {lean.commit}), by <code>judges/scripts/make_lean_data.py</code>.</p>
    </div>
  );
}
