const {
  decompressFromEncodedURIComponent: decompress,
  compressToEncodedURIComponent: compress,
} = require("lz-string");

const encodeFields = ["query", "size", "sort", "fields", "_source"];

async function decodeSearchToken(token) {
  return JSON.parse(await decompress(token));
}

async function encodeSearchToken(models, body, format, options) {
  let token = { body: { size: 10 }, models, format, options };
  for (const field in body) {
    if (encodeFields.includes(field)) {
      token.body[field] = body[field];
    }
  }
  return await compress(JSON.stringify(token));
}

function from(body) {
  return body?.from || 0;
}

function size(body) {
  return body?.size || 10;
}

function maxPage(body, count) {
  return Math.ceil(count / size(body));
}

function nextPage(body, count) {
  const current = thisPage(body);
  return maxPage(body, count) > current ? current + 1 : null;
}

function prevPage(body, _count) {
  return body.from > 0 ? thisPage(body) - 1 : null;
}

function thisPage(body) {
  return Math.floor(from(body) / size(body) + 1);
}

class Paginator {
  constructor(baseUrl, route, models, body, format, options) {
    this.baseUrl = baseUrl;
    this.route = route;
    this.models = models;
    this.body = { ...body };
    this.format = format;
    this.options = options;
  }

  async pageInfo(count) {
    let url = new URL(this.route, this.baseUrl);
    let searchToken;

    if (this.options?.includeToken != false) {
      searchToken =
        this.options?.parameterOverrides?.searchToken ||
        this.options?.queryStringParameters?.searchToken ||
        (await encodeSearchToken(
          this.models,
          this.body,
          this.format,
          this.options
        ));

      url.searchParams.set("searchToken", searchToken);
    }

    const queryStringParameters =
      this.options?.parameterOverrides || this.options?.queryStringParameters;
    if (typeof queryStringParameters === "object") {
      for (const param in queryStringParameters) {
        url.searchParams.set(param, queryStringParameters[param]);
      }
    }

    const prev = prevPage(this.body, count);
    const next = nextPage(this.body, count);
    url.searchParams.delete("from");

    let result = {
      query_url: url.toString(),
      current_page: thisPage(this.body),
      limit: size(this.body),
      offset: from(this.body),
      total_hits: count,
      total_pages: maxPage(this.body, count),
      options: this.options,
      format: this.format,
    };
    if (prev) {
      url.searchParams.set("page", prev);
      result.prev_url = url.toString();
    }
    if (next) {
      url.searchParams.set("page", next);
      result.next_url = url.toString();
    }
    if (searchToken) {
      result.search_token = searchToken;
    }

    return result;
  }
}

module.exports = { decodeSearchToken, encodeSearchToken, Paginator };
