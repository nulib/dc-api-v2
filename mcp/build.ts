import pkg from "./apps/mcp/package.json" with { type: "json" };

const sourcemap = process.env.PUBLISHING !== "true" ? "external" : "none";

console.log(`Building MCP version ${pkg.version}...`);

const result = await Bun.build({
  entrypoints: ["./apps/mcp/handlers/lambda.ts"],
  outdir: "./dist/apps/mcp",
  format: "esm",
  target: "node",
  external: ["@aws-sdk/*", "node:*"],
  sourcemap,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    "process.env": "process.env",
  },
  naming: "[name].[ext]",
});

if (!result.success) {
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}
