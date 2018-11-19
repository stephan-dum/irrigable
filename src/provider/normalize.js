const { Transform } = require("stream");
const objectToString = Object.prototype.toString;

class NormalizeStream extends Transform {
  constructor() {
    super({
      objectMode : true,
      highWaterMark
    });
  }
  _transform(bundle, encoding, callback) {
    let { bundleId, config } = bundle;

      switch(objectToString.call(config)) {
        case "[object String]":
          config = {
            inputs : [config]
          };
          break;
        case "[object Object]":
          break;
        case "[object Array]":
          let wrapperConfig = {
            inputs : [],
            rules : [],
            providers : []
          }

          config.forEach((config) => {
            if(objectToString.call(config) == "[object String]") {
              return wrapperConfig.inputs.push(config);
            }

            let { filter, rules, dest, env, pipeline, setup, watch } = config;

            if(filter || rules || dest || env || pipeline || setup || watch) {
              return wrapperConfig.rules.push(config);
            }

            let { providers, inputs } = config;

            if(providers) {
              if(!Array.isArray) {
                providers = [provders];
              }

              wrapperConfig.providers.push(...providers);
            }
            if(inputs) {
              if(!Array.isArray(inputs)) {
                inputs = [inputs];
              }
              wrapperConfig.inputs.push(...inputs);
            }
          });

          config = wrapperConfig;
          break;
        default:
          return callback(new TypeError(`Unknown bundle type '${objectToString.call(config)}' for '${bundleid}'!`));
      }
  }
}

module.exports = NormalizeStream;
