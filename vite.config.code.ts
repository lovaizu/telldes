// Figma side: one script with no imports, run in Figma's plugin sandbox.
// Built after the UI, so it must not empty dist/.
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2017",
    outDir: "dist",
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: "src/figma/main.ts",
      formats: ["iife"],
      name: "telldes",
      fileName: () => "code.js",
    },
  },
});
