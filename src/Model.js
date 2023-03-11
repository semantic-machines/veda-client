import Value from './Value.js';
import ObserverArray from './ObserverArray.js';
import Observable from './Observable.js';
import {genUri} from './Util.js';

const handler = {
  'get': function (obj, key, receiver) {
    const value = Reflect.get(obj, key, receiver);
    return typeof value === 'function' ? value.bind(obj) : value;
  },
  'set': function (obj, key, value, receiver) {
    obj.isSync(false);
    obj.emit(key, value);
    obj.emit('modified', key, value);
    if (Array.isArray(value)) {
      obj[key] = new ObserverArray(obj, key, ...value);
      return true;
    }
    return Reflect.set(obj, key, value, receiver);
  },
  'deleteProperty': function (obj, key) {
    if (key in obj) {
      delete obj[key];
      obj.emit(key);
      obj.emit('modified', key);
      return true;
    }
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
      console.error(`${fn.name.toUpperCase()}`, error);
      throw error;
    }
  };
}

export default class Model extends Observable(Object) {
  #resource;

  constructor (resource) {
    super();
    this.#resource = resource;
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
        const value = resource[prop];
        this[prop] = Array.isArray(value) ? new ObserverArray(this, prop, ...value.map(Value.parse)) : Value.parse(value);
      });
    }
    return new Proxy(this, handler);
  }

  toJSON () {
    const keys = Object.getOwnPropertyNames(this);
    const json = keys.reduce((acc, key) => {
      if (key === 'id') {
        acc['@'] = this.id;
        return acc;
      }
      const value = this[key];
      if (value instanceof Function) {
        return acc;
      } else if (Array.isArray(value)) {
        acc[key] = value.filter(Boolean).map(Value.serialize);
        if (!acc[key].length) delete acc[key];
      } else {
        acc[key] = [Value.serialize(value)].filter(Boolean);
        if (!acc[key].length) delete acc[key];
      }
      return acc;
    }, {});
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
