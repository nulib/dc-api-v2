import { expect } from "bun:test";

type ResponseFormatType = "opensearch" | "iiif" | "xml";

declare module "bun:test" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<T> {
    toHaveResponseFormat(type: ResponseFormatType): void;
  }
  interface AsymmetricMatchers {
    toHaveResponseFormat(type: ResponseFormatType): void;
  }
}

const ResponseFormatContentTypeMatchers = {
  opensearch: /^application\/json.*charset=UTF-8/i,
  iiif: /^application\/ld\+json.*profile="http:\/\/iiif.io.*charset=UTF-8/i,
  xml: /^application\/xml/i,
};

expect.extend({
  toHaveResponseFormat(received: unknown, type: ResponseFormatType) {
    const pass = ResponseFormatContentTypeMatchers[type].test(
      (received as Response).headers.get("content-type") ?? "",
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
