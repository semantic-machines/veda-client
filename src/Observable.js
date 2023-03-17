import {diff} from 'deep-object-diff';
import ObserverArray from './ObserverArray.js';

const handler = {
  'get': function (target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
  'set': function (target, prop, value, receiver) {
    target.emit(prop, value);
    target.emit('modified', prop, value);
    if (Array.isArray(value)) {
      target[prop] = new ObserverArray(target, prop, ...value);
      return true;
    }
    return Reflect.set(target, prop, value, receiver);
  },
  'deleteProperty': function (target, prop) {
    if (prop in target) {
      delete target[prop];
      target.emit(prop);
      target.emit('modified', prop);
      return true;
    }
  },
};

export default (Class) => {
  class Observable extends Class {
    constructor (...args) {
      super(...args);
      return new Proxy(this, handler);
    }

    #callbacks = {};

    on (events, fn) {
      if (typeof fn === 'function') {
        events.replace(/[^\s]+/g, (name, pos) => {
          this.#callbacks[name] = this.#callbacks[name] || [];
          this.#callbacks[name].push(fn);
          fn.typed = pos > 0;
        });
      }
      return this;
    }

    off (events, fn) {
      if (events === '*') this.#callbacks = {};
      else if (fn) {
        events.replace(/[^\s]+/g, (name) => {
          if (this.#callbacks[name]) {
            this.#callbacks[name] = this.#callbacks[name].filter((cb) => {
              return cb !== fn;
            });
          }
        });
      } else {
        events.replace(/[^\s]+/g, (name) => {
          this.#callbacks[name] = [];
        });
      }
      return this;
    }

    one (name, fn) {
      if (fn) fn.one = true;
      return this.on(name, fn);
    }
    once (...args) {
      return this.one(...args);
    }

    trigger (name, ...args) {
      const fns = this.#callbacks[name] || [];
      let c = 0;
      return fns.reduce((p, fn, i) => p.then(() => {
        if (fn.one) {
          fns.splice(i - c, 1); c++;
        }
        return fn.apply(this, fn.typed ? [name].concat(args) : args);
      }), Promise.resolve()).then(() => this);
    }
    emit (...args) {
      return this.trigger(...args);
    }
  };

  let proto = Class.prototype;
  if (Class.prototype !== Object.prototype) {
    do {
      const props = Object.getOwnPropertyNames(proto);
      for (const prop of props) {
        if (prop === 'constructor') continue;
        const method = proto[prop];
        if (
          typeof method === 'function' &&
          prop !== 'toJSON' &&
          !Observable.prototype.hasOwnProperty(prop)
        ) {
          Observable.prototype[prop] = function (...args) {
            const before = this.toJSON();
            const result = method.apply(this, args);
            const after = this.toJSON();
            const delta = diff(after, before);
            Object.keys(delta).forEach((prop) => {
              this.emit(prop, this[prop]);
              this.emit('modified', prop, this[prop]);
            });
            return result;
          };
        }
      }
    } while ((proto = Object.getPrototypeOf(proto)) !== Object.prototype);
  }

  return Observable;
};
