const fs = require("fs");
const nock = require("nock");
const path = require("path");
const EventBuilder = require("./event-builder.js");

process.env.HONEYBADGER_DISABLED = "true";
process.env.HONEYBADGER_ENV = "test";

const TestEnvironment = {
  API_TOKEN_SECRET: "abc123",
  API_TOKEN_NAME: "dcapiTEST",
  DC_URL: "https://thisisafakedcurl",
  DC_API_ENDPOINT: "https://thisisafakeapiurl",
  NUSSO_BASE_URL: "https://nusso-base.com/",
  NUSSO_API_KEY: "abc123",
};

for (const v in TestEnvironment) delete process.env[v];

function requireSource(module) {
  const absolute = path.resolve(__dirname, "../../src", module);
  return require(absolute);
}

const { __processRequest } = requireSource("handlers/middleware");

function saveEnvironment() {
  const env = { ...process.env };

  beforeEach(function () {
    for (const v in TestEnvironment) process.env[v] = TestEnvironment[v];
  });

  afterEach(function () {
    process.env = { ...env };
  });
}

function mockEvent(method, route) {
  return new EventBuilder(method, route);
}

function mockIndex() {
  const mock = nock("https://index.test.library.northwestern.edu");

  beforeEach(function () {
    process.env.ELASTICSEARCH_ENDPOINT = "index.test.library.northwestern.edu";
  });

  afterEach(function () {
    nock.cleanAll();
    mock.removeAllListeners();
  });

  return mock;
}

function encodedFixture(file) {
  const content = testFixture(file);
  return new Buffer.from(content).toString("base64");
}

function testFixture(file) {
  const fixtureFile = path.join("test/fixtures", file);
  return fs.readFileSync(fixtureFile);
}

function cookieValue(cookies, cookieName) {
  if (!Array.isArray(cookies)) return undefined;

  let cookieValue = { value: "" };
  const regex = new RegExp(`^${cookieName}=(?<value>[^;]+)(?<props>.+)?$`);
  for (const c of cookies) {
    const match = regex.exec(c);
    if (match) {
      const { value, props } = match.groups;
      cookieValue.value = value;
      if (props) {
        for (const prop of props.split(/;\s+/)) {
          const [propKey, propValue] = prop.split(/=/);
          if (propKey != "") cookieValue[propKey] = propValue;
        }
      }
    }
  }
  return cookieValue;
}

global.helpers = {
  saveEnvironment,
  mockEvent,
  mockIndex,
  encodedFixture,
  testFixture,
  cookieValue,
  preprocess: __processRequest,
};

global.requireSource = requireSource;
