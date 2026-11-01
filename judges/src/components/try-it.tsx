// "Try it": a small Live on the page, playing Ian's real stems (Nov 1, Ian: "a mini Ableton in the website so the
// judges can see the changes made using the software ... there's a 99% chance the judges don't make music").
// Nothing here is simulated:
//   - the five tracks are the unmixed stems in test-pack/sample, their waveforms from their own peaks (demo-tracks.json)
//   - each step is a recorded run (demo-run.json): Aria's findings, Muse Spark's words and the changes Aria made, as Aria
//     logged them, and the "after" audio is what Live played after that step, exported from Live
//   - the spectrum is measured live, in the browser, from whatever is playing
// Mute and solo work on the original tracks; an "after" is Live's export of the whole mix.
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import song from "@/demo-tracks.json";
import run from "@/demo-run.json";

type Done = { text: string; ok: boolean };
type Step = {
  id: string; kind: "check" | "fix" | "ask"; label: string; ask: string | null; reply: string | null;
  note?: { short: string; text: string }; finding?: { kind: string; hz: number; hz_range: number[]; diff_db: number; bars: number[] };
  bands?: { name: string; diff_db: number }[]; done: Done[]; devices: { track: string; name: string }[]; audio: string | null;
  measured?: string | null;
};
const STEPS = run.steps as Step[];

// What each step means for someone who has never mixed a song. Written for the page; the numbers come from the run.
const PLAIN: Record<string, (s: Step) => string> = {
  check: (s) => s.finding
    ? `Aria listened to these 16 bars and compared them with Ian's own finished mix of the same song. The rough version has ${s.finding.diff_db} dB too much around ${s.finding.hz} Hz: that's the boxy, cardboard sound in the low middle, where bass, synths and voice all pile up.`
    : "Aria listened to these 16 bars and looked for sounds that clash or stick out.",
  fix: () => "Ian pressed Fix all. Muse Spark picked a change for each problem, Aria made it in Live, then played the same bars again and measured whether the problem really went away.",
  sidechain: () => "The kick and the bass hit the same low notes at the same time, so they blur. A sidechain makes the bass duck out of the way for a split second every time the kick hits. Listen to the kick get clearer.",
  punch: () => "Aria loaded one of its racks, Aria Punch Through, on the kick: parallel saturation and compression that make the kick cut through the rest of the song.",
};

const COLORS = ["#ff5a4f", "#ffa529", "#10a4ee", "#5cffe8", "#ff94a6"];
const DUR = (song.bars * 4 * 60) / song.tempo;   // 16 bars at 128 BPM: 30 s

