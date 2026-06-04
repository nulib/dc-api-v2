import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { formatUrl } from "@aws-sdk/util-format-url";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-browser";
import { region } from "../environment.ts";
import type { HttpRequest as SmithyHttpRequest } from "@smithy/types";

export const requestUrl = (request: SmithyHttpRequest): string =>
  formatUrl(request);

export async function awsFetch(
  request: HttpRequest,
): Promise<{ status: number; body: string }> {
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: region(),
    service: "es",
    sha256: Sha256,
  });

  const signed = await signer.sign(request);
  const url = requestUrl(signed);

  const resp = await fetch(url, {
    method: signed.method,
    headers: signed.headers as Record<string, string>,
    body: signed.body as string | undefined,
  });

  return { status: resp.status, body: await resp.text() };
}
