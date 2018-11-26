const Distributer = require("./distributer/index.js");
const { Transform } = require("stream");
const CWD = process.cwd();

class DelegationError extends Transform {
  constructor() {
    super({
      objectMode : true
    });
  }
  _transform(vinyl, encoding, callback) {
    callback(new ReferenceError(`Could not delegate ${vinyl.path}!`));
  }
}

module.exports = new Distributer({
  cwd : CWD,
  base : "",
  sourcemap : false,
  error : console.warn,
  webroot : ".",
  outputs : [],
  rules : [{
    pipeline : [{ construct : DelegationError }]
  }],
  watch : false,
  split : true,
  stream : [],
  tasks : {},
  config : {},
  cache : {}
}, {
  isSetup : true,
  emit() {}
});
