const { processRequest, processResponse } = require("./middleware");

module.exports.handler = async (event) => {
  event = processRequest(event);
  return processResponse(event, { statusCode: 200 });
};
