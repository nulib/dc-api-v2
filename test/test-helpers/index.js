const fs = require("fs");
const nock = require("nock");
const path = require("path");
const EventBuilder = require("./event-builder.js");

global.helpers = {
  saveEnvironment: () => {
    const env = Object.assign({}, process.env);

    afterEach(function () {
      process.env = env;
    });
  },

  mockEvent: (method, route) => {
    return new EventBuilder(method, route);
  },

  mockIndex: () => {
    const mock = nock("https://index.test.library.northwestern.edu");

    beforeEach(function () {
      process.env.ELASTICSEARCH_ENDPOINT =
        "index.test.library.northwestern.edu";
    });

    afterEach(function () {
      mock.removeAllListeners();
    });

    return mock;
  },

  testFixture: (file) => {
    const fixtureFile = path.join("test/fixtures", file);
    return eval(fs.readFileSync(fixtureFile));
  },
};
