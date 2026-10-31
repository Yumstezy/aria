// The judges' page (Oct 31). Redone after Ian's look ("the original website was so much cleaner"): the same rhythm as
// the product page, one idea a section (a small label, a big headline with a dim second half, one short paragraph,
// one big visual), few boxes, and no pills. Its message is different: here's the proof. Every number was measured on
// real audio this week; every screenshot is the app on Ian's own song, loops and vocal (CLAUDE.md, "No invented data").
import { useEffect, useState, type ReactNode } from "react";
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
  bars: (s?: number) => svg(<path d="M5 20v-6M10 20V8M15 20v-9M20 20V5" />, s),
  flag: (s?: number) => svg(<path d="M5 21V4M5 4h11l-2 4 2 4H5" />, s),
  mic: (s?: number) => svg(<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, s),
  ear: (s?: number) => svg(<><path d="M7 9.5a5 5 0 0 1 10 0c0 3-2.4 4-3.3 5.8-.7 1.5-1 3.7-3.4 3.7A2.8 2.8 0 0 1 7.5 16" /><path d="M10 9.5a2 2 0 0 1 4 0" /></>, s),
  check: (s?: number) => svg(<path d="M5 12.5l4.5 4.5L19 7" />, s),
  speech: (s?: number) => svg(<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />, s),
  lanes: (s?: number) => svg(<><rect x="3" y="7" width="5" height="10" rx="1.5" /><rect x="10" y="7" width="5" height="10" rx="1.5" /><rect x="17" y="7" width="4" height="10" rx="1.5" /></>, s),
  github: (s?: number) => svg(<path d="M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.7 5.8 3 5.8 3a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.4c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />, s),
};

/* ---------- pieces, the same as the product page's ---------- */
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

function IconChip({ children }: { children: ReactNode }) {
  return <span className="grid size-9 flex-none place-items-center rounded-[11px] border border-edge bg-card-2">{children}</span>;
}

const You = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[88%] justify-self-end rounded-[14px] border border-edge px-3.5 py-2.5 text-[14px] leading-snug">{children}</div>
);
const Muse = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[88%] justify-self-start rounded-[14px] bg-ink px-3.5 py-2.5 text-[14px] leading-snug text-ground">{children}</div>
);

