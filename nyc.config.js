'use strict';
 
const defaultExclude = require('@istanbuljs/schema/default-exclude');
const localExclude = ["src/handlers/**"];
module.exports = {
  all: true,
  "check-coverage": true,
  exclude: defaultExclude.concat(localExclude)
};
