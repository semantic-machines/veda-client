import {diff} from 'deep-object-diff';

import {decorator} from './Util.js';

import ObservableArray from './ObservableArray.js';

import WeakCache from './WeakCache.js';

const handler = {
  'get': function (target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
  'set': function (target, prop, value, receiver) {
    if (Array.isArray(value)) {
      const arr = new ObservableArray(...value);
      target[prop] = arr;
      arr.on('modified', () => {
        target.emit(prop, arr);
        target.emit('modified', prop, arr);
      });
    } else {
      Reflect.set(target, prop, value, receiver);
    }
    target.emit(prop, value);
    target.emit('modified', prop, value);
    return true;
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

export default function Observable (Class, {setters = [], actions = []} = {setters: [], actions: []}) {
  class Observable extends Class {
    static cache = new WeakCache();

    constructor (...args) {
      super(...args);
      if (this.id) {
        const cached = Observable.cache.get(this.id);
        if (cached) return cached;
        const proxy = new Proxy(this, handler);
        Observable.cache.set(this.id, proxy);
        return proxy;
      }
      return new Proxy(this, handler);
    }
  }

  function setterDecorator (fn) {
    let before;
    function pre () {
      before = this.toJSON();
    };
    function post () {
      const after = this.toJSON();
      const delta = diff(after, before);
      Object.keys(delta).forEach((prop) => {
        this.emit(prop, this[prop]);
        this.emit('modified', prop, this[prop]);
      });
    };
    return decorator(fn, pre, post, console.error);
  }

  function actionDecorator (fn) {
    async function pre () {
      const before = this.toJSON();
      await this.emit('before' + fn.name, before);
    };
    async function post () {
      const after = this.toJSON();
      await this.emit('after' + fn.name, after);
    };
    return decorator(fn, pre, post, console.error);
  }

  setters.forEach((name) => {
    if (typeof Class.prototype[name] === 'function') {
      Observable.prototype[name] = setterDecorator(Class.prototype[name]);
    }
  });

  actions.forEach((name) => {
    if (typeof Class.prototype[name] === 'function') {
      Observable.prototype[name] = actionDecorator(Observable.prototype.hasOwnProperty(name) ? Observable.prototype[name] : Class.prototype[name]);
    }
  });

  Object.defineProperty(Observable, 'name', {value: `Observable(${Class.name})`});

  return Observable;
}
