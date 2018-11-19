const { Transform } = require("stream");

class SetupStream extends Transform {
  constructor(parent) {
    super({
      objectMode : true
    });

    this.parent = parent;
  }

  _transform(vinyl, encoding, callback) {
    let parent = this.parent;

    vinyl.references = [];
    vinyl.dependencies = [];
    vinyl.env = parent.env;
    vinyl.config = parent.config;
    vinyl.cache = parent.cache;
    vinyl.writeBase = parent.writeBase;

    callback(null, vinyl);
  }
}

module.exports = SetupStream;
