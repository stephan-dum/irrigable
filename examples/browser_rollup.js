{
  filter : "*.{m,}js",
  reader : {
    read : false
  },
  pipeline : [
    gulp_rollup({
      entry : {
        plugins : [
          rollupResolve({
            browser : true
          })
        ],
      },
      output : {
        format : "amd",
        sourcemap : true
      }
    })
  ]
}
