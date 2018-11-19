# irrigable

Streams API on top of gulp, connecting various build tools.


> The project is in an early alpha, no testing and unstable interface, stay tuned for updates.

## Motivation

One of the biggest Problems in gulp is tracking dependencies, and configs in ES7 or Typescript are not supported out of the box.  
On the other hand webpack and rollups having hard times providing code spliting and external resources like CSS or images. Using import on these resources is not forward compatible and will most likly never be.

## The Idea
This API is heavily inspired by gulp and its stream design. Irrigable its self is already a transform stream one can write to. Configs can be organized as a tree like struct, so if an input is attached it can also fall back to one of its ancestors.  
Instead of providing one big config irrigable aims to seperate these in smaller easier managable chunks.

## Config

### Nodes

All options are optional, most will use the parent node value as fallback.

```javascript
{
  cwd : String = parent.cwd || process.cwd(),
  base : String = parent.base || ".",
  writeBase : String = parent.writeBase || ".",
  env : String | Array<String> = parent.env,
  extend : Boolean = true,
  last : Boolean = true,
  break : Boolean = true,
  fork : Boolean = false,
  traverse : Function | defaultHandler,
  filter : GlobString | Array<GlobString>,
  micromatch : Object,
  contents : Boolean = true,
  cache : Object = parent.cache,
  split : Boolean = parent.split || true,
  watch : Boolean = parent.watch || false,
  error : Function = parent.error || console.warn
  sourcemap : Boolean = parent.sourcemap || false
  providers : Array<String | Invocable | instanceof ReadableStream> = [],
  pipecompose : Function | defaultHandler,
  inputs : Input | Array<Input> = [],
  pipline : Array<Invocable> = [],
  outputs : Invocable | Array<Invocable> = null,
  tasks : Object<String, Node> = {},
  complete : Function = noop
  rules : Array<Node> = [],
  nodes : Array<Node> = []
}
```

### Inputs
This streams will bubble up the tree trying to match one or more nodes.
Inputs will receive the stream that issued the transformation as last argument.

```javascript
{
  last : Boolean,
  glob : String
  pipline : Array<Invocable>,
  outputs : Invocable | Array<Invocable>,
  complete : Function | noop,
  sync : Function | noop,
}
```
### Invocable
Makes internal diffing and hashing more reliable.

```javascript
function
| {
  [construct | invoke] : String | Function
  args : Object | Array<Object>
}
```
if options is a function it self, invocation should be handled inside it and the later returned function should contain at least a property that can used for diffing future updates.
if invoke or construct is a String, this will require the given module which should export a function.


## CLI
The CLI will write a new config to the root stream, with the following options possible:

short | long
 -- | ---
 -p | --providers
 -w | --watch
 -i | --inputs
 -o | --outputs
 -v | --verbose

## Providers
With providers you can add Subconfigs

### ArrayProvider(`array`)
Push an array of configs the the node, this will not watch for changes.

`array` : values that should get emitted

#### Example

```javascript
const ArrayProvider = require("@aboutweb/irrigable/provider/array.js");

new ArrayProvider([
  { inputs : ["./some.config"]}
]);

```

### ImportProvider(`options`, `parent`)

Will find all matching files build them using rollup, execute them inline and emit its module.exports. This will also watch for changes.


`options` : {  
:  **glob** : `GlobString | Array<GlobString>`,  
:  **cwd** : `String = parent.cwd || process.cwd()`,  
  **base** : `String = parent.base || "."`,  
  **watch** : `Boolean = parent.watch || false`,  
  **error** : `Function = parent.error || console.warn`,  
  **pipeline** : `Array<Invocable> = [],`  
},  
**parent** : `Object = {}` node that invoked the provider

```javascript
const irrigable = require("@aboutweb/irrigable");
const ImportProvider = require("@aboutweb/irrigable/provider/import.js");

const node = irrigable.addNode({
  providers : [{
    construct : ImportProvider,
    args : {
      glob : ["./**/build.js"]
    }
  }]
});

//shorthand

const short = irrigable.addNode({
  providers : ["./**/build.js"]
});

```

## Processors
* [irrigable-html](https://github.com/stephan-dum/irrigable-html)
* [irrigable-sass](https://github.com/stephan-dum/irrigable-sass)
* [irrigable-postcss](https://github.com/stephan-dum/irrigable-postcss)
* [irrigable-webpack](https://github.com/stephan-dum/irrigable-webpack)
* [irrigable-rollup](https://github.com/stephan-dum/irrigable-rollup)

## Transforms
* [irrigable-parallel](https://github.com/stephan-dum/irrigable-html)
* [irrigable-jscompiler](https://github.com/stephan-dum/irrigable-html)


## Licence

 ISC
