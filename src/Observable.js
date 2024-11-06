import {diff, decorator} from './Util.js';

import NotifyArray from './NotifyArray.js';

const handler = {
  'get': function (target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
  'set': function (target, prop, value, receiver) {
    if (Array.isArray(value)) {
      target[prop] = new NotifyArray(target, prop, ...value);
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
    constructor (...args) {
      super(...args);
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
      delta.forEach((prop) => {
        this.emit(prop, this[prop]);
        this.emit('modified', prop, this[prop]);
      });
    };
    return decorator(fn, pre, post);
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
    return decorator(fn, pre, post);
  }

  setters.forEach((name) => {
    if (typeof Class.prototype[name] === 'function') {
      Observable.prototype[name] = setterDecorator(Class.prototype[name]);
    }
  });

  actions.forEach((name) => {
    if (typeof Class.prototype[name] === 'function') {
      Observable.prototype[name] = actionDecorator(Object.prototype.hasOwnProperty.call(Observable.prototype, name) ? Observable.prototype[name] : Class.prototype[name]);
    }
  });

  Object.defineProperty(Observable, 'name', {value: `Observable(${Class.name})`});

  return Observable;
}
