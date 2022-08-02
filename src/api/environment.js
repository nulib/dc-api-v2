function prefix(value) {
  return [process.env.ENV_PREFIX, value]
    .filter((val) => { return (val !== "") && !!val })
    .join("-");
};

module.exports = { prefix }