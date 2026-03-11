import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "../../dist/apps/viewer"),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]"
      }
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
