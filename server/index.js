"use strict";

const register = require("./register");
const bootstrap = require("./bootstrap");
const destroy = require("./destroy");
const contentTypes = require("./content-types");
const controllers = require("./controllers");
const routes = require("./routes");
const services = require("./services");

module.exports = {
  register,
  bootstrap,
  destroy,
  controllers,
  routes,
  services,
  contentTypes,
};
