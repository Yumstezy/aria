// The judges' page, on its own site since Oct 31 (Ian: "make this website its own thing like a different deploy").
// The nav and hero are the SaaS template Ian picked; the hero's picture is a drawing of Aria running in Live until
// the demo video is in. Every number was measured on real audio and every screenshot is the app on Ian's own song,
// loops and vocal (CLAUDE.md, "No invented data").
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Hero, ArrowRight } from "@/components/ui/saa-s-template";
import { LiquidNavbar, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";
import { GlowCard, type Accent } from "@/components/ui/glow-card";
import { LiveMockup } from "@/components/ui/live-mockup";
import { HowItWorks } from "@/components/how-it-works";
import { Button } from "@/components/ui/button";
import { TeamLanyardRail, type LanyardMember } from "@/components/ui/team-lanyard-rail";
import { TryIt } from "@/components/try-it";
import { cn } from "@/lib/utils";
import { DEMO_VIDEO, DOWNLOAD, GITHUB } from "@/links";
import { DemoVideo } from "@/components/demo-video";


const PRODUCT = "https://aria-sigma-gilt.vercel.app";
const RELEASES = "https://github.com/Yumstezy/aria/releases/latest";

/* ---------- icons: the app's own line icons ---------- */
const svg = (d: ReactNode, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  spark: (s?: number) => svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />, s),
  mic: (s?: number) => svg(<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, s),
  check: (s?: number) => svg(<path d="M5 12.5l4.5 4.5L19 7" />, s),
  speech: (s?: number) => svg(<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />, s),
  wave: (s?: number) => svg(<path d="M3 15c3 0 3-7 6-7s3 9 6 9 3-6 6-6" />, s),
  knob: (s?: number) => svg(<><circle cx="12" cy="12" r="7" /><path d="M12 12 15.5 8.5" /></>, s),
  split: (s?: number) => svg(<path d="M4 6h6l4 6-4 6H4M20 6h-4M20 18h-4M14 12h6" />, s),
  user: (s?: number) => svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>, s),
  download: (s?: number) => svg(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, s),
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

// The product site's liquid glass navbar (Ian, Oct 31: "take the nav bar from the first site")
const NAV: LiquidNavItem[] = [
  { label: "Try it", href: "#try", icon: I.speech(), fx: "pop" },
  { label: "How", href: "#how", icon: I.wave(), fx: "wave" },
  { label: "Meta AI", href: "#meta", icon: I.spark(), fx: "spin" },
  { label: "Tools", href: "#tools", icon: I.knob(), fx: "spin" },
  { label: "Build", href: "#build", icon: I.split(), fx: "pop" },
  { label: "Team", href: "#team", icon: I.user(), fx: "pop" },
];

const META: [string, string, Accent, ReactNode][] = [
  ["Muse Spark writes it", "Turns Aria's measurements into plain advice and a fix. It only ever sees measured numbers, and Aria checks its answer before anything happens.", "gold", I.spark()],
  ["Muse Spark does it", "24 tools in Live through tool calling: EQ, faders, stock devices, 26 custom racks, sidechain, vocal sync. Each is checked against a fixed menu and limits, and each has Undo.", "blue", I.check()],
  ["Muse Spark asks", "When it can't tell which track you mean, it asks instead of guessing. It also names the parts of your song: Intro, Build, Drop.", "good", I.speech()],
  ["Muse Voice Transcribe hears it", "Hold a key and say it. \"Cut the mud on the bass\" came back as text in 1.4 seconds and ran like a typed request.", "white", I.mic()],
];

