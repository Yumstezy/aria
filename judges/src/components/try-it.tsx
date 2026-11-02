// "Try it": a small Live with Aria in it, on the page (Nov 1, Ian: "a mini Ableton in the website so the judges can
// see the changes made using the software"; then "it blends into the site ... the check mix, the text box and
// everything should work"). Nothing here is simulated:
//   - the five tracks are the unmixed stems in test-pack/sample, their waveforms from their own peaks (demo-tracks.json)
//   - every step is a recorded run (demo-run.json): Aria's findings, Muse Spark's words and the changes Aria made, as
//     Aria logged them; each "after" is what Live played after that step, exported from Live
//   - the spectrum is measured live, in the browser, from whatever is playing
// The page replays the run: Check mix and Fix all play back what really happened, faster than real time, and the
// chat runs the recorded request that matches what's typed. It says so in the window.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import song from "@/demo-tracks.json";
import run from "@/demo-run.json";

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
function Wave({ peaks }: { peaks: number[] }) {
  const n = peaks.length, top: string[] = [], bot: string[] = [];
  peaks.forEach((v, i) => {
    const x = ((i + 0.5) / n) * 1000, a = (v / 99) * 19;
    top.push(`${x.toFixed(1)} ${(20 - a).toFixed(1)}`);
    bot.unshift(`${x.toFixed(1)} ${(20 + a).toFixed(1)}`);
  });
  return (
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[calc(100%-13px)] w-full" aria-hidden="true">
      <path d={`M0 20L${top.join("L")}L1000 20L${bot.join("L")}Z`} fill="rgba(0,0,0,0.72)" />
    </svg>
  );
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
      if (range) {
        g.fillStyle = "rgba(255,181,50,0.18)";
        g.fillRect(x(range[0]), 0, x(range[1]) - x(range[0]), h);
      }
      if (a) {
        const data = new Float32Array(a.frequencyBinCount);
        a.getFloatFrequencyData(data);
        const bin = a.context.sampleRate / a.fftSize;
        g.beginPath();
        for (let px = 0; px <= w; px += 2 * dpr) {
          const f = lo * Math.pow(hi / lo, px / w), f2 = lo * Math.pow(hi / lo, (px + 2 * dpr) / w);
          const k0 = Math.floor(f / bin), k1 = Math.max(k0 + 1, Math.floor(f2 / bin));   // the bins under this pixel
          let sum = 0;
          for (let k = k0; k < k1 && k < data.length; k++) sum += Math.pow(10, data[k] / 10);
          const db = 10 * Math.log10(sum / (k1 - k0) + 1e-12) + 3 * Math.log2(f / 1000);   // tilted 3 dB/oct, as analyzers show music
          const y = h - ((db + 100) / 80) * h;
          if (px === 0) g.moveTo(px, y); else g.lineTo(px, y);
        }
        g.strokeStyle = "#ffb532";
        g.lineWidth = 1.5 * dpr;
        g.stroke();
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, playing, range]);
  return (
    <div className="relative h-[110px] overflow-hidden rounded-[6px] bg-[#141414]">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between font-mono text-[10px] text-[#6a6a6a]"><span>30 Hz</span><span>Low</span><span>Middle</span><span>High</span><span>16 kHz</span></div>
      {!playing && <div className="absolute inset-0 grid place-items-center text-[12px] text-[#7a7a7a]">Press play to see the sound, measured as it plays</div>}
    </div>
  );
}

// A soft pulsing ring that says "press this next"
function Hint({ on, children, className }: { on: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      {on && <span className="pointer-events-none absolute -inset-1 animate-ping rounded-full border-2 border-[#6ea8ff]/70" />}
      {children}
    </span>
  );
}

type Msg =
  | { kind: "user"; text: string; note?: string } | { kind: "muse"; text: string } | { kind: "step"; text: string }
  | { kind: "done"; d: Done } | { kind: "card"; title: string; text: string } | { kind: "plain"; text: string }
  | { kind: "aria"; text: string } | { kind: "chips"; steps: string[] };

const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);

