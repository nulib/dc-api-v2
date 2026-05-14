import { Context } from "hono";

export default (Honeybadger: typeof import("@honeybadger-io/js")) => {
  Honeybadger.configure({
    apiKey: process.env["HONEYBADGER_API_KEY"] ?? "DEVELOPMENT_MODE",
    environment: process.env["HONEYBADGER_ENV"] ?? "development",
    revision: process.env["HONEYBADGER_REVISION"],
    enableUncaught: !process.env["HONEYBADGER_DISABLED"],
    enableUnhandledRejection: !process.env["HONEYBADGER_DISABLED"],
  });

  Honeybadger.beforeNotify((notice) => {
    if (!notice) return;
    const { requestContext } = notice.context as { requestContext?: Context };
    if (requestContext?.req) {
      const req = requestContext.req.raw as Request;
      const url = new URL(req.url);
      notice.url = url.pathname;
      notice.params = Object.fromEntries(url.searchParams.entries());
      notice.cgiData = {
        REQUEST_METHOD: req.method,
        QUERY_STRING: url.search.slice(1),
        REMOTE_USER: requestContext.get("userToken")?.token?.sub,
      };
      delete (notice as Record<string, unknown>).context;
    }
  });
};
