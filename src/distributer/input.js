let VinylStream /*circular see bottom*/;
const ChokidarStream = require("../provider/chokidar.js");
const Irrigable = require("./irrigable.js");
const Invocable = require("@aboutweb/irrigable-invoc");
const objectToString = Object.prototype.toString;
const path = require("path");
const crypto = require("crypto");
const { inspect } = require('util');

class InputStream extends Irrigable {
  constructor(options, distributer, callback) {
    if(!("last" in options)) {
      options.last = false;
    }

    super(options, distributer);

    let {
      config = {},
      glob = [],
      complete,
      sync,
      hash,
      task
    } = options;

    if(!Array.isArray(glob)) {
      glob = [glob];
    }

    this.hash = hash;

    this.config = Object.freeze({ ...config });
    this.glob = glob;

    let stack;

    if(this.last) {
      stack = [[]];
    } else {
      stack = (
        task
          ?distributer.findTask(task)
          :distributer
      );

      stack = stack.trace(this);
    }

    this.streams = stack.map((stream) => this.pipe(new VinylStream(this, stream)));

    if(sync) {
      this.on("sync", sync);
    }

    if(this.watch) {
      this.watcher = new ChokidarStream({
        cwd : path.join(this.cwd, this.base),
        glob : glob,
        initial : false,
        persistent : true,
      });

      this.watcher.pipe(this);

      this.watcher.on("unlink", () => this.emit("unlink"));
    }

    this.on("error", this.error);

    this.write(glob, (error) => {
      if(complete) {
        complete(error, this);
      }

      if(!error) {
        if(this.watch) {
          this.on("sync", () => {
            distributer.emit("sync");
          });
        }

        distributer.emit("sync");
        this.emit("complete");
      }

      if(callback) {
        callback(error, this);
      }
    });
  }
  _write(file, encoding, callback) {
    Promise.all(
      this.streams.map(
        (stream) => new Promise(
          (resolve, reject) => {
            stream.write(file, resolve)
          }
        )
      )
    ).then(() => callback(), callback);
  }
  _destroy(error, callback) {
    if(this.watcher) {
      this.watcher.destroy();
    }

    this.streams.forEach((stream) => {
      stream.destroy();
    });

    super._destroy(error, callback);
  }
  static cast(input) {
    switch(objectToString.call(input)) {
      case "[object String]":
        input = { glob : [input] };
        break;
      case "[object Array]":
        input = { glob : input };
        break;
    }

    if(!input.hash) {
      input.hash = InputStream.hashJSON(input);
    }

    return input;
  }
  static hashJSON(input) {
    return crypto.createHash('sha256')
      .update(inspect(input))
      .digest('hex')
    ;
  }
}

module.exports = InputStream;

/*resolve circular reference*/
VinylStream = require("../vinyl/index.js");
