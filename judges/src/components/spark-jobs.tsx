// "What Muse Spark does in Aria" (Nov 3, Ian: a feel for the product on the demo page). Six jobs, each shown with
// a real output, never an example: the first note is from demo-lean.json (a real Mix check of the rough mix); the
// rest are from Aria's logs in Live and the README's recorded runs (sources in the footnote).
import { motion } from "motion/react";
import lean from "@/demo-lean.json";

const note = lean.mixes[0].muse_notes[0];

function Did({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 self-start rounded-[14px] bg-white/[0.06] px-3 py-2 text-[13.5px] font-semibold leading-snug text-good">
      <svg width="12" height="12" viewBox="0 0 12 12" className="mt-[3px] flex-none" aria-hidden><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>{children}</span>
    </p>
  );
}
const Muse = ({ children }: { children: React.ReactNode }) => <p className="self-start rounded-[16px] bg-ink px-4 py-2.5 text-[14.5px] leading-snug text-black">{children}</p>;
const Mono = ({ children }: { children: React.ReactNode }) => <p className="font-mono text-[12.5px] leading-relaxed text-faint">{children}</p>;

const JOBS: { title: string; body: React.ReactNode }[] = [
  { title: "Says it plainly", body: <><p className="text-[16px] font-medium">{note.short}</p><Muse>{note.text}</Muse></> },
  { title: "Fixes it in Live", body: <><Did>Added an EQ Eight on “BASSLINE”. Bell −1.90&nbsp;dB at 319&nbsp;Hz, Q&nbsp;1.</Did><Did>The Compressor now listens to “KICK&nbsp;TEST”.</Did><Mono>Live’s own devices. Every change has Undo.</Mono></> },
  { title: "Hears what you say", body: <><p className="flex items-center gap-2 self-end rounded-[16px] border border-edge bg-card-2 px-4 py-2.5 text-[14.5px]"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="4.5" y="1" width="5" height="8" rx="2.5" fill="none" stroke="#8a8a92" strokeWidth="1.4" /><path d="M2.5 6.5a4.5 4.5 0 0 0 9 0M7 11v2" fill="none" stroke="#8a8a92" strokeWidth="1.4" strokeLinecap="round" /></svg>Cut the mud on the bass</p><Mono>Muse Voice Transcribe turned it into text in 1.4 s, then it ran like a typed request.</Mono></> },
  { title: "Asks when it isn’t sure", body: <><Muse>Which vocal track do you mean, VOCAL TEST or Vox&nbsp;2?</Muse><Mono>It asks instead of guessing which track to change.</Mono></> },
  { title: "Reads your screen", body: <><div className="flex flex-wrap gap-2 font-mono text-[12.5px]">{["EQ Eight · band 4", "3.62 kHz", "−3.50 dB", "Q 6.00"].map((c) => <span key={c} className="rounded-[8px] bg-white/[0.06] px-2.5 py-1.5">{c}</span>)}</div><Mono>Read from a screenshot of a plugin, and tied to the harsh spot Aria had measured.</Mono></> },
  { title: "Proves it worked", body: <><p className="text-[34px] font-light tracking-[-0.03em] text-good">6.9 dB lower</p><Mono>A planted harsh boost, after the fix: the same bars played again at the same loudness. 3 dB or more counts as Fixed.</Mono></> },
];

export function SparkJobs() {
  return (
    <>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {JOBS.map((j, k) => (
          <motion.div key={j.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.35, delay: (k % 3) * 0.06 }}
                      className="flex flex-col gap-3 rounded-[22px] border border-edge bg-card p-5 sm:p-6">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint"><span className="font-mono text-white/30">0{k + 1}</span>{j.title}</p>
            {j.body}
          </motion.div>
        ))}
      </div>
      <p className="mt-5 text-[12px] leading-relaxed text-faint">All real outputs. 01 is Muse Spark on the sample rough mix (above). 02 is from Aria’s logs in Live. 03 to 06 are recorded runs described in the README. Muse Spark picks every change from a fixed menu, and Aria checks it before anything happens.</p>
    </>
  );
}
