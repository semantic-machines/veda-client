import {diff} from 'deep-object-diff';
import {decorator} from './Util.js';
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
  };

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
  };

  function setDecorators (_class) {
    if (!_class) return;

    if (_class.setters) {
      _class.setters.forEach((name) => {
        Observable.prototype[name] = Observable.prototype.hasOwnProperty(name) ? Observable.prototype[name] : setterDecorator(_class.prototype[name]);
      });
    }

    if (_class.actions) {
      _class.actions.forEach((name) => {
        Observable.prototype[name] = Observable.prototype.hasOwnProperty(name) ? Observable.prototype[name] : actionDecorator(_class.prototype[name]);
      });
    }

    setDecorators(_class.prototype);
  }

  setDecorators(Class);

  return Observable;
};
