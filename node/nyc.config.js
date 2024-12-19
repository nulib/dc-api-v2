'use strict';
 
const defaultExclude = require('@istanbuljs/schema/default-exclude');
const localExclude = [".aws-sam/**/*", "docs/**/*"];
module.exports = {
  all: true,
  branches: 80,
  lines: 80,
  functions: 80,
  statements: 80,
  watermarks: {
    lines: [80, 90],
    functions: [80, 90],
    branches: [80, 90],
    statements: [80, 90]
  },
  "check-coverage": true,
  exclude: defaultExclude.concat(localExclude)
};
