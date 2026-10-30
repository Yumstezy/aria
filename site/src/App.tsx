// Aria's website (Oct 29). What Aria does, in plain words for people who don't make music, with real screenshots
// of the app on a real song. Additional features still in development say so and are drawn as simple pictures with no
// numbers, because nothing here may show data Aria didn't measure (CLAUDE.md, "No invented data").
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { LiquidNavbar, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";
import { GlowCard, type Accent } from "@/components/ui/glow-card";
import { cn } from "@/lib/utils";

const GITHUB = "https://github.com/Yumstezy/aria";

/* ---------- icons (the app's own line icons, ui/src/components/icons.tsx) ---------- */
const svg = (d: ReactNode, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const Icon = {
  mic: (s?: number) => svg(<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, s),
  wave: (s?: number) => svg(<path d="M3 15c3 0 3-7 6-7s3 9 6 9 3-6 6-6" />, s),
  ref: (s?: number) => svg(<><rect x="3" y="6" width="5" height="12" rx="1.5" /><rect x="11" y="6" width="10" height="12" rx="1.5" /></>, s),
  spark: (s?: number) => svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />, s),
  play: (s?: number) => svg(<path d="M7 5v14l12-7Z" />, s),
  plus: (s?: number) => svg(<path d="M12 5v14M5 12h14" />, s),
  knob: (s?: number) => svg(<><circle cx="12" cy="12" r="7" /><path d="M12 12 15.5 8.5" /></>, s),
  minus: (s?: number) => svg(<path d="M5 12h14" />, s),
  plug: (s?: number) => svg(<><path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0Z" /><path d="M12 16v5" /></>, s),
  ear: (s?: number) => svg(<><path d="M7 9.5a5 5 0 0 1 10 0c0 3-2.4 4-3.3 5.8-.7 1.5-1 3.7-3.4 3.7A2.8 2.8 0 0 1 7.5 16" /><path d="M10 9.5a2 2 0 0 1 4 0" /></>, s),
  check: (s?: number) => svg(<path d="M5 12.5l4.5 4.5L19 7" />, s),
  undo: (s?: number) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>, s),
  speech: (s?: number) => svg(<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />, s),
  split: (s?: number) => svg(<path d="M4 6h6l4 6-4 6H4M20 6h-4M20 18h-4M14 12h6" />, s),
  download: (s?: number) => svg(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, s),
  github: (s?: number) => svg(<path d="M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.7 5.8 3 5.8 3a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.4c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />, s),
};

/* ---------- small pieces ---------- */

/** Fades up the first time it scrolls into view */
function Rise({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay, ease: [0.32, 0.72, 0, 1] }}>{children}</motion.div>
  );
}

function Section({ id, label, title, dim, sub, children }: { id?: string; label: string; title: string; dim?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-hairline py-24 sm:py-28">
      <div className="mx-auto max-w-[1160px] px-6">
        <Rise>
          <span className="font-mono text-[12.5px] text-faint">{label}</span>
          <h2 className="mt-2.5 max-w-[780px] text-[clamp(30px,4vw,46px)] font-medium leading-[1.08] tracking-[-0.03em]">
            {title}{dim && <span className="text-faint"> {dim}</span>}
          </h2>
          {sub && <p className="mt-4 max-w-[640px] text-[17px] leading-relaxed text-muted">{sub}</p>}
        </Rise>
        {children}
      </div>
    </section>
  );
}

/** A real screenshot of the app in a rounded frame */
function Shot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[18px] border border-edge bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]", className)}>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  );
}

function Btn({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <a href={href} className={cn("inline-flex h-10 items-center gap-2 rounded-[10px] border px-4 text-[14px] font-medium transition-[filter] hover:brightness-110",
      primary ? "border-transparent bg-ink text-ground" : "border-edge bg-card text-ink")}>{children}</a>
  );
}

function IconChip({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="grid size-9 flex-none place-items-center rounded-[11px] border border-edge bg-card-2" style={{ color }}>{children}</span>;
}

/* ---------- chat bits (styled like the app's Ask Muse) ---------- */
const You = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[88%] justify-self-end rounded-[14px] border border-edge px-3.5 py-2.5 text-[14px] leading-snug">{children}</div>
);
const Muse = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[88%] justify-self-start rounded-[14px] bg-ink px-3.5 py-2.5 text-[14px] leading-snug text-ground">{children}</div>
);
const Done = ({ children }: { children: ReactNode }) => (
  <div className="flex max-w-[92%] items-start gap-2 justify-self-start rounded-[10px] bg-good/10 px-3 py-2 text-[12.5px] font-medium leading-snug text-good">
    <span className="mt-px">{Icon.check(14)}</span><span>{children}</span>
  </div>
);

