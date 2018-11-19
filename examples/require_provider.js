const RequireStream = require("../src/provider/require.js");

module.exports = {
  providers : [
    new RequireStream({
      cwd : __dirname,
      glob : "./src/bundle.js",
      watch : true
    })
  ]
};
