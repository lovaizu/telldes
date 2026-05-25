import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [solidPlugin(), viteSingleFile()],
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: false,
    target: "es2020",
    rollupOptions: {
      input: "src/ui.html",
    },
  },
});
