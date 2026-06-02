import { getReasonPhrase } from "http-status-codes";

export function transformError(response: { status: number }): Response {
  const responseBody = {
    status: response.status,
    error: getReasonPhrase(response.status),
  };

  return new Response(JSON.stringify(responseBody), {
    status: response.status,
  });
}
