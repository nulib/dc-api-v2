import { Formats } from "../../api/src/api/response/formats.ts";

// The IIIF content type as a client may send it in `Accept`, profile and all.
const iiifProfileType = () =>
  `application/ld+json;profile=${Formats.iiif.contentType.profile}`;

// The `as` value a client would use to ask for the same thing, for the comment
// on each `Accept` entry. A media type belongs to the first format that lists
// it, which is also how the API resolves it.
const owningAlias = (mediaType) => {
  for (const [format, { accept, as }] of Object.entries(Formats)) {
    if (accept.includes(mediaType)) return as[0] ?? format;
  }
  return undefined;
};

const unique = (values) => [...new Set(values)];

const asValues = () => unique(Object.values(Formats).flatMap(({ as }) => as));

const acceptValues = () => {
  const values = [];
  for (const { accept } of Object.values(Formats)) {
    for (const mediaType of accept) {
      values.push(mediaType);
      // The profile'd form of the IIIF type is equally acceptable.
      if (mediaType === "application/ld+json") values.push(iiifProfileType());
    }
  }
  return unique(values);
};

// A value needs quoting where YAML would otherwise read it as structure; the
// only such value here is the profile'd IIIF type, which carries quotes.
const quote = (value) => (value.includes('"') ? `'${value}'` : value);

const asEnum = () => asValues().map((value) => `- ${value}`);

const acceptEnum = () =>
  acceptValues().map((mediaType) => {
    const alias = owningAlias(
      mediaType.startsWith("application/ld+json")
        ? "application/ld+json"
        : mediaType,
    );
    const comment = alias ? ` # Same as query parameter "as=${alias}"` : "";
    return `- ${quote(mediaType)}${comment}`;
  });

/**
 * Rewrite the `enum:` block of one parameter in `types.yaml`. The file is
 * edited as text rather than reserialized so its comments and descriptions
 * survive.
 */
function replaceEnum(yaml, parameter, entries) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.match(`^ {4}${parameter}:$`));
  if (start === -1) throw new Error(`no ${parameter} parameter in types.yaml`);

  const enumLine = lines.findIndex(
    (line, index) => index > start && line.trim() === "enum:",
  );
  if (enumLine === -1) throw new Error(`no enum for ${parameter} parameter`);

  const indent = " ".repeat(lines[enumLine].search(/\S/) + 2);
  let end = enumLine + 1;
  while (end < lines.length && lines[end].startsWith(`${indent}- `)) end += 1;

  return [
    ...lines.slice(0, enumLine + 1),
    ...entries.map((entry) => `${indent}${entry}`),
    ...lines.slice(end),
  ].join("\n");
}

/** `types.yaml` with both negotiation enums taken from the format registry. */
export function syncEnums(yaml) {
  return replaceEnum(replaceEnum(yaml, "as", asEnum()), "accept", acceptEnum());
}
