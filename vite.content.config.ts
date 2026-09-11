import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(root, "src/content.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/content.js",
      },
    },
  },
});
