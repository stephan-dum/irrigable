const Rollup = require("@aboutweb/irrigable-rollup");
const path = require("path");
const { Transform, Writable } = require("stream");
const JSCompiler = require("@aboutweb/irrigable-jscompiler");
const stack = require("../index.js");
const uuid = require("uuid/v1");

class JSONParser extends Transform {
  constructor() {
    super({
      objectMode : true
    });
  }
  _transform(file, encoding, callback) {
    file.exports = JSON.parse(file.contents);

    callback(null, file);
  }
}

const compiler = stack.addNode({
  bundleId : "ImportProvider",
  config : {
    env : "node",
    rules : [{
      filter : "*.{m,}js",
      sourcemap : false,
      contents : false,
      pipeline : [
        {
          construct : Rollup,
          args : {
            output : {
              format : "cjs",
              sourcemap : false
            }
          }
        },
        { construct : JSCompiler }
      ]
    }, {
      filter : "*.json",
      pipeline : [{
        construct : JSONParser
      }]
    }]
  }
});

class Transfer extends Writable {
  constructor(receiver) {
    super({
      objectMode : true
    });

    this.receiver = receiver;
  }
  _write(file, encoding, callback) {
    this.receiver.write(file, callback);
  }
}

class ImportStream extends Transform {
  constructor(options, distributer = {}) {
    let {
      glob,
      cwd = distributer.cwd || process.cwd(),
      base = distributer.base || ".",
      pipeline = [],
      watch = distributer.watch,
      error = distributer.error || console.warn
    } = options;

    if(glob == undefined) {
      error(new TypeError(`options.glob is mandatory!`));
    }

    super({
      objectMode : true
    });

    this.uid = uuid();
    this.cwd = cwd;
    this.base = base;
    this.glob = glob;

    this.on("error", error);

    compiler.addInputs({
      glob,
      pipeline,
      outputs : {
        construct : Transfer,
        args : this
      },
      watch,
      cwd,
      base,
      error
    }).then((inputs) => {
      this.inputs = inputs;
      this.emit("complete");
    });
  }
  _transform(vinyl, encoding, callback) {
    let bundleId = vinyl.path;
    let config = vinyl.exports;

    if(!config.cwd && !config.base) {
      if(this.base) {
        config.base = this.base;
      } else {
        config.base = path.relative(
          this.cwd,
          path.dirname(bundleId)
        );
      }
    }

    callback(null, { providerId : this.uid, bundleId, config });
  }
  _destroy() {
    let input;

    while(input = this.inputs.pop()) {
      input.destroy();
    }
  }
}

module.exports = ImportStream;
