{
  env : "node",
  dest : "./dest/node",
  reader : {
    read : false,
  },
  rules : [{
    filter : "*.{m,}js",
    pipeline : [
      gulp_rollup({
        entry : {
          plugins : []
        },
        output : {
          format : "cjs",
          sourcemap : true
        }
      })
    ]
  }]
}
