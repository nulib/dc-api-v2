import { negotiateFormat } from "./formats.ts";
import { transformError } from "./error.ts";
import type { ResponseFormat } from "./formats.ts";
import type { AppEnv } from "../../types.ts";
import type { Context } from "hono";

type FormatHandler = () => Response | Promise<Response>;

/**
 * Dispatch on the format a request negotiates, among the ones this route can
 * produce. A route lists only those, so `?as=` naming any other format is a
 * 406 rather than a silent fallback to the default representation.
 *
 * `preferred` is the representation to fall back to where the request states
 * no usable preference — a search token's recorded format, say.
 */
export async function negotiate(
  c: Context<AppEnv>,
  handlers: Partial<Record<ResponseFormat, FormatHandler>>,
  { preferred }: { preferred?: ResponseFormat } = {},
): Promise<Response> {
  const supported = Object.keys(handlers) as ResponseFormat[];
  const format = negotiateFormat(
    { as: c.req.query("as"), accept: c.req.header("Accept") },
    supported,
    preferred,
  );

  const handler = format ? handlers[format] : undefined;
  const response = handler ? await handler() : transformError({ status: 406 });

  // This route's response depends on the request's Accept header, so caches
  // have to key on it. Routes that never negotiate don't say this.
  varyOnAccept(response);
  return response;
}

function varyOnAccept(response: Response): void {
  const vary = response.headers.get("vary");
  if (!vary) {
    response.headers.set("vary", "Accept");
  } else if (!/(^|,)\s*accept\s*(,|$)/i.test(vary)) {
    response.headers.set("vary", `${vary}, Accept`);
  }
}
