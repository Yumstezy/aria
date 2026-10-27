// Each screen builds to one self-contained HTML file (code, styles and fonts inlined),
// because Max's jweb loads the UI from disk and module scripts won't load over file://.
//   vite build --mode strip   -> dist/strip/index.html
//   vite build --mode window  -> dist/window/index.html
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const screen = mode === "strip" ? "strip" : "window";
  return {
    root: resolve(__dirname, "src/screens", screen),
    base: "./",
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: {
      outDir: resolve(__dirname, "dist", screen),
      emptyOutDir: true,
      assetsInlineLimit: 100_000_000,   // fonts too
    },
    server: { port: screen === "strip" ? 5173 : 5174 },
  };
});
