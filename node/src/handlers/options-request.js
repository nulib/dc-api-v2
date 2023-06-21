const { wrap } = require("./middleware");

module.exports.handler = wrap(async () => {
  return { statusCode: 200 };
});
