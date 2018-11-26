const { PassThrough, Transform, Writable } = require("stream");
const path = require("path");

const Invocable = require("@aboutweb/irrigable-invoc");
const vfs = require("vinyl-fs");
const objectToString = Object.prototype.toString;
const ChokidarStream = require("../provider/chokidar.js");
let Distributer /*circular see Irrigable.constructor*/;


class TaskTransfer extends Transform {
  constructor(task, parent) {
    super({ objectMode : true });

    this.task = task;
    this.parent = parent;
  }
  _transform(vinyl, encoding, finish) {
    let finised = false;
    let inputs;

    this.task.addInputs({
      glob : vinyl.path,
      watch : this.watch,
      outputs : {
        construct : Writable,
        args : {
          objectMode : true,
          write(child, encoding, callback) {
            vinyl.dependencies.push(...child.dependencies);

            if(finised == false) {
              finish(null, child);
              callback();
            } else {
              inputs.forEach((input) => { input.destroy(); });
              this.parent.write(vinyl.path, callback);
            }

            finised = true;
          }
        }
      }
    }).then((nodes) => { inputs = nodes; });
  }
}

function _pipecompose(pipeline) {
  let {
    pre = [],
    post = []
  } = pipeline;

  return [...pre, ...pipeline, ...post];
}

class Irrigable extends PassThrough {
  constructor(options, parent = {}) {
    super({
      objectMode : true
    });

    //resolve circular reference
    if(!Distributer) {
      Distributer = require("./index.js");
    }

    let {
      cwd,
      base = "",
      error = console.warn,
      pipeline = [],
      env,
      outputs,
      contents = parent.contents,
      fork = false,
      cache = {},
      split = true,
      watch,
      sourcemap = parent.sourcemap,
      tasks = {},
      pipecompose = _pipecompose,
      writeBase = parent.writeBase
    } = options

    if(watch) {
      if(
        objectToString.call(watch) == "[object String]"
        || Array.isArray(watch)
      ) {
        this.watch = new ChokidarStream({
          glob : watch,
          persistent : false,
          initial : false,
          cwd : cwd
        });

        this.watch.pipe(new Writable({
          objectMode : true,
          write : (file, encoding, callback) => {
            this.emit("sync");
            callback();
          }
        }))

      } else {
        this.watch = watch;
      }
    } else {
      this.watch = Boolean(parent.watch);
    }

    if(cwd) {
      cwd = this.cwd = path.isAbsolute(cwd)?cwd:path.resolve(cwd);
      base = this.base = base || "";
    } else {
      cwd = this.cwd = parent.cwd;
      base = this.base = base || parent.base;
    }

    this.extend = (("extend" in options)?options.extend:true);
    this.writeBase = writeBase;
    this.pipecompose = pipecompose;
    this.parent = parent;
    this.error = error;
    this.fork = fork;
    //this.watch = watch;
    this.contents = contents;
    this.sourcemap = sourcemap;
    this.cache = (cache === false?parent.cache:cache);
    this.split = split;
    this.last = (("last" in options)?options.last:true);

    if(outputs) {
      this.outputs = (Array.isArray(outputs)?outputs:[outputs]).map((output) => {
        if(objectToString.call(output) == "[object String]") {
          if(!path.isAbsolute(output)) {
            output = path.join(cwd, output);
          }

          output = {
            args : [ output ]
          }
        }

        if(typeof output != "function" && !output.construct) {
          output.invoke = (dir, input) => {
            return vfs.dest(dir, {
              cwd,
              sourcemaps : input.sourcemap
            });
          }
        }

        return Invocable(output);
      });
    }

    this.tasks = {};

    for(let name in tasks) {
      this.tasks[name] = new Distributer(tasks[name], this);
    }

    this.pipeline = [];
    this.pipeline._keys = new Set;

    this.addPipeline(pipeline, this.pipeline);



    let parentEnv = this.parent.env || [];

    if(!env) {
      this.env = parentEnv;
    } else if(Array.isArray(env)) {
      this.env = [...new Set([...parentEnv, ...env])]
    } else {
      this.env = [...new Set([...parentEnv, env])];
    }

  }
  _pipelineTask(pipeline, slot) {
    pipeline.forEach((handler) => {
      if(handler.task) {
        let task = this.findTask(handler.task);

        if(handler.inine) {
          slot.push(...task.pipeline);
        } else {
          slot.push({
            construct : TaskTransfer,
            args : [task]
          });
        }
      } else {
        slot.push(Invocable(handler));
      }
    });
  }
  addPipeline(raw, pipeline) {
    switch(objectToString.call(raw)) {
      case "[object Array]":
        this._pipelineTask(raw, pipeline)

        if(raw._keys) {
          raw._keys.forEach((key) => {
            if(raw[key]) {
              this._pipelineTask(
                raw[key],
                pipeline[key] || (pipeline[key] = [])
              );

              pipeline._keys.add(key);
            }
          });
        }
        break;
      case "[object Object]":
        for(let key in raw) {
          this._pipelineTask(
            raw[key],
            pipeline[key] || (pipeline[key] = [])
          );

          pipeline._keys.add(key);
        }
        break;

      default:
        throw new TypeError("Pipeline must be of type object or array");
    }
  }
  findTask(task) {
    let curr = this;

    do {
      if(curr.tasks[task]) {
        return curr.tasks[task];
      }
    } while(curr = curr.parent)

    throw new ReferenceError("Could not find task '"+task+"'!");
  }
  _destroy(error, callback) {
    this.emit("destroy", error);

    if(this.watch && this.watch.destroy) {
      this.watch.destroy();
    }

    callback(error);
  }
}

module.exports = Irrigable;
