// The judges' page (Oct 31, Ian: "a new website very similar to the one we made, but this one for judges ... results,
// challenges, images, things to help us with the rubric"). Laid out the way the rubric scores: Impact, Use of Meta AI,
// Technical, Demo. Every number on it was measured on real audio this week and is in the repo's history; every
// screenshot is the app on Ian's own song and loops. Nothing here is made up (CLAUDE.md, "No invented data").
import { type ReactNode } from "react";
import { motion } from "motion/react";
import { LiquidNavbar, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";
import { GlowCard, type Accent } from "@/components/ui/glow-card";
import { cn } from "@/lib/utils";

const GITHUB = "https://github.com/Yumstezy/aria";

/* ---------- icons: the app's own line icons ---------- */
const svg = (d: ReactNode, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  wave: (s?: number) => svg(<path d="M3 15c3 0 3-7 6-7s3 9 6 9 3-6 6-6" />, s),
  spark: (s?: number) => svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />, s),
  cog: (s?: number) => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>, s),
  play: (s?: number) => svg(<path d="M7 5v14l12-7Z" />, s),
  flag: (s?: number) => svg(<path d="M5 21V4M5 4h11l-2 4 2 4H5" />, s),
  bolt: (s?: number) => svg(<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />, s),
  mic: (s?: number) => svg(<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, s),
  split: (s?: number) => svg(<path d="M4 6h6l4 6-4 6H4M20 6h-4M20 18h-4M14 12h6" />, s),
  ear: (s?: number) => svg(<><path d="M7 9.5a5 5 0 0 1 10 0c0 3-2.4 4-3.3 5.8-.7 1.5-1 3.7-3.4 3.7A2.8 2.8 0 0 1 7.5 16" /><path d="M10 9.5a2 2 0 0 1 4 0" /></>, s),
  check: (s?: number) => svg(<path d="M5 12.5l4.5 4.5L19 7" />, s),
  undo: (s?: number) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>, s),
  speech: (s?: number) => svg(<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />, s),
  grid: (s?: number) => svg(<><circle cx="5" cy="9" r="1.2" /><circle cx="10" cy="9" r="1.2" /><circle cx="15" cy="9" r="1.2" /><circle cx="20" cy="9" r="1.2" /><circle cx="6" cy="15" r="1.2" /><circle cx="11" cy="15" r="1.2" /><circle cx="16" cy="15" r="1.2" /></>, s),
  bars: (s?: number) => svg(<path d="M5 20v-6M10 20V8M15 20v-9M20 20V5" />, s),
  ref: (s?: number) => svg(<><rect x="3" y="6" width="5" height="12" rx="1.5" /><rect x="11" y="6" width="10" height="12" rx="1.5" /></>, s),
  lanes: (s?: number) => svg(<><rect x="3" y="7" width="5" height="10" rx="1.5" /><rect x="10" y="7" width="5" height="10" rx="1.5" /><rect x="17" y="7" width="4" height="10" rx="1.5" /></>, s),
  github: (s?: number) => svg(<path d="M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.7 5.8 3 5.8 3a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.4c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />, s),
  x: (s?: number) => svg(<path d="M6 6l12 12M18 6 6 18" />, s),
};

/* ---------- pieces ---------- */
function Rise({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay, ease: [0.32, 0.72, 0, 1] }}>{children}</motion.div>
  );
}

/** A section with its rubric line: which category it answers, and that category's weight */
function Section({ id, rubric, weight, title, dim, sub, children }: { id: string; rubric: string; weight?: string; title: string; dim?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-hairline py-24 sm:py-28">
      <div className="mx-auto max-w-[1160px] px-6">
        <Rise>
          <div className="flex items-center gap-2.5 font-mono text-[12.5px]">
            <span className="text-faint">{rubric}</span>
            {weight && <span className="rounded-md border border-edge px-1.5 py-px text-muted">{weight}</span>}
          </div>
          <h2 className="mt-2.5 max-w-[820px] text-[clamp(30px,4vw,46px)] font-medium leading-[1.08] tracking-[-0.03em]">
            {title}{dim && <span className="text-faint"> {dim}</span>}
          </h2>
          {sub && <p className="mt-4 max-w-[660px] text-[17px] leading-relaxed text-muted">{sub}</p>}
        </Rise>
        {children}
      </div>
    </section>
  );
}