const TOOLS: { crop: number; skip?: number; title: string; line: string; src: string; alt: string }[] = [
  { crop: 560, skip: 150, title: "Fix it, then prove it.", line: "Fix it asks Muse Spark for the change and it happens in Live. Check again plays the same bars at the same loudness: 3 dB or more lower is Fixed, and it moves out of the way. Less, and it comes back with Fix it again.", src: "/img/fixed.png", alt: "A problem confirmed fixed by Before and after" },
  { crop: 420, skip: 450, title: "Two loops, one groove.", line: "Aria finds every hit to the millisecond and moves each one onto the grid or onto another loop's feel, in a new clip under the original. A perc loop 14.9 ms behind its kick came back at 0, all 32 hits. Nothing is stretched.", src: "/img/groove.png", alt: "Groove match: in time" },
  { crop: 560, skip: 410, title: "A vocal on your kick.", line: "Drop in an acapella. Aria reads its tempo and key, puts its first beat on your kick, not just the grid (Ian's kick sits 22 to 25 ms late), and warps it with Live's own markers, reading them back to be sure they stuck.", src: "/img/vocal.png", alt: "Vocal sync on the kick" },
  { crop: 560, skip: 40, title: "Ask, and it happens.", line: "Real requests from testing, typos and all. 5 of 5 got the right tool, or a question when the track wasn't clear. Each change has Undo.", src: "/img/chat.png", alt: "Ask Muse making changes in Live" },
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


// The same three people as badges on a lanyard rail (Ian, Nov 1), with the photos and LinkedIn links Ian sent
// (public/img/team, cropped square around the face).
const BADGES: LanyardMember[] = [
  { id: "ian", name: "Ian Barrie", role: "Builder", team: "Aria · Build", tone: 1, image: "/img/team/ian.jpg",
    bio: "Built Aria end to end: the engine, Muse Spark, the devices in Live and the sites.",
    tags: ["Engine", "Max for Live", "Security"], links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/ianabarrie/" }, { label: "GitHub", href: "https://github.com/Yumstezy" }] },
  { id: "dylan", name: "Dylan Haman", role: "Product manager", team: "Aria · Product", tone: 2, image: "/img/team/dylan.jpg",
    bio: "Organized the team, ran planning and check-ins, kept the schedule.",
    tags: ["Planning", "Hand-offs"], links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/dylan-haman-735116266/" }, { label: "GitHub", href: "https://github.com/Hamqnn" }] },
  { id: "raghav", name: "Raghav Agarwal", role: "Machine learning", team: "Aria · Mix model", tone: 3, image: "/img/team/raghav.jpg",
    bio: "Built the mix model: rated mixes, their measurements, the ordinal model.",
    tags: ["Mix model", "Audiobox"], links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/raghav-agarwal-csu/" }, { label: "GitHub", href: "https://github.com/RaghavAgarwal18" }] },
];

// Getting Aria into Live: what's in Aria-mac.zip and what "Install Aria" does (install.sh)
const GET: [string, ReactNode][] = [
  ["Download and unzip", <>Move the Aria folder where it will stay, like Documents. Live's browser links to it.</>],
  ["Double-click Install Aria", <>It sets up the engine and puts Aria in Live's browser. The first time, macOS may ask: right-click it and choose Open.</>],
  ["Drag Aria onto Main", <>In Live: User Library, Presets, Audio Effects, Max Audio Effect, Aria. Drop it last on your Main track and press Check mix.</>],
];

/* ---------- the page ---------- */

// Which section you're in, for the navbar (Ian, Nov 1: "the nav bar change when u scroll depending on where ur at"):
// the last one whose top has passed 40% of the window
function useSectionInView(ids: string[]) {
  const [at, setAt] = useState(0);
  const hold = useRef(0);   // after a click, the nav stays on the pick while the page scrolls past the others
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      if (performance.now() < hold.current) return;
      const line = window.innerHeight * 0.4;
      let i = 0;
      ids.forEach((id, k) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= line) i = k; });
      setAt(i);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, [ids]);
  const pick = (i: number) => { hold.current = performance.now() + 1200; setAt(i); };
  return [at, pick] as const;
}
const NAV_IDS = NAV.map((n) => n.href!.slice(1));

export default function App() {
  const [navAt, setNavAt] = useSectionInView(NAV_IDS);
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-black via-black/70 to-transparent pb-5">
        <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-6 pt-4">
          <a href="#" className="flex items-center gap-2.5 text-[17px] font-semibold"><span className="mark size-[22px]" />Aria</a>
          <div className="flex flex-1 justify-center"><LiquidNavbar tone="dark" items={NAV} active={navAt} onChange={(i) => setNavAt(i)} /></div>
          <a href="/demo" className="hidden text-[14px] text-muted transition-colors hover:text-ink md:inline">Demos</a>
          <Button href={DOWNLOAD} variant="filled" size="sm" className="hidden sm:inline-flex">{I.download(16)}Download</Button>
        </div>
      </header>

      <Hero
        title={<>Aria hears your mix,<br />and fixes it in Ableton.</>}
        sub={<>An AI co-producer that runs inside Live, on your Main track. It finds the sounds that clash or stick out, Meta's Muse Spark explains them and makes the fix, and Aria measures again to prove it worked.</>}
        cta={<>
          <Button href={DOWNLOAD} variant="filled" size="md">{I.download(18)}Download for Mac</Button>
          <Button href="#try" variant="outlined" size="md">Try it right here<ArrowRight /></Button>
        </>}
      >
        <LiveMockup />
        <p className="mt-5 text-center text-[13px] text-faint">A drawing of Aria in Live. The clips are Ian's song, drawn from its stems, with the parts Muse Spark named on it. The Aria screens are real screenshots, the chat with real requests.</p>
      </Hero>

      {DEMO_VIDEO && (
        <Section id="demo" label="Watch it run" title="Three minutes in Ableton." dim="Nothing faked.">
          <Rise className="mt-12"><DemoVideo /></Rise>
        </Section>
      )}

      <Section id="try" label="Try it" title="Hear Aria fix a real mix." dim="No Ableton needed."
               sub="A house demo Ian made, before mixing. Four steps: listen, let Aria check it, fix it, then compare.">
        <TryIt />
        <p className="mt-4 text-[14px] text-faint">Also on its own page, with the video of Aria in Ableton: <a href="/demo" className="text-muted underline underline-offset-4 hover:text-ink">aria-judges.vercel.app/demo</a></p>
      </Section>

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
              {/* the top of the docked window, where the answer is, faded at the bottom. A fixed height and no lazy
                  loading: a lazy image clipped to an empty box never loads (Ian, Oct 31: "why is this empty") */}
              <div className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[18px] border border-edge bg-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]" style={{ height: t.crop }}>
                <img src={t.src} alt={t.alt} className="block w-full" style={{ marginTop: -(t.skip ?? 0) }} />
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

      <Section id="get" label="Get Aria" title="Download, double-click, drag." dim="Then it's in Live's browser."
               sub={<>For a Mac with Ableton Live 12 Suite (Max for Live) and Python 3.11. Add your Meta Model API key for Muse Spark's advice; without it Aria still shows what it measured.</>}>
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {GET.map(([title, text], i) => (
            <Rise key={title} delay={i * 0.06} className="rounded-[18px] border border-edge bg-card p-6">
              <span className="font-mono text-[12px] text-faint">{i + 1}</span>
              <b className="mt-1 block text-[18px] font-medium tracking-[-0.02em]">{title}</b>
              <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-muted">{text}</p>
            </Rise>
          ))}
        </div>
        <Rise className="mt-8 flex flex-wrap items-center gap-3">
          <Button href={DOWNLOAD} variant="filled" size="md">{I.download(18)}Download for Mac</Button>
          <a href={RELEASES} className="text-[14px] text-muted underline-offset-4 hover:text-white hover:underline">Release notes on GitHub</a>
        </Rise>
      </Section>

      <section id="team" className="scroll-mt-20 border-t border-hairline py-24">
        <div className="mx-auto max-w-[1160px] px-6">
          <Rise>
            <span className="text-[13px] font-medium text-faint">Who built it</span>
            <h2 className="fade-text mt-2.5 text-[clamp(30px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.04em]">Three people, nine days.</h2>
          </Rise>
          <Rise className="mt-6">
            <TeamLanyardRail items={BADGES} autoplay caption="Hover a badge to meet someone, click to flip it, or pull it down." />
          </Rise>
          <Rise className="mt-12 flex flex-wrap gap-3">
            <Button href={DOWNLOAD} variant="filled" size="md">{I.download(18)}Download for Mac</Button>
            <Button href={GITHUB} variant="tonal" size="md">{I.github(18)}Code on GitHub</Button>
            <Button href={PRODUCT} variant="outlined" size="md">The product page<ArrowRight /></Button>
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
