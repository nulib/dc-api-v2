exports.handler = async () => {
  const target = process.env.REDIRECT_TO;

  return {
    statusCode: 302,
    headers: {
      "content-type": "text/html",
      location: target
    },
    body: `<p>Redirecting to <a href="${target}">API Documentation</a></p>`
  };
};