function Shot({ src, alt, className, caption }: { src: string; alt: string; className?: string; caption?: string }) {
  return (
    <figure className={cn("m-0", className)}>
      <div className="overflow-hidden rounded-[18px] border border-edge bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
        <img src={src} alt={alt} className="block w-full" loading="lazy" />
      </div>
      {caption && <figcaption className="mt-3 font-mono text-[12px] leading-relaxed text-faint">{caption}</figcaption>}
    </figure>
  );
}

function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="grid size-9 flex-none place-items-center rounded-[11px] border border-edge bg-card-2" style={{ color }}>{children}</span>;
}

/** A measured result: the big number, what it is, how it was measured */
function Stat({ value, unit, label, how, color }: { value: string; unit?: string; label: string; how: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[18px] border border-edge bg-card p-5">
      <span className="text-[34px] font-medium leading-none tracking-[-0.02em]" style={{ color }}>{value}{unit && <span className="ml-1 text-[16px] text-muted">{unit}</span>}</span>
      <span className="text-[14.5px] leading-snug text-ink">{label}</span>
      <span className="mt-auto pt-2 font-mono text-[11.5px] leading-relaxed text-faint">{how}</span>
    </div>
  );
}

/* ---------- content ---------- */

const NAV: LiquidNavItem[] = [
  { label: "Impact", href: "#impact", icon: I.flag(), fx: "pop" },
  { label: "Meta AI", href: "#meta", icon: I.spark(), fx: "spin" },
  { label: "Tech", href: "#tech", icon: I.cog(), fx: "spin" },
  { label: "Results", href: "#results", icon: I.bars(), fx: "wave" },
  { label: "Demo", href: "#demo", icon: I.play(), fx: "pop" },
];

const RUBRIC = [
  { name: "Impact", w: "30%", href: "#impact", line: "Who it helps and what changes for them" },
  { name: "Use of Meta AI", w: "25%", href: "#meta", line: "Muse Spark, Muse Voice Transcribe, Demucs, Audiobox" },
  { name: "Technical", w: "20%", href: "#tech", line: "A device, a bridge and an engine, measured on real audio" },
  { name: "Demo", w: "25%", href: "#demo", line: "What you'll see in the video, screen by screen" },
];

