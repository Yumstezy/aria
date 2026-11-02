// "Try it": a small Live with Aria in it, on the page (Nov 1, Ian: "a mini Ableton in the website so the judges can
// see the changes made using the software"; then "it blends into the site ... the check mix, the text box and
// everything should work"). Nothing here is simulated:
//   - the five tracks are the unmixed stems in test-pack/sample, their waveforms from their own peaks (demo-tracks.json)
//   - every step is a recorded run (demo-run.json): Aria's findings, Muse Spark's words and the changes Aria made, as
//     Aria logged them; each "after" is what Live played after that step, exported from Live
//   - the spectrum is measured live, in the browser, from whatever is playing
// Four steps in order, one sentence and one button each (Ian, Nov 1: the Live-style version was "cluttered and
// overwhelming and the site is clean"): Listen, Check, Fix, Compare. Check and Fix replay what really happened,
// faster than real time. Waveforms are detailed, one column a pixel, colored by each moment's lows, mids and highs;
// judges/scripts/make_demo_data.py measured them from the stems.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
const FIX = STEPS.find((s) => s.kind === "fix") ?? null;
const ASKS = STEPS.filter((s) => s.kind === "ask");

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
type Wave = { n: number; p: string; r: string; c: string };
const bytes = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

// A detailed waveform, drawn the way pro DJ and audio software draws one (Ian, Nov 2): one thin column per screen
// pixel, its peak faint and its body (RMS) bright inside it, each column colored by its own sound: red lows, pink
// mids, cyan highs (make_demo_data.py). Heights are the measured levels, eased a little (^0.8) so quiet parts show.
function WaveCanvas({ wave }: { wave: Wave }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const data = useMemo(() => ({ p: bytes(wave.p), r: bytes(wave.r), c: bytes(wave.c) }), [wave]);
  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const draw = () => {
      const ctx = el.getContext("2d"), dpr = window.devicePixelRatio || 1;
      const W = Math.round(el.clientWidth * dpr), H = Math.round(el.clientHeight * dpr);
      if (!ctx || !W) return;
      el.width = W; el.height = H;
      ctx.clearRect(0, 0, W, H);
      const { p, r, c } = data, n = wave.n, mid = H / 2, ease = (v: number) => Math.pow(v / 255, 0.8) * (mid - dpr);
      for (let x = 0; x < W; x++) {
        // The source columns under this pixel: their loudest peak and body, the color of the loudest body
        const i0 = Math.floor((x * n) / W), i1 = Math.max(i0 + 1, Math.floor(((x + 1) * n) / W));
        let pk = 0, rm = 0, at = i0;
        for (let i = i0; i < i1 && i < n; i++) { if (p[i] > pk) pk = p[i]; if (r[i] > rm) { rm = r[i]; at = i; } }
        const rgb = `${c[at * 3]},${c[at * 3 + 1]},${c[at * 3 + 2]}`;
        const hp = Math.max(dpr * 0.5, ease(pk)), hr = Math.min(hp, ease(Math.min(255, rm * 1.4)));
        ctx.fillStyle = `rgba(${rgb},0.42)`; ctx.fillRect(x, mid - hp, 1, hp * 2);
        ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(x, mid - hr, 1, hr * 2);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wave, data]);
  return <canvas ref={cv} className="block size-full" aria-hidden="true" />;
}

const STAGES = ["Listen", "Check", "Fix", "Compare"] as const;
type Stage = 0 | 1 | 2 | 3;

// The three changes of the fix in plain words, each with its real values from the run
const plainChange = (t: string) => {
  const low = (w: string) => w.toLowerCase();
  let m = t.match(/on "(\w+)"[.:] band \d+ Bell (-?[\d.]+) dB at ([\d.]+ k?Hz)/i);
  if (m) { const db = Math.round(parseFloat(m[2])); return db < 0 ? `Cut the ${low(m[1])} ${-db} dB at ${m[3]}` : `Lifted the ${low(m[1])} ${db} dB at ${m[3]}`; }
  m = t.match(/on "(\w+)": band \d+ Low Pass \w+ at ([\d.]+ k?Hz)/i);
  if (m) return `Cut everything in the ${low(m[1])} above ${m[2]}`;
  m = t.match(/on "(\w+)": band \d+ High Shelf (-?[\d.]+) dB at ([\d.]+) kHz/i);
  if (m) return `Added ${Math.round(parseFloat(m[2]))} dB of air to the ${low(m[1])} above ${Math.round(parseFloat(m[3]))} kHz`;
  m = t.match(/Added an? (Reverb|Delay) on "(\w+)"/);
  if (m) return `Added a ${low(m[1])} to the ${low(m[2])}`;
  m = t.match(/"(\w+)" (down|up) ([\d.]+) dB/);
  if (m) return `Turned the ${low(m[1])} ${m[2]} ${Math.round(parseFloat(m[3]))} dB`;
  return t.replace(/\.+$/, "");
};

