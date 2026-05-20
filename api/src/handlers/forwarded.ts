const TRUSTED_HOST_PATTERN = /^.+\.[^.]+\.library\.northwestern\.edu$/;

interface ForwardedInfo {
  by?: string;
  for?: string;
  host?: string;
  proto?: string;
}

function parseForwardedHeader(value: string): ForwardedInfo {
  const result: ForwardedInfo = {};
  for (const part of value.split(";")) {
    const [key, val] = part.trim().split("=");
    if (key && val) {
      result[key.trim().toLowerCase() as keyof ForwardedInfo] = val.trim();
    }
  }
  return result;
}

function selectTrustedEntry(
  entries: ForwardedInfo[],
): ForwardedInfo | undefined {
  return entries.find((e) => e.host && TRUSTED_HOST_PATTERN.test(e.host));
}

export function normalizeRequest(req: Request): Request {
  const forwardedHeader = req.headers.get("Forwarded");
  const xForwardedFor = req.headers.get("X-Forwarded-For");
  const xForwardedHost = req.headers.get("X-Forwarded-Host");
  const xForwardedProto = req.headers.get("X-Forwarded-Proto");

  let selected: ForwardedInfo | undefined;

  if (forwardedHeader) {
    const entries = forwardedHeader
      .split(",")
      .map((v) => parseForwardedHeader(v.trim()));
    selected = selectTrustedEntry(entries);
    if (!selected && entries.length > 0) selected = entries[0];
  } else if (xForwardedHost) {
    const hosts = xForwardedHost.split(",").map((v) => v.trim());
    const fors = xForwardedFor
      ? xForwardedFor.split(",").map((v) => v.trim())
      : [];
    const protos = xForwardedProto
      ? xForwardedProto.split(",").map((v) => v.trim())
      : [];

    const entries: ForwardedInfo[] = hosts.map((host, i) => ({
      host,
      for: fors[i],
      proto: protos[i],
    }));

    selected = selectTrustedEntry(entries);
    if (!selected && entries.length > 0) selected = entries[0];
  }

  if (!selected) return req;

  const newUrl = new URL(req.url);
  if (selected.host) newUrl.host = selected.host;
  if (selected.proto) newUrl.protocol = selected.proto + ":";

  const newHeaders = new Headers(req.headers);
  newHeaders.set("Host", newUrl.host);
  newHeaders.delete("Forwarded");
  newHeaders.delete("X-Forwarded-For");
  newHeaders.delete("X-Forwarded-Host");
  newHeaders.delete("X-Forwarded-Proto");
  newHeaders.set("X-Real-IP", selected?.for ?? "127.0.0.1");

  const result = new Request(newUrl.toString(), {
    method: req.method,
    headers: newHeaders,
    body: req.body,
    redirect: req.redirect,
  });

  return result;
}