/* ---------- the hero's card: Muse asking before it acts. Both requests and both replies are real (Muse Spark, Oct 31) ---------- */
const ASKS = [
  { you: "put my vocal on beat", muse: "Which vocal track do you mean, VOCAL TEST or Vox 2?" },
  { you: "can u set my vocal test on time with my kick test", muse: "Got it, lining up your vocal with the kick." },
];
function HeroAsk() {
  const [step, setStep] = useState(0);   // each exchange: the request, then the reply
  useEffect(() => {
    if (step >= ASKS.length * 2) return;
    const t = setTimeout(() => setStep(step + 1), step === 0 ? 700 : 1400);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div className="grid w-full gap-2.5 rounded-[20px] border border-white/10 bg-black/40 p-4 text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="flex items-baseline gap-2 text-[14px]"><b className="font-semibold">Ask Muse</b><span className="font-mono text-[11.5px] text-faint">Muse Spark</span></div>
      {ASKS.flatMap((a, i) => [
        step > i * 2 && <motion.div key={`y${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid"><You>{a.you}</You></motion.div>,
        step > i * 2 + 1 && <motion.div key={`m${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid"><Muse>{a.muse}</Muse></motion.div>,
      ])}
      <div className="flex h-11 items-center gap-2.5 rounded-[12px] border-[1.5px] border-blue px-2 text-[13.5px]">
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-white/5 text-muted">{I.mic(14)}</span>
        <span className="text-faint">Ask, or tell Muse what to change</span>
      </div>
    </div>
  );
}

/* ---------- content ---------- */

const NAV: LiquidNavItem[] = [
  { label: "Why", href: "#why", icon: I.flag(), fx: "pop" },
  { label: "Meta AI", href: "#meta", icon: I.spark(), fx: "spin" },
  { label: "Proof", href: "#proof", icon: I.bars(), fx: "wave" },
  { label: "Tools", href: "#tools", icon: I.wave(), fx: "wave" },
  { label: "Build", href: "#build", icon: I.cog(), fx: "spin" },
];

const META: [string, string, Accent, ReactNode][] = [
  ["Muse Spark writes it", "Turns Aria's measurements into plain advice and a fix. It only ever sees measured numbers, and Aria checks its answer before anything happens.", "gold", I.spark()],
  ["Muse Spark does it", "21 actions in Live through tool calling, from an EQ cut to syncing a vocal. Each is checked against a fixed menu and limits, and each has Undo.", "blue", I.check()],
  ["Muse Spark asks", "When it can't tell which track you mean, it asks instead of guessing. It also names the parts of your song: Intro, Build, Drop.", "good", I.speech()],
  ["Muse Voice Transcribe hears it", "Hold a key and say it. \"Cut the mud on the bass\" came back as text in 1.4 seconds and ran like a typed request.", "white", I.mic()],
];

// Big number, then the sentence that says what it is and how it was measured
const PROOF: [string, string, string][] = [
  ["14.9 → 0 ms", "A perc loop following a kick loop, average lateness before and after Groove match.", "Ian's loops at 165 BPM. All 32 hits found again in the new file."],
  ["-6.9 dB", "A planted harsh boost, measured again after the fix at the same loudness. Marked Fixed.", "Test mix B against the clean control."],
  ["126.6 BPM", "A 126 BPM acapella's tempo, read from the vocal alone. It read 190 before we fixed it. Key: G# minor, right.", "No beat underneath, just the voice."],
  ["22 to 25 ms", "How far Ian's kick sits after Live's grid, depending on the bar. Aria finds it, so a vocal lands on the kick, not on the grid.", "His own drum and vocal stems."],
  ["-9.2 LUFS", "The live analyzer's loudness on Ian's drop, the same as the engine measured for that recording.", "Measured two ways, inside the device and in the engine."],
  ["5 of 5", "Real requests to Muse Spark that got the right tool, or a question when the track wasn't clear.", "Sync, groove at 70%, a sidechain, an unclear vocal, \"did that work\"."],
];

const MISSES = [
  "The mix model didn't ship. Trained on 99 mixes people rated, it scored 0.49 against 0.45 for loudness alone and failed our shuffle test. With Meta's Audiobox scores: 0.51, better than chance, but not reliably better than loudness. Raters liked louder mixes. Next we try the spectrum's shape alone, good against bad.",
  "One vocal still reads the wrong tempo (Ian's 148 BPM stem reads 192), so every reading comes with the next likely ones, and the song's own tempo is one tap.",
  "Without a reference, a broad low-mid boost is hard to hear: the rules found 1 of 3 planted problems. That's why the reference compare exists.",
];

const TOOLS: { crop: number; skip?: number; title: string; line: string; src: string; alt: string }[] = [
  { crop: 560, skip: 150, title: "Fix it, then prove it.", line: "Fix it asks Muse Spark for the change and it happens in Live. Check again plays the same bars at the same loudness: 3 dB or more lower is Fixed, and it moves out of the way. Less, and it comes back with Fix it again.", src: "/img/judges/fixed.png", alt: "A problem confirmed fixed by Before and after" },
  { crop: 420, skip: 530, title: "Two loops, one groove.", line: "Aria finds every hit to the millisecond and moves each one onto the grid or onto another loop's feel, in a new clip under the original. Nothing is stretched, and warped loops are timed the way you hear them.", src: "/img/judges/groove.png", alt: "Groove match: in time" },
  { crop: 560, skip: 410, title: "A vocal on your kick.", line: "Drop in an acapella. Aria reads its tempo and key, puts its first beat on your kick, and warps it with Live's own markers, reading them back to be sure they stuck.", src: "/img/judges/vocal.png", alt: "Vocal sync on the kick" },
  { crop: 560, skip: 300, title: "Ask, and it happens.", line: "Real requests from testing, typos and all. Each change has Undo, and anything Muse suggests on its own waits for a yes.", src: "/img/judges/ask.png", alt: "Ask Muse making changes in Live" },
];

const BUILD: [string, string][] = [
  ["The device", "Sits last on the Main track. Records bars for a check, reads and sets things through the Live API, and runs the live analyzer 20 times a second."],
  ["The bridge", "Node for Max. Carries messages between Live, the screens and the engine, and keeps every change on an Undo stack."],
  ["The engine", "Python, on this Mac. Measures the audio and talks to Muse Spark. It returns numbers; the words come from Muse."],
  ["The screens", "React, inside Live's own web view: the strip on the device, and the window docked over Live."],
];

const BROKE: [string, string][] = [
  ["The device came up blank.", "Live's audio was off, which stalls Max's message queue. The device now carries its own page that says so."],
  ["A result was too big to show.", "Max passes its web view about 32 KB; a groove result was 50 KB. Results are packed now, and anything too long gets a plain error."],
  ["Live dropped warp markers without a word.", "Aria now sets them in rounds, reads them back, and only says Synced when they're there."],
  ["Kicks read 30 ms late.", "A kick's low end builds slowly. Hits are timed by their full sound now."],
  ["A vocal read 190 for 126.", "Three beats at 190 last as long as two at 126. Counting repeats over whole bars fixed it."],
  ["\"On time\" became a sidechain.", "Muse got timing tools, a rule that timing never means ducking, and a question when the track isn't clear."],
];

const TEAM: [string, string, string][] = [
  ["Ian Barrie", "Everything: product, sound, the build, testing in Live every day", "https://github.com/Yumstezy"],
  ["Dylan Haman", "Product manager", "https://github.com/Hamqnn"],
  ["Raghav Agarwal", "The mix model: the rated mixes, the measurements, the experiments", "https://github.com/RaghavAgarwal18"],
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
      <header className="relative overflow-hidden pt-36 sm:pt-44">
        <div className="mx-auto max-w-[1160px] px-6 text-center">
          <Rise>
            <h1 className="mx-auto max-w-[920px] text-[clamp(44px,7vw,84px)] font-medium leading-[0.98] tracking-[-0.045em]">
              Aria hears your mix,<br /><span className="text-faint">and fixes it in Ableton.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[660px] text-[19px] leading-relaxed text-muted">
              An AI co-producer that sits on your Main track. It finds the sounds that clash or stick out, Meta's Muse Spark explains them and makes the fix in Live, and Aria measures again to prove it worked. Built in nine days. Here's the proof.
            </p>
            <div className="mt-8 flex justify-center gap-2.5"><Btn href="#proof" primary>See the results</Btn><Btn href={GITHUB}>{I.github(15)}Code</Btn></div>
          </Rise>
          <Rise delay={0.15} className="relative mx-auto mt-16 max-w-[1100px] pb-20">
            <Shot src="/img/judges/home.png" alt="Aria's Home on a real song" />
            <div className="mx-auto mt-4 max-w-[400px] md:absolute md:-left-6 md:bottom-4 md:mt-0 md:w-[400px]"><HeroAsk /></div>
          </Rise>
        </div>
      </header>

      {/* why */}
      <Section id="why" label="Why it matters" title="Finishing a song stops at the mix." dim="Aria is the second pair of ears."
               sub="Most producers learn to make a drop long before they learn why it sounds muddy next to the songs they love. The usual answers are an engineer, a course, or guessing with plugins. Aria works where they already are, in Ableton, on their own song, and tells them exactly what's wrong and where.">
        <Rise className="mt-12"><Shot src="/img/judges/mixcheck.png" alt="Mix check: three problems, where they are, against a reference" /></Rise>
        <Rise className="mt-5 grid gap-x-10 gap-y-3 text-[15px] leading-relaxed text-muted md:grid-cols-3">
          <p className="m-0"><b className="font-medium text-ink">Where, not a score.</b> The sound, the range and the bars: "Upper mids fuller than your reference, 2.8 to 3.6 kHz, bars 33 to 81."</p>
          <p className="m-0"><b className="font-medium text-ink">Plain words.</b> Muse Spark writes it the way a producer would say it, from measured numbers only.</p>
          <p className="m-0"><b className="font-medium text-ink">Never made up.</b> If Aria can't measure something, it says so. No example numbers, no canned advice.</p>
        </Rise>
      </Section>

      {/* Meta AI */}
      <Section id="meta" label="Meta AI" title="Muse Spark does the work you see." dim="Not a chat box on the side."
               sub="Every screen has Meta AI in it. And Muse never touches Live directly: it answers with actions from a fixed menu, Aria checks each one, and only then applies it, with Undo.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {META.map(([t, d, a, ic], i) => (
            <Rise key={t} delay={i * 0.06}><GlowCard accent={a} className="h-full">
              <IconChip>{ic}</IconChip><b className="mt-4 text-[17px] font-medium">{t}</b><p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
      </Section>

      {/* proof */}
      <Section id="proof" label="Proof" title="Measured on real songs." dim="Including what didn't work."
               sub="Every number below came from real audio this week, and the code that produced it is in the repo.">
        <div className="mt-12 border-t border-hairline">
          {PROOF.map(([n, line, how], i) => (
            <Rise key={n} delay={(i % 3) * 0.04}>
              <div className="grid items-baseline gap-x-10 gap-y-1 border-b border-hairline py-6 md:grid-cols-[260px_1fr]">
                <span className="text-[clamp(30px,3.6vw,42px)] font-medium leading-none tracking-[-0.03em]">{n}</span>
                <div><p className="m-0 text-[16.5px] leading-relaxed text-ink">{line}</p><p className="m-0 mt-1 text-[14px] text-faint">{how}</p></div>
              </div>
            </Rise>
          ))}
        </div>
        <Rise className="mt-14 grid gap-10 md:grid-cols-[260px_1fr]">
          <span className="text-[17px] font-medium">What didn't work</span>
          <div className="grid gap-4">{MISSES.map((m) => <p key={m} className="m-0 text-[15.5px] leading-relaxed text-muted">{m}</p>)}</div>
        </Rise>
      </Section>

      {/* tools */}
      <Section id="tools" label="The tools" title="Seven tools in one device." dim="These four are new this week."
               sub="Alongside Mix check, the reference compare, Arrangement and the live analyzer.">
        <div className="mt-14 grid gap-20">
          {TOOLS.map((t, i) => (
            <Rise key={t.title} className="grid items-center gap-10 lg:grid-cols-2">
              <div className={cn("max-w-[460px]", i % 2 === 1 && "lg:order-2 lg:justify-self-end")}>
                <h3 className="m-0 text-[28px] font-medium leading-tight tracking-[-0.02em]">{t.title}</h3>
                <p className="m-0 mt-3 text-[16.5px] leading-relaxed text-muted">{t.line}</p>
              </div>
              {/* the top of the docked window, where the answer is, faded at the bottom */}
              <div className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[18px] border border-edge bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]" style={{ maxHeight: t.crop }}>
                <img src={t.src} alt={t.alt} className="block w-full" loading="lazy" style={{ marginTop: -(t.skip ?? 0) }} />
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(transparent, var(--color-ground))" }} />
              </div>
            </Rise>
          ))}
        </div>
        <Rise className="mt-24 grid gap-5 lg:grid-cols-2">
          <div><Shot src="/img/judges/arrangement.png" alt="Arrangement: the parts of two songs, named by Muse Spark" />
            <p className="m-0 mt-4 text-[15px] leading-relaxed text-muted"><b className="font-medium text-ink">Arrangement.</b> Aria hears the whole song and Muse Spark names its parts, so a check compares your drop with their drop.</p></div>
          <div><Shot src="/img/judges/analyzer.png" alt="Live analyzer" />
            <p className="m-0 mt-4 text-[15px] leading-relaxed text-muted"><b className="font-medium text-ink">Live analyzer.</b> The spectrum against your reference, loudness, where the sound sits in stereo, and a waveform colored by its lows and highs.</p></div>
        </Rise>
      </Section>

      {/* build */}
      <Section id="build" label="How it's built" title="Four parts, one rule." dim="Report only what was measured."
               sub="A Max for Live device, a Node bridge, a Python engine and React screens, all running on the producer's own Mac.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BUILD.map(([t, d], i) => (
            <Rise key={t} delay={i * 0.06}><GlowCard accent="white" className="h-full">
              <b className="text-[17px] font-medium">{t}</b><p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
        <Rise className="mt-20"><span className="text-[17px] font-medium">What broke, and how we fixed it</span></Rise>
        <div className="mt-6 grid gap-x-12 border-t border-hairline md:grid-cols-2">
          {BROKE.map(([t, d]) => (
            <Rise key={t}><div className="border-b border-hairline py-5"><p className="m-0 text-[15.5px] font-medium text-ink">{t}</p><p className="m-0 mt-1.5 text-[14.5px] leading-relaxed text-muted">{d}</p></div></Rise>
          ))}
        </div>
      </Section>

      {/* team */}
      <section className="border-t border-hairline py-24">
        <div className="mx-auto max-w-[1160px] px-6">
          <Rise>
            <span className="font-mono text-[12.5px] text-faint">Who built it</span>
            <h2 className="mt-2.5 text-[clamp(30px,4vw,46px)] font-medium leading-[1.08] tracking-[-0.03em]">Three people, nine days.</h2>
          </Rise>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {TEAM.map(([name, role, gh], i) => (
              <Rise key={name} delay={i * 0.06}>
                <a href={gh} className="flex h-full flex-col gap-2 rounded-[18px] border border-edge bg-card p-5 transition-colors hover:bg-card-2">
                  <b className="text-[17px] font-medium">{name}</b>
                  <span className="text-[14.5px] leading-relaxed text-muted">{role}</span>
                  <span className="mt-auto flex items-center gap-1.5 pt-2 text-[13px] text-faint">{I.github(14)}{gh.replace("https://github.com/", "")}</span>
                </a>
              </Rise>
            ))}
          </div>
          <Rise className="mt-12 flex flex-wrap gap-2.5"><Btn href={GITHUB} primary>{I.github(15)}Code on GitHub</Btn><Btn href="/">The product page</Btn></Rise>
        </div>
      </section>

      <footer className="border-t border-hairline py-12">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 text-[13px] text-faint">
          <span className="flex items-center gap-2 text-ink"><span className="mark size-4" />Aria</span>
          <span>Built Oct 26 to Nov 4, 2026, for the Meta Global AI Developer Hackathon.</span>
        </div>
      </footer>
    </div>
  );
}