// One request's changes in plain words. Back-to-back volume moves on the same track read as one, with where the
// fader ended ("Turned the vocal down 12 dB, to -12 dB", not "down 6 dB, then down 6 dB")
const plainSteps = (done: { ok: boolean; text: string }[]) => {
  const out: string[] = [];
  let run: { track: string; dir: string; db: number; now: number } | null = null;
  const flush = () => { if (run) out.push(`Turned the ${run.track.toLowerCase()} ${run.dir} ${Math.round(run.db)} dB, to ${Math.round(run.now)} dB`); run = null; };
  for (const d of done.filter((x) => x.ok)) {
    const m = d.text.match(/^"(\w+)" (down|up) ([\d.]+) dB, now (-?[\d.]+) dB/);
    if (m && run && run.track === m[1] && run.dir === m[2]) { run.db += parseFloat(m[3]); run.now = parseFloat(m[4]); continue; }
    flush();
    if (m) run = { track: m[1], dir: m[2], db: parseFloat(m[3]), now: parseFloat(m[4]) };
    else out.push(plainChange(d.text));
  }
  flush();
  return out.map((t, k) => (k ? t.replace(/^\w/, (c) => c.toLowerCase()) : t)).join(", then ");
};

/* ---------- the demo ---------- */
export function TryIt() {
  const mix = useMix();
  const [stage, setStage] = useState<Stage>(0);
  const [busy, setBusy] = useState<string | null>(null);   // what Aria is doing right now, in a few words
  const [solo, setSolo] = useState<number | null>(null);
  const [version, setVersion] = useState<"before" | "after">("before");
  const [more, setMore] = useState(false);
  const [how, setHow] = useState(false);
  const playhead = useRef<HTMLDivElement>(null);

  const checked = stage >= 1 && busy === null;
  const fixed = stage >= 2;
  const showAfter = stage === 3 && version === "after";
  const gains = useCallback((): Gains => ({
    stems: song.tracks.map((_, i) => (solo === null || solo === i ? 1 : 0)),
    before: showAfter ? 0 : 1,
    after: Object.fromEntries(STEPS.filter((s) => s.audio).map((s) => [s.id, showAfter && s.id === FIX?.id ? 1 : 0])),
  }), [solo, showAfter]);
  useEffect(() => { mix.setGains(gains()); }, [gains, mix]);
  useEffect(() => {
    let raf = 0;
    const tick = () => { if (playhead.current) playhead.current.style.left = `${((mix.position() / DUR) * 100).toFixed(3)}%`; raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mix]);
  const playing = mix.state === "playing";
  const ensurePlaying = (g: Gains = gains()) => { if (mix.state !== "playing") mix.play(g, 0); };
  const toggle = () => (playing ? mix.stop() : mix.play(gains()));

  // Space plays and pauses while the pointer is over the demo or focus is in it, instead of scrolling the page
  // (Ian, Nov 1: "alow for pressing pause (space bar to pause) instead of it scrolling u down")
  const card = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  const toggleRef = useRef(toggle);
  toggleRef.current = () => { if (mix.state !== "loading") toggle(); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!hover.current) {
        if (!card.current?.contains(document.activeElement)) return;
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;   // keyboard users press the focused button
      }
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const check = async () => {
    setSolo(null);
    setStage(1);
    ensurePlaying({ ...gains(), stems: song.tracks.map(() => 1) });
    for (const t of ["Listening to the 16 bars", "Hearing each track on its own", "Muse Spark is reading the measurements"]) { setBusy(t); await sleep(1100); }
    setBusy(null);
  };
  const fix = async () => {
    setStage(2);
    setBusy("Muse Spark is making room");
    await sleep(1500);
    setBusy(null);
  };
  const compare = () => {
    setSolo(null);
    setStage(3);
    setMore(false);
    setVersion("after");
    ensurePlaying({ ...gains(), stems: song.tracks.map(() => 1), before: 0, after: FIX ? { [FIX.id]: 1 } : {} });
  };

  const leads = song.tracks.findIndex((t) => t.name === "LEADS");
  const changes = FIX ? FIX.done.filter((d) => d.ok).map((d) => plainChange(d.text)) : [];
  const fixedTracks = new Set(FIX ? FIX.devices.map((d) => d.track) : []);
  const lowMids = reveal.bands.find((b) => b.name === "Low mids" && b.diff_db < 0);

  // One sentence and one button per step
  const say: Record<Stage, string> = {
    0: "Ian's song, 16 bars, before any mixing. Tap a track's name to hear it alone.",
    1: busy ?? "The lead melody is buried. The rest of the song covers it most of the time, so you barely hear it.",
    2: busy ?? "Muse Spark made room for the leads instead of just turning them up:",
    3: `After the fix and Ian's ${ASKS.length} requests. Same 16 bars, same loudness.` + (lowMids ? ` The boxy low mids are ${Math.abs(lowMids.diff_db)} dB cleaner.` : ""),
  };
  const action: Record<Stage, { label: string; run: () => void } | null> = {
    0: { label: "Check the mix", run: check },
    1: checked ? { label: "Fix it", run: fix } : null,
    2: busy === null ? { label: "Compare before and after", run: compare } : null,
    3: { label: "Start over", run: () => { mix.stop(); setStage(0); setVersion("before"); setMore(false); } },
  };

  return (
    <div ref={card} onPointerEnter={() => (hover.current = true)} onPointerLeave={() => (hover.current = false)}
         className="mt-12 overflow-hidden rounded-[22px] border border-edge bg-card">
      {/* the four steps, in order */}
      <ol className="flex border-b border-hairline px-5 sm:px-7">
        {STAGES.map((name, i) => (
          <li key={name} className={cn("relative py-4 pr-4 text-[13px] transition-colors duration-300 sm:pr-10 sm:text-[14px]", i === stage ? "text-ink" : i < stage ? "text-muted" : "text-faint")}>
            <span className="mr-2 tabular-nums opacity-60">{i + 1}</span>{name}
            {i === stage && <motion.span layoutId="stage-line" className="absolute inset-x-0 -bottom-px mr-4 h-[2px] bg-ink sm:mr-10" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
          </li>
        ))}
      </ol>

      {/* the song: five tracks, or the whole mix when comparing */}
      <div className="relative px-5 pt-6 sm:px-7">
        <AnimatePresence mode="wait" initial={false}>
          {stage < 3 ? (
            <motion.div key="tracks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative">
              {song.tracks.map((t, i) => {
                const focus = stage >= 1 && busy === null && stage < 3 ? i === leads : null;   // after the check, the leads are the story
                const heard = solo === null || solo === i;
                return (
                  <div key={t.name} className="flex h-[60px] items-center gap-4 sm:h-[72px]">
                    <button type="button" onClick={() => setSolo((s) => (s === i ? null : i))}
                            className={cn("w-[58px] flex-none text-left text-[12.5px] transition-colors sm:w-[72px]", solo === i ? "text-ink" : "text-faint hover:text-muted")}
                            aria-pressed={solo === i} aria-label={`Hear ${t.name.toLowerCase()} alone`}>
                      {t.name.charAt(0) + t.name.slice(1).toLowerCase()}
                    </button>
                    <div className={cn("relative h-full min-w-0 flex-1 py-[7px] transition-opacity duration-500",
                      !heard ? "opacity-15" : focus === false ? "opacity-25" : "opacity-100")}>
                      <WaveCanvas wave={t as unknown as Wave} />
                      {focus === true && <motion.div layoutId="focus" className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-[#ff8a5b]/60" />}
                    </div>
                    <span className={cn("w-[28px] flex-none text-right text-[11.5px] text-good sm:w-[56px] transition-opacity duration-500", fixed && fixedTracks.has(t.name) ? "opacity-100" : "opacity-0")}>EQ</span>
                  </div>
                );
              })}
              <div className="pointer-events-none absolute inset-y-0 left-[74px] right-[44px] sm:left-[88px] sm:right-[72px]">
                <div ref={playhead} className={cn("absolute inset-y-0 w-px bg-white/70 transition-opacity", playing ? "opacity-100" : "opacity-0")} style={{ left: 0 }} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="mix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <div className="relative h-[150px] opacity-90 sm:h-[190px]">
                {(["before", "after"] as const).map((v) => (
                  <div key={v} className="absolute inset-0 py-4 transition-opacity duration-500" style={{ opacity: version === v ? 1 : 0 }}>
                    <WaveCanvas wave={reveal[v] as unknown as Wave} />
                  </div>
                ))}
                <div ref={playhead} className="pointer-events-none absolute inset-y-0 w-px bg-white/70" style={{ left: 0 }} />
              </div>
              <div className="mt-2 flex justify-center">
                <div className="flex rounded-full bg-white/[0.06] p-1" role="group" aria-label="Which version plays">
                  {(["before", "after"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setVersion(v)}
                            className={cn("relative rounded-full px-8 py-2.5 text-[15px] font-medium transition-colors sm:px-12", version === v ? "text-black" : "text-muted hover:text-ink")}>
                      {version === v && <motion.span layoutId="ab" className={cn("absolute inset-0 rounded-full", v === "after" ? "bg-good" : "bg-white")} transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                      <span className="relative">{v === "before" ? "Before" : "After Aria"}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* what's happening, and the one thing to do next */}
      <div className="flex flex-col gap-5 px-5 pb-6 pt-6 sm:flex-row sm:items-start sm:gap-6 sm:px-7">
        <button type="button" onClick={toggle} disabled={mix.state === "loading"}
                className="grid size-12 flex-none place-items-center rounded-full bg-white text-black transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:opacity-60"
                aria-label={playing ? "Pause" : "Play"}>
          {mix.state === "loading" ? <span className="size-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            : playing ? <span className="flex gap-[4px]"><span className="h-[14px] w-[4px] rounded-[1px] bg-black" /><span className="h-[14px] w-[4px] rounded-[1px] bg-black" /></span>
            : <span className="ml-[3px] h-0 w-0 border-y-[8px] border-l-[13px] border-y-transparent border-l-black" />}
        </button>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.p key={`${stage}-${busy ?? ""}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                      className={cn("max-w-[560px] text-[16px] leading-relaxed", busy ? "text-muted" : "text-ink")}>
              {mix.state === "error" ? "The audio didn't load in this browser. Reload the page to try again." : say[stage]}
            </motion.p>
          </AnimatePresence>
          {stage === 2 && busy === null && (
            <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.18 } } }} className="mt-3 space-y-1.5">
              {changes.map((c) => (
                <motion.li key={c} variants={{ h: { opacity: 0, x: -6 }, s: { opacity: 1, x: 0 } }} className="flex items-center gap-2.5 text-[15px] text-muted">
                  <span className="size-1.5 flex-none rounded-full bg-good" />{c}
                </motion.li>
              ))}
            </motion.ul>
          )}
          {stage === 2 && busy === null && ASKS.length > 0 && (
            <div className="mt-4">
              <button type="button" onClick={() => setMore((x) => !x)} className="text-[13.5px] text-faint underline-offset-4 hover:text-muted hover:underline">
                {more ? "Hide the rest of the run" : `See what Ian asked next (${ASKS.length} more requests)`}
              </button>
              <AnimatePresence>
                {more && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {ASKS.map((a) => (
                      <li key={a.id} className="mt-3 max-w-[560px] text-[14px] leading-relaxed">
                        <span className="text-ink">"{a.ask}"</span>
                        <span className="block text-muted">{plainSteps(a.done)}.</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        {action[stage] && (
          <Button onClick={action[stage]!.run} variant={stage === 3 ? "outlined" : "filled"} size="sm" className="flex-none self-start">{action[stage]!.label}</Button>
        )}
      </div>

      {/* where it came from, in one line */}
      <div className="border-t border-hairline px-5 py-3.5 text-[12.5px] text-faint sm:px-7">
        Replays Ian's real run in Live with Aria and Muse Spark, faster than real time.{" "}
        <button type="button" onClick={() => setHow((x) => !x)} className="underline underline-offset-4 hover:text-muted">{how ? "Hide" : "How this was recorded"}</button>
        <AnimatePresence>
          {how && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-2 leading-relaxed">
              {run.recorded} {run.after_note} {reveal.source} The five tracks are in the repo's test-pack/sample, so anyone with Live can run it for real.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
