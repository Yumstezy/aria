// Ian's video of Aria in Ableton (links.ts DEMO_VIDEO): a YouTube embed, or a file played in place
import { DEMO_VIDEO, youtubeEmbed } from "@/links";

export function DemoVideo() {
  if (!DEMO_VIDEO) return null;
  const embed = youtubeEmbed(DEMO_VIDEO);
  return (
    <div className="overflow-hidden rounded-[22px] border border-edge bg-card">
      {embed
        ? <iframe src={embed} title="Aria in Ableton Live" className="block aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        : <video src={DEMO_VIDEO} controls playsInline preload="metadata" className="block aspect-video w-full" />}
    </div>
  );
}
