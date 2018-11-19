const micromatch = require("micromatch");
const Irrigable = require("./irrigable.js");
const InputStream = require("./input.js");
const castInput = InputStream.cast;
const hashJSON = InputStream.hashJSON;
const objectToString = Object.prototype.toString;
const equalProperties = ["filter", "micromatch", "split", "cache", "watch", "pipeline", "last", "fork", "cwd", "env", "outputs", "tasks", "complete", "include"];
const uuid = require("uuid/v1");
const Invocable = require("@aboutweb/irrigable-invoc");
let ImportProvider /*circular see castProvider*/;

function castProvider(provider, parent) {
  if(!ImportProvider) {
    ImportProvider = require('../provider/import.js');
  }

  if(objectToString.call(provider) == "[object String]") {
    provider = new ImportProvider({
      glob : provider,
      cwd : parent.cwd,
      base : parent.base,
      watch : parent.watch
    }, parent);
  } else if(provider.constructor === Object) {
    provider = Invocable(provider)(parent);
  }

  provider.hash = hashJSON(provider);
  provider.uid = uuid();

  return provider;
}

function hashNode(node) {
  let hashObject = {};

  equalProperties.forEach((property) => {
    hashObject[property] = node[property];
  });

  return hashJSON(hashObject);
}

class Distributer extends Irrigable {
  constructor(options, parent) {
    super(options, parent);

    let {
      filter,
      traverse = this._traverse,
      hash = hashNode(options),
      complete,
      micromatch = { basename : true }
    } = options;

    if(!this.outputs) {
      this.outputs = parent.outputs;
    }

    this.intermediateNodes = [];
    this.isComplete = false;
    this.hash = hash;
    this.break = (("break" in options)?options.break:true);
    this.traverse = traverse;
    this.micromatch = micromatch;
    this.providers = new Map;
    this.nodes = new Map;
    this.children = new Map;
    this.inputs = new Map;
    this.rules = new Map;


    if(complete) {
      this.on("complete", complete);
    }

    switch(objectToString.call(filter)) {
      case "[object String]":
      case "[object Array]":
        this.filter = micromatch.matcher(filter, this.micromatch);
        break;
      case "[object Function]":
        this.filter = filter;
        break;
    }

    this.upsertRules(options);
  }
  matches(config) {
    return (
      (!this.filter || config.glob.every((glob) => this.filter(glob)))
      && (
        this.env.length == 0
        || config.env.length == 0
        || config.env.some((env) => this.env.indexOf(env) >= 0)
      )
    );
  }
  dif(iterable, data, autoRemove = true) {
    let
      insert = [],
      remove = [],
      update = [],
      currSet = new Set
    ;

    data.forEach((elem) => {
      currSet.add(elem.hash);

      let curr = iterable.get(elem.hash);

      if(curr) {
        update.push({ curr, next : elem });
      } else {
        insert.push(elem);
      }
    });

    iterable.forEach((elem, key) => {
      if(!currSet.has(elem.hash)) {
        if(autoRemove) {
          iterable.delete(key);
        }
        remove.push(elem);
      }
    });

    return { insert, remove, update };
  }
  trace(input, prev) {
    let children = this.traverse(input, prev);
    let parent = this.parent;

    if(children.length == 0) {
      return parent.trace(input, this);
    }

    let streams = [];
    let bubbles = [];

    children.forEach((child) => {
      if(child[0].last) {
        streams.push(child);
      } else {
        bubbles.push(child);
      }
    });

    if(bubbles.length) {
      let ascendents = parent.trace(input);

      if(ascendents.length == 0) {
        ascendents.push([]);
      }

      bubbles.forEach((bubble) => {
        streams.push(
          ...ascendents.map((ascendent) => [...bubble, ...ascendent])
        );
      });
    }

    return streams;

  }
  _traverse(input, prev) {
    let streams = [];

    if(this.matches(input)) {
      for(let [key, rule] of this.rules) {
        if(prev == rule) {
          continue;
        }

        let nodes = rule.traverse(input, this);

        if(nodes.length) {
          for(let queue of nodes) {
            if(this.extend) {
              queue.push(this);
            }

            streams.push(queue);
          }

          if(rule.break) {
            return streams;
          }

        }
      }

      if(
          streams.length == 0
          && (
            this.pipeline.length
            || this.pipeline._keys.size
          )
      ) {
          return [[this]];
      }
    }

    return streams;

  }
  upsertStreams(config) {
    let {
      inputs = [],
      providers = [],
      nodes = [],
      rules = []
    } = config;

    if(!Array.isArray(providers)) {
      providers = [providers];
    }
    if(!Array.isArray(inputs)) {
      inputs = [];
    }
    if(!Array.isArray(nodes)) {
      nodes = [nodes];
    }

    let inputDif = this.dif(this.inputs, inputs.map(castInput));
    inputDif.remove.forEach((input) => input.destroy());

    nodes.forEach((node) => {
      node.hash = hashNode(node);
    })

    let nodeDif = this.dif(this.nodes, nodes);

    nodeDif.remove.forEach((node) => { node.destroy(); });
    nodeDif.update.forEach(({ curr, next }) => { curr.upsertRules(next); });

    let providerDif = this.dif(this.providers, providers);
    providerDif.remove.forEach((provider) => this.removeProvider);


    let ruleDif = this.dif(this.rules, rules, false);

    return Promise.all([
      Promise.all(
        ruleDif.update.map(
          ({ curr, next }) => curr.upsertStreams(next)
        )
      ),
      nodeDif.insert.reduce((curr, node) => {
        return curr.then(
          () => new Promise((resolve, reject) => {
            this.addNode({
              bundleId : node.hash,
              config : node
            }, this, "nodes")
              .once("complete", resolve)
              .once("error", reject)
            ;
          })
        )
      }, Promise.resolve()),
      this.addProviders(providerDif.insert),
      this.addInputs(inputDif.insert)
    ]).then(
      () => {
        let queue = [];

        (
          (this.watch)
            ?this.children
            :this.intermediateNodes
        ).forEach((child) => {
          queue.push(new Promise((resolve, reject) => {
            if(child.isComplete) {
              return resolve();
            }

            child
              .once("complete", resolve)
              .once("error", reject)
            ;
          }));
        });

        Promise.all(queue).then(() => {
          let node;

          while(node = this.intermediateNodes.pop()) {
            node.destroy();
          }

        }).then(() => {
          this.isComplete = true;
          this.emit("complete");
        });
      },
      this.error
    );
  }
  upsertRules(config) {
    let rules = config.rules || [];

    if(!Array.isArray(rules)) {
      rules = [rules];
    }

    this.isSetup = false;

    rules.forEach((config) => {
      let task = false;

      if(objectToString.call(config) == "[object String]") {
        config = task = this.findTask(config);
      }

      if(!config.hash) {
        config.hash = hashNode(config);
      }

      let node = this.rules.get(config.hash);

      if(node) {
        if(task) {
          return;
        }

        return node.upsertRules(config);
      }

      this.rules.set(
        config.hash,
        task || new Distributer(config, this)
      );
    });

    this.isSetup = true;

    if(this.parent.isSetup) {
      return this.upsertStreams(config);
    }
  }
  addInputs(inputs) {
    if(!Array.isArray(inputs)) {
      inputs = [inputs];
    }

    let createInput = (input) => {
      if(Array.isArray(input)) {
        return inputs.map(createInput).reduce((curr, inputPromise) => {
          return curr.then(inputPromise);
        });
      }

      input = castInput(input);

      if(this.inputs.has(input.hash)) {
        return;
      }

      return new Promise((resolve, reject) => {
        new InputStream(input, this, (error, stream) => {
          if(error) {
            return reject(error);
          }

          resolve(stream);
        });
      });
    }



    return Promise.all(
      inputs.map(createInput)
    ).then((inputs) => {
      inputs.forEach((input) => {
        if(input && input.watch) {
          this.inputs.set(input.hash, input);
        }
      });

      return inputs;
    });
  }
  removeProvider(provider) {
    provider.unpipe(this);
    provider.destroy();
  }
  addProviders(providers) {
    if(providers.length == 0) {
      return
    }

    return Promise.all(
      providers.map((provider) => {
        provider = castProvider(provider, this);

        this.providers.set(provider.hash, provider);

        provider.on("destroy", () => {
            this.nodes.forEach((node, key) => {
              if(node.providerId == provider.uid) {
                node.destroy();
                this.nodes.delete(key);
              }
            });
          })
          .on("unlink", (bundleId) => this.removeNode(bundleId))
          .pipe(this)
        ;

        return new Promise((resolve, reject) => {
          provider
            .once("complete", resolve)
            .once("error", reject)
          ;
        })
      })
    );

  }
  removeNode(bundleId) {
    let node = this.nodes.get(bundleId);

    if(node) {
      node.destroy();
      this.nodes.delete(bundleId);
    }
  }
  addNode(bundle, parent = this, property = "children") {
    let { bundleId, config } = bundle;
    let node;

    config.hash = hashNode(config);

    if(
      bundleId
      && (node = this[property].get(bundleId))
    ) {
      if(
        !config.overwrite
        && node.hash == config.hash
      ) {
        node.upsertRules(config);

        return node;
      }

      node.destroy();
    }

    node = new Distributer(config, this);

    if(bundleId) {
      if(node.watch) {
        this[property].set(bundleId, node);
      } else {
        this.intermediateNodes.push(node);
      }
    }

    return node;
  }
  _destroy(error, callback) {
    this.providers.forEach((provider) => {
      provider.unpipe(this);

      if(provider._readableState.pipesCount == 0) {
        provider.destroy();
      }
    });

    this.providers.clear();

    this.inputs.forEach((input) => {
      input.destroy();
    });

    this.inputs.clear();

    super._destroy(error, callback);
  }
  _write(bundle, encoding, callback) {
    this.addNode(bundle, this).once("complete", callback);
  }
}

module.exports = Distributer;
