import {diff} from 'deep-object-diff';
import {decorator} from './Util.js';
import ObservableArray from './ObservableArray.js';

const handler = {
  'get': function (target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
  'set': function (target, prop, value, receiver) {
    target.emit(prop, value);
    target.emit('modified', prop, value);
    if (Array.isArray(value)) {
      const arr = new ObservableArray(...value);
      target[prop] = arr;
      arr.on('modified', () => {
        target.emit(prop, arr);
        target.emit('modified', prop, arr);
      });
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

function makeObservable (target) {
  let callbacks = {};

  target.on = function (events, fn) {
    if (typeof fn === 'function') {
      events.replace(/[^\s]+/g, (name, pos) => {
        callbacks[name] = callbacks[name] || [];
        callbacks[name].push(fn);
        fn.typed = pos > 0;
      });
    }
    return target;
  };

  target.off = function (events, fn) {
    if (events === '*') callbacks = {};
    else if (fn) {
      events.replace(/[^\s]+/g, (name) => {
        if (callbacks[name]) {
          callbacks[name] = callbacks[name].filter((cb) => {
            return cb !== fn;
          });
        }
      });
    } else {
      events.replace(/[^\s]+/g, (name) => {
        callbacks[name] = [];
      });
    }
    return target;
  };

  target.one = target.once = function (name, fn) {
    if (fn) fn.one = true;
    return target.on(name, fn);
  };

  target.trigger = target.emit = function (name, ...args) {
    const fns = callbacks[name] || [];
    let c = 0;
    return fns.reduce((p, fn, i) => p.then(() => {
      if (fn.one) {
        fns.splice(i - c, 1); c++;
      }
      return fn.apply(this, fn.typed ? [name].concat(args) : args);
    }), Promise.resolve()).then(() => this);
  };
}

export default function Observable (Class) {
  class ObservableClass extends Class {
    constructor (...args) {
      super(...args);
      if (!(this.on && this.off && this.trigger)) {
        makeObservable(this);
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

  function setDecorators (_class) {
    if (!_class) return;

    if (_class.setters) {
      _class.setters.forEach((name) => {
        ObservableClass.prototype[name] = ObservableClass.prototype.hasOwnProperty(name) ? ObservableClass.prototype[name] : setterDecorator(_class.prototype[name]);
      });
    }

    if (_class.actions) {
      _class.actions.forEach((name) => {
        ObservableClass.prototype[name] = ObservableClass.prototype.hasOwnProperty(name) ? ObservableClass.prototype[name] : actionDecorator(_class.prototype[name]);
      });
    }

    setDecorators(Object.getPrototypeOf(_class));
  }

  setDecorators(Class);

  return ObservableClass;
}
