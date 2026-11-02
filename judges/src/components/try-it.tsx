// "Try it": a small Live with Aria in it, on the page (Nov 1, Ian: "a mini Ableton in the website so the judges can
// see the changes made using the software"; then "it blends into the site ... the check mix, the text box and
// everything should work"). Nothing here is simulated:
//   - the five tracks are the unmixed stems in test-pack/sample, their waveforms from their own peaks (demo-tracks.json)
//   - every step is a recorded run (demo-run.json): Aria's findings, Muse Spark's words and the changes Aria made, as
//     Aria logged them; each "after" is what Live played after that step, exported from Live
//   - the spectrum is measured live, in the browser, from whatever is playing
// The page replays the run: Check mix and Fix it play back what really happened, faster than real time, and the
// chat runs the recorded request that matches what's typed. It says so in the window. A short guided tour (Ian, Nov 1:
// "like a tutorial where the judge has to navigate it with little tips") leads to the Before and After reveal.
// Waveforms are drawn the way the app's Live analyzer draws them (Window.tsx): mirrored, smooth, colored by where the
// sound is; judges/scripts/make_demo_data.py measured them from the stems.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import song from "@/demo-tracks.json";
import run from "@/demo-run.json";
import reveal from "@/demo-reveal.json";

type Done = { text: string; ok: boolean };
type Step = {
  id: string; kind: "check" | "fix" | "ask"; label: string; ask: string | null; reply: string | null;
  note?: { short: string; text: string }; finding?: { kind: string; hz: number; hz_range: number[]; diff_db: number; bars: number[] };
  bands?: { name: string; diff_db: number }[]; done: Done[]; devices: { track: string; name: string }[]; audio: string | null;
  measured?: string | null; keywords?: string[]; button?: string;
};
const STEPS = run.steps as Step[];
const CHECK = STEPS.find((s) => s.kind === "check")!;
const FIX = STEPS.find((s) => s.kind === "fix") ?? null;
const ASKS = STEPS.filter((s) => s.kind === "ask");

// What each step means for someone who has never mixed a song. Written for the page; the numbers come from the run.
const PLAIN: Record<string, (s: Step) => string> = {
  check: () => "Aria listened to each track on its own. The lead synth is there, but the rest of the song covers it most of the time, so you barely hear the melody.",
  fix: () => "Instead of just turning the leads up (louder, closer to distortion), Muse made room: it cut the bass where it sits on top of the leads, gave the leads a little lift where they carry, and turned down the kick, which was by far the loudest thing.",
  vocal12: () => "The vocal sample was too loud. Aria turned its fader down until it sat with the music instead of on top of it.",
  leads: () => "Now the leads came through, a bit too much. Aria pulled them back so they don't overpower the song.",
  basscut: () => "The bass had high, buzzy overtones it doesn't need, right where the leads and vocal live. A low pass on the bass removes everything above 1000 Hz, which leaves the bass's weight and clears space for the rest.",
  vocals: () => "The whole vocal group came down 2 dB so the voice blends in.",
  air: () => "A high shelf adds a touch of 'air': the shimmer above 10 kHz that makes a synth sound open and expensive.",
  reverb: () => "Reverb puts the vocal in a room, so it sounds like part of the track instead of pasted on top.",
  delay: () => "A soft delay repeats the vocal quietly in time with the song, which fills the space between phrases.",
};

// What Aria did, in three plain groups for the reveal; each change line is copied from the run (demo-run.json)
const doneOf = (...ids: string[]) => STEPS.filter((s) => ids.includes(s.id)).flatMap((s) => s.done.filter((d) => d.ok).map((d) => d.text));
const REVEAL_CARDS = [
  { title: "Made room for the leads", plain: "Cut the bass where it sat on the melody, instead of just turning the leads up.", changes: doneOf("fix").filter((t) => /EQ Eight/.test(t)) },
  { title: "Turned down what was too loud", plain: "The kick, the vocal and the leads came down until everything fit.", changes: [...doneOf("fix").filter((t) => /KICK/.test(t)), ...["vocal12", "leads", "vocals"].map((id) => doneOf(id).slice(-1)[0]).filter(Boolean)] },
  { title: "Cleaned it up and finished it", plain: "Took the buzz off the bass, added air to the leads, put the vocal in a room.", changes: doneOf("basscut", "air", "reverb", "delay").filter((t) => !/"VOCAL" down/.test(t)) },
];

