const convert = require("xml-js");

const json2xmlOptions = { compact: true, ignoreComment: true, spaces: 4 };

const declaration = {
  _declaration: { _attributes: { version: "1.0", encoding: "utf-8" } },
};

const invalidOaiRequest = (oaiCode, message, statusCode = 400) => {
  const obj = {
    OAI_PMH: {
      _attributes: {
        xmlns: "http://www.openarchives.org/OAI/2.0/",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation":
          "http://www.openarchives.org/OAI/2.0/\nhttp://www.openarchives.org/OAI/2.0/OAI-PMH.xsd",
      },
      responseDate: new Date().toISOString(),
      error: {
        _attributes: {
          code: oaiCode,
        },
        _text: message,
      },
    },
  };
  return output(obj, statusCode);
};

const output = (obj, statusCode = 200) => {
  return {
    statusCode: statusCode,
    headers: { "content-type": "application/xml" },
    body: convert.js2xml({ ...declaration, ...obj }, json2xmlOptions),
  };
};

module.exports = { invalidOaiRequest, output };
