declare module "sort-json" {
  interface SortJsonOptions {
    depth?: number;
    ignoreCase?: boolean;
    reverse?: boolean;
  }
  function sortJson(obj: unknown, opts?: SortJsonOptions): unknown;
  export default sortJson;
}

declare module "parse-http-header" {
  interface ParsedHeader {
    [key: string]: string | string[] | number | undefined;
    q?: number;
  }
  function parseHeader(
    header: string,
  ): Record<string, ParsedHeader | string | null> | null;
  export default parseHeader;
}
