const { transformError } = require("../api/response/error");
const { wrap } = require("./middleware");

module.exports.handler = wrap(async () => {
  return transformError({ statusCode: 404 });
});
