// Talk to Muse: record the microphone in the page, send it to the engine, and Muse Voice Transcribe
// (Meta) turns it into words, which go to Ask Muse like typed ones. The engine converts the recording
// to the 16 kHz mono 16-bit WAV the API needs, so this sends plain 16-bit WAV at the mic's own rate.
import { ENGINE } from "@/lib/aria";

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let node: ScriptProcessorNode | null = null;
let chunks: Float32Array[] = [];
const TIMEOUT_MS = 20000;   // never stuck "hearing"

/** Start listening. Throws a plain reason when the microphone isn't allowed. */
export async function startRecording() {
  if (stream) return;   // already recording: never open the mic twice
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This view can't reach the microphone.");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new Error("The microphone isn't allowed here. Check that Live may use it in macOS Settings, Privacy, Microphone.");
  }
  ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  node = ctx.createScriptProcessor(4096, 1, 1);
  chunks = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);   // ScriptProcessor only runs when connected; it outputs silence
}

/** Stop and return the recording as a 16-bit mono WAV. */
export async function stopRecording(): Promise<Blob> {
  const rate = ctx?.sampleRate ?? 48000;
  node?.disconnect();
  stream?.getTracks().forEach((t) => t.stop());
  await ctx?.close();
  ctx = null; stream = null; node = null;
  const n = chunks.reduce((s, c) => s + c.length, 0);
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, n * 2, true);
  let at = 44;
  for (const c of chunks) for (const v of c) { view.setInt16(at, Math.max(-1, Math.min(1, v)) * 0x7fff, true); at += 2; }
  chunks = [];
  return new Blob([view], { type: "audio/wav" });
}

/** The words in a recording, by Muse Voice Transcribe through the engine. */
export async function transcribe(wav: Blob): Promise<string> {
  let res: Response;
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    res = await fetch(ENGINE + "/voice/transcribe", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav, signal: stop.signal });
  } catch {
    throw new Error(stop.signal.aborted ? "Muse took too long to hear that. Try again." : "The Aria engine isn't running.");
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Muse couldn't hear that (HTTP ${res.status}).`);
  return typeof body.text === "string" ? body.text : "";
}
