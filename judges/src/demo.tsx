// The demos page (Ian, Nov 1: "a new page where it's just demos"): the Try it demo, and Ian's video of Aria in
// Ableton once it's recorded. Same look as the main page, nothing else on it.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "./index.css";
import { TryIt } from "@/components/try-it";
import { DemoVideo } from "@/components/demo-video";
import { Button } from "@/components/ui/button";
import { DEMO_VIDEO, DOWNLOAD, GITHUB } from "@/links";

function Demos() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="mx-auto flex max-w-[1160px] items-center gap-4 px-6 pt-5">
        <a href="/" className="flex items-center gap-2.5 text-[17px] font-semibold"><span className="mark size-[22px]" />Aria</a>
        <a href="/" className="ml-auto text-[14px] text-muted transition-colors hover:text-ink">The full page</a>
        <Button href={DOWNLOAD} variant="filled" size="sm">Download</Button>
      </header>

      <section className="mx-auto max-w-[1160px] px-6 pb-20 pt-16 sm:pt-20">
        <h1 className="max-w-[760px] text-[clamp(32px,4.6vw,52px)] font-medium leading-[1.08] tracking-[-0.04em]">
          <span className="fade-text">Hear Aria fix a real mix.</span> <span className="text-faint">No Ableton needed.</span>
        </h1>
        <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-muted">A house demo Ian made, before mixing. Four steps: listen, let Aria check it, fix it, then compare.</p>
        <TryIt />
      </section>

      {DEMO_VIDEO && (
        <section className="mx-auto max-w-[1160px] border-t border-hairline px-6 py-20">
          <h2 className="max-w-[760px] text-[clamp(28px,3.8vw,44px)] font-medium leading-[1.1] tracking-[-0.04em]">
            <span className="fade-text">Watch it in Ableton.</span> <span className="text-faint">The real thing, in Live.</span>
          </h2>
          <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-muted">Ian using Aria inside Ableton Live on his own song: the check, the fixes and the proof.</p>
          <div className="mt-10"><DemoVideo /></div>
        </section>
      )}

      <footer className="border-t border-hairline py-10">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 text-[13px] text-faint">
          <span className="flex items-center gap-2 text-ink"><span className="mark size-4" />Aria</span>
          <a href="/" className="hover:text-ink">The full page</a>
          <a href={GITHUB} className="hover:text-ink">Code on GitHub</a>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><MotionConfig reducedMotion="user"><Demos /></MotionConfig></StrictMode>);
