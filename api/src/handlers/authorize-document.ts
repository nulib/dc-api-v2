import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import type { OpenSearchGetResponse } from "../api/opensearch-types.ts";

type AuthDocSource = {
  published: boolean;
  visibility: string;
  work_id?: string;
  id: string;
};

export function authorizeDocument(
  c: Context<AppEnv>,
  osResponse: { status: number; body: string },
): Response {
  if (osResponse.status !== 200) {
    return new Response(null, { status: osResponse.status });
  }

  const document = (
    JSON.parse(osResponse.body) as OpenSearchGetResponse<AuthDocSource>
  )._source!;
  const token = c.get("userToken");

  const { published, visibility } = document;
  const workId = document.work_id ?? document.id;
  let allowed = token.hasEntitlement(workId);

  if (!allowed) {
    const publishedState = published ? "Published" : "Unpublished";
    allowed = [`read:${visibility}`, `read:${publishedState}`].every((scope) =>
      token.can(scope),
    );
  }

  return new Response(null, { status: allowed ? 204 : 403 });
}
