const log = require("./log");
const config = require("./config");

module.exports = [...log, ...config];
