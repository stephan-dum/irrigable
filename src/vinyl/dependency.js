const { Transform } = require("stream");
const { performance } = require('perf_hooks');
const path = require("path");
const saveProperties = ["references", "dependencies"];

class DependencyStream extends Transform {
  constructor(vinylStream) {
    super({
      objectMode : true
    });

    this.dependenciesMap = new Map;
    this.referencesMap = new Map;
    this.vinylStream = vinylStream;
  }
  _transform(vinyl, encoding, callback) {
    let fileId = vinyl.history[0];

    saveProperties.forEach((property) => {
      let curr = this[property+'Map'].get(fileId);
      let update = vinyl[property];

      if(!curr) {
        this[property+'Map'].set(fileId, curr = []);
      }

      if(update) {
        curr.push(...update)
      }
    });

    callback(null, vinyl);
  }
  _flush(callback) {
    this.dependenciesMap.forEach((updates, fileId) => {
      this.vinylStream.depend(fileId, updates);
    });

    this.referencesMap.forEach((updates, fileId) => {
      let references = this.vinylStream.references.get(fileId);
      let updateSet = new Set(updates);

      if(references) {
        references.forEach((reference, key) => {
          if(!updateSet.has(key)) {
            reference.destroy();
          }
        });
      }
    });

    callback();
  }
}

module.exports = DependencyStream;
