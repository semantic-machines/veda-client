import Resource from './Resource.js';
import Observable from './Observable.js';
import {genUri} from './Util.js';

const modelHandler = {
  'get': function (obj, key, receiver) {
    const resourceValue = obj.resource[key];
    if (typeof resourceValue !== 'undefined') {
      return Array.isArray(resourceValue) ? resourceValue.map(Resource.parse) : resourceValue;
    }
    const value = obj[key];
    if (value instanceof Function) {
      return function (...args) {
        return value.apply(this === receiver ? obj : this, args);
      };
    }
    return Reflect.get(obj, key, receiver);
  },
  'set': function (obj, key, value, receiver) {
    let values = Array.isArray(value) ? value.map((item) => new Resource(item)) : Array(new Resource(value));
    obj.resource[key] = values;
    obj.isSync(false);
    values = receiver[key];
    obj.emit(key, values);
    obj.emit('modified', key, values);
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

export default class Model extends Observable {
  constructor (resource) {
    super();
    if (typeof resource === 'undefined') {
      this.resource = {id: genUri()};
    } else {
      this.resource = resource;
    }
    return new Proxy(this, modelHandler);
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
