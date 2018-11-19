let VinylStream;
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

    /*if(!this.outputs) {
      this.outputs = distributer.outputs;
    }*/

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

      if(callback) {
        callback(error, this);
      }

      if(!error) {
        this.emit("complete");
      }
    });

    /*this.write(input.glob, (error) => {
      if(complete) {
        complete(this);
      }

      if(callback) {
        callback(error);
      }

      if(error) {
        this.emit("error", error);
      } else {
        this.emit("complete");
      }
    });*/

    /*return new Promise((resolve, reject) => {
      this.write(glob, () => {
        if(complete) {
          complete();
        }

        this.emit("complete");

        resolve(this);
      });
    });*/

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
  _destroy(err, cb) {
    if(this.watcher) {
      this.watcher.destroy();
    }

    this.streams.forEach((stream) => {
      stream.destroy();
    })

    super._destroy(err, cb);
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
