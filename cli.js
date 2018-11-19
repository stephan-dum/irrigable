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

/*["SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT" ].forEach( function(signal) {
  process.on(signal, function() {
    console.log("Received "+signal+", killing child process...");

    stack.destroy();

  });
});*/

stack.write({
  bundleId : "mainCLI",
  config : options
});
