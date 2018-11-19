/*
#### ChokidarProvider(`options`, `parent`)

Emit all matching files and watch for changes

`options` : {
  glob : GlobString | Array<GlobString>,
  cwd : String = parent.cwd || process.cwd(),
  initial : Boolean = true,
  disableGlobbing : Boolean = false,
  persistent : Boolean = false,
  transform : Function(file, encoding, callback) {} = noop
}
`parent` = {}

```javascript
const ChokidarProvider = require("@aboutweb/irrigable/provider/chokidar.js");

{
  construct : ChokidarProvider,
  args : {
    glob : "watch.config.js"
  }
}
```*/

const chokidar = require("chokidar");
const { PassThrough } = require("stream");

class GlobWatcher extends PassThrough {
  constructor(options) {
    super({
      objectMode : true
    });

    let {
      glob,
      initial = true,
      cwd = process.cwd(),
      disableGlobbing = false,
      persistent = false,
      transform
    } = options;

    let upsert = (moduleId) => {
      this.write(moduleId);
    };

    if(transform) {
      this._transform = transform;
    }


    this.watcher = chokidar.watch(
      glob,
      {
        cwd,
        ignoreInitial : !initial,
        disableGlobbing,
        persistent,
        usePolling : true,
        awaitWriteFinish : {
          stabilityThreshold : 500,
          pollInterval : 50
        }
      }
    )
      .on("change", upsert)
      .on("add", upsert)
      .on("unlink", (moduleId) => this.emit("unlink", moduleId))
      .on("ready", () => this.emit("ready"))
    ;
  }
  unwatch(...args) {
    this.watcher.unwatch(...args);
  }
  add(...args) {
    this.watcher.add(...args);
  }
  destroy() {
    this.watcher.close();
    super.destroy();
  }
}

module.exports = GlobWatcher;
