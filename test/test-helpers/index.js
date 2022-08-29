const fs = require("fs");
const nock = require("nock");
const path = require("path");
const EventBuilder = require("./event-builder.js");

function saveEnvironment() {
  const env = Object.assign({}, process.env);

  afterEach(function () {
    process.env = env;
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

global.helpers = {
  saveEnvironment,
  mockEvent,
  mockIndex,
  encodedFixture,
  testFixture,
};