const COLORS = ["#ff5a4f", "#ffa529", "#10a4ee", "#5cffe8", "#ff94a6"];
const DUR = (song.bars * 4 * 60) / song.tempo;   // 16 bars at 128 BPM: 30 s
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- audio: the stems and each step's Live export, started together and looped ---------- */
type Gains = { stems: number[]; before: number; after: Record<string, number> };
function useMix() {
  const afters = useMemo(() => STEPS.filter((s) => s.audio).map((s) => ({ id: s.id, src: s.audio as string })), []);
  const ctx = useRef<AudioContext | null>(null);
  const bufs = useRef<{ stems: AudioBuffer[]; after: Record<string, AudioBuffer> } | null>(null);
  const nodes = useRef<{ srcs: AudioBufferSourceNode[]; stemGain: GainNode[]; before: GainNode; after: Record<string, GainNode>; analyser: AnalyserNode } | null>(null);
  const loading = useRef<Promise<void> | null>(null);
  const t0 = useRef(0), offset = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "playing" | "error">("idle");

  const load = useCallback(() => {
    if (!loading.current) {
      loading.current = (async () => {
        setState("loading");
        try {
          const ac = ctx.current ?? new AudioContext();
          ctx.current = ac;
          const get = async (src: string) => ac.decodeAudioData(await (await fetch(encodeURI(src))).arrayBuffer());
          const [stems, after] = await Promise.all([
            Promise.all(song.tracks.map((t) => get(`/demo/${t.name}.m4a`))),
            Promise.all(afters.map(async (a) => [a.id, await get(a.src)] as const)),
          ]);
          bufs.current = { stems, after: Object.fromEntries(after) };
          setState("ready");
        } catch {
          loading.current = null;
          setState("error");
        }
      })();
    }
    return loading.current;
  }, [afters]);

  const stop = useCallback(() => {
    const ac = ctx.current, n = nodes.current;
    if (!ac || !n) return;
    offset.current = (ac.currentTime - t0.current) % DUR;
    n.srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    nodes.current = null;
    setState("ready");
  }, []);

  const play = useCallback(async (g: Gains, from?: number) => {
    if (nodes.current) stop();
    if (from !== undefined) offset.current = from;
    await load();
    const ac = ctx.current, b = bufs.current;
    if (!ac || !b) return;
    await ac.resume();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.82;
    analyser.connect(ac.destination);
    const before = ac.createGain();
    before.gain.value = g.before;
    before.connect(analyser);
    const at = ac.currentTime + 0.08, start = offset.current % DUR;
    const srcs: AudioBufferSourceNode[] = [];
    const begin = (buf: AudioBuffer, dest: AudioNode) => {
      const s = ac.createBufferSource();
      s.buffer = buf; s.loop = true; s.loopEnd = Math.min(buf.duration, DUR);
      s.connect(dest); s.start(at, start % s.loopEnd);
      srcs.push(s);
    };
    const stemGain = b.stems.map((buf, i) => {
      const sg = ac.createGain();
      sg.gain.value = g.stems[i];
      sg.connect(before);
      begin(buf, sg);
      return sg;
    });
    const after: Record<string, GainNode> = {};
    for (const [id, buf] of Object.entries(b.after)) {
      const ag = ac.createGain();
      ag.gain.value = g.after[id] ?? 0;
      ag.connect(analyser);
      begin(buf, ag);
      after[id] = ag;
    }
    t0.current = at - start;
    nodes.current = { srcs, stemGain, before, after, analyser };
    setState("playing");
  }, [load, stop]);

  // A short fade between versions, so the switch is instant but never clicks
  const setGains = useCallback((g: Gains) => {
    const ac = ctx.current, n = nodes.current;
    if (!ac || !n) return;
    const t = ac.currentTime;
    n.stemGain.forEach((sg, i) => sg.gain.setTargetAtTime(g.stems[i], t, 0.012));
    n.before.gain.setTargetAtTime(g.before, t, 0.012);
    for (const [id, ag] of Object.entries(n.after)) ag.gain.setTargetAtTime(g.after[id] ?? 0, t, 0.012);
  }, []);

  const position = useCallback(() => {
    const ac = ctx.current;
    if (!ac || !nodes.current) return offset.current % DUR;
    return Math.max(0, ac.currentTime - t0.current) % DUR;
  }, []);

  useEffect(() => () => { nodes.current?.srcs.forEach((s) => { try { s.stop(); } catch { /* */ } }); ctx.current?.close(); }, []);
  return { state, load, play, stop, setGains, position, analyser: useCallback(() => nodes.current?.analyser ?? null, []) };
}

/* ---------- pieces ---------- */
type Wave = { h: number[]; rgb: number[][] };

// The app's waveform: mirrored, smooth, the color flowing along it by where the sound is (red lows, orange mids,
// green highs). Drawn once per size; the playhead and the played part are drawn over it.
function WaveCanvas({ wave, className, dim }: { wave: Wave; className?: string; dim?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const draw = () => {
      const ctx = el.getContext("2d"), dpr = window.devicePixelRatio || 1, cw = el.clientWidth, ch = el.clientHeight;
      if (!ctx || !cw) return;
      el.width = Math.round(cw * dpr); el.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const n = wave.h.length, mid = ch / 2, x = (i: number) => (i / (n - 1)) * cw, y = (i: number) => Math.max(0.6, wave.h[i] * (mid - 2));
      const grad = ctx.createLinearGradient(0, 0, cw, 0);
      wave.rgb.forEach((c, i) => grad.addColorStop(i / (n - 1), `rgb(${c[0]},${c[1]},${c[2]})`));
      ctx.beginPath();
      ctx.moveTo(0, mid - y(0));
      for (let i = 1; i < n; i++) { const xm = (x(i - 1) + x(i)) / 2; ctx.quadraticCurveTo(x(i - 1), mid - y(i - 1), xm, mid - (y(i - 1) + y(i)) / 2); }
      for (let i = n - 1; i > 0; i--) { const xm = (x(i - 1) + x(i)) / 2; ctx.quadraticCurveTo(x(i), mid + y(i), xm, mid + (y(i - 1) + y(i)) / 2); }
      ctx.closePath();
      ctx.globalAlpha = dim ? 0.35 : 0.92; ctx.fillStyle = grad; ctx.fill(); ctx.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wave, dim]);
  return <canvas ref={cv} className={cn("block size-full", className)} aria-hidden="true" />;
}

