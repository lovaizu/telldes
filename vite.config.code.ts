import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2020",
    lib: {
      entry: "src/code.ts",
      formats: ["iife"],
      name: "telldes",
    },
    rollupOptions: {
      output: {
        entryFileNames: "code.js",
      },
    },
  },
});
