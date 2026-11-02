// Links both pages use (index.html and demo.html)
export const GITHUB = "https://github.com/Yumstezy/aria";
// The newest release's zip on GitHub: the devices, the engine and a double-click installer (scripts/release.sh makes it)
export const DOWNLOAD = "https://github.com/Yumstezy/aria/releases/latest/download/Aria-mac.zip";
// Ian's video of Aria in Ableton, when it's recorded: a YouTube link, or a file in public/ (like "/demo.mp4").
// Both pages show their video section only once it's set.
export const DEMO_VIDEO: string | null = null;

// A YouTube link becomes its embed address; anything else is played as a file
export function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` : null;
}
