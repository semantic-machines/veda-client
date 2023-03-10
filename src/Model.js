import Value from './Value.js';
import List from './List.js';
import Observable from './Observable.js';
import {genUri} from './Util.js';

const modelHandler = {
  'get': function (obj, key, receiver) {
    const value = obj[key];
    if (value instanceof Function) {
      return function (...args) {
        return value.apply(this === receiver ? obj : this, args);
      };
    }
    if (value instanceof List) {
      return value.map(Value.parse);
    }
    return Reflect.get(obj, key, receiver);
  },
  'set': function (obj, key, value, receiver) {
    const current = obj[key];
    if (current instanceof List) {
      if (Array.isArray(value)) {
        current.splice(0, current.length, ...value.map(Value.serialize));
      } else {
        current.splice(0, current.length, Value.serialize(value));
      }
    } else if (typeof current === 'undefined') {
      obj[key] = Array.isArray(value) ? List.from(value.map((item) => new Value(item))) : new List(new Value(value));
    }
    obj.isSync(false);
    const updated = receiver[key];
    obj.emit(key, updated);
    obj.emit('modified', key, updated);
    return true;
  },
};

function emitDecorator (fn) {
  return async function (...args) {
    try {
      await this.emit('before' + fn.name, ...args);
      const res = await fn.call(this, ...args);
      await this.emit('after' + fn.name, ...args);
      return res;
    } catch (error) {
      console.log(`${fn.name.toUpperCase()}`, error);
      throw error;
    }
  };
}

export default class Model extends Observable(Object) {
  constructor (resource) {
    super();
    if (typeof resource === 'string') {
      this.id = resource;
      this.isNew(false);
    } else if (typeof resource === 'undefined') {
      this.id = genUri();
    } else if (typeof resource === 'object') {
      Object.getOwnPropertyNames(resource).forEach((prop) => {
        if (prop === '@' || prop === 'id') {
          return this.id = resource.id ?? resource['@'];
        }
        this[prop] = List.from(resource[prop].map((value) => new Value(value)));
      });
    }
    return new Proxy(this, modelHandler);
  }

  toJSON () {
    const json = {...this, '@': this.id};
    delete json.id;
    return json;
  }

  #isNewFlag = true;
  isNew (value) {
    return typeof value === 'undefined' ? this.#isNewFlag : this.#isNewFlag = value;
  }

  #isLoadedFlag = false;
  isLoaded (value) {
    return typeof value === 'undefined' ? this.#isLoadedFlag : this.#isLoadedFlag = value;
  }

  #isSyncFlag = false;
  isSync (value) {
    return typeof value === 'undefined' ? this.#isSyncFlag : this.#isSyncFlag = value;
  }

  load = emitDecorator(function load () {
  });
  reset = emitDecorator(function reset () {
  });
  save = emitDecorator(function save () {
  });
  remove = emitDecorator(function remove () {
  });
}
