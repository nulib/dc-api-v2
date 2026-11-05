import { expect } from "bun:test";
import { Formats } from "../../src/api/response/formats.ts";
import type { ResponseFormat } from "../../src/api/response/formats.ts";

type ResponseFormatType = ResponseFormat | "xml";

// The negotiated formats, plus the plain XML that OAI-PMH responses carry.
const ResponseFormatContentTypes: Record<
  ResponseFormatType,
  Readonly<Record<string, string | undefined>>
> = {
  opensearch: Formats.opensearch.contentType,
  iiif: Formats.iiif.contentType,
  c2pa: Formats.c2pa.contentType,
  premisxml: Formats.premisxml.contentType,
  premisjson: Formats.premisjson.contentType,
  xml: { mime: "application/xml", charset: "UTF-8" },
};

declare module "bun:test" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<T> {
    toHaveResponseFormat(type: ResponseFormatType): void;
  }
  interface AsymmetricMatchers {
    toHaveResponseFormat(type: ResponseFormatType): void;
  }
}

const parseContentType = (contentType: string) => {
  const [mime, ...rest] = contentType.split(";").map((s) => s.trim());
  const params = Object.fromEntries(
    rest.map((p) => p.split("=").map((s) => s.trim())),
  );
  return { mime, ...params };
};

expect.extend({
  toHaveResponseFormat(received: unknown, type: ResponseFormatType) {
    const contentType =
      (received as Response).headers.get("content-type") ?? "";
    const parsed = parseContentType(contentType);
    const expected = ResponseFormatContentTypes[type];
    const pass = Object.entries(expected).every(
      ([key, value]) => parsed[key] === value,
    );
    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a ${type} response`
          : `expected ${JSON.stringify(received)} to be a ${type} response`,
    };
  },
});
