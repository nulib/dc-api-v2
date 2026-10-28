import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";

loadLanguages(["bash", "javascript", "json", "powershell", "python", "ruby"]);

// Language names as they appear in our Markdown, mapped to Prism grammars.
const ALIASES = { sh: "bash", shell: "bash", js: "javascript", py: "python" };

const TAB = /^=== "(.+)"\s*$/;
const FENCE = /^```(\S+)?(?:\s+title="([^"]*)")?\s*$/;

let groupCount = 0;

function escapeHtml(text) {
  return text.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
  );
}

// Newlines are encoded as character references so the whole tab group can be
// emitted on a single physical line; a blank line would end the HTML block and
// send the rest of the group back through the Markdown parser.
function highlight(code, lang) {
  const name = ALIASES[lang] ?? lang;
  const grammar = name && Prism.languages[name];
  const html = grammar ? Prism.highlight(code, grammar, name) : escapeHtml(code);
  return html.replace(/\n/g, "&#10;");
}

function trimBlank(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

// A tab body is a single fenced block, optionally carrying a `title="..."`.
function parseTabBody(body) {
  const lines = trimBlank(body);
  const open = lines[0]?.match(FENCE);
  if (!open) return { lang: null, title: null, code: lines.join("\n") };
  const close = lines.lastIndexOf("```");
  return {
    lang: open[1] ?? null,
    title: open[2] ?? null,
    code: lines.slice(1, close === -1 ? lines.length : close).join("\n"),
  };
}

function caption(title) {
  return title ? `<div class="code-caption">${escapeHtml(title)}</div>` : "";
}

// ReDoc renders `info.description` as Markdown and leaves raw HTML alone, but a
// block-level HTML element ends at the first blank line, so the whole tab group
// has to be emitted as one unbroken line (see `highlight`).
function renderTabs(tabs) {
  groupCount += 1;
  const id = `code-tabs-${groupCount}`;
  const labels = tabs
    .map(
      ({ label }, index) =>
        `<button type="button" class="code-tabs__label${index === 0 ? " is-active" : ""}" data-tab="${index}">${escapeHtml(label)}</button>`,
    )
    .join("");
  const panels = tabs
    .map(({ lang, title, code }, index) => {
      const language = ALIASES[lang] ?? lang ?? "none";
      return `<div class="code-tabs__panel${index === 0 ? " is-active" : ""}" data-tab="${index}">${caption(title)}<pre class="code-tabs__code language-${escapeHtml(language)}"><code>${highlight(code, lang)}</code></pre></div>`;
    })
    .join("");
  return `<div class="code-tabs" id="${id}"><div class="code-tabs__labels" role="tablist">${labels}</div><div class="code-tabs__panels">${panels}</div></div>`;
}

/**
 * Translate the Material for MkDocs extensions we use into something ReDoc can
 * render: `=== "Label"` tab groups become a small HTML tab widget, and fence
 * titles become captions (ReDoc treats everything after the language name as
 * part of the language name).
 */
export function renderContent(markdown) {
  const lines = markdown.split("\n");
  const out = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    if (TAB.test(line)) {
      const tabs = [];
      while (i < lines.length && TAB.test(lines[i])) {
        const label = lines[i].match(TAB)[1];
        const body = [];
        i += 1;
        while (
          i < lines.length &&
          !TAB.test(lines[i]) &&
          (lines[i].trim() === "" || lines[i].startsWith("    "))
        ) {
          body.push(lines[i].replace(/^ {4}/, ""));
          i += 1;
        }
        tabs.push({ label, ...parseTabBody(body) });
      }
      out.push("", renderTabs(tabs), "");
      continue;
    }

    const fence = line.match(FENCE);
    if (fence?.[2]) {
      out.push(caption(fence[2]), "", `\`\`\`${fence[1] ?? ""}`);
      i += 1;
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out.join("\n");
}
