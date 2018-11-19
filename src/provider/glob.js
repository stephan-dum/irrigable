/*
#### GlobProvider(`glob`, `config`, `parent` = {})

Emits all matching files ,will not watch for changes.

`glob` : match this files
`config` : passed directly to node-glob
`parent` : the node the provider is added to

#### Example

```javascript
const irrigable = require("@aboutweb/irrigable");
const GlobProvider = require("@aboutweb/irrigable/provider/glob.js");

const node = irrigable.addNode({
  providers : [{
    construct : GlobProvider,
    args : [
      ["globstring or array of globstrings"],
      {
        noglobstar : true
      }
    ]
  }]
});

```
*/

const { PassThrough } = require("stream");
const Glob = require('glob').Glob;

class GlobStream extends PassThrough {
  constructor(glob, options, parent = {}) {
    super({
      objectMode : true
    });

    let error = options.error || parent.error || console.error;

    let matcher = new Glob(glob, options);

    matcher.on("match", (file) => {
      if(!this.write(file)) {
        matcher.pause();
      }
    });

    matcher.on("error", error);

    this.on("drain", () => {
      matcher.resume();

      if(!matcher.paused && matcher._emitQueue.length == 0) {
        this.push(null);
      }
    });

    matcher.on("end", (files) => {
      if(!matcher.paused) {
        this.push(null);
      }
    });
  }
}

module.exports = GlobStream;