/* ---------- audio: the stems and each step's Live export, started together and looped ---------- */
function useMix(afters: { id: string; src: string }[]) {
  const ctx = useRef<AudioContext | null>(null);
  const bufs = useRef<{ stems: AudioBuffer[]; after: Record<string, AudioBuffer> } | null>(null);
  const nodes = useRef<{ srcs: AudioBufferSourceNode[]; stemGain: GainNode[]; before: GainNode; after: Record<string, GainNode>; analyser: AnalyserNode } | null>(null);
  const t0 = useRef(0), offset = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "playing" | "error">("idle");

  const load = useCallback(async () => {
    if (bufs.current) return;
    setState("loading");
    try {
      const ac = ctx.current ?? new AudioContext();
      ctx.current = ac;
      const get = async (src: string) => ac.decodeAudioData(await (await fetch(src)).arrayBuffer());
      const [stems, after] = await Promise.all([
        Promise.all(song.tracks.map((t) => get(`/demo/${t.name}.m4a`))),
        Promise.all(afters.map(async (a) => [a.id, await get(a.src)] as const)),
      ]);
      bufs.current = { stems, after: Object.fromEntries(after) };
      setState("ready");
    } catch {
      setState("error");
    }
  }, [afters]);

  const stop = useCallback(() => {
    const ac = ctx.current, n = nodes.current;
    if (!ac || !n) return;
    offset.current = (ac.currentTime - t0.current) % DUR;
    n.srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    nodes.current = null;
    setState("ready");
  }, []);

  const play = useCallback(async (gains: () => { stems: number[]; before: number; after: Record<string, number> }) => {
    await load();
    const ac = ctx.current, b = bufs.current;
    if (!ac || !b) return;
    await ac.resume();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.82;
    analyser.connect(ac.destination);
    const g = gains();
    const before = ac.createGain();
    before.gain.value = g.before;
    before.connect(analyser);
    const at = ac.currentTime + 0.08, from = offset.current % DUR;
    const srcs: AudioBufferSourceNode[] = [];
    const start = (buf: AudioBuffer, dest: AudioNode) => {
      const s = ac.createBufferSource();
      s.buffer = buf; s.loop = true; s.loopEnd = Math.min(buf.duration, DUR);
      s.connect(dest); s.start(at, from % s.loopEnd);
      srcs.push(s);
    };
    const stemGain = b.stems.map((buf, i) => {
      const sg = ac.createGain();
      sg.gain.value = g.stems[i];
      sg.connect(before);
      start(buf, sg);
      return sg;
    });
    const after: Record<string, GainNode> = {};
    for (const [id, buf] of Object.entries(b.after)) {
      const ag = ac.createGain();
      ag.gain.value = g.after[id] ?? 0;
      ag.connect(analyser);
      start(buf, ag);
      after[id] = ag;
    }
    t0.current = at - from;
    nodes.current = { srcs, stemGain, before, after, analyser };
    setState("playing");
  }, [load]);

  // A short fade between versions, so the switch is instant but never clicks
  const setGains = useCallback((g: { stems: number[]; before: number; after: Record<string, number> }) => {
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
  return { state, play, stop, setGains, position, analyser: () => nodes.current?.analyser ?? null };
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
      const w = (c.width = c.clientWidth * devicePixelRatio), h = (c.height = c.clientHeight * devicePixelRatio);
      const x = (f: number) => (Math.log(f / lo) / Math.log(hi / lo)) * w;
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(255,255,255,0.05)";
      for (const f of [100, 1000, 10000]) g.fillRect(x(f), 0, devicePixelRatio, h);
      if (range) {
        g.fillStyle = "rgba(255,181,50,0.16)";
        g.fillRect(x(range[0]), 0, x(range[1]) - x(range[0]), h);
      }
      if (a) {
        const data = new Float32Array(a.frequencyBinCount);
        a.getFloatFrequencyData(data);
        const bin = a.context.sampleRate / a.fftSize;
        g.beginPath();
        let started = false;
        for (let px = 0; px <= w; px += 2 * devicePixelRatio) {
          const f = lo * Math.pow(hi / lo, px / w);
          // average the bins under this pixel, so the highs don't flicker
          const k0 = Math.floor(f / bin), k1 = Math.max(k0 + 1, Math.floor((lo * Math.pow(hi / lo, (px + 2 * devicePixelRatio) / w)) / bin));
          let sum = 0;
          for (let k = k0; k < k1 && k < data.length; k++) sum += Math.pow(10, data[k] / 10);
          const db = 10 * Math.log10(sum / (k1 - k0) + 1e-12) + 6 * Math.log2(f / 1000) * 0.5;   // gently tilted, as producers' analyzers show it
          const y = h - ((db + 100) / 80) * h;
          if (!started) { g.moveTo(px, y); started = true; } else g.lineTo(px, y);
        }
        g.strokeStyle = "#ffb532";
        g.lineWidth = 1.5 * devicePixelRatio;
        g.stroke();
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, playing, range]);
  return (
    <div className="relative h-[120px] overflow-hidden rounded-[6px] bg-[#161616]">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between font-mono text-[10px] text-[#6a6a6a]"><span>30 Hz</span><span>Low</span><span>Middle</span><span>High</span><span>16 kHz</span></div>
      {!playing && <div className="absolute inset-0 grid place-items-center text-[12px] text-[#7a7a7a]">Press play to see the sound, measured as it plays</div>}
    </div>
  );
}

/* ---------- the demo ---------- */
export function TryIt() {
  const afters = STEPS.filter((s) => s.audio).map((s) => ({ id: s.id, src: s.audio as string }));
  const mix = useMix(afters);
  const [step, setStep] = useState(0);
  const [version, setVersion] = useState<"before" | "after">("before");
  const [mute, setMute] = useState<boolean[]>(song.tracks.map(() => false));
  const [solo, setSolo] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const cur = STEPS[step];
  const hasAfter = !!cur.audio;
  const showAfter = version === "after" && hasAfter;

  const gains = useCallback(() => ({
    stems: song.tracks.map((_, i) => (solo !== null ? (solo === i ? 1 : 0) : mute[i] ? 0 : 1)),
    before: showAfter ? 0 : 1,
    after: Object.fromEntries(afters.map((a) => [a.id, showAfter && a.id === cur.id ? 1 : 0])),
  }), [solo, mute, showAfter, afters, cur.id]);

  useEffect(() => { mix.setGains(gains()); }, [gains, mix]);
  useEffect(() => {
    if (mix.state !== "playing") return;
    let raf = 0;
    const tick = () => { setPos(mix.position()); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mix.state, mix]);

  const playing = mix.state === "playing";
  const beat = Math.floor((pos / DUR) * song.bars * 4);
  const devicesUpTo = STEPS.slice(0, step + 1).flatMap((s) => s.devices);
  const range = cur.finding?.hz_range ?? STEPS[0].finding?.hz_range;

  return (
    <div className="mt-12 overflow-hidden rounded-[22px] border border-edge bg-[#1e1e1e] text-white">
      {/* transport */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/70 bg-[#2a2a2a] px-3 py-2.5 sm:gap-3 sm:px-4">
        <button type="button" onClick={() => (playing ? mix.stop() : mix.play(gains))} disabled={mix.state === "loading"}
                className={cn("flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition", playing ? "bg-white text-black" : "bg-[#7cd38a] text-black hover:brightness-110")}
                aria-label={playing ? "Stop" : "Play"}>
          {mix.state === "loading" ? "Loading…" : playing ? <><span className="size-[9px] rounded-[1px] bg-black" />Stop</> : <><span className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-black" />Play</>}
        </button>
        <span className="rounded-[4px] bg-[#1b1b1b] px-2 py-1 font-mono text-[12px] text-[#d8d8d8]">{Math.floor(beat / 4) + 1} . {(beat % 4) + 1}</span>
        <span className="hidden font-mono text-[12px] text-[#9a9a9a] sm:inline">{song.tempo} BPM · 16 bars, looping</span>
        <div className="ml-auto flex rounded-full bg-[#1b1b1b] p-1" role="group" aria-label="Which version plays">
          {(["before", "after"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVersion(v)} disabled={v === "after" && !hasAfter}
                    className={cn("rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition",
                      (v === "after" ? showAfter : !showAfter) ? (v === "after" ? "bg-[#4ade80] text-black" : "bg-white text-black") : "text-[#9a9a9a] hover:text-white",
                      v === "after" && !hasAfter && "cursor-not-allowed opacity-40 hover:text-[#9a9a9a]")}>
              {v === "before" ? "Before" : "After"}
            </button>
          ))}
        </div>
      </div>
      {mix.state === "error" && <p className="bg-[#3a1d1d] px-4 py-2 text-[13px] text-[#ffb4ac]">The audio didn't load. Reload the page to try again.</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* arrangement */}
        <div className="min-w-0 border-black/70 p-3 sm:p-4 lg:border-r">
          <div className="relative [--lane-left:116px] sm:[--lane-left:132px]">
            <div className="ml-[116px] flex h-5 font-mono text-[10px] text-[#8a8a8a] sm:ml-[132px]">
              {Array.from({ length: song.bars }, (_, i) => <span key={i} className="flex-1 border-l border-white/10 pl-1">{i % 2 === 0 ? i + 1 : ""}</span>)}
            </div>
            {song.tracks.map((t, i) => {
              const color = COLORS[i % COLORS.length], audible = solo !== null ? solo === i : !mute[i];
              const devs = devicesUpTo.filter((d) => d.track === t.name);
              return (
                <div key={t.name} className="flex h-[54px] border-t border-black/60">
                  <div className="flex w-[116px] flex-none items-center gap-1 bg-[#2c2c2c] pl-0 pr-1.5 sm:w-[132px] sm:gap-1.5 sm:pr-2">
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
                      {devs.map((d) => <span key={d.name} className="ml-1 rounded-[2px] bg-black/70 px-1 text-[9px] text-[#4ade80]">{d.name}</span>)}
                    </div>
                    <Wave peaks={t.peaks} />
                  </div>
                </div>
              );
            })}
            <span className="pointer-events-none absolute bottom-0 top-5 w-px bg-white" style={{ left: `calc(var(--lane-left) + (100% - var(--lane-left)) * ${(pos / DUR).toFixed(4)})` }} />
          </div>
          <p className="mt-2 text-[12px] text-faint">{showAfter ? "Playing Live's export after this step. Mute and solo work on the original tracks." : "Mute or solo a track to hear what each one plays."}</p>
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[12px] text-[#9a9a9a]">
              <span>The whole mix, measured as it plays</span>
              {range && <span className="text-[#ffb532]">{range[0]} to {range[1]} Hz: where Aria heard the problem</span>}
            </div>
            <Spectrum analyser={mix.analyser} playing={playing} range={range} />
          </div>
        </div>

        {/* Aria: the recorded run, one step at a time */}
        <div className="flex min-w-0 flex-col bg-[#171717]">
          <div className="flex gap-1 overflow-x-auto border-b border-black/70 p-2" role="tablist" aria-label="Steps of the run">
            {STEPS.map((s, i) => (
              <button key={s.id} type="button" role="tab" aria-selected={i === step} onClick={() => { setStep(i); setVersion(s.audio ? "after" : "before"); }}
                      className={cn("flex-none rounded-full px-3 py-1.5 text-[12.5px] font-medium transition", i === step ? "bg-white text-black" : "text-[#a0a0a0] hover:bg-white/10 hover:text-white")}>
                <span className="mr-1.5 font-mono text-[11px] opacity-60">{i + 1}</span>{s.label}
              </button>
            ))}
          </div>
          <div className="flex-1 space-y-3 p-4">
            <div className="flex items-center gap-2 text-[12px] text-[#8a8a8a]"><span className="mark size-[14px] text-white" />Aria</div>
            {cur.ask && <div className="ml-auto max-w-[85%] rounded-[14px] border border-white/10 px-3.5 py-2.5 text-[14px]">{cur.ask}</div>}
            {cur.reply && <div className="max-w-[92%] rounded-[14px] bg-[#ededef] px-3.5 py-2.5 text-[14px] text-[#0a0a0b]">{cur.reply}</div>}
            {cur.note && (
              <div className="rounded-[14px] bg-[#232325] p-3.5">
                <div className="text-[14px] font-medium">{cur.note.short}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#a8a8ad]">{cur.note.text}</p>
              </div>
            )}
            {cur.done.map((d) => (
              <div key={d.text} className={cn("rounded-[12px] px-3 py-2 text-[13px] font-medium", d.ok ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-[#fb923c]/10 text-[#fb923c]")}>{d.text}</div>
            ))}
            {cur.measured && <div className="rounded-[12px] border border-[#4ade80]/30 px-3 py-2 text-[13px] text-[#d8d8d8]">{cur.measured}</div>}
            <div className="border-t border-white/10 pt-3">
              <div className="text-[12px] font-medium text-[#8a8a8a]">In plain words</div>
              <p className="mt-1 text-[14px] leading-relaxed text-[#d0d0d4]">{(PLAIN[cur.id] ?? (() => ""))(cur)}</p>
              {hasAfter && <p className="mt-2 text-[13px] text-[#4ade80]">Switch Before and After while it plays to hear the change.</p>}
            </div>
          </div>
        </div>
      </div>
      <p className="border-t border-black/70 bg-[#1a1a1a] px-4 py-3 text-[12px] leading-relaxed text-[#7a7a7a]">
        Recorded, not simulated. {run.recorded} Reference: {run.reference}. The audio is in the repo's test-pack/sample, so anyone with Live can run it.
      </p>
    </div>
  );
}
