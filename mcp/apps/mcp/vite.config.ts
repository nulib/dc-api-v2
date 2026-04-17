import { defineConfig } from "vite";
import path from "node:path";
import version from "./common/version.js";

console.log(`Building MCP version ${version}...`);
export default defineConfig({
  root: path.resolve(__dirname),
  define: {
    "process.env": "process.env", // pass through as-is
    __VERSION__: JSON.stringify(version)
  },
  build: {
    target: "es2022",
    outDir: path.resolve(__dirname, "../../dist/apps/mcp"),
    emptyOutDir: false,
    sourcemap: process.env.PUBLISHING !== "true",
    rollupOptions: {
      external: [/^@aws-sdk\/.+/, /^node:.+/],
      input: path.resolve(__dirname, "handlers/lambda.ts"),
      preserveEntrySignatures: "exports-only",
      output: {
        format: "esm", // or "cjs" if you need require()
        inlineDynamicImports: true,
        manualChunks: undefined,
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]"
      }
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
