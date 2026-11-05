#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import yaml from "js-yaml";
import { renderContent } from "./lib/markdown.mjs";
import { syncEnums } from "./lib/spec-enums.mjs";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(root, "docs");
const specDir = path.join(contentDir, "spec");
const outDir = path.join(root, "site");

const SITE_TITLE = "NUL Digital Collections API";

// One ReDoc sidebar section per page of the old MkDocs nav. The API reference
// that follows them is grouped under SPEC_GROUP.
const SECTIONS = [
  { title: "Overview", file: "index.md" },
  { title: "Response Formats", file: "formats.md" },
  { title: "Protocol for Metadata Harvesting (OAI-PMH)", file: "oai.md" },
];
const SPEC_GROUP = "OpenAPI Specification";

// Spec files that are published alongside the site and merged into the copy
// ReDoc renders.
const SPEC_PARTS = ["types.yaml", "data-types.yaml"];

const loadYaml = (file) => yaml.load(fs.readFileSync(file, "utf8"));

// The negotiation enums are generated from the API's format registry, so a
// format added there and not synced here would publish a spec that lies.
function checkSpecEnums() {
  const file = path.join(specDir, "types.yaml");
  const current = fs.readFileSync(file, "utf8");
  if (syncEnums(current) !== current) {
    throw new Error(
      "spec/types.yaml is out of date with the format registry; run `bun run sync-spec`",
    );
  }
}

// ReDoc is handed a spec object rather than a URL, so external `$ref`s have to
// be resolved up front. Our parts never collide, so merging `components` and
// rewriting the file prefixes keeps every schema's name intact.
function mergeSpec() {
  const spec = loadYaml(path.join(specDir, "openapi.yaml"));
  spec.components ??= {};
  for (const file of SPEC_PARTS) {
    const part = loadYaml(path.join(specDir, file));
    for (const [section, members] of Object.entries(part.components ?? {})) {
      const target = (spec.components[section] ??= {});
      for (const [name, value] of Object.entries(members)) {
        if (name in target) {
          throw new Error(`${file} redefines components/${section}/${name}`);
        }
        target[name] = value;
      }
    }
  }
  return localizeRefs(spec);
}

function localizeRefs(node) {
  if (Array.isArray(node)) return node.map(localizeRefs);
  if (node === null || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) =>
      key === "$ref" && typeof value === "string"
        ? [key, value.replace(/^\.\/[\w-]+\.yaml#/, "#")]
        : [key, localizeRefs(value)],
    ),
  );
}

// Declared tags first, in spec order, then any tag only used by an operation.
function allTags(spec) {
  const tags = (spec.tags ?? []).map(({ name }) => name);
  for (const operations of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(operations)) {
      for (const tag of operation?.tags ?? []) {
        if (!tags.includes(tag)) tags.push(tag);
      }
    }
  }
  return tags;
}

// ReDoc drops any tag that no group claims, so whatever the spec declares is
// kept as-is and everything left over goes into a trailing group. With no
// groups declared at all that single group holds the whole reference, which is
// what gives the sidebar its third top-level entry.
function tagGroups(spec) {
  const groups = (spec["x-tagGroups"] ?? []).map((group) => ({
    ...group,
    tags: [...(group.tags ?? [])],
  }));
  const grouped = new Set(groups.flatMap(({ tags }) => tags));
  const ungrouped = allTags(spec).filter((tag) => !grouped.has(tag));

  if (ungrouped.length > 0) groups.push({ name: SPEC_GROUP, tags: ungrouped });
  return groups;
}

function buildDescription() {
  return SECTIONS.map(({ title, file }) => {
    const markdown = fs.readFileSync(path.join(contentDir, file), "utf8");
    return `# ${title}\n\n${renderContent(markdown).trim()}`;
  }).join("\n\n");
}

const REDOC_OPTIONS = {
  scrollYOffset: 60,
  hideDownloadButton: true,
  expandResponses: "200",
  jsonSampleExpandLevel: 2,
  pathInMiddlePanel: true,
  theme: {
    colors: { primary: { main: "#401f68" } },
    typography: {
      fontFamily:
        '"Akkurat Pro Regular", -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif',
      headings: {
        fontFamily:
          '"Campton Bold", -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif',
      },
    },
    sidebar: { width: "280px", backgroundColor: "#f5f3f7" },
    // ReDoc pads every section by 40px top and bottom, which leaves a lot of
    // air between the prose sections of the description.
    spacing: { sectionVertical: 16 },
  },
};

// `<` is escaped so the embedded spec can never close the script element.
const embed = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function page(spec) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SITE_TITLE}</title>
    <link rel="stylesheet" href="css/fonts.css" />
    <link rel="stylesheet" href="css/overrides.css" />
  </head>
  <body>
    <header class="docs-header">
      <a class="docs-header__home" href="https://www.library.northwestern.edu">
        <img src="assets/nul-logo.svg" alt="Northwestern University Libraries" />
      </a>
      <span class="docs-header__title">Digital Collections API</span>
      <a class="docs-header__repo" href="https://github.com/nulib/dc-api-v2">nulib/dc-api-v2</a>
    </header>
    <div id="redoc"></div>
    <script src="redoc.standalone.js"></script>
    <script src="js/tabs.js"></script>
    <script>
      Redoc.init(${embed(spec)}, ${embed(REDOC_OPTIONS)}, document.getElementById("redoc"));
    </script>
  </body>
</html>
`;
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

function build() {
  checkSpecEnums();
  const spec = mergeSpec();
  spec.info.description = buildDescription();
  spec["x-tagGroups"] = tagGroups(spec);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const dir of ["assets", "css", "js", "spec"]) {
    copyDir(path.join(contentDir, dir), path.join(outDir, dir));
  }
  fs.copyFileSync(
    require.resolve("redoc/bundles/redoc.standalone.js"),
    path.join(outDir, "redoc.standalone.js"),
  );
  fs.writeFileSync(path.join(outDir, "index.html"), page(spec));

  console.log(`Built ${path.relative(process.cwd(), outDir)}/`);
}

build();
