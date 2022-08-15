const fs = require("fs");
const nock = require("nock");
const path = require("path");

global.helpers = {
  saveEnvironment: () => {
    const env = Object.assign({}, process.env);

    afterEach(function () {
      process.env = env;
    });
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
    const fixtureFile = path.join("tests/fixtures", file);
    return eval(fs.readFileSync(fixtureFile));
  },
};
