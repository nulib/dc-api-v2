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

function validateRequest(event) {
  const id = event.pathParameters.id;
  const aspect = event?.queryStringParameters?.aspect || "full";
  const sizeParam = event?.queryStringParameters?.size || 300;
  const size = Number(sizeParam);

  if (!["full", "square"].includes(aspect))
    throw new Error(`Unknown aspect ratio: ${aspect}`);
  if (isNaN(size)) throw new Error(`${sizeParam} is not a valid size`);
  if (size > 300)
    throw new Error(`Requested size of ${size}px exceeds maximum of 300px`);

  return { id, aspect, size };
}

/**
 * A simple function to proxy a Work's thumbnail from the IIIF server
 */
exports.handler = async (event) => {
  try {
    const { id, aspect, size } = validateRequest(middleware(event));
    const esResponse = await getWork(id);
    if (esResponse.statusCode != 200) {
      return opensearchResponse.transform(esResponse);
    }

    const body = JSON.parse(esResponse.body);
    const iiif_base = body?._source?.representative_file_set?.url;

    if (!iiif_base) {
      return {
        statusCode: 404,
        headers: { "content-type": "text/plain" },
        body: "Not Found",
      };
    }

    const thumbnail = `${iiif_base}/${aspect}/!${size},${size}/0/default.jpg`;

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
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "content-type": "text/plain" },
      body: err.message,
    };
  }
};