/* ---------- the floating Ask Muse card on the hero: a real request typing in, then Aria's real answer ---------- */
const HERO_ASK = "get rid of the muddy sounds in the low end of the calp around 900hz";
function HeroAsk() {
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState(0);   // 0 typing, 1 answer, 2 done
  useEffect(() => {
    if (typed < HERO_ASK.length) { const t = setTimeout(() => setTyped(typed + 1), 38); return () => clearTimeout(t); }
    const a = setTimeout(() => setStage(1), 500), b = setTimeout(() => setStage(2), 1300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [typed]);
  return (
    <div className="grid w-full gap-2.5 rounded-[20px] border border-white/10 bg-black/40 p-4 text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="flex items-baseline gap-2 text-[14px]"><b className="font-semibold">Ask Muse</b><span className="font-mono text-[11.5px] text-faint">Muse Spark</span></div>
      {typed >= HERO_ASK.length && <You>{HERO_ASK}</You>}
      {stage >= 1 && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid"><Muse>Cutting that boxiness out of your clap.</Muse></motion.div>}
      {stage >= 2 && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid"><Done>Added an EQ Eight on "Clap". band 5 Bell -3.01 dB at 900 Hz, Q 1.</Done></motion.div>}
      <div className="flex h-11 items-center gap-2.5 rounded-[12px] border-[1.5px] border-blue px-2 text-[13.5px]">
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-white/5 text-muted">{Icon.mic(14)}</span>
        {typed < HERO_ASK.length
          ? <span className="truncate text-ink">{HERO_ASK.slice(0, typed)}<span className="caret" /></span>
          : <span className="text-faint">Ask, or tell Muse what to change</span>}
      </div>
    </div>
  );
}

/* ---------- Additional features (in development): simple pictures of how each works, no numbers ---------- */

function PicAnalyzer() {
  const bars = [6, 9, 14, 18, 15, 12, 13, 16, 11, 9, 10, 8, 6, 5, 4];
  return (
    <div className="flex h-24 items-end gap-1">
      {bars.map((h, i) => (
        <motion.span key={i} className="flex-1 rounded-sm bg-blue/60" animate={{ height: [`${h * 4}%`, `${(h * 4 * 0.6)}%`, `${h * 4}%`] }}
                     transition={{ duration: 1.4 + (i % 4) * 0.2, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </div>
  );
}
function PicGroove() {
  const beat = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="grid h-24 content-center gap-4">
      {[0, 1].map((row) => (
        <div key={row} className="relative h-3">
          <span className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
          {beat.map((b) => (
            <motion.span key={b} className={cn("absolute top-0 size-3 rounded-full", row ? "bg-gold" : "bg-ink")}
                         style={{ left: `${(b / 7) * 92}%` }}
                         animate={row ? { x: [b % 2 ? 7 : -5, 0, 0, b % 2 ? 7 : -5] } : undefined}
                         transition={{ duration: 3, repeat: Infinity, times: [0, 0.35, 0.8, 1] }} />
          ))}
        </div>
      ))}
    </div>
  );
}
function PicSections() {
  const lanes = [["Intro", 2, "bg-white/10"], ["Build", 1.4, "bg-blue/25"], ["Drop", 2.4, "bg-gold/30"], ["Break", 1.2, "bg-white/10"], ["Drop", 2, "bg-gold/30"]] as const;
  return (
    <div className="grid h-24 content-center gap-2">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-1">
          {lanes.map(([name, w, c], i) => (
            <span key={i} className={cn("grid h-8 place-items-center truncate rounded-md text-[10.5px] text-muted", c)} style={{ flex: w }}>{row ? name : ""}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
function PicScore() {
  return (
    <div className="grid h-24 place-items-center">
      <svg viewBox="0 0 120 64" className="h-20 w-32" aria-hidden="true">
        <path d="M10 60a50 50 0 0 1 100 0" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" strokeLinecap="round" />
        <motion.path d="M10 60a50 50 0 0 1 100 0" fill="none" stroke="var(--color-good)" strokeWidth="8" strokeLinecap="round"
                     initial={{ pathLength: 0 }} whileInView={{ pathLength: 0.7 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: "easeOut" }} />
      </svg>
    </div>
  );
}
function PicBeforeAfter() {
  return (
    <svg viewBox="0 0 200 80" className="h-24 w-full" aria-hidden="true">
      <path d="M0 60 C30 30 50 20 80 35 S130 25 160 40 200 55 200 55" fill="none" stroke="var(--color-hot)" strokeWidth="2" strokeDasharray="4 4" opacity=".7" />
      <path d="M0 62 C30 36 50 32 80 42 S130 36 160 46 200 58 200 58" fill="none" stroke="var(--color-good)" strokeWidth="2.2" />
    </svg>
  );
}

/* ---------- the page ---------- */

const NAV: LiquidNavItem[] = [
  { label: "Talk", href: "#talk", icon: Icon.speech(), fx: "pop" },
  { label: "Check", href: "#check", icon: Icon.wave(), fx: "wave" },
  { label: "Compare", href: "#compare", icon: Icon.ref(), fx: "spin" },
  { label: "More", href: "#next", icon: Icon.spark(), fx: "spin" },
  { label: "Video", href: "#video", icon: Icon.play(), fx: "pop" },
];

const BEATS = [
  { t: "0:00", title: "The problem", line: "Making music is hard. Making it sound good is harder.", shot: "Text only" },
  { t: "0:03", title: "Meet Aria", line: "Meet Aria. Your AI co-producer.", shot: "The Aria window over Ableton" },
  { t: "0:06", title: "Just tell it", line: "Just tell it what you want.", shot: "A request types in, a green Done card appears" },
  { t: "0:10", title: "Add, change, remove", line: "Add effects. Change any setting. Remove what you don't need. Undo anytime.", shot: "Done cards stack up one after another" },
  { t: "0:14", title: "It listens", line: "It finds what sounds wrong.", shot: "Mix check: numbered problems on the graph" },
  { t: "0:18", title: "Fix it", line: "One click to fix it.", shot: "The Fix first card, the EQ curve dips" },
  { t: "0:21", title: "Compare", line: "See how you compare to songs you love.", shot: "Gold and blue lines on one graph" },
  { t: "0:24", title: "And more", line: "Live analyzer. Groove match. Song sections. Mix score.", shot: "Quick cuts of the Additional features pictures" },
  { t: "0:27", title: "Logo, with a wink", line: "aria, make my song sound good. make no mistakes.", shot: "Types into the Ask Muse box like a real request, then the bird and \"Built with Meta Muse Spark\" below it" },
];

const SHOTS = [
  ["mixcheck.png", "Mix check, with what to fix pinned on a graph of the song"],
  ["reference.png", "Mix check against a reference song: yours in gold, the reference in blue"],
  ["reference-screen.png", "The Reference screen"],
  ["detailed.png", "Detailed: the numbers, as pictures"],
  ["docked.png", "Docked beside Ableton"],
  ["home.png", "Home, before a first check"],
  ["device.png", "The Aria device on the Main track"],
] as const;

/** Each card of the app on its own, transparent around its corners, for the editor to animate one at a time */
const PARTS = [
  ["detailed-1-loudness--87lufs.png", "Loudness"],
  ["detailed-2-true-peak-05dbtp.png", "True peak"],
  ["detailed-3-balance-bass--116.png", "Balance"],
  ["detailed-4-width-bass-0.png", "Width"],
  ["detailed-5-each-part-against.png", "Each part against the mix"],
  ["detailed-6-everything-muse-spark.png", "Everything Muse Spark said"],
  ["mixcheck-1-to-fix-1.png", "How many to fix"],
  ["mixcheck-2-fix-first-harsh.png", "Fix first, with Muse's EQ cut"],
  ["mixcheck-3-split-into-3parts.png", "The parts Aria heard"],
  ["mixcheck-4-where-the-problems.png", "Where the problems are"],
  ["mixcheck-5-1-harsh-hits.png", "A problem, opened"],
  ["reference-1-to-fix-2.png", "How many to fix, with a reference"],
  ["reference-2-fix-first-mids.png", "Fix first: fuller than the reference"],
  ["reference-3-split-into-2parts.png", "The parts Aria heard"],
  ["reference-4-against-your-reference.png", "Against your reference"],
  ["reference-5-1-mids-fuller.png", "A reference problem, opened"],
] as const;

export default function App() {
  return (
    <div className="min-h-screen">
      {/* Top bar: the liquid glass navbar in the middle */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-6 pt-4">
          <a href="#" className="flex items-center gap-2.5 text-[17px] font-semibold"><span className="mark size-[22px]" />Aria</a>
          <div className="flex flex-1 justify-center"><LiquidNavbar tone="dark" items={NAV} /></div>
          <a href={GITHUB} className="hidden h-10 items-center gap-2 rounded-[10px] bg-ink px-4 text-[14px] font-medium text-ground sm:inline-flex">Get Aria</a>
        </div>
      </header>

      {/* Hero */}
      <header className="relative overflow-hidden pt-40 text-center">
        <div className="mx-auto max-w-[1160px] px-6">
          <Rise>
            <h1 className="mx-auto max-w-[920px] text-[clamp(42px,6.6vw,80px)] font-medium leading-[1.02] tracking-[-0.035em]">
              Just tell Ableton<br /><span className="text-faint">what you want.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[660px] text-[19px] leading-relaxed text-muted">
              Aria is an AI helper inside Ableton Live, the app producers use to make songs. Tell it what you want, typed or out loud, and it makes the change for you. Then it listens to your song and shows you what to fix.
            </p>
            <div className="mt-8 flex justify-center gap-2.5"><Btn href={GITHUB} primary>Get Aria</Btn><Btn href="#talk">See it work</Btn></div>
          </Rise>
          <Rise delay={0.15} className="relative mx-auto mt-16 max-w-[1100px] pb-20">
            <Shot src="/img/mixcheck.png" alt="Aria's Mix check window over Ableton Live" />
            <div className="mx-auto mt-4 max-w-[400px] md:absolute md:-left-6 md:bottom-4 md:mt-0 md:w-[400px]"><HeroAsk /></div>
          </Rise>
        </div>
      </header>

      {/* New to this */}
      <Section id="basics" label="New to this?" title="Four words, then you know everything Aria does." sub="You don't need to make music to follow along.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["Ableton Live", "A program for making songs on a computer. Every sound, like the drums or the voice, sits on its own track.", "white", Icon.wave()],
            ["A mix", "All those tracks playing together. In a good mix you can hear every sound clearly. In a bad one they fight.", "hot", Icon.split()],
            ["EQ", "A tone control for one sound: more or less bass, middle or treble. Most fixes are a small EQ cut.", "gold", Icon.knob()],
            ["A reference song", "A finished song you want yours to sound like. Professionals compare against one all the time.", "blue", Icon.ref()],
          ] as [string, string, Accent, ReactNode][]).map(([t, d, a, ic], i) => (
            <Rise key={t} delay={i * 0.06}><GlowCard accent={a} className="h-full">
              <IconChip>{ic}</IconChip><b className="mt-4 text-[17px] font-medium">{t}</b><p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
      </Section>

      {/* Talk to it */}
      <Section id="talk" label="Talk to it" title="Say it, and it happens in Ableton." dim="Typed or out loud."
               sub="No menus, no knobs. Hold a key and say what you want, or type it. Aria's AI, Meta's Muse Spark, finds the right track and the right tool and makes the change straight away. Anything it does can be undone.">
        <div className="mt-12 grid items-start gap-4 lg:grid-cols-2">
          <Rise><GlowCard accent="good">
            <div className="mb-4 flex items-center gap-2.5 text-[13px] text-muted"><IconChip>{Icon.mic(15)}</IconChip>Real requests from our testing, exactly as typed, and what Aria did</div>
            <div className="grid gap-2.5">
              <You>Fix this for the whole song: Mud (150–400 Hz). Synths feel boxed in behind the mix</You>
              <Muse>Cutting the low-mid clutter behind your synths now.</Muse>
              <Done>On "Kick + Bass": band 5 Bell -3.01 dB at 274 Hz, Q 1.</Done>
              <You>get rid of the muddy sounds in the low end of the calp around 900hz</You>
              <Muse>Cutting that boxiness out of your clap.</Muse>
              <Done>Added an EQ Eight on "Clap". band 5 Bell -3.01 dB at 900 Hz, Q 1.</Done>
              <You>make bar 1-32 the intro 32-80 the drop</You>
              <Muse>Setting up those sections now.</Muse>
              <You>move m e to bar 145</You>
              <Muse>Jumping to bar 145 for you.</Muse>
            </div>
          </GlowCard></Rise>
          <div className="grid gap-3">
            {([
              ["Add", "Effects like echo, reverb, distortion or a compressor, on any track, already set up. EQ cuts and boosts. Names for the parts of your song. A sidechain, so the bass ducks when the kick hits.", "gold", Icon.plus(), ["EQ Eight", "Compressor", "Reverb", "Delay", "Saturator", "Roar", "+15 more"]],
              ["Change", "Any knob on those effects, how loud a track is, its tone, the tempo. Mute or solo a track. \"Raise it by half a dB\" knows what \"it\" is.", "blue", Icon.knob(), []],
              ["Remove", "Take out markers and song parts. Undo removes anything Aria added, one step at a time.", "hot", Icon.minus(), []],
              ["Your own plugins", "Aria only changes Ableton's built-in tools. Ask about a plugin like Pro-Q and it draws how the setting should look, from your own presets, for you to copy.", "white", Icon.plug(), []],
            ] as [string, string, Accent, ReactNode, string[]][]).map(([t, d, a, ic, chips], i) => (
              <Rise key={t} delay={i * 0.06}><GlowCard accent={a}>
                <div className="flex items-center gap-3"><IconChip>{ic}</IconChip><b className="text-[17px] font-medium">{t}</b></div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{d}</p>
                {chips.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{chips.map((c) => <span key={c} className="rounded-[7px] border border-edge px-2 py-0.5 text-[12px] text-muted">{c}</span>)}</div>}
              </GlowCard></Rise>
            ))}
          </div>
        </div>
      </Section>

      {/* Mix check */}
      <Section id="check" label="Mix check" title="Press Check." dim="See what sounds wrong, and where."
               sub="Aria listens to about 20 seconds of your song and finds the sounds that clash or stick out: a voice buried under the music, a muddy low end, a sound that's too sharp. Each one gets a number on a picture of your song.">
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Rise className="grid gap-3">
            {([
              ["hot", Icon.wave(), "What to fix first", "The biggest problem, how big it is, and where in the song it happens."],
              ["gold", Icon.check(), "Fix it", "One click. Aria puts the fix into Ableton for you."],
              ["blue", Icon.undo(), "Undo", "Don't like it? One click puts it back."],
              ["white", Icon.split(), "It hears each part", "Meta's Demucs splits your song into drums, bass, vocals and the rest, so Aria can tell which part is the problem."],
            ] as [Accent, ReactNode, string, string][]).map(([a, ic, t, d]) => (
              <div key={t} className="flex gap-3.5"><IconChip color={a === "white" ? undefined : `var(--color-${a})`}>{ic}</IconChip>
                <div><b className="text-[15.5px] font-medium">{t}</b><p className="mt-0.5 text-[14.5px] leading-relaxed text-muted">{d}</p></div></div>
            ))}
          </Rise>
          <Rise delay={0.1}><Shot src="/img/mixcheck.png" alt="Mix check: what to fix first, and a graph of the song with the problem pinned on it" /></Rise>
        </div>
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <Rise><Shot src="/img/detailed.png" alt="Detailed view: loudness, peak, balance, width and each part" /></Rise>
          <Rise delay={0.1}>
            <h3 className="text-[26px] font-medium leading-tight tracking-[-0.02em]">The numbers, when you want them.</h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">For the curious: how loud the song is, how its low, middle and high parts balance, how wide it sounds, and how loud each part is. Every number was measured from your audio. Aria never makes one up.</p>
          </Rise>
        </div>
      </Section>

      {/* Compare */}
      <Section id="compare" label="Compare" title="Pick a song you love." dim="See how yours measures up."
               sub="Choose any song as your reference. Aria plays both at the same volume and draws them on one graph: yours in gold, theirs in blue. Where theirs is fuller, the gap is blue. Where yours is, it's gold.">
        <Rise className="mt-12"><Shot src="/img/reference.png" alt="Your song against a reference song, both drawn on one graph" /></Rise>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.55fr]">
          <Rise><Shot src="/img/reference-screen.png" alt="The Reference screen: the song, Muse's verdict and the graph" /></Rise>
          <Rise delay={0.1}><GlowCard accent="blue" className="h-full">
            <IconChip color="var(--color-blue)">{Icon.ref()}</IconChip>
            <b className="mt-4 text-[17px] font-medium">A verdict in plain words</b>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Muse Spark reads the comparison and says it like a person would: "Your mids stand out against your reference, so start there." Then Fix it does the rest.</p>
          </GlowCard></Rise>
        </div>
      </Section>

      {/* Name my tracks + the device */}
      <Section label="In your song" title="It knows your tracks by name." dim="And lives in one small box.">
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Rise><GlowCard accent="gold" className="h-full">
            <IconChip color="var(--color-gold)">{Icon.ear()}</IconChip>
            <b className="mt-4 text-[17px] font-medium">Name my tracks</b>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Turn it on and Aria puts a small listener on your main tracks, like the kick, the bass and the vocal. Then it can tell you exactly which two are fighting. On our test song: "Drums and Bass clash from 890 Hz to 1.1 kHz."</p>
          </GlowCard></Rise>
          <Rise delay={0.08}><GlowCard accent="white" className="h-full">
            <div className="flex items-start gap-5">
              <div className="flex-1">
                <IconChip>{Icon.wave()}</IconChip>
                <b className="mt-4 block text-[17px] font-medium">One box in Ableton</b>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Aria sits at the end of your song's main output, in Ableton's own grey. Check, Ask, and Open window. Nothing in your song changes until you ask, or say yes.</p>
              </div>
              <img src="/img/device.png" alt="The Aria device: Check, Ask, Open window" className="w-[150px] flex-none rounded-[10px] border border-edge" loading="lazy" />
            </div>
          </GlowCard></Rise>
        </div>
      </Section>

      {/* Additional features (in development) */}
      <Section id="next" label="Additional features" title="And there's more." dim="Same window, same idea."
               sub="In development now. The pictures show how each one works.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["Live analyzer", "Watch your song's sound move while it plays, with problems lighting up as they happen.", "blue", <PicAnalyzer />],
            ["Groove match", "Two loops that don't quite line up? Aria nudges the hits until they play perfectly in time.", "gold", <PicGroove />],
            ["Song sections", "Aria finds the intro, the build and the drop in your song and a reference, side by side, and names them in Ableton for you.", "white", <PicSections />],
            ["Mix score", "A score for your mix, from a model trained on real songs rated by real producers.", "good", <PicScore />],
            ["Before and after", "After a fix, Aria listens again at the same volume and shows you what changed.", "hot", <PicBeforeAfter />],
            ["One-click install", "Download Aria from this page and drop it into Ableton. No setup.", "white", <div className="grid h-24 place-items-center text-muted">{Icon.download(40)}</div>],
          ] as [string, string, Accent, ReactNode][]).map(([t, d, a, pic], i) => (
            <Rise key={t} delay={(i % 3) * 0.06}><GlowCard accent={a} className="h-full">
              <div className="rounded-[12px] border border-hairline bg-ground/60 p-4">{pic}</div>
              <b className="mt-4 text-[16.5px] font-medium">{t}</b>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
      </Section>

      {/* Muse Spark */}
      <Section id="muse" label="Built with Meta AI" title="Meta's Muse Spark does the talking" dim="and the doing.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["Explains", "Turns what Aria measured into plain words, using only real numbers.", "white", Icon.speech()],
            ["Drives Ableton", "Picks the track, the tool and the settings, and makes the change, from a fixed list of safe actions, each with Undo.", "gold", Icon.knob()],
            ["Hears you", "Muse Voice Transcribe turns what you say into a request.", "good", Icon.mic()],
            ["Splits the song", "Meta's Demucs separates drums, bass, vocals and the rest, so Aria hears each part.", "blue", Icon.split()],
          ] as [string, string, Accent, ReactNode][]).map(([t, d, a, ic], i) => (
            <Rise key={t} delay={i * 0.06}><GlowCard accent={a} className="h-full">
              <IconChip>{ic}</IconChip><b className="mt-4 text-[17px] font-medium">{t}</b><p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
      </Section>

      {/* For the video */}
      <Section id="video" label="For the video" title="The 30 second cut," dim="beat by beat."
               sub="Every screenshot here is the real app on a real song. The on-screen text is written for people who have never made music.">
        <div className="mt-12 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {BEATS.map((b, i) => (
            <Rise key={b.t} delay={i * 0.05}><GlowCard accent={i === 2 ? "good" : "white"} className="h-full">
              <span className="font-mono text-[11.5px] text-faint">{b.t}</span>
              <b className="mt-1.5 text-[15px] font-medium">{b.title}</b>
              <p className="mt-2 text-[14px] leading-snug text-ink">"{b.line}"</p>
              <p className="mt-auto pt-3 text-[12.5px] leading-snug text-muted">{b.shot}</p>
            </GlowCard></Rise>
          ))}
        </div>
        <Rise className="mt-12">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-[22px] font-medium tracking-[-0.02em]">Logo</h3>
            <span className="ml-auto"><Btn href="/aria-logos.zip" primary>{Icon.download(16)}Download all</Btn></span>
          </div>
          {/* Each version on dark (white) and on light (black), centered at one size, so they compare at a glance */}
          <div className="mt-5 mb-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ["aria-logo", "The bird and the name", "max-h-9"],
              ["aria-logo-lowercase", "The bird and the name, lowercase", "max-h-9"],
              ["aria-wordmark", "Just the name", "max-h-9"],
              ["aria-wordmark-lowercase", "Just the name, lowercase", "max-h-9"],
              ["aria-mark", "Just the bird", "max-h-14"],
              ["aria-app-icon", "App icon", "max-h-20"],
            ] as const).map(([f, label, h]) => {
              const dark = f === "aria-app-icon" ? `${f}-dark.png` : `${f}-white.png`, light = f === "aria-app-icon" ? `${f}-light.png` : `${f}-black.png`;
              return (
                <div key={f}>
                  <div className="grid h-40 grid-cols-2 overflow-hidden rounded-[14px] border border-edge">
                    <a href={`/brand/${dark}`} download className="flex items-center justify-center bg-ground p-4"><img src={`/brand/${dark}`} alt={`${label}, white`} className={cn("h-auto max-w-full", h)} /></a>
                    <a href={`/brand/${light}`} download className="flex items-center justify-center bg-[#f4f4f5] p-4"><img src={`/brand/${light}`} alt={`${label}, black`} className={cn("h-auto max-w-full", h)} /></a>
                  </div>
                  <p className="mt-2 text-[13px] text-muted">{label}. Tap either side to download it.</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-[22px] font-medium tracking-[-0.02em]">Cards, one at a time</h3>
            <span className="ml-auto"><Btn href="/aria-components.zip">{Icon.download(16)}Download all</Btn></span>
          </div>
          <p className="mt-2 max-w-[640px] text-[14.5px] text-muted">Every card of the app as its own image, with a see-through background, so each one can slide or zoom in on its own.</p>
          <div className="mt-5 mb-14 columns-1 gap-3 sm:columns-2 lg:columns-3">
            {PARTS.map(([f, label]) => (
              <a key={f} href={`/parts/${f}`} download className="group mb-3 block break-inside-avoid rounded-[14px] border border-hairline bg-[linear-gradient(135deg,#1c1c20,#0a0a0b)] p-3">
                <img src={`/parts/${f}`} alt={label} loading="lazy" className="mx-auto block max-h-56 w-auto max-w-full transition-transform duration-500 group-hover:scale-[1.02]" />
                <p className="mt-2 text-[13px] text-muted">{label}</p>
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-[22px] font-medium tracking-[-0.02em]">Screenshots</h3>
            <span className="ml-auto"><Btn href="/aria-screenshots.zip">{Icon.download(16)}Download all</Btn></span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SHOTS.map(([f, alt]) => (
              <a key={f} href={`/img/${f}`} download className="group">
                <div className="overflow-hidden rounded-[12px] border border-edge bg-card"><img src={`/img/${f}`} alt={alt} loading="lazy" className={cn("block aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03]",
                  f === "docked.png" || f === "device.png" ? "object-contain p-3" : "object-cover object-top")} /></div>
                <p className="mt-2 text-[13px] text-muted">{alt}</p>
              </a>
            ))}
          </div>
        </Rise>
      </Section>

      <footer className="border-t border-hairline py-10 text-[13.5px] text-faint">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold text-muted"><span className="mark size-[18px]" />Aria</span>
          <span>Built for the Meta AI hackathon, 2026.</span>
          <a href={GITHUB} className="ml-auto inline-flex items-center gap-1.5 hover:text-ink">{Icon.github(15)}GitHub</a>
        </div>
      </footer>
    </div>
  );
}
