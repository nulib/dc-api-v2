#!/usr/bin/env node
// Local preview: build once, serve site/, and rebuild when a source file changes.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "site");
const watched = ["build.mjs", "lib", "docs"];
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 8000);

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".yaml": "text/yaml; charset=utf-8",
};

function build() {
  const { status } = spawnSync(process.execPath, [path.join(root, "build.mjs")], {
    stdio: "inherit",
  });
  if (status !== 0) console.error("Build failed; serving the previous output.");
}

function resolve(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const file = path.join(outDir, pathname);
  if (!file.startsWith(outDir)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    return path.join(file, "index.html");
  }
  return fs.existsSync(file) ? file : path.join(outDir, "index.html");
}

build();

let pending = null;
for (const target of watched) {
  fs.watch(path.join(root, target), { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(build, 100);
  });
}

http
  .createServer((request, response) => {
    const file = resolve(request.url);
    if (!file || !fs.existsSync(file)) {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, host, () => {
    console.log(`Serving docs on http://${host}:${port}/`);
  });
