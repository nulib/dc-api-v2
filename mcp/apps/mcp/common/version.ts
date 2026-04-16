import fs from "node:fs";

declare const __VERSION__: string | undefined;
let version: string;

if (typeof __VERSION__ === "undefined") {
  const packageJson = new URL("../package.json", import.meta.url);
  version = JSON.parse(fs.readFileSync(packageJson, "utf-8")).version;
} else {
  version = __VERSION__;
}

export default version;
