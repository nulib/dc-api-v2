import convert from "xml-js";
import { formatOaiDate } from "./date-utils.ts";

const json2xmlOptions = { compact: true, ignoreComment: true, spaces: 4 };

const declaration = {
  _declaration: { _attributes: { version: "1.0", encoding: "utf-8" } },
};

export const invalidOaiRequest = (
  oaiCode: string,
  message: string,
  status = 400,
): Response => {
  const obj = {
    "OAI-PMH": {
      _attributes: {
        xmlns: "http://www.openarchives.org/OAI/2.0/",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation":
          "http://www.openarchives.org/OAI/2.0/\nhttp://www.openarchives.org/OAI/2.0/OAI_PMH.xsd",
      },
      responseDate: formatOaiDate(new Date()),
      error: {
        _attributes: { code: oaiCode },
        _text: message,
      },
    },
  };
  return output(obj, status);
};

export const output = (
  obj: Record<string, unknown>,
  status = 200,
): Response => {
  const body = convert.js2xml({ ...declaration, ...obj }, json2xmlOptions);
  return new Response(body, {
    status: status,
    headers: { "content-type": "application/xml" },
  });
};
