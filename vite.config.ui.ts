// UI: one self-contained HTML file, because Figma loads `ui` as a single file.
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src/ui",
  plugins: [solid(), viteSingleFile()],
  build: {
    target: "es2022",
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: { input: "src/ui/ui.html" },
  },
});