function Spectrum({ analyser, playing, range }: { analyser: () => AnalyserNode | null; playing: boolean; range?: number[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let raf = 0;
    const lo = 30, hi = 16000;
    const draw = () => {
      const g = c.getContext("2d"), a = analyser();
      if (!g) return;
      const dpr = devicePixelRatio, w = (c.width = c.clientWidth * dpr), h = (c.height = c.clientHeight * dpr);
      const x = (f: number) => (Math.log(f / lo) / Math.log(hi / lo)) * w;
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(255,255,255,0.05)";
      for (const f of [100, 1000, 10000]) g.fillRect(x(f), 0, dpr, h);
      if (range) { g.fillStyle = "rgba(255,181,50,0.16)"; g.fillRect(x(range[0]), 0, x(range[1]) - x(range[0]), h); }
      if (a) {
        const data = new Float32Array(a.frequencyBinCount);
        a.getFloatFrequencyData(data);
        const bin = a.context.sampleRate / a.fftSize;
        g.beginPath();
        for (let px = 0; px <= w; px += 2 * dpr) {
          const f = lo * Math.pow(hi / lo, px / w), f2 = lo * Math.pow(hi / lo, (px + 2 * dpr) / w);
          const k0 = Math.floor(f / bin), k1 = Math.max(k0 + 1, Math.floor(f2 / bin));
          let sum = 0;
          for (let k = k0; k < k1 && k < data.length; k++) sum += Math.pow(10, data[k] / 10);
          const db = 10 * Math.log10(sum / (k1 - k0) + 1e-12) + 3 * Math.log2(f / 1000);
          const y = h - ((db + 100) / 80) * h;
          if (px === 0) g.moveTo(px, y); else g.lineTo(px, y);
        }
        g.strokeStyle = "#ffb532"; g.lineWidth = 1.5 * dpr; g.stroke();
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, playing, range]);
  return (
    <div className="relative h-[96px] overflow-hidden rounded-[8px] bg-[#141414]">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between font-mono text-[10px] text-[#6a6a6a]"><span>30 Hz</span><span>Low</span><span>Middle</span><span>High</span><span>16 kHz</span></div>
      {!playing && <div className="absolute inset-0 grid place-items-center text-[12px] text-[#7a7a7a]">The sound, measured live as it plays</div>}
    </div>
  );
}

// The two average spectra of the reveal, Before (grey) and After (green), at the same loudness
function RevealSpectrum({ range }: { range?: number[] }) {
  const W = 600, H = 150, lo = 30, hi = 16000;
  const hz = reveal.hz as number[];
  const all = [...reveal.before.spectrum, ...reveal.after.spectrum] as number[];
  const top = Math.max(...all), bottom = top - 42;
  const X = (f: number) => (Math.log(f / lo) / Math.log(hi / lo)) * W;
  const Y = (db: number) => H - 6 - ((Math.max(bottom, db) - bottom) / (top - bottom)) * (H - 14);
  const line = (v: number[]) => hz.map((f, i) => (f < lo || f > hi ? null : `${X(f).toFixed(1)},${Y(v[i]).toFixed(1)}`)).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[150px] w-full" role="img" aria-label="Average spectrum before and after, at the same loudness">
      {range && <rect x={X(range[0])} y={0} width={X(range[1]) - X(range[0])} height={H} fill="rgba(255,181,50,0.12)" />}
      {[100, 1000, 10000].map((f) => <line key={f} x1={X(f)} x2={X(f)} y1={0} y2={H} stroke="rgba(255,255,255,0.06)" />)}
      <polyline points={line(reveal.before.spectrum as number[])} fill="none" stroke="#8a8a8a" strokeWidth={2} strokeLinejoin="round" />
      <polyline points={line(reveal.after.spectrum as number[])} fill="none" stroke="#4ade80" strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  );
}

// A soft pulsing ring that says "press this next"
function Ring({ on }: { on: boolean }) {
  return on ? <span className="pointer-events-none absolute -inset-1.5 animate-ping rounded-full border-2 border-[#6ea8ff]/80" /> : null;
}

type Msg =
  | { kind: "user"; text: string; note?: string } | { kind: "muse"; text: string } | { kind: "step"; text: string }
  | { kind: "done"; d: Done } | { kind: "card"; title: string; text: string } | { kind: "plain"; text: string }
  | { kind: "aria"; text: string } | { kind: "chips"; steps: string[] };

const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);

// The guided tour: one short sentence per step, pointing at what to press (Ian, Nov 1)
type Tour = "play" | "solo" | "check" | "fix" | "hear" | "ask" | "reveal" | "done";
const TOUR: Record<Exclude<Tour, "done">, { n: number; text: string; skip?: string }> = {
  play: { n: 1, text: "This is Ian's song in a small Live, before any mixing. Press play." },
  solo: { n: 2, text: "Solo the leads. That melody is what gets lost in the full mix.", skip: "Next" },
  check: { n: 3, text: "Now let Aria listen. It hears every track on its own." },
  fix: { n: 4, text: "Aria found the problem. Let Muse Spark fix it." },
  hear: { n: 5, text: "You're hearing After now: where Ian's run with Aria ended up. Flip to Before, then back.", skip: "Next" },
  ask: { n: 6, text: "That took a few more requests. Tap them to see what Ian asked for.", skip: "Next" },
  reveal: { n: 7, text: "That's the whole run. Time for the big reveal." },
};

/* ---------- the demo ---------- */
export function TryIt() {
  const mix = useMix();
  const [phase, setPhase] = useState<"idle" | "checking" | "checked" | "busy">("idle");
  const [progress, setProgress] = useState<{ text: string; pct: number } | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [version, setVersion] = useState<"before" | "after">("before");
  const [mute, setMute] = useState<boolean[]>(song.tracks.map(() => false));
  const [solo, setSolo] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [tour, setTour] = useState<Tour>("play");
  const [showReveal, setShowReveal] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const revealHead = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const targets = useRef<Partial<Record<Tour, HTMLElement | null>>>({});
  const playhead = useRef<HTMLDivElement>(null);
  const played = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean; arrow: number } | null>(null);

  const latestAfter = [...applied].reverse().find((id) => STEPS.find((s) => s.id === id)?.audio) ?? null;
  const showAfter = version === "after" && !!latestAfter;
  const gains = useCallback((): Gains => ({
    stems: song.tracks.map((_, i) => (solo !== null ? (solo === i ? 1 : 0) : mute[i] ? 0 : 1)),
    before: showAfter ? 0 : 1,
    after: Object.fromEntries(STEPS.filter((s) => s.audio).map((s) => [s.id, showAfter && s.id === latestAfter ? 1 : 0])),
  }), [solo, mute, showAfter, latestAfter]);

  useEffect(() => { mix.setGains(gains()); }, [gains, mix]);
  // The playhead and the played part move every screen frame, straight on the elements (no React re-render)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = mix.position() / DUR;
      if (playhead.current) playhead.current.style.left = `${(p * 100).toFixed(3)}%`;
      if (played.current) played.current.style.width = `${(p * 100).toFixed(3)}%`;
      if (revealHead.current) revealHead.current.style.left = `${(p * 100).toFixed(3)}%`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mix]);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing, progress]);

  // Where the tour's tip sits: under (or over) what it points at, inside the window
  useEffect(() => {
    if (tour === "done" || showReveal) { setTip(null); return; }
    let raf = 0;
    const place = () => {
      const t = targets.current[tour], b = box.current;
      if (t && b) {
        const r = t.getBoundingClientRect(), o = b.getBoundingClientRect();
        const below = r.bottom - o.top < o.height - 120;
        setTip((old) => {
          const cx = r.left + r.width / 2 - o.left, nx = Math.min(Math.max(cx, 150), o.width - 150), ny = below ? r.bottom - o.top + 12 : r.top - o.top - 12;
          return old && Math.abs(old.x - nx) < 0.5 && Math.abs(old.y - ny) < 0.5 && old.below === below ? old : { x: nx, y: ny, below, arrow: cx - nx };
        });
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [tour, showReveal]);

  const say = (m: Msg) => setMsgs((x) => [...x, m]);
  const playing = mix.state === "playing";
  const devices = STEPS.filter((s) => applied.includes(s.id)).flatMap((s) => s.devices);
  const range = phase !== "idle" ? CHECK.finding?.hz_range : undefined;
  const pending = ASKS.filter((s) => !applied.includes(s.id));
  const busy = phase === "checking" || phase === "busy";
  const leads = song.tracks.findIndex((t) => t.name === "LEADS");

  const walk = async (lines: string[], ms: number) => {
    for (let i = 0; i < lines.length; i++) { setProgress({ text: lines[i], pct: ((i + 1) / lines.length) * 100 }); await sleep(ms); }
    setProgress(null);
  };

  const play = () => {
    if (playing) { mix.stop(); return; }
    mix.play(gains());
    if (tour === "play") setTour("solo");
  };

  const checkMix = async () => {
    if (busy || phase !== "idle") return;
    setSolo(null);
    setTour("check");
    setPhase("checking");
    if (!playing) mix.play({ ...gains(), stems: song.tracks.map(() => 1) }, 0);
    await walk(["Listening to bars 1 to 16", "Hearing each track on its own", "Finding what covers what", "Muse Spark is reading the measurements"], 1000);
    if (CHECK.reply) say({ kind: "muse", text: CHECK.reply });
    if (CHECK.note) say({ kind: "card", title: CHECK.note.short, text: CHECK.note.text });
    say({ kind: "plain", text: PLAIN.check(CHECK) });
    setPhase("checked");
    setTour(FIX ? "fix" : "ask");
  };

  const apply = async (s: Step, asked?: string) => {
    if (busy) return;
    setPhase("busy");
    if (s.kind === "ask") say({ kind: "user", text: s.ask ?? s.label, note: asked && asked.trim().toLowerCase() !== (s.ask ?? "").toLowerCase() ? "the recorded request closest to what you typed" : undefined });
    else say({ kind: "step", text: s.button === "Fix it" && CHECK.note ? `Fix it: ${CHECK.note.short}` : "Fixing the strongest problems" });
    setTyping(true);
    await sleep(1200);
    setTyping(false);
    if (s.reply) say({ kind: "muse", text: s.reply });
    for (const d of s.done) { await sleep(380); say({ kind: "done", d }); }
    setApplied((a) => [...a, s.id]);
    if (s.kind === "fix" && s.measured) {
      await walk(["Playing bars 1 to 16 again", "Comparing before and after at the same loudness"], 1000);
      say({ kind: "step", text: "How it went" });
      say({ kind: "muse", text: s.measured });
    }
    if (PLAIN[s.id]) say({ kind: "plain", text: PLAIN[s.id](s) });
    setPhase("checked");
    if (s.audio) {   // the payoff right away: switch to After while it plays (Ian, Nov 1: "there's no reveal" at the fix)
      setVersion("after");
      if (mix.state !== "playing") mix.play({ ...gains(), before: 0, after: { [s.id]: 1 } });
    }
    if (s.kind === "fix") setTour("hear");
    else if (tour === "ask" && pending.filter((x) => x.id !== s.id).length <= ASKS.length - 3) setTour("reveal");
  };

  const send = (raw: string) => {
    const t = raw.trim();
    if (!t || busy) return;
    setText("");
    const w = words(t), low = t.toLowerCase();
    if (/\bcheck\b/.test(low) && phase === "idle") { say({ kind: "user", text: t }); checkMix(); return; }
    if (phase === "idle") { say({ kind: "user", text: t }); say({ kind: "aria", text: "Run Check mix first, so Aria knows what's in this mix." }); return; }
    if (FIX && /fix/.test(low) && !applied.includes(FIX.id)) { say({ kind: "user", text: t }); apply(FIX); return; }
    const best = ASKS.map((s) => {
      const keys = new Set([...words(s.ask ?? ""), ...words(s.label), ...(s.keywords ?? [])]);
      return { s, score: w.filter((x) => keys.has(x)).length };
    }).sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0) {
      if (applied.includes(best.s.id)) { say({ kind: "user", text: t }); say({ kind: "aria", text: `That's done already: "${best.s.ask}".` }); }
      else apply(best.s, t);
      return;
    }
    say({ kind: "user", text: t });
    say({ kind: "aria", text: "This page replays Ian's real run in Live, so it can only do what he asked. In Live, Aria takes any request." });
    const left = [...(FIX && !applied.includes(FIX.id) ? [FIX.id] : []), ...pending.map((s) => s.id)];
    if (left.length) say({ kind: "chips", steps: left });
  };

  const openReveal = () => {
    setShowReveal(true);
    setTour("done");
    setSolo(null);
    setVersion("before");
    if (!playing) mix.play({ ...gains(), stems: song.tracks.map(() => 1), before: 1 }, 0);
  };
  const flip = (v: "before" | "after") => {
    if (v === "after" && !latestAfter) return;
    setVersion(v);
    if (!playing) mix.play({ ...gains(), before: v === "after" ? 0 : 1 });
  };
  useEffect(() => {
    if (!showReveal) return;
    const key = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setVersion((v) => (v === "before" ? "after" : "before")); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [showReveal]);

  const tipNow = tour !== "done" && !showReveal ? TOUR[tour] : null;
  const lowMids = reveal.bands.find((b) => b.name === "Low mids" && b.diff_db < 0);
  const changes = STEPS.reduce((n, s) => n + s.done.length, 0);

  return (
    <div className="relative mt-12">
      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(60%_60%_at_30%_20%,rgba(110,168,255,0.38),transparent_70%),radial-gradient(50%_50%_at_80%_80%,rgba(74,222,128,0.22),transparent_70%)] blur-2xl" />
      <div ref={box} className="relative overflow-hidden rounded-[16px] border border-[#6ea8ff]/40 bg-[#1b1b1c] text-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95),0_0_60px_-10px_rgba(110,168,255,0.35)]">
        {/* window title bar */}
        <div className="flex h-[34px] items-center gap-[7px] border-b border-black/70 bg-[#141414] px-3">
          <span className="size-[11px] flex-none rounded-full bg-[#ff5f57]" /><span className="size-[11px] flex-none rounded-full bg-[#febc2e]" /><span className="size-[11px] flex-none rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate text-[12px] text-[#9a9a9a]">House demo by Ian · Aria on Main</span>
          <span className="ml-auto flex flex-none items-center gap-1.5 rounded-full bg-[#4ade80]/12 px-2.5 py-[3px] text-[11.5px] font-medium text-[#4ade80]">
            <span className="size-[6px] animate-pulse rounded-full bg-[#4ade80]" />Interactive demo
          </span>
        </div>

        {/* transport */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/70 bg-[#262626] px-3 py-2 sm:gap-3">
          <span ref={(el) => { targets.current.play = el; }} className="relative inline-flex">
            <Ring on={tour === "play"} />
            <button type="button" onClick={play} disabled={mix.state === "loading"}
                    className={cn("flex h-8 items-center gap-2 rounded-[8px] px-3.5 text-[13px] font-medium transition", playing ? "bg-[#7cd38a] text-black" : "bg-white text-black hover:bg-white/90")}
                    aria-label={playing ? "Stop" : "Play"}>
              {mix.state === "loading" ? "Loading…" : playing ? <><span className="size-[9px] rounded-[1px] bg-black" />Stop</> : <><span className="h-0 w-0 border-y-[5px] border-l-[9px] border-y-transparent border-l-black" />Play</>}
            </button>
          </span>
          <span className="hidden font-mono text-[12px] text-[#9a9a9a] sm:inline">{song.tempo} BPM · bars 1 to 16, looping</span>
          <div className="ml-auto flex items-center gap-2">
            {tour !== "done" && !showReveal && <button type="button" onClick={() => setTour("done")} className="text-[12px] text-[#8a8a8a] hover:text-white">Skip tour</button>}
            {latestAfter && !showReveal && (
              <span ref={(el) => { targets.current.hear = el; }} className="relative inline-flex">
                <Ring on={tour === "hear"} />
                <div className="flex rounded-full bg-[#141414] p-1" role="group" aria-label="Which version plays">
                  {(["before", "after"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => { flip(v); if (tour === "hear" && v === "before") setTimeout(() => setTour((t) => (t === "hear" ? "ask" : t)), 3500); }}
                            className={cn("relative rounded-full px-3.5 py-1 text-[12.5px] font-semibold transition", version === v ? "text-black" : "text-[#9a9a9a] hover:text-white")}>
                      {version === v && <motion.span layoutId="transport-pill" className={cn("absolute inset-0 rounded-full", v === "after" ? "bg-[#4ade80]" : "bg-white")} transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                      <span className="relative">{v === "before" ? "Before" : "After"}</span>
                    </button>
                  ))}
                </div>
              </span>
            )}
            {latestAfter && !showReveal && (
              <button type="button" onClick={openReveal} ref={(el) => { targets.current.reveal = el; }}
                      className="relative rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-white ring-1 ring-[#4ade80]/50 transition hover:bg-white/20">
                <Ring on={tour === "reveal"} />The reveal
              </button>
            )}
          </div>
        </div>
        {mix.state === "error" && <p className="bg-[#3a1d1d] px-4 py-2 text-[13px] text-[#ffb4ac]">The audio didn't load. Reload the page to try again.</p>}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* arrangement */}
          <div className="min-w-0 border-black/70 p-3 lg:border-r">
            <div className="flex">
              <div className="w-[118px] flex-none sm:w-[134px]" />
              <div className="flex h-5 min-w-0 flex-1 font-mono text-[10px] text-[#7a7a7a]">
                {Array.from({ length: song.bars }, (_, i) => <span key={i} className="flex-1 border-l border-white/10 pl-1">{i % 2 === 0 ? i + 1 : ""}</span>)}
              </div>
            </div>
            <div className="relative">
              {song.tracks.map((t, i) => {
                const color = COLORS[i % COLORS.length], audible = solo !== null ? solo === i : !mute[i];
                const devs = devices.filter((d) => d.track === t.name);
                return (
                  <div key={t.name} className="flex h-[56px] border-t border-black/60">
                    <div className="flex w-[118px] flex-none items-center gap-1 bg-[#262626] pr-1.5 sm:w-[134px] sm:gap-1.5 sm:pr-2">
                      <span className="h-full w-[4px] flex-none" style={{ background: color }} />
                      <span className="min-w-0 flex-1 truncate pl-1.5 text-[11.5px] font-medium sm:text-[12px]">{t.name}</span>
                      <button type="button" onClick={() => setMute((m) => m.map((x, k) => (k === i ? !x : x)))} disabled={showAfter}
                              className={cn("grid size-[20px] flex-none place-items-center rounded-[4px] text-[10px] font-semibold transition sm:size-[22px]", mute[i] ? "bg-[#3a3a3a] text-[#7a7a7a]" : "bg-[#ffb532] text-black", showAfter && "opacity-40")}
                              aria-label={`${mute[i] ? "Unmute" : "Mute"} ${t.name}`} title="Mute">{i + 1}</button>
                      <span className="relative inline-flex" ref={i === leads ? (el) => { targets.current.solo = el; } : undefined}>
                        <Ring on={tour === "solo" && i === leads} />
                        <button type="button" onClick={() => { setSolo((s) => (s === i ? null : i)); if (tour === "solo" && i === leads) setTimeout(() => setTour((x) => (x === "solo" ? "check" : x)), 2600); }} disabled={showAfter}
                                className={cn("grid size-[20px] flex-none place-items-center rounded-[4px] text-[10px] font-semibold transition sm:size-[22px]", solo === i ? "bg-[#5cb8ff] text-black" : "bg-[#3a3a3a] text-[#cfcfcf]", showAfter && "opacity-40")}
                                aria-label={`Solo ${t.name}`} title="Solo">S</button>
                      </span>
                    </div>
                    <div className={cn("relative min-w-0 flex-1 overflow-hidden border-l border-black/60 bg-[#151515] transition-opacity duration-300", !audible && "opacity-25")}>
                      <div className="absolute inset-x-0 inset-y-[6px]"><WaveCanvas wave={t as unknown as Wave} /></div>
                      <AnimatePresence>
                        {devs.map((d, k) => (
                          <motion.span key={d.name} initial={{ opacity: 0, y: -6, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}
                                       className="absolute top-1 rounded-[4px] bg-black/80 px-1.5 py-[1px] text-[10px] font-medium text-[#4ade80] ring-1 ring-[#4ade80]/40" style={{ right: 6 + k * 84 }}>
                            {d.name}
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
              {/* the played part dims nothing; the unplayed part is shaded, and the playhead glides */}
              <div className="pointer-events-none absolute inset-y-0 left-[118px] right-0 sm:left-[134px]">
                <div ref={played} className="absolute inset-y-0 left-0 bg-white/[0.035]" style={{ width: 0 }} />
                <div ref={playhead} className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ left: 0 }} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-[#8a8a8a]">{showAfter ? "After: Ian's export from Live at the end of the run, at the same loudness as Before." : "Colors show where each sound lives: red lows, orange mids, green highs."}</p>
            <div className="mt-3">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-[#9a9a9a]">
                <span>The whole mix, measured as it plays</span>
                {range && <span className="text-[#ffb532]">{range[0]} to {range[1]} Hz: where the leads get covered</span>}
              </div>
              <Spectrum analyser={mix.analyser} playing={playing} range={range} />
            </div>
          </div>

          {/* Aria: the strip's buttons, then Ask Muse */}
          <div className="flex min-h-[540px] min-w-0 flex-col bg-[#0a0a0b] lg:min-h-0">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <span className="mark size-[18px] text-white" /><span className="text-[14px] font-medium">Aria</span>
              <div className="ml-auto flex gap-2">
                <span ref={(el) => { targets.current.check = el; }} className="relative inline-flex">
                  <Ring on={tour === "check"} />
                  <button type="button" onClick={checkMix} disabled={busy || phase !== "idle"}
                          className={cn("rounded-full px-4 py-1.5 text-[13px] font-medium transition", phase === "idle" ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-[#8a8a8a]")}>
                    {phase === "checking" ? "Checking…" : phase === "idle" ? "Check mix" : "Checked"}
                  </button>
                </span>
                {FIX && (
                  <span ref={(el) => { targets.current.fix = el; }} className="relative inline-flex">
                    <Ring on={tour === "fix"} />
                    <button type="button" onClick={() => FIX && !applied.includes(FIX.id) && apply(FIX)} disabled={phase === "idle" || busy || applied.includes(FIX.id)}
                            className={cn("rounded-full px-4 py-1.5 text-[13px] font-medium transition",
                              phase !== "idle" && !applied.includes(FIX.id) ? "bg-[#6ea8ff] text-black hover:brightness-110" : "bg-white/10 text-[#6a6a6a]")}>
                      {applied.includes(FIX.id) ? "Fixed" : FIX.button ?? "Fix all"}
                    </button>
                  </span>
                )}
              </div>
            </div>
            <AnimatePresence>
              {progress && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-white/[0.08]">
                  <div className="px-4 py-2.5">
                    <div className="text-[12.5px] text-[#d0d0d4]">{progress.text}</div>
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-[#6ea8ff]" animate={{ width: `${progress.pct}%` }} transition={{ duration: 0.9, ease: "easeInOut" }} /></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={thread} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 lg:max-h-[430px]">
              {!msgs.length && !progress && (
                <div className="grid h-full place-items-center py-10 text-center text-[13px] leading-relaxed text-[#7a7a7a]">
                  <div>Aria listens to the song and tells you<br />what's wrong, in plain words.</div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {msgs.map((m, k) => (
                  <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
                    {m.kind === "user" && (
                      <div className="ml-auto max-w-[85%] text-right">
                        <div className="inline-block rounded-[14px] border border-white/[0.08] px-3.5 py-2.5 text-left text-[14px]">{m.text}</div>
                        {m.note && <div className="mt-1 text-[11px] text-[#7a7a7a]">{m.note}</div>}
                      </div>
                    )}
                    {m.kind === "muse" && <div className="max-w-[92%] rounded-[14px] bg-[#ededef] px-3.5 py-2.5 text-[14px] text-[#0a0a0b]">{m.text}</div>}
                    {m.kind === "aria" && <div className="max-w-[92%] rounded-[14px] border border-white/[0.08] bg-[#141416] px-3.5 py-2.5 text-[13.5px] text-[#d0d0d4]">{m.text}</div>}
                    {m.kind === "step" && <div className="pt-1 text-[12px] text-[#8a8a8a]">{m.text}</div>}
                    {m.kind === "done" && <div className={cn("rounded-[12px] px-3 py-2 text-[13px] font-medium", m.d.ok ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-[#fb923c]/10 text-[#fb923c]")}>{m.d.text}</div>}
                    {m.kind === "card" && (
                      <div className="rounded-[14px] bg-[#141416] p-3.5">
                        <div className="text-[14px] font-medium">{m.title}</div>
                        <p className="mt-1 text-[13px] leading-relaxed text-[#a8a8ad]">{m.text}</p>
                      </div>
                    )}
                    {m.kind === "plain" && (
                      <div className="rounded-[12px] border-l-2 border-[#6ea8ff] bg-[#6ea8ff]/[0.06] px-3 py-2 text-[13px] leading-relaxed text-[#c8d6f0]">
                        <span className="mr-1 font-medium text-[#6ea8ff]">In plain words:</span>{m.text}
                      </div>
                    )}
                    {m.kind === "chips" && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.steps.map((id) => { const s = STEPS.find((x) => x.id === id)!; return (
                          <button key={id} type="button" onClick={() => apply(s)} disabled={busy || applied.includes(id)}
                                  className="rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-[#d0d0d4] hover:bg-white/10 disabled:opacity-40">{s.kind === "fix" ? (s.button ?? "Fix all") : s.label}</button>
                        ); })}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {typing && <div className="inline-flex gap-1 rounded-[14px] bg-[#ededef] px-3.5 py-3">{[0, 1, 2].map((i) => <span key={i} className="size-[6px] animate-bounce rounded-full bg-[#0a0a0b]/50" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
            </div>

            {/* Ask Muse's input, with Ian's recorded requests as chips */}
            <div className="border-t border-white/[0.08] p-3">
              {phase !== "idle" && pending.length > 0 && (
                <div ref={(el) => { targets.current.ask = el; }} className="mb-2 flex flex-wrap gap-1.5">
                  {pending.map((s) => (
                    <button key={s.id} type="button" onClick={() => apply(s)} disabled={busy}
                            className={cn("rounded-full border px-3 py-1 text-[12.5px] transition disabled:opacity-40", tour === "ask" ? "border-[#6ea8ff]/60 text-white hover:bg-[#6ea8ff]/15" : "border-white/15 text-[#d0d0d4] hover:bg-white/10")}>{s.label}</button>
                  ))}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); send(text); }}
                    className="flex items-center gap-2 rounded-[14px] border border-white/[0.12] bg-[#141416] px-3 py-1.5 focus-within:border-[#6ea8ff]">
                <input value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
                       placeholder={phase === "idle" ? "Run Check mix first, or type \"check my mix\"" : "Ask, or tell Muse what to change"}
                       className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-white placeholder:text-[#6a6a6a] focus:outline-none" aria-label="Ask Muse" />
                <button type="submit" disabled={busy || !text.trim()} className="grid size-8 flex-none place-items-center rounded-[10px] bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40" aria-label="Send">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* the tour's tip, pointing at what to press */}
        <AnimatePresence>
          {tipNow && tip && (
            <div key={tour} className="pointer-events-none absolute z-20 w-[280px]" style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? "0" : "-100%"})` }}>
             <motion.div initial={{ opacity: 0, y: tip.below ? -6 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                         className="pointer-events-auto relative rounded-[12px] bg-[#6ea8ff] px-3.5 py-2.5 text-[13px] font-medium leading-snug text-[#0a0a0b] shadow-[0_12px_40px_-8px_rgba(110,168,255,0.7)]">
                <span className={cn("absolute size-3 -translate-x-1/2 rotate-45 bg-[#6ea8ff]", tip.below ? "-top-1.5" : "-bottom-1.5")} style={{ left: `calc(50% + ${tip.arrow}px)` }} />
                <div className="mb-0.5 text-[11px] font-semibold opacity-60">Step {tipNow.n} of 7</div>
                {tipNow.text}
                {tipNow.skip && <button type="button" onClick={() => setTour(tour === "solo" ? "check" : tour === "hear" ? "ask" : "reveal")} className="ml-2 underline underline-offset-2 opacity-70 hover:opacity-100">{tipNow.skip}</button>}
             </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* the big reveal (Ian, Nov 1: the first one read like a lab report): one big waveform that changes in place,
            a big switch, and what Aria did in plain words, each with its real changes; the measurements on request */}
        <AnimatePresence>
          {showReveal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
                        className="absolute inset-0 z-30 overflow-y-auto bg-[#09090a]">
              <div className="pointer-events-none absolute inset-0 transition-colors duration-700" style={{ background: version === "after" ? "radial-gradient(70% 50% at 50% 30%, rgba(74,222,128,0.16), transparent 70%)" : "radial-gradient(70% 50% at 50% 30%, rgba(255,255,255,0.06), transparent 70%)" }} />
              <div className="relative mx-auto max-w-[900px] px-5 py-8 sm:py-10">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#4ade80]">The reveal</span>
                  <button type="button" onClick={() => setShowReveal(false)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] text-[#d0d0d4] hover:bg-white/20">Back to the demo</button>
                </div>
                <h3 className="mt-3 text-center text-[clamp(30px,4.4vw,52px)] font-medium leading-[1.05] tracking-[-0.035em]">
                  {version === "after" ? "After Aria." : "Before Aria."}
                </h3>
                <p className="mx-auto mt-2 max-w-[520px] text-center text-[14px] text-[#a8a8ad]">Same 16 bars, same loudness. Flip it while it plays (or press space).</p>

                <div className="mt-6 flex justify-center">
                  <div className="flex rounded-full bg-[#1b1b1c] p-1.5 ring-1 ring-white/10">
                    {(["before", "after"] as const).map((v) => (
                      <button key={v} type="button" onClick={() => flip(v)}
                              className={cn("relative rounded-full px-10 py-3 text-[17px] font-semibold transition sm:px-14", version === v ? "text-black" : "text-[#9a9a9a] hover:text-white")}>
                        {version === v && <motion.span layoutId="reveal-pill" className={cn("absolute inset-0 rounded-full shadow-[0_0_40px_-6px]", v === "after" ? "bg-[#4ade80] shadow-[#4ade80]" : "bg-white shadow-white/40")} transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                        <span className="relative">{v === "before" ? "Before" : "After"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* one waveform of the whole mix; flipping fades one version into the other in place */}
                <div className="relative mt-7 h-[150px] overflow-hidden rounded-[16px] bg-[#121213] ring-1 ring-white/10 sm:h-[180px]">
                  {(["before", "after"] as const).map((v) => (
                    <div key={v} className="absolute inset-x-0 inset-y-[14px] transition-opacity duration-500" style={{ opacity: version === v ? 1 : 0 }}>
                      <WaveCanvas wave={reveal[v] as unknown as Wave} />
                    </div>
                  ))}
                  <div className="pointer-events-none absolute inset-0">
                    <div ref={revealHead} className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" style={{ left: 0 }} />
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {REVEAL_CARDS.map((c, i) => (
                    <motion.div key={c.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                                className="rounded-[16px] bg-[#141416] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[16px] font-medium">{c.title}</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#a8a8ad]">{c.plain}</p>
                      <ul className="mt-3 space-y-1">
                        {c.changes.map((t) => <li key={t} className="text-[12px] leading-snug text-[#4ade80]">{t}</li>)}
                      </ul>
                    </motion.div>
                  ))}
                </div>

                {lowMids && (
                  <p className="mt-6 text-center text-[15px] text-[#d0d0d4]">
                    Measured at the same loudness: the boxy low mids are <span className="font-semibold text-white">{Math.abs(lowMids.diff_db)} dB cleaner</span>.
                  </p>
                )}
                <div className="mt-3 text-center">
                  <button type="button" onClick={() => setShowNumbers((x) => !x)} className="text-[12.5px] text-[#8a8a8a] underline underline-offset-4 hover:text-white">{showNumbers ? "Hide the measurements" : "Show the measurements"}</button>
                </div>
                <AnimatePresence>
                  {showNumbers && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="rounded-[12px] bg-[#141416] p-3">
                          <div className="mb-1 flex items-center gap-3 text-[12px] text-[#9a9a9a]">
                            <span>Average spectrum</span>
                            <span className="ml-auto flex items-center gap-1.5"><span className="h-[2px] w-4 bg-[#8a8a8a]" />Before</span>
                            <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 bg-[#4ade80]" />After</span>
                          </div>
                          <RevealSpectrum range={CHECK.finding?.hz_range} />
                        </div>
                        <div className="rounded-[12px] bg-[#141416] p-3 text-[12.5px]">
                          <div className="text-[12px] text-[#9a9a9a]">After vs Before, dB</div>
                          <div className="mt-2 space-y-1">
                            {reveal.bands.map((b) => (
                              <div key={b.name} className="flex justify-between"><span className="text-[#cfcfcf]">{b.name}</span><span className="font-mono text-[#d8d8d8]">{b.diff_db > 0 ? "+" : ""}{b.diff_db}</span></div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-[11.5px] leading-relaxed text-[#6a6a6a]">{reveal.source} Measured by judges/scripts/make_demo_data.py.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="border-t border-black/70 bg-[#141414] px-4 py-2.5 text-[11.5px] leading-relaxed text-[#7a7a7a]">
          Recorded, not simulated: this replays a real run, faster than real time. {run.recorded} {run.after_note} The five tracks are in the repo's test-pack/sample, so anyone with Live can run it for real.
        </p>
      </div>
    </div>
  );
}
