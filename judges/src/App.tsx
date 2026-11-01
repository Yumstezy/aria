// The judges' page, on its own site since Oct 31 (Ian: "make this website its own thing like a different deploy").
// The nav and hero are the SaaS template Ian picked; the hero's picture is a drawing of Aria running in Live until
// the demo video is in. Every number was measured on real audio and every screenshot is the app on Ian's own song,
// loops and vocal (CLAUDE.md, "No invented data").
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Navigation, Hero, ButtonLink, ArrowRight, type NavLink } from "@/components/ui/saa-s-template";
import { GlowCard, type Accent } from "@/components/ui/glow-card";
import { LiveMockup } from "@/components/ui/live-mockup";
import { HowItWorks } from "@/components/how-it-works";
import { cn } from "@/lib/utils";

const GITHUB = "https://github.com/Yumstezy/aria";
const PRODUCT = "https://aria-sigma-gilt.vercel.app";
// The demo video, when Ian has recorded it: a file in public/ (like "/demo.mp4"). The section shows only once it's set.
const DEMO_VIDEO: string | null = null;

/* ---------- icons: the app's own line icons ---------- */
const svg = (d: ReactNode, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  spark: (s?: number) => svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />, s),
  mic: (s?: number) => svg(<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, s),
  check: (s?: number) => svg(<path d="M5 12.5l4.5 4.5L19 7" />, s),
  speech: (s?: number) => svg(<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />, s),
  github: (s?: number) => svg(<path d="M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.7 5.8 3 5.8 3a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.4c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />, s),
};

/* ---------- pieces ---------- */
function Rise({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay, ease: [0.32, 0.72, 0, 1] }}>{children}</motion.div>
  );
}

