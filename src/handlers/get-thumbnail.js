const ApiToken = require("../api/api-token");
const axios = require("axios").default;
const cookie = require("cookie");
const opensearchResponse = require("../api/response/opensearch");
const { apiTokenName } = require("../environment");
const { getCollection, getWork } = require("../api/opensearch");
const { wrap } = require("./middleware");

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

const getThumbnail = async (id, aspect, size, event) => {
  const allowUnpublished = event.userToken.hasEntitlement(id);
  const allowPrivate = allowUnpublished || event.userToken.isReadingRoom();

  let esResponse;
  let body;
  let iiif_base;
  if (event.rawPath.match(/\/collections\//)) {
    esResponse = await getCollection(id, {
      allowPrivate,
      allowUnpublished,
    });
    if (esResponse.statusCode != 200)
      return { error: await opensearchResponse.transform(esResponse) };
    body = JSON.parse(esResponse.body);
    iiif_base = body?._source?.representative_image?.url;
  } else {
    esResponse = await getWork(id, {
      allowPrivate,
      allowUnpublished,
    });
    if (esResponse.statusCode != 200)
      return { error: await opensearchResponse.transform(esResponse) };
    body = JSON.parse(esResponse.body);
    iiif_base = body?._source?.representative_file_set?.url;
  }

  if (!iiif_base) {
    return {
      statusCode: 404,
      headers: { "content-type": "text/plain" },
      body: "Not Found",
    };
  }

  const thumbnail = `${iiif_base}/${aspect}/!${size},${size}/0/default.jpg`;

  const { status, headers, data } = await getAxiosResponse(thumbnail, {
    headers: {
      cookie: cookie.serialize(
        apiTokenName(),
        new ApiToken().superUser().sign(),
        {
          domain: "library.northwestern.edu",
          path: "/",
          secure: true,
        }
      ),
    },
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

/**
 * A simple function to proxy a Collection or Work thumbnail from the IIIF server
 */
exports.handler = wrap(async (event) => {
  try {
    const { id, aspect, size } = validateRequest(event);
    return await getThumbnail(id, aspect, size, event);
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "content-type": "text/plain" },
      body: err.message,
    };
  }
});
