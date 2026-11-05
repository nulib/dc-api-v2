#!/usr/bin/env bun
// Writes the `as` and `accept` enums in the OpenAPI spec from the API's format
// registry. `build.mjs` fails if the committed file doesn't match.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncEnums } from "../lib/spec-enums.mjs";

const typesFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "spec",
  "types.yaml",
);

const current = fs.readFileSync(typesFile, "utf8");
const synced = syncEnums(current);

if (current === synced) {
  console.log("spec enums already match the format registry");
} else {
  fs.writeFileSync(typesFile, synced);
  console.log(`Updated ${path.relative(process.cwd(), typesFile)}`);
}
