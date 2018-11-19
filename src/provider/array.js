const { Transform } = require("stream");

class ArrayStream extends Transform {
  constructor(array) {
    super({ objectMode : true });

    this.write(array);
  }
  _transform(array, encoding, callback) {
    if(!Array.isArray(array)) {
      callback(new TypeError("Chunk must be of type Array!"));
    }

    array.forEach((config, bundleId) => this.push({bundleId, config}));

    callback();
  }
}

module.exports = ArrayStream;