const FEATURES: { icon: ReactNode; color: string; accent: Accent; title: string; line: string; src: string; alt: string; caption: string; wide?: boolean }[] = [
  { icon: I.wave(), color: "var(--color-hot)", accent: "hot", title: "Mix check", line: "Records 16 bars of your Main track, splits it into parts with Demucs, and finds what clashes or sticks out: buried sounds, mud, harsh hits, ringing notes, bass clicks, tracks that fight. Each one marked on the spectrum by kind and by range.",
    src: "/img/judges/mixcheck.png", alt: "Mix check against a reference song", caption: "Ian's song, bars 33 to 81, against his reference. Three problems, each icon in its range's color.", wide: true },
  { icon: I.check(), color: "var(--color-good)", accent: "good", title: "Fix it, then prove it", line: "Fix it asks Muse Spark for the change; Muse makes it in Live with Undo. Check again plays the same bars and measures them at the same loudness. A problem 3 dB or more lower is marked Fixed; less, and it comes back with Fix it again.",
    src: "/img/judges/fixed.png", alt: "Before and after with a problem confirmed fixed", caption: "A planted harsh boost: 6.9 dB less after the fix, so it's Fixed and out of the way." },
  { icon: I.speech(), color: "var(--color-blue)", accent: "blue", title: "Ask Muse", line: "Type or say what you want. Muse Spark picks from 21 actions (EQ, volume, 20 stock devices, sidechain, markers, tempo, groove match, vocal sync, Undo) and they happen right away, each with Undo. When it can't tell which track you mean, it asks.",
    src: "/img/judges/ask.png", alt: "Ask Muse making changes in Live", caption: "Real requests from testing, typos and all, with what Aria did in green." },
  { icon: I.grid(), color: "var(--color-gold)", accent: "gold", title: "Groove match", line: "Two loops flamming? Aria finds every hit to the millisecond, moves each one onto the grid or onto another loop's feel, and writes a new clip under the original (kept, muted). Nothing is stretched. Warped loops are timed as you hear them.",
    src: "/img/judges/groove.png", alt: "Groove match result", caption: "A perc loop following a kick loop: worst hit 15.5 ms off, now 0." },
  { icon: I.ear(), color: "var(--color-violet)", accent: "white", title: "Vocal sync", line: "Drop in an acapella. Aria reads its original tempo and key, puts its first beat on your kick, and warps it to your song with Live's own warp markers, which Aria reads back to be sure they stuck. Undo puts it back.",
    src: "/img/judges/vocal.png", alt: "Vocal sync with the kick", caption: "Ian's vocal: 148 BPM, A minor, beat 1 on the kick at bar 9, which sits 22.6 ms after Live's grid." },
  { icon: I.lanes(), color: "var(--color-cyan)", accent: "blue", title: "Arrangement", line: "Aria hears the whole song once, finds its parts on a 4-bar grid, and Muse Spark names them (Intro, Build, Drop, Break, Bridge, Outro). Rename or move them, then add them to Live as markers. A check then compares your drop with their drop.",
    src: "/img/judges/arrangement.png", alt: "Arrangement of two songs", caption: "Ian's song and his reference, both named by Muse Spark.", wide: true },
  { icon: I.bars(), color: "var(--color-violet)", accent: "white", title: "Live analyzer", line: "Main as it plays: a sixth-octave spectrum against your reference, loudness to the BS.1770 standard, a polar stereo view with a phase meter, and a waveform colored by where the sound is (red lows, green highs).",
    src: "/img/judges/analyzer.png", alt: "Live analyzer", caption: "Ian's drop: -9.2 LUFS, the same loudness the engine measured for that recording.", wide: true },
];

const META = [
  { icon: I.spark(26), color: "var(--color-gold)", name: "Muse Spark", id: "muse-spark-1.3", what: [
    "Turns the engine's measurements into plain advice and a concrete fix, as JSON that Aria validates. It only ever sees measured numbers.",
    "Drives Live through tool calling: 21 actions, each checked against a fixed menu and limits before it runs, each with Undo.",
    "Asks instead of guessing: \"Which vocal track do you mean, VOCAL TEST or Vox 2?\" (a real reply, Oct 31).",
    "Names the parts of a song from their measured loudness and shape.",
  ] },
  { icon: I.mic(26), color: "var(--color-blue)", name: "Muse Voice Transcribe", id: "muse-voice-transcribe-1.0", what: [
    "Hold the mapped key (or the mic) and say it: \"cut the mud on the bass\" came back as text in 1.4 s, then ran like a typed request.",
    "Aria converts whatever the mic records to the 16 kHz mono WAV the API takes, and says plainly when the mic gives silence.",
  ] },
  { icon: I.split(26), color: "var(--color-hot)", name: "Demucs", id: "htdemucs (Meta AI research)", what: [
    "Splits each Mix check into vocals, drums, bass and other, so Aria can tell which sound covers which: \"SYNTH buried 1 to 4 kHz\".",
    "Prototype use only: its weights' license is unclear, so they download on first use and aren't in the repo.",
  ] },
  { icon: I.ear(26), color: "var(--color-violet)", name: "Audiobox Aesthetics", id: "experiment", what: [
    "Scored all 99 rated mixes for production quality, as a feature for the mix model. A planned side experiment, reported honestly below: it didn't beat loudness, so it didn't ship.",
  ] },
];

