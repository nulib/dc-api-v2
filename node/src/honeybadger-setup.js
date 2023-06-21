const Honeybadger = require("@honeybadger-io/js");

Honeybadger.configure({
  apiKey: process.env.HONEYBADGER_API_KEY || "DEVELOPMENT_MODE",
  environment: process.env.HONEYBADGER_ENV || "development",
  revision: process.env.HONEYBADGER_REVISION,
  enableUncaught: !process.env.HONEYBADGER_DISABLED,
  enableUnhandledRejection: !process.env.HONEYBADGER_DISABLED,
});

Honeybadger.beforeNotify((notice) => {
  if (notice.context?.event) {
    const event = notice.context?.event;
    notice.url = event.requestContext.http.path;
    notice.headers = event.headers;
    notice.cookies = event.cookieObject;
    notice.params = event.queryStringParameters;
    notice.cgiData = {
      REQUEST_METHOD: event.requestContext.http.method,
      SERVER_PROTOCOL: event.requestContext.http.protocol,
      QUERY_STRING: event.rawQueryString,
      REMOTE_ADDR: event.requestContext.http.sourceIp,
      REMOTE_USER: event.userToken?.sub,
    };

    delete notice.context;
  }
});

module.exports = Honeybadger;
