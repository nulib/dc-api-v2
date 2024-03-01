'use strict';
 
const defaultExclude = require('@istanbuljs/schema/default-exclude');
const localExclude = [".aws-sam/**/*", "docs/**/*"];
module.exports = {
  all: true,
  "check-coverage": true,
  exclude: defaultExclude.concat(localExclude)
};