const RESULTS = [
  { value: "14.9 → 0", unit: "ms", label: "A perc loop following a kick loop, average lateness before and after Groove match", how: "Ian's loops at 165 BPM; all 32 hits found again in the new file by cross-correlation", color: "var(--color-good)" },
  { value: "-6.9", unit: "dB", label: "A planted harsh boost, measured after the fix at the same loudness", how: "Test mix B against the clean control, through Before and after", color: "var(--color-good)" },
  { value: "126.6", unit: "BPM", label: "A 126 BPM acapella's tempo, read from the vocal alone (was 190 before the fix)", how: "Repetition over 1, 2, 4 and 8 beats where it sings; key read as G# minor, right", color: "var(--color-blue)" },
  { value: "22.6", unit: "ms", label: "How far Ian's kick sits after Live's grid, found so a vocal lands on the kick, not the grid", how: "Kicks timed by their full sound, counted as kicks by the low band", color: "var(--color-blue)" },
  { value: "-9.2", unit: "LUFS", label: "The Live analyzer's loudness on Ian's drop, matching the engine's own measurement", how: "BS.1770 K-weighting inside the device, against pyloudnorm in the engine", color: "var(--color-violet)" },
  { value: "5 / 5", label: "Real requests sent to Muse Spark that got the right tool or a clarifying question", how: "Sync, groove at 70%, a sidechain, an unclear vocal, \"did that work\" (Oct 31)", color: "var(--color-gold)" },
  { value: "172", label: "Commits since Oct 26, in the open on GitHub", how: "git rev-list --count HEAD, Oct 31", color: "var(--color-ink)" },
  { value: "153", label: "Engine tests passing, every endpoint on real or generated audio", how: "cd engine && .venv/bin/pytest", color: "var(--color-ink)" },
];

const MISSES = [
  { title: "The mix model didn't ship", line: "Trained on 99 mixes people rated good, mid or bad: best 0.49 balanced accuracy against 0.45 for loudness alone (0.33 is a coin toss), and it failed the shuffle test (p = 0.70). With Meta's Audiobox scores added: 0.51, better than chance (p = 0.01), but it beat loudness in only 52% of test rounds. Raters preferred louder mixes. Next: shape only, good against bad." },
  { title: "One vocal still reads the wrong tempo", line: "Ian's own 148 BPM vocal stem reads 192. So every reading comes with the next likely ones and \"your song's tempo\" as one tap." },
  { title: "Broad boosts are hard to hear without a reference", line: "On three test mixes with one planted problem each, the clarity rules found the spikes but not a broad low-mid boost (1 of 3). That's why the reference compare exists." },
];

const CHALLENGES = [
  { title: "A blank device", line: "Aria's strip came up empty in Live. Cause: Live's audio wasn't running, which stalls Max's message queue, so the page was never told to load. Now the device carries a page of its own that says so after 4 seconds." },
  { title: "Max's message limit", line: "A groove result with a waveform picture was 50 KB, and Max passes its web view about 32 KB, so the screen hung. Results are packed now (7 KB), and the bridge refuses anything too long with a plain error." },
  { title: "Live drops warp markers without a word", line: "Vocal sync set two markers; Live kept one and played the vocal half time. Now Aria sets a marker every 4 bars in rounds, reads them back from Live, and only says Synced when they're there." },
  { title: "Kicks read 30 ms late", line: "Filtered to the low end, a kick's body builds slowly, so its start read 28 to 41 ms late. Now each hit is timed by its full sound and the low band only decides whether it's a kick." },
  { title: "Vocals in three against two", line: "A 126 BPM acapella read 190: three beats at 190 last as long as two at 126. Counting how the vocal repeats over whole bars fixed it." },
  { title: "Warped loops in the wrong time", line: "A 140 BPM loop warped to a 165 song was matched in its own file time and moved the wrong way. Aria now reads each clip's warp markers and works in the song's time." },
  { title: "\"On time\" became a sidechain", line: "Before Muse had the tools, it read \"set my vocal on time with my kick\" as ducking. It has timing tools now, a rule that timing words never mean sidechain, and it asks when the track isn't clear." },
  { title: "A comparison nobody understood", line: "\"Against good mixes\" (the rated mixes as a target) confused our own producer, and 30 mixes aren't a standard. We took it out the same day." },
];

