const { Writable, Transform, PassThrough } = require("stream");
const ChokidarStream = require("../provider/chokidar.js");
const SetupStream = require("./setup.js");
const DependencyStream = require("./dependency.js");
const path = require("path")
const InputStream = require("../distributer/input.js");
const objectToString = Object.prototype.toString;
const vfs = require("vinyl-fs");
const castInput = InputStream.cast;
const ParallelTransform = require("@aboutweb/irrigable-parallel");


class VinylStream extends Writable {
  constructor(input, distributerStack) {
    super({
      objectMode : true
    });


    let pipeline = [];
    pipeline._keys = new Set;

    input.addPipeline(input.pipeline, pipeline);

    let config = {};
    let outputs = [];
    let fork = true;
    let split = true;


    if(input.outputs) {
      outputs.push(...input.outputs);
      fork = input.fork;
    }

    distributerStack.forEach((distributer) => {
      distributer.addPipeline(distributer.pipeline, pipeline);

      if(split) {
        split = distributer.split;
      }

      if(fork && distributer.outputs) {
        outputs.push(...distributer.outputs);

        fork = distributer.fork;
      }
    });

    this.pipeline = input.pipecompose(pipeline);

    this.parent = input;
    this.distributer = input.parent;
    this.outputs = outputs;

    this.split = split;

    this.references = new Map;
    this.inputs = new Map;

    this.writeBase = input.writeBase;
    this.cwd = input.cwd;
    this.base = input.base;
    this.env = input.env;
    this.error = input.error;
    this.watch = input.watch;
    this.glob = input.glob;
    this.contents = input.contents;
    this.cache = input.cache;
    this.sourcemap = (distributerStack[0] || input).sourcemap;

    this
      .on("error", (error) => input.emit("error", error))
      .on("sync", () => input.emit("sync"))
    ;

    if(this.watch) {
      this.fileToDependencies = new Map;
      this.dependencyToFiles = new Map;

      this.watcher = new ChokidarStream({
        cwd : input.cwd,
        glob : [],
        persistent : true,
        initial : false,
        disableGlobbing : true,
        transform : (dependency, encoding, callback) => {
          if(!path.isAbsolute(dependency)) {
            dependency = path.join(this.cwd, dependency);
          }


          let queue = [];

          this.dependencyToFiles.get(dependency).forEach((file) => {
            queue.push(new Promise((resolve, reject) => {
              this.write(file, (error) => {
                error?reject(error):resolve()
              });
            }));
          })

          Promise.all(queue).then(() => callback(), callback);
        }
      });

      this.watcher.pipe(this);

      this.watcher.on("unlink", (fileId) => {
        this.error(new ReferenceError(`Deleted "${fileId}" which is still referenced by: ${this.dependencyToFiles.get(path.resolve(fileId))}`))
      });

      input.on("unlink", (
        this.split
          ?(fileId) => this.undepend(fileId)
          :() => this.write(this.glob)
      ));
    }

    this.source = (glob) => {
      return vfs.src(glob, {
        cwd : this.cwd,
        sourcemaps : this.sourcemap,
        cwdbase : true,
        read : this.contents
      }).on("error", input.error);
    }

  }
  addInputs(vinyl, inputs, external = false) {
    let children, inputMap;

    if(external) {
      children = vinyl.references;
      inputMap = this.references;
    } else {
      children = vinyl.dependencies;
      inputMap = this.inputs;
    }

    let fileId = vinyl.path;

    if(!Array.isArray(inputs)) {
      inputs = [inputs];
    }

    let slot = inputMap.get(fileId);

    if(!slot) {
      inputMap.set(fileId, slot = new Map);
    }

    return Promise.all(
      inputs.map((input) => {
        input = castInput(input);

        if(external) {
          children.push(input.hash);
        } else {
          children.push(...input.glob);
        }

        if(slot.has(input.hash)) {
          return;
        }

        return new Promise((resolve, reject) => {
          new InputStream(input, this.distributer, (error, stream) => {
            if(error) {
              return reject(error);
            }

            resolve(stream);
          });
        });
      })
    ).then((inputs) => {
        inputs.forEach((input) => {
          if(input.watch) {
            slot.set(input.hash, input);
          } else {
            input.destroy();
          }
        });

    });
  }
  _destroy() {
    function destroyInputs(inputMap) {
      for(input of inputMap) {
        input.destroy();
      }

      inputMap.clear();
    }

    this.references.forEach(destroyInputs);
    this.references.clear();

    this.inputs.forEach(destroyInputs)
    this.inputs.clear();

    if(this.watcher) {
      this.watcher.destroy();
    }
  }
  depend(fileId, updates = []) {
    let watcher = this.watcher;
    let dependencies = this.fileToDependencies.get(fileId);
    let updateSet = new Set(updates);

    if(dependencies) {
      dependencies.forEach((dependency) => {
        if(!updateSet.has(dependency)) {
          this.undepend(fileId, [dependency]);
        } else {
          updateSet.delete(dependency);
        }
      });
    } else if(updateSet.size) {
      this.fileToDependencies.set(fileId, dependencies = new Set);
    }

    updateSet.forEach((dependency) => {
      dependencies.add(dependency);
      watcher.add(dependency);

      let importers = this.dependencyToFiles.get(dependency);

      if(!importers) {
        this.dependencyToFiles.set(dependency, importers = new Set);
      }

      importers.add(fileId);
    });
  }
  undepend(fileId, dependencies) {
    if(dependencies) {
      let watcher = this.watcher;

      dependencies.forEach((dependency) => {
        let importers = this.dependencyToFiles.get(dependency);

        if(importers && importers.has(fileId)) {
          watcher.unwatch(dependency);
          importers.delete(fileId);

          if(importers.size == 0) {
            this.dependencyToFiles.delete(dependency);
          }
        }
      });

      fileToDependencies.remove(fileId);
    }
  }
  _write(fileIds, encoding, callback) {
    if(!Array.isArray(fileIds)) {
      fileIds = [fileIds];
    }

    fileIds = fileIds.map((fileId) => {
      return path.isAbsolute(fileId)
        ?fileId
        :path.join(this.base, fileId)
    });

    try {
      let input = this.source(fileIds).pipe(new SetupStream(this));
      let noError = true;

      let dest = (
        this.watch
          ?new DependencyStream(this)
          :new PassThrough({ objectMode : true })
      );

      Promise.all(
        this.outputs.map((factory) => {
          return new Promise((resolve, reject) => {
            dest.pipe(
              factory(this)
                .once("finish", resolve)
                .once("error", reject)
            );
          });
        })
      ).then(() => {
        if(noError) {
          this.emit("sync");
          callback();
        }
      }, callback);

      function pipe(stream, handler) {
        if(Array.isArray(handler)) {
          handler = new ParallelTransform(handler);
        }

        return stream.pipe(handler).on('error', (error) => {
          noError = false;
          callback(error);
        });
      }

      this.pipeline.reduce(
        (stream, factory) => {
          let handlers = factory(this);

          if(!Array.isArray(handlers)) {
            handlers = [handlers];
          }

          return handlers.reduce(pipe, stream);
        },
        input
      ).pipe(dest);
    } catch(error) {
      callback(error);
    }
  }
}

module.exports = VinylStream;
