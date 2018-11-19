#!/usr/bin/env node
"use strict";

const stack = require("./src/index.js");

const flags = {
  "p" : "providers",
  "i" : "inputs",
  "o" : "outputs",
  "w" : "watch",
  "v" : "verbose"
}

const options = {};

process.argv.forEach(function(raw) {
  let [property, value] = raw.replace(/^--?/, "").split("=");

  if(property in flags) {
    property = flags[property];
  }

  this[property] = value || true;
}, options);

stack.write({
  bundleId : "mainCLI",
  config : options
});