const ARCH = [
  { k: "Ableton Live", v: "Aria.amxd on the Main track: records 16 bars, reads tempo and clips, sets EQ, devices, markers and warp markers through the Live API, and runs the live analyzer (55 bands, loudness, stereo)." },
  { k: "Bridge", v: "Node for Max: carries messages between Live, the screens and the engine, keeps every change on an Undo stack, and starts the engine when needed." },
  { k: "Engine", v: "Python on 127.0.0.1:8765: measures (clarity rules, loudness, sections, groove, vocal tempo and key), splits with Demucs, and talks to Muse Spark. Returns numbers; words come from Muse." },
  { k: "Screens", v: "React in Live's own web view: the strip on the device, and the window docked over Live." },
];

/* ---------- the page ---------- */

export default function JudgesPage() {
  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-6 pt-4">
          <a href="/" className="flex items-center gap-2.5 text-[17px] font-semibold"><span className="mark size-[22px]" />Aria</a>
          <div className="flex flex-1 justify-center"><LiquidNavbar tone="dark" items={NAV} /></div>
          <a href={GITHUB} className="hidden h-10 items-center gap-2 rounded-[10px] bg-ink px-4 text-[14px] font-medium text-ground sm:inline-flex">{I.github(16)}GitHub</a>
        </div>
      </header>

      {/* hero */}
      <header className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[620px]"
             style={{ background: "radial-gradient(60% 60% at 70% 20%, rgba(167,139,250,0.16), transparent 70%), radial-gradient(50% 50% at 20% 30%, rgba(245,196,81,0.10), transparent 70%)" }} />
        <div className="relative mx-auto max-w-[1160px] px-6 pb-16 pt-36 sm:pt-44">
          <Rise>
            <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-card px-3 py-1 font-mono text-[12px] text-muted">
              <span className="size-1.5 rounded-full bg-good" />For the judges · Meta Global AI Developer Hackathon · Indie track
            </span>
            <h1 className="mt-6 max-w-[900px] text-[clamp(44px,7vw,84px)] font-medium leading-[0.98] tracking-[-0.045em]">
              Aria hears your mix <span className="text-faint">and fixes it, inside Ableton.</span>
            </h1>
            <p className="mt-6 max-w-[640px] text-[18px] leading-relaxed text-muted">
              An AI co-producer on your Main track. It finds the sounds that clash or stick out, Muse Spark explains them in plain words and makes the fix in Live, and Aria measures again to prove it worked.
            </p>
          </Rise>
          <Rise delay={0.1} className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RUBRIC.map((r) => (
              <a key={r.name} href={r.href} className="group rounded-[16px] border border-edge bg-card p-4 transition-colors hover:bg-card-2">
                <div className="flex items-baseline justify-between"><b className="text-[15px] font-medium">{r.name}</b><span className="font-mono text-[12px] text-muted">{r.w}</span></div>
                <p className="m-0 mt-1.5 text-[13px] leading-snug text-faint group-hover:text-muted">{r.line}</p>
              </a>
            ))}
          </Rise>
          <Rise delay={0.2} className="mt-12"><Shot src="/img/judges/home.png" alt="Aria's Home in the full window" caption="Home, full window: what to fix, the reference, the song's parts and the live analyzer, on Ian's song." /></Rise>
        </div>
      </header>

      {/* Impact */}
      <Section id="impact" rubric="Impact" weight="30%" title="Finishing a song stops at the mix." dim="Aria is the second pair of ears."
               sub="Most producers learn to make a drop long before they learn why it sounds muddy next to the songs they love. The usual answers are an engineer, a course, or guessing with plugins. Aria works where they already are, in Ableton, on their own song.">
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {[
            { icon: I.wave(), color: "var(--color-hot)", t: "It finds the problem", l: "Not a score out of 100. The sound, the range and the bars: \"SYNTH buried, 1 to 4 kHz, bars 33 to 48\"." },
            { icon: I.speech(), color: "var(--color-gold)", t: "It says it plainly", l: "Muse Spark writes it like a producer would say it, from measured numbers only, never canned text." },
            { icon: I.undo(), color: "var(--color-good)", t: "It fixes it, and proves it", l: "One tap makes the change in Live with Undo. Check again measures the same bars at the same loudness." },
          ].map((c, i) => (
            <Rise key={c.t} delay={i * 0.06}>
              <GlowCard accent={i === 0 ? "hot" : i === 1 ? "gold" : "good"} className="h-full">
                <Chip color={c.color}>{c.icon}</Chip>
                <b className="mt-4 text-[17px] font-medium">{c.t}</b>
                <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-muted">{c.l}</p>
              </GlowCard>
            </Rise>
          ))}
        </div>
        <Rise className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[18px] border border-edge bg-card p-6">
            <span className="font-mono text-[12px] text-faint">Who it's for</span>
            <p className="m-0 mt-2 text-[15.5px] leading-relaxed text-ink">Bedroom and indie producers in Ableton Live, starting with EDM: people who can make the parts but can't yet hear why the whole doesn't hold up.</p>
          </div>
          <div className="rounded-[18px] border border-edge bg-card p-6">
            <span className="font-mono text-[12px] text-faint">What it never does</span>
            <p className="m-0 mt-2 text-[15.5px] leading-relaxed text-ink">Invent a number, judge your taste, or change a third-party plugin. It changes Live's own devices, and for plugins it draws how they should look.</p>
          </div>
        </Rise>
      </Section>

      {/* Meta AI */}
      <Section id="meta" rubric="Use of Meta AI" weight="25%" title="Meta's models do the work you can see." dim="Not a chat box on the side."
               sub="Every screen has Meta AI in it: Muse Spark writes the advice and makes the changes, Muse Voice Transcribe takes spoken requests, Demucs splits the mix, and we tested Audiobox Aesthetics on our data.">
        <div className="mt-12 grid gap-3 md:grid-cols-2">
          {META.map((m, i) => (
            <Rise key={m.name} delay={(i % 2) * 0.06}>
              <div className="flex h-full flex-col gap-3 rounded-[18px] border border-edge bg-card p-6">
                <div className="flex items-center gap-3"><Chip color={m.color}>{m.icon}</Chip>
                  <div className="grid"><b className="text-[17px] font-medium">{m.name}</b><span className="font-mono text-[11.5px] text-faint">{m.id}</span></div></div>
                <ul className="m-0 grid gap-2 p-0">
                  {m.what.map((w) => <li key={w} className="flex list-none gap-2.5 text-[14.5px] leading-relaxed text-muted"><span className="mt-[9px] size-1 flex-none rounded-full" style={{ background: m.color }} />{w}</li>)}
                </ul>
              </div>
            </Rise>
          ))}
        </div>
        <Rise className="mt-3 rounded-[18px] border border-edge bg-card p-6">
          <span className="font-mono text-[12px] text-faint">The guardrail</span>
          <p className="m-0 mt-2 max-w-[880px] text-[15.5px] leading-relaxed text-ink">Muse Spark never touches Live directly. It answers with actions from a fixed menu; Aria checks each one (the track exists, the gain stays within ±6 dB, the knob's unit fits) and only then applies it, with Undo. If Muse is down, the screen shows the measurements and says advice is unavailable. It never falls back to canned text.</p>
        </Rise>
      </Section>

      {/* Demo: the screens */}
      <section id="demo" className="scroll-mt-24 border-t border-hairline py-24 sm:py-28">
        <div className="mx-auto max-w-[1160px] px-6">
          <Rise>
            <div className="flex items-center gap-2.5 font-mono text-[12.5px]"><span className="text-faint">Demo</span><span className="rounded-md border border-edge px-1.5 py-px text-muted">25%</span></div>
            <h2 className="mt-2.5 max-w-[820px] text-[clamp(30px,4vw,46px)] font-medium leading-[1.08] tracking-[-0.03em]">Seven tools, one device. <span className="text-faint">Every screenshot is real.</span></h2>
            <p className="mt-4 max-w-[660px] text-[17px] leading-relaxed text-muted">All taken on Ian's own song, loops and vocal, with Aria's real results and Muse Spark's real words.</p>
          </Rise>
          <div className="mt-14 grid gap-16">
            {FEATURES.map((f, i) => (
              <Rise key={f.title} className={cn("grid items-start gap-8", f.wide ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_1.05fr]")}>
                <div className={cn("flex flex-col gap-3", !f.wide && "lg:sticky lg:top-28 lg:pt-10", !f.wide && i % 2 === 1 && "lg:order-2")}>
                  <div className="flex items-center gap-3"><Chip color={f.color}>{f.icon}</Chip><b className="text-[22px] font-medium tracking-[-0.01em]">{f.title}</b></div>
                  <p className="m-0 max-w-[620px] text-[16px] leading-relaxed text-muted">{f.line}</p>
                </div>
                <Shot src={f.src} alt={f.alt} caption={f.caption} className={cn(!f.wide && "mx-auto w-full max-w-[420px]")} />
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* Technical */}
      <Section id="tech" rubric="Technical" weight="20%" title="Built in nine days, measured on real audio." dim="Three parts, one rule."
               sub="The rule: the engine reports only what it measured. If it can't measure something, it says so. Muse gets only those numbers.">
        <div className="mt-12 grid gap-3 md:grid-cols-4">
          {ARCH.map((a, i) => (
            <Rise key={a.k} delay={i * 0.05}>
              <div className="relative flex h-full flex-col gap-2 rounded-[18px] border border-edge bg-card p-5">
                <span className="font-mono text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <b className="text-[16px] font-medium">{a.k}</b>
                <p className="m-0 text-[13.5px] leading-relaxed text-muted">{a.v}</p>
              </div>
            </Rise>
          ))}
        </div>
        <Rise className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            ["Clarity rules", "Buried sounds, mud, harsh bursts, ringing notes, bass clicks and clashing tracks, from the split parts or the producer's own tracks (Aria Ear), each with its bars and range."],
            ["Same loudness, always", "Reference compares and before and after are loudness matched (pyloudnorm) and compared in third and twelfth octaves."],
            ["Hits to the millisecond", "Onsets pinned to the start of the attack, moved by slicing just before each hit (no stretching), then found again by cross-correlation. Warped clips are timed through Live's warp markers."],
            ["Vocals and kicks", "Tempo from how the vocal repeats over bars, key from the notes it uses (Krumhansl profiles), kicks timed by their full sound and gated by the low band."],
          ].map(([t, l]) => (
            <div key={t} className="rounded-[18px] border border-edge bg-card p-5"><b className="text-[15px] font-medium">{t}</b><p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted">{l}</p></div>
          ))}
        </Rise>
        <Rise className="mt-3 flex flex-wrap gap-2 font-mono text-[12px] text-muted">
          {["Max for Live", "Node for Max", "Python 3.11 · FastAPI", "numpy · scipy · pyloudnorm", "Demucs", "React · TypeScript · Tailwind", "Muse Spark API"].map((t) => <span key={t} className="rounded-full border border-edge bg-card px-3 py-1">{t}</span>)}
        </Rise>
      </Section>

      {/* Results */}
      <Section id="results" rubric="Results" title="What we measured." dim="And what didn't work."
               sub="Every number here came from real audio this week, and the code that produced it is in the repo.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RESULTS.map((r, i) => <Rise key={r.label} delay={(i % 4) * 0.05} className="h-full"><Stat {...r} /></Rise>)}
        </div>
        <Rise className="mt-10"><span className="font-mono text-[12.5px] text-faint">Honest misses</span></Rise>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {MISSES.map((m, i) => (
            <Rise key={m.title} delay={i * 0.05} className="h-full">
              <div className="flex h-full flex-col gap-2 rounded-[18px] border border-edge bg-card p-5">
                <div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-hot/10 text-hot">{I.x(14)}</span><b className="text-[15px] font-medium">{m.title}</b></div>
                <p className="m-0 text-[13.5px] leading-relaxed text-muted">{m.line}</p>
              </div>
            </Rise>
          ))}
        </div>
      </Section>

      {/* Challenges */}
      <Section id="challenges" rubric="Challenges" title="What broke, and how we fixed it." sub="Found by using Aria on real songs inside Live, every day of the build.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {CHALLENGES.map((c, i) => (
            <Rise key={c.title} delay={(i % 2) * 0.05} className="h-full">
              <div className="flex h-full gap-4 rounded-[18px] border border-edge bg-card p-5">
                <span className="font-mono text-[13px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <div className="grid gap-1.5"><b className="text-[15.5px] font-medium">{c.title}</b><p className="m-0 text-[13.5px] leading-relaxed text-muted">{c.line}</p></div>
              </div>
            </Rise>
          ))}
        </div>
      </Section>

      {/* Try it */}
      <section className="border-t border-hairline py-24">
        <div className="mx-auto grid max-w-[1160px] gap-10 px-6 lg:grid-cols-[1fr_1fr]">
          <Rise>
            <span className="font-mono text-[12.5px] text-faint">Try it</span>
            <h2 className="mt-2.5 text-[clamp(30px,4vw,44px)] font-medium leading-[1.08] tracking-[-0.03em]">One script, then drag it in.</h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-muted">Mac, Ableton Live 12 Suite (Max for Live), Python 3.11. The script sets up the engine and puts Aria in Live's browser, under User Library. Drag it onto your Main track, last.</p>
            <div className="mt-6 flex gap-2.5">
              <a href={GITHUB} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-ink px-4 text-[14px] font-medium text-ground">{I.github(16)}Code on GitHub</a>
              <a href="/" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-edge bg-card px-4 text-[14px] font-medium">The product page</a>
            </div>
          </Rise>
          <Rise delay={0.08}>
            <pre className="m-0 overflow-x-auto rounded-[18px] border border-edge bg-card p-6 font-mono text-[13.5px] leading-relaxed text-ink">{`git clone ${GITHUB}
cd aria
./install.sh
# put MODEL_API_KEY in engine/.env
# Live: User Library > Presets > Audio Effects
#       > Max Audio Effect > Aria`}</pre>
          </Rise>
        </div>
      </section>

      <footer className="border-t border-hairline py-12">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 text-[13px] text-faint">
          <span className="flex items-center gap-2 text-ink"><span className="mark size-4" />Aria</span>
          <span>Built Oct 26 to Nov 4, 2026, for the Meta Global AI Developer Hackathon, Indie track.</span>
          <span className="ml-auto">No commercial music in the repo or the video.</span>
        </div>
      </footer>
    </div>
  );
}