function Section({ id, label, title, dim, sub, children }: { id?: string; label: string; title: string; dim?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-hairline py-24 sm:py-28">
      <div className="mx-auto max-w-[1160px] px-6">
        <Rise>
          <span className="text-[13px] font-medium text-faint">{label}</span>
          <h2 className="mt-2.5 max-w-[800px] text-[clamp(30px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.04em]">
            <span className="fade-text">{title}</span>{dim && <span className="text-faint"> {dim}</span>}
          </h2>
          {sub && <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-muted">{sub}</p>}
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

function IconChip({ children }: { children: ReactNode }) {
  return <span className="grid size-9 flex-none place-items-center rounded-[11px] border border-edge bg-card-2">{children}</span>;
}

const You = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[88%] justify-self-end rounded-[14px] border border-edge px-3.5 py-2.5 text-[14px] leading-snug">{children}</div>
);
const Muse = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[88%] justify-self-start rounded-[14px] bg-white px-3.5 py-2.5 text-[14px] leading-snug text-black">{children}</div>
);

/* ---------- Muse asking before it acts. Both requests and both replies are real (Muse Spark, Oct 31) ---------- */
const ASKS = [
  { you: "put my vocal on beat", muse: "Which vocal track do you mean, VOCAL TEST or Vox 2?" },
  { you: "can u set my vocal test on time with my kick test", muse: "Got it, lining up your vocal with the kick." },
];
function AskCard() {
  const [step, setStep] = useState(0);   // each exchange: the request, then the reply
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!seen || step >= ASKS.length * 2) return;
    const t = setTimeout(() => setStep(step + 1), step === 0 ? 400 : 1400);
    return () => clearTimeout(t);
  }, [step, seen]);
  return (
    <motion.div onViewportEnter={() => setSeen(true)} viewport={{ once: true }}
                className="grid min-h-[300px] content-start gap-2.5 rounded-[20px] border border-edge bg-card p-5">
      <div className="flex items-baseline gap-2 text-[14px]"><b className="font-semibold">Ask Muse</b><span className="font-mono text-[11.5px] text-faint">Muse Spark</span></div>
      {ASKS.flatMap((a, i) => [
        step > i * 2 && <motion.div key={`y${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid"><You>{a.you}</You></motion.div>,
        step > i * 2 + 1 && <motion.div key={`m${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid"><Muse>{a.muse}</Muse></motion.div>,
      ])}
      <div className="mt-auto flex h-11 items-center gap-2.5 rounded-[12px] border-[1.5px] border-blue px-2 text-[13.5px]">
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-white/5 text-muted">{I.mic(14)}</span>
        <span className="text-faint">Ask, or tell Muse what to change</span>
      </div>
    </motion.div>
  );
}

/* ---------- content ---------- */

const NAV: NavLink[] = [
  { label: "How it works", href: "#how" },
  { label: "Meta AI", href: "#meta" },
  { label: "Tools", href: "#tools" },
  { label: "Build", href: "#build" },
  { label: "Team", href: "#team" },
];

const META: [string, string, Accent, ReactNode][] = [
  ["Muse Spark writes it", "Turns Aria's measurements into plain advice and a fix. It only ever sees measured numbers, and Aria checks its answer before anything happens.", "gold", I.spark()],
  ["Muse Spark does it", "21 actions in Live through tool calling, from an EQ cut to syncing a vocal. Each is checked against a fixed menu and limits, and each has Undo.", "blue", I.check()],
  ["Muse Spark asks", "When it can't tell which track you mean, it asks instead of guessing. It also names the parts of your song: Intro, Build, Drop.", "good", I.speech()],
  ["Muse Voice Transcribe hears it", "Hold a key and say it. \"Cut the mud on the bass\" came back as text in 1.4 seconds and ran like a typed request.", "white", I.mic()],
];

const TOOLS: { crop: number; skip?: number; title: string; line: string; src: string; alt: string }[] = [
  { crop: 560, skip: 150, title: "Fix it, then prove it.", line: "Fix it asks Muse Spark for the change and it happens in Live. Check again plays the same bars at the same loudness: 3 dB or more lower is Fixed, and it moves out of the way. Less, and it comes back with Fix it again.", src: "/img/fixed.png", alt: "A problem confirmed fixed by Before and after" },
  { crop: 420, skip: 530, title: "Two loops, one groove.", line: "Aria finds every hit to the millisecond and moves each one onto the grid or onto another loop's feel, in a new clip under the original. A perc loop 14.9 ms behind its kick came back at 0, all 32 hits. Nothing is stretched.", src: "/img/groove.png", alt: "Groove match: in time" },
  { crop: 560, skip: 410, title: "A vocal on your kick.", line: "Drop in an acapella. Aria reads its tempo and key, puts its first beat on your kick, not just the grid (Ian's kick sits 22 to 25 ms late), and warps it with Live's own markers, reading them back to be sure they stuck.", src: "/img/vocal.png", alt: "Vocal sync on the kick" },
  { crop: 560, skip: 300, title: "Ask, and it happens.", line: "Real requests from testing, typos and all. 5 of 5 got the right tool, or a question when the track wasn't clear. Each change has Undo.", src: "/img/ask.png", alt: "Ask Muse making changes in Live" },
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

const MISSES = [
  "The mix model didn't ship. Trained on 99 mixes people rated, it scored 0.49 against 0.45 for loudness alone and failed our shuffle test. With Meta's Audiobox scores: 0.51, better than chance, but not reliably better than loudness. Next we try the spectrum's shape alone, good against bad.",
  "One vocal still reads the wrong tempo (Ian's 148 BPM stem reads 192), so every reading comes with the next likely ones, and the song's own tempo is one tap.",
  "Without a reference, a broad low-mid boost is hard to hear: the rules found 1 of 3 planted problems. That's why the reference compare exists.",
];

const TEAM: [string, string, string][] = [
  ["Ian Barrie", "Everything: product, sound, the build, testing in Live every day", "https://github.com/Yumstezy"],
  ["Dylan Haman", "Product manager", "https://github.com/Hamqnn"],
  ["Raghav Agarwal", "The mix model: the rated mixes, the measurements, the experiments", "https://github.com/RaghavAgarwal18"],
];

/* ---------- the page ---------- */

export default function App() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Navigation
        logo={<a href="#" className="flex items-center gap-2.5"><span className="mark size-[22px]" />Aria</a>}
        links={NAV}
        actions={<>
          <ButtonLink variant="ghost" size="sm" href={GITHUB}>{I.github(15)}GitHub</ButtonLink>
          <ButtonLink variant="default" size="sm" href="#how">How it works</ButtonLink>
        </>}
      />

      <Hero
        title={<>Aria hears your mix,<br />and fixes it in Ableton.</>}
        sub={<>An AI co-producer that runs inside Live, on your Main track. It finds the sounds that clash or stick out, Meta's Muse Spark explains them and makes the fix, and Aria measures again to prove it worked.</>}
        cta={<>
          <ButtonLink variant="gradient" size="lg" className="rounded-lg" href="#how">See how it works<ArrowRight /></ButtonLink>
          <ButtonLink variant="ghost" size="lg" className="rounded-lg" href={GITHUB}>{I.github(17)}Code on GitHub</ButtonLink>
        </>}
      >
        <LiveMockup />
        <p className="mt-5 text-center text-[13px] text-faint">A drawing of Aria in Live. The Aria screens in it are real screenshots.</p>
      </Hero>

      {DEMO_VIDEO && (
        <Section id="demo" label="Watch it run" title="Three minutes in Ableton." dim="Nothing faked.">
          <Rise className="mt-12 overflow-hidden rounded-[22px] border border-edge bg-card">
            <video src={DEMO_VIDEO} controls playsInline preload="metadata" className="block aspect-video w-full" />
          </Rise>
        </Section>
      )}

      <Section id="how" label="How it works" title="One problem, start to finish." dim="Heard, explained, fixed, proved."
               sub="This is a real one, from Ian's own song. Aria's loop is the same for every problem it finds.">
        <HowItWorks />
      </Section>

      <Section id="why" label="Why it matters" title="Finishing a song stops at the mix." dim="Aria is the second pair of ears."
               sub="Most producers learn to make a drop long before they learn why it sounds muddy next to the songs they love. The usual answers are an engineer, a course, or guessing with plugins. Aria works where they already are, in Ableton, on their own song.">
        <Rise className="mt-12"><Shot src="/img/mixcheck.png" alt="Mix check: three problems, where they are, against a reference" /></Rise>
        <Rise className="mt-5 grid gap-x-10 gap-y-3 text-[15px] leading-relaxed text-muted md:grid-cols-3">
          <p className="m-0"><b className="font-medium text-ink">Where, not a score.</b> The sound, the range and the bars: "Upper mids fuller than your reference, 2.8 to 3.6 kHz, bars 33 to 81."</p>
          <p className="m-0"><b className="font-medium text-ink">Plain words.</b> Muse Spark writes it the way a producer would say it, from measured numbers only.</p>
          <p className="m-0"><b className="font-medium text-ink">Never made up.</b> If Aria can't measure something, it says so. No example numbers, no canned advice.</p>
        </Rise>
      </Section>

      <Section id="meta" label="Meta AI" title="Muse Spark does the work you see." dim="Not a chat box on the side."
               sub="Muse never touches Live directly: it answers with actions from a fixed menu, Aria checks each one, and only then applies it, with Undo.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {META.map(([t, d, a, ic], i) => (
            <Rise key={t} delay={i * 0.06}><GlowCard accent={a} className="h-full">
              <IconChip>{ic}</IconChip><b className="mt-4 text-[16.5px] font-medium">{t}</b><p className="mt-2 text-[14px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
        <Rise className="mt-3 grid items-center gap-10 rounded-[20px] lg:grid-cols-[1fr_420px]">
          <div className="max-w-[460px]">
            <h3 className="m-0 text-[24px] font-medium leading-tight tracking-[-0.03em]">It asks before it guesses.</h3>
            <p className="m-0 mt-3 text-[15.5px] leading-relaxed text-muted">Two tracks had "vocal" in the name, so Muse Spark asked which one. The next request named it, and the sync ran. Both replies are Muse Spark's own.</p>
          </div>
          <AskCard />
        </Rise>
      </Section>

      <Section id="tools" label="The tools" title="Seven tools in one device." dim="These four are new this week."
               sub="Alongside Mix check, the reference compare, Arrangement and the live analyzer.">
        <div className="mt-14 grid gap-20">
          {TOOLS.map((t, i) => (
            <Rise key={t.title} className="grid items-center gap-10 lg:grid-cols-2">
              <div className={cn("max-w-[460px]", i % 2 === 1 && "lg:order-2 lg:justify-self-end")}>
                <h3 className="m-0 text-[28px] font-medium leading-tight tracking-[-0.03em]">{t.title}</h3>
                <p className="m-0 mt-3 text-[16px] leading-relaxed text-muted">{t.line}</p>
              </div>
              {/* the top of the docked window, where the answer is, faded at the bottom */}
              <div className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[18px] border border-edge bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]" style={{ maxHeight: t.crop }}>
                <img src={t.src} alt={t.alt} className="block w-full" loading="lazy" style={{ marginTop: -(t.skip ?? 0) }} />
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(transparent, #000)" }} />
              </div>
            </Rise>
          ))}
        </div>
        <Rise className="mt-24 grid gap-5 lg:grid-cols-2">
          <div><Shot src="/img/arrangement.png" alt="Arrangement: the parts of two songs, named by Muse Spark" />
            <p className="m-0 mt-4 text-[15px] leading-relaxed text-muted"><b className="font-medium text-ink">Arrangement.</b> Aria hears the whole song and Muse Spark names its parts, so a check compares your drop with their drop.</p></div>
          <div><Shot src="/img/analyzer.png" alt="Live analyzer" />
            <p className="m-0 mt-4 text-[15px] leading-relaxed text-muted"><b className="font-medium text-ink">Live analyzer.</b> The spectrum against your reference, loudness, where the sound sits in stereo, and a waveform colored by its lows and highs.</p></div>
        </Rise>
      </Section>

      <Section id="build" label="How it's built" title="Four parts, one rule." dim="Report only what was measured."
               sub="A Max for Live device, a Node bridge, a Python engine and React screens, all running on the producer's own Mac.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BUILD.map(([t, d], i) => (
            <Rise key={t} delay={i * 0.06}><GlowCard accent="white" className="h-full">
              <b className="text-[16.5px] font-medium">{t}</b><p className="mt-2 text-[14px] leading-relaxed text-muted">{d}</p>
            </GlowCard></Rise>
          ))}
        </div>
        <Rise className="mt-20"><span className="text-[17px] font-medium">What broke, and how we fixed it</span></Rise>
        <div className="mt-6 grid gap-x-12 border-t border-hairline md:grid-cols-2">
          {BROKE.map(([t, d]) => (
            <Rise key={t}><div className="border-b border-hairline py-5"><p className="m-0 text-[15px] font-medium text-ink">{t}</p><p className="m-0 mt-1.5 text-[14px] leading-relaxed text-muted">{d}</p></div></Rise>
          ))}
        </div>
        <Rise className="mt-16 grid gap-6 md:grid-cols-[260px_1fr]">
          <span className="text-[17px] font-medium">What didn't work</span>
          <div className="grid gap-4">{MISSES.map((m) => <p key={m} className="m-0 text-[15px] leading-relaxed text-muted">{m}</p>)}</div>
        </Rise>
      </Section>

      <section id="team" className="scroll-mt-20 border-t border-hairline py-24">
        <div className="mx-auto max-w-[1160px] px-6">
          <Rise>
            <span className="text-[13px] font-medium text-faint">Who built it</span>
            <h2 className="fade-text mt-2.5 text-[clamp(30px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.04em]">Three people, nine days.</h2>
          </Rise>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {TEAM.map(([name, role, gh], i) => (
              <Rise key={name} delay={i * 0.06}>
                <a href={gh} className="flex h-full flex-col gap-2 rounded-[18px] border border-edge bg-card p-5 transition-colors hover:bg-card-2">
                  <b className="text-[16.5px] font-medium">{name}</b>
                  <span className="text-[14px] leading-relaxed text-muted">{role}</span>
                  <span className="mt-auto flex items-center gap-1.5 pt-2 text-[13px] text-faint">{I.github(14)}{gh.replace("https://github.com/", "")}</span>
                </a>
              </Rise>
            ))}
          </div>
          <Rise className="mt-12 flex flex-wrap gap-3">
            <ButtonLink variant="gradient" size="lg" className="rounded-lg" href={GITHUB}>{I.github(17)}Code on GitHub</ButtonLink>
            <ButtonLink variant="ghost" size="lg" className="rounded-lg" href={PRODUCT}>The product page<ArrowRight /></ButtonLink>
          </Rise>
        </div>
      </section>

      <footer className="border-t border-hairline py-12">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 text-[13px] text-faint">
          <span className="flex items-center gap-2 text-ink"><span className="mark size-4" />Aria</span>
          <span>Built Oct 26 to Nov 4, 2026, for the Meta Global AI Developer Hackathon.</span>
        </div>
      </footer>
    </main>
  );
}