/* ---------- the demo ---------- */
export function TryIt() {
  const mix = useMix();
  const [phase, setPhase] = useState<"idle" | "checking" | "checked" | "busy">("idle");
  const [progress, setProgress] = useState<{ text: string; pct: number } | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [version, setVersion] = useState<"before" | "after">("before");
  const [mute, setMute] = useState<boolean[]>(song.tracks.map(() => false));
  const [solo, setSolo] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const thread = useRef<HTMLDivElement>(null);

  const latestAfter = [...applied].reverse().find((id) => STEPS.find((s) => s.id === id)?.audio) ?? null;
  const showAfter = version === "after" && !!latestAfter;
  const gains = useCallback((): Gains => ({
    stems: song.tracks.map((_, i) => (solo !== null ? (solo === i ? 1 : 0) : mute[i] ? 0 : 1)),
    before: showAfter ? 0 : 1,
    after: Object.fromEntries(STEPS.filter((s) => s.audio).map((s) => [s.id, showAfter && s.id === latestAfter ? 1 : 0])),
  }), [solo, mute, showAfter, latestAfter]);

  useEffect(() => { mix.setGains(gains()); }, [gains, mix]);
  useEffect(() => {
    if (mix.state !== "playing") return;
    let raf = 0;
    const tick = () => { setPos(mix.position()); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mix.state, mix]);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing, progress]);

  const say = (m: Msg) => setMsgs((x) => [...x, m]);
  const playing = mix.state === "playing";
  const beat = Math.floor((pos / DUR) * song.bars * 4);
  const devices = STEPS.filter((s) => applied.includes(s.id)).flatMap((s) => s.devices);
  const range = phase !== "idle" ? CHECK.finding?.hz_range : undefined;
  const pending = ASKS.filter((s) => !applied.includes(s.id));
  const busy = phase === "checking" || phase === "busy";

  // Aria's progress, replayed faster than real time (the real check listens to 16 bars: 30 s)
  const walk = async (lines: string[], ms: number) => {
    for (let i = 0; i < lines.length; i++) {
      setProgress({ text: lines[i], pct: (i / lines.length) * 100 });
      await sleep(ms);
    }
    setProgress(null);
  };

  const checkMix = async () => {
    if (busy) return;
    setPhase("checking");
    if (!playing) mix.play(gains(), 0);
    await walk(["Listening to bars 1 to 16", "Hearing each track on its own", "Finding what covers what", "Muse Spark is reading the measurements"], 1100);
    if (CHECK.reply) say({ kind: "muse", text: CHECK.reply });
    if (CHECK.note) say({ kind: "card", title: CHECK.note.short, text: CHECK.note.text });
    say({ kind: "plain", text: PLAIN.check(CHECK) });
    setPhase("checked");
  };

  const apply = async (s: Step, asked?: string) => {
    setPhase("busy");
    if (s.kind === "ask") say({ kind: "user", text: s.ask ?? s.label, note: asked && asked.trim().toLowerCase() !== (s.ask ?? "").toLowerCase() ? "the recorded request closest to what you typed" : undefined });
    else say({ kind: "step", text: s.button === "Fix it" && CHECK.note ? `Fix it: ${CHECK.note.short}` : "Fixing the strongest problems" });
    setTyping(true);
    await sleep(1400);
    setTyping(false);
    if (s.reply) say({ kind: "muse", text: s.reply });
    for (const d of s.done) { await sleep(450); say({ kind: "done", d }); }
    setApplied((a) => [...a, s.id]);
    if (s.kind === "fix" && s.measured) {
      await walk(["Playing bars 1 to 16 again", "Comparing before and after at the same loudness"], 1100);
      say({ kind: "step", text: "How it went" });
      say({ kind: "muse", text: s.measured });
    }
    if (PLAIN[s.id]) say({ kind: "plain", text: PLAIN[s.id](s) });
    if (s.audio) {
      setVersion("after");
      if (!playing) mix.play({ ...gains(), before: 0 }, 0);
    }
    setPhase("checked");
  };

  const fixAll = () => { if (FIX && !busy && !applied.includes(FIX.id)) apply(FIX); };

  // The chat runs the recorded request that matches what was typed; anything else gets a plain answer
  const send = (raw: string) => {
    const t = raw.trim();
    if (!t || busy) return;
    setText("");
    const w = words(t), low = t.toLowerCase();
    if (/\bcheck\b/.test(low) && phase === "idle") { say({ kind: "user", text: t }); checkMix(); return; }
    if (phase === "idle") { say({ kind: "user", text: t }); say({ kind: "aria", text: "Run Check mix first, so Aria knows what's in this mix." }); return; }
    if (FIX && /fix/.test(low) && /(mix|all|everything)/.test(low)) {
      say({ kind: "user", text: t });
      if (applied.includes(FIX.id)) say({ kind: "aria", text: "That's done: Fix all already ran on these bars." });
      else apply(FIX);
      return;
    }
    const scored = ASKS.map((s) => {
      const keys = new Set([...words(s.ask ?? ""), ...words(s.label), ...(s.keywords ?? [])]);
      return { s, score: w.filter((x) => keys.has(x)).length };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.score > 0) {
      if (applied.includes(best.s.id)) { say({ kind: "user", text: t }); say({ kind: "aria", text: `That's done already: "${best.s.ask}".` }); }
      else apply(best.s, t);
      return;
    }
    say({ kind: "user", text: t });
    say({ kind: "aria", text: "This page replays a real run in Live, so it can only do what was recorded. In Live, Aria takes any request." });
    const left = [...(FIX && !applied.includes(FIX.id) ? [FIX.id] : []), ...pending.map((s) => s.id)];
    if (left.length) say({ kind: "chips", steps: left });
  };

  const next = phase === "idle" ? "check" : FIX && !applied.includes(FIX.id) ? "fix" : pending.length ? "chat" : latestAfter && version === "before" ? "after" : null;

  return (
    <div className="relative mt-12">
      {/* the glow that lifts the window off the page */}
      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(60%_60%_at_30%_20%,rgba(110,168,255,0.38),transparent_70%),radial-gradient(50%_50%_at_80%_80%,rgba(74,222,128,0.22),transparent_70%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[16px] border border-[#6ea8ff]/40 bg-[#1e1e1e] text-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95),0_0_60px_-10px_rgba(110,168,255,0.35)]">
        {/* window title bar */}
        <div className="flex h-[34px] items-center gap-[7px] border-b border-black/70 bg-[#161616] px-3">
          <span className="size-[11px] flex-none rounded-full bg-[#ff5f57]" /><span className="size-[11px] flex-none rounded-full bg-[#febc2e]" /><span className="size-[11px] flex-none rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate text-[12px] text-[#9a9a9a]">BRILL house demo · Aria on Main</span>
          <span className="ml-auto flex flex-none items-center gap-1.5 rounded-full bg-[#4ade80]/12 px-2.5 py-[3px] text-[11.5px] font-medium text-[#4ade80]">
            <span className="size-[6px] animate-pulse rounded-full bg-[#4ade80]" />Interactive demo
          </span>
        </div>

        {/* transport */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/70 bg-[#2a2a2a] px-3 py-2 sm:gap-3">
          <button type="button" onClick={() => (playing ? mix.stop() : mix.play(gains()))} disabled={mix.state === "loading"}
                  className={cn("flex h-8 items-center gap-2 rounded-[6px] px-3 text-[13px] font-medium transition", playing ? "bg-[#7cd38a] text-black" : "bg-[#1b1b1b] text-[#e6e6e6] hover:bg-[#333]")}
                  aria-label={playing ? "Stop" : "Play"}>
            {mix.state === "loading" ? "Loading…" : playing ? <><span className="size-[9px] rounded-[1px] bg-black" />Stop</> : <><span className="h-0 w-0 border-y-[5px] border-l-[9px] border-y-transparent border-l-[#7cd38a]" />Play</>}
          </button>
          <span className="rounded-[4px] bg-[#1b1b1b] px-2 py-1 font-mono text-[12px] text-[#d8d8d8]">{Math.floor(beat / 4) + 1} . {(beat % 4) + 1}</span>
          <span className="hidden font-mono text-[12px] text-[#9a9a9a] sm:inline">{song.tempo} BPM · bars 1 to 16, looping</span>
          <Hint on={next === "after"} className="ml-auto">
            <div className="flex rounded-full bg-[#1b1b1b] p-1" role="group" aria-label="Which version plays">
              {(["before", "after"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVersion(v)} disabled={v === "after" && !latestAfter}
                        className={cn("rounded-full px-3.5 py-1 text-[12.5px] font-medium transition",
                          (v === "after" ? showAfter : !showAfter) ? (v === "after" ? "bg-[#4ade80] text-black" : "bg-white text-black") : "text-[#9a9a9a] hover:text-white",
                          v === "after" && !latestAfter && "cursor-not-allowed opacity-40 hover:text-[#9a9a9a]")}>
                  {v === "before" ? "Before" : "After"}
                </button>
              ))}
            </div>
          </Hint>
        </div>
        {mix.state === "error" && <p className="bg-[#3a1d1d] px-4 py-2 text-[13px] text-[#ffb4ac]">The audio didn't load. Reload the page to try again.</p>}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* arrangement */}
          <div className="min-w-0 border-black/70 p-3 lg:border-r">
            <div className="relative [--lane-left:116px] sm:[--lane-left:132px]">
              <div className="ml-[116px] flex h-5 font-mono text-[10px] text-[#8a8a8a] sm:ml-[132px]">
                {Array.from({ length: song.bars }, (_, i) => <span key={i} className="flex-1 border-l border-white/10 pl-1">{i % 2 === 0 ? i + 1 : ""}</span>)}
              </div>
              {song.tracks.map((t, i) => {
                const color = COLORS[i % COLORS.length], audible = solo !== null ? solo === i : !mute[i];
                const devs = devices.filter((d) => d.track === t.name);
                return (
                  <div key={t.name} className="flex h-[52px] border-t border-black/60">
                    <div className="flex w-[116px] flex-none items-center gap-1 bg-[#2c2c2c] pr-1.5 sm:w-[132px] sm:gap-1.5 sm:pr-2">
                      <span className="h-full w-[3px] flex-none" style={{ background: color }} />
                      <span className="min-w-0 flex-1 truncate pl-1 text-[11px] font-medium sm:text-[12px]">{t.name}</span>
                      <button type="button" onClick={() => setMute((m) => m.map((x, k) => (k === i ? !x : x)))} disabled={showAfter}
                              className={cn("grid size-[19px] flex-none place-items-center rounded-[3px] text-[10px] font-semibold sm:size-[22px]", mute[i] ? "bg-[#454545] text-[#8a8a8a]" : "bg-[#ffb532] text-black", showAfter && "opacity-40")}
                              aria-label={`${mute[i] ? "Unmute" : "Mute"} ${t.name}`} title="Mute">{i + 1}</button>
                      <button type="button" onClick={() => setSolo((s) => (s === i ? null : i))} disabled={showAfter}
                              className={cn("grid size-[19px] flex-none place-items-center rounded-[3px] text-[10px] font-semibold sm:size-[22px]", solo === i ? "bg-[#5cb8ff] text-black" : "bg-[#454545] text-[#cfcfcf]", showAfter && "opacity-40")}
                              aria-label={`Solo ${t.name}`} title="Solo">S</button>
                    </div>
                    <div className={cn("relative min-w-0 flex-1 overflow-hidden border-l border-black/60 transition-opacity", !audible && "opacity-30")} style={{ background: color }}>
                      <div className="flex h-[13px] items-center gap-1 bg-black/15 px-1 text-[9.5px] leading-[13px] text-black/85">
                        <span className="truncate">{t.name}</span>
                        <AnimatePresence>
                          {devs.map((d) => (
                            <motion.span key={d.name} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="ml-1 flex-none rounded-[2px] bg-black/75 px-1 text-[9px] text-[#4ade80]">{d.name}</motion.span>
                          ))}
                        </AnimatePresence>
                      </div>
                      <Wave peaks={t.peaks} />
                    </div>
                  </div>
                );
              })}
              <span className="pointer-events-none absolute bottom-0 top-5 w-px bg-white" style={{ left: `calc(var(--lane-left) + (100% - var(--lane-left)) * ${(pos / DUR).toFixed(4)})` }} />
            </div>
            <p className="mt-2 text-[12px] text-[#8a8a8a]">{showAfter ? "Playing Ian's export from Live after the whole run, at the same loudness as Before. Mute and solo work on the original tracks." : "Mute or solo a track to hear what each one plays."}</p>
            <div className="mt-3">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-[#9a9a9a]">
                <span>The whole mix, measured as it plays</span>
                {range && <span className="text-[#ffb532]">{range[0]} to {range[1]} Hz: where the leads get covered</span>}
              </div>
              <Spectrum analyser={mix.analyser} playing={playing} range={range} />
            </div>
          </div>

          {/* Aria: the strip's buttons, then Ask Muse */}
          <div className="flex min-h-[520px] min-w-0 flex-col bg-[#0a0a0b] lg:min-h-0">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <span className="mark size-[18px] text-white" /><span className="text-[14px] font-medium">Aria</span>
              <div className="ml-auto flex gap-2">
                <Hint on={next === "check"}>
                  <button type="button" onClick={checkMix} disabled={busy || phase !== "idle"}
                          className={cn("rounded-full px-4 py-1.5 text-[13px] font-medium transition", phase === "idle" ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-[#8a8a8a]")}>
                    {phase === "checking" ? "Checking…" : phase === "idle" ? "Check mix" : "Checked"}
                  </button>
                </Hint>
                {FIX && (
                  <Hint on={next === "fix"}>
                    <button type="button" onClick={fixAll} disabled={phase === "idle" || busy || applied.includes(FIX.id)}
                            className={cn("rounded-full px-4 py-1.5 text-[13px] font-medium transition",
                              phase !== "idle" && !applied.includes(FIX.id) ? "bg-[#6ea8ff] text-black hover:brightness-110" : "bg-white/10 text-[#6a6a6a]")}>
                      {applied.includes(FIX.id) ? "Fixed" : FIX.button ?? "Fix all"}
                    </button>
                  </Hint>
                )}
              </div>
            </div>
            {progress && (
              <div className="border-b border-white/[0.08] px-4 py-2.5">
                <div className="text-[12.5px] text-[#d0d0d4]">{progress.text}</div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-[#6ea8ff]" animate={{ width: `${progress.pct + 25}%` }} transition={{ duration: 1 }} /></div>
              </div>
            )}

            <div ref={thread} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 lg:max-h-[440px]">
              {!msgs.length && !progress && (
                <div className="grid h-full place-items-center py-10 text-center text-[13px] leading-relaxed text-[#7a7a7a]">
                  <div>Press <span className="font-medium text-white">Check mix</span>. Aria listens to the 16 bars<br />and tells you what's wrong, in plain words.</div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {msgs.map((m, k) => (
                  <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
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
                          <button key={id} type="button" onClick={() => (s.kind === "fix" ? fixAll() : apply(s))} disabled={busy || applied.includes(id)}
                                  className="rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-[#d0d0d4] hover:bg-white/10 disabled:opacity-40">{s.kind === "fix" ? (s.button ?? "Fix all") : s.label}</button>
                        ); })}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {typing && <div className="inline-flex gap-1 rounded-[14px] bg-[#ededef] px-3.5 py-3">{[0, 1, 2].map((i) => <span key={i} className="size-[6px] animate-bounce rounded-full bg-[#0a0a0b]/50" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
            </div>

            {/* Ask Muse's input, with the recorded requests as chips */}
            <div className="border-t border-white/[0.08] p-3">
              {phase !== "idle" && pending.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {pending.map((s) => (
                    <Hint key={s.id} on={next === "chat" && s === pending[0]}>
                      <button type="button" onClick={() => apply(s)} disabled={busy}
                              className="rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-[#d0d0d4] transition hover:bg-white/10 disabled:opacity-40">{s.label}</button>
                    </Hint>
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
        <p className="border-t border-black/70 bg-[#161616] px-4 py-2.5 text-[11.5px] leading-relaxed text-[#7a7a7a]">
          Recorded, not simulated: this replays a real run, faster than real time. {run.recorded} {run.after_note} The five tracks are in the repo's test-pack/sample, so anyone with Live can run it for real.
        </p>
      </div>
    </div>
  );
}
