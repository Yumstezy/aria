// The judges' page: a static build (dist/) that its own Vercel project serves as is.
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  server: { port: 5182 },
  // Two pages: the main page, and the demos page at /demo (vercel.json cleanUrls serves demo.html there)
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), demo: resolve(import.meta.dirname, "demo.html") } } },
});
