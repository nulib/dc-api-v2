const { apiToken } = require("../aws/environment");
const axios = require("axios").default;
const middleware = require("./middleware");
const { getWork } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

function getAxiosResponse(url, config) {
  return new Promise((resolve) => {
    axios
      .get(url, config)
      .then((response) => resolve(response))
      .catch((error) => resolve(error.response));
  });
}

/**
 * A simple function to proxy a Work's thumbnail from the IIIF server
 */
exports.handler = async (event) => {
  event = middleware(event);
  const id = event.pathParameters.id;
  const esResponse = await getWork(id);
  if (esResponse.statusCode != 200) {
    return opensearchResponse.transform(esResponse);
  }

  const body = JSON.parse(esResponse.body);
  const thumbnail = body?._source?.thumbnail;

  if (thumbnail === undefined) {
    return {
      statusCode: 404,
      body: "Not Found",
    };
  }

  const { status, headers, data } = await getAxiosResponse(thumbnail, {
    headers: { Authorization: `Bearer ${apiToken()}` },
    responseType: "arraybuffer",
  });

  if (status != 200) {
    return {
      statusCode: status,
      body: data.toString(),
      headers: headers,
    };
  }

  return {
    statusCode: status,
    isBase64Encoded: true,
    body: data.toString("base64"),
    headers: {
      "content-type": headers["content-type"],
    },
  };
};
