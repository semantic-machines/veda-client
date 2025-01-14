export default function Emitter(Class = Object) {
  class Emitter extends Class {
    static name = `Emitter(${Class.name})`;

    _callbacks = {};

    on (events, fn) {
      if (typeof fn === 'function') {
        events.replace(/[^\s]+/g, (name, pos) => {
          this._callbacks[name] = this._callbacks[name] || [];
          this._callbacks[name].push(fn);
          fn.typed = pos > 0;
        });
      }
      return this;
    }

    off (events, fn) {
      if (events === '*') this._callbacks = {};
      else if (fn) {
        events.replace(/[^\s]+/g, (name) => {
          if (this._callbacks[name]) {
            this._callbacks[name] = this._callbacks[name].filter((cb) => {
              return cb !== fn;
            });
          }
        });
      } else {
        events.replace(/[^\s]+/g, (name) => {
          this._callbacks[name] = [];
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

    emit (name, ...args) {
      const fns = this._callbacks[name] || [];
      let c = 0;
      fns.forEach((fn, i) => {
        if (fn.one) {
          fns.splice(i - c, 1); c++;
        }
        fn.apply(this, fn.typed ? [name].concat(args) : args);
      });
      return this;
    }

    trigger (...args) {
      return this.emit(...args);
    }
  };

  Object.defineProperty(Emitter, 'name', {value: `Emitter(${Class.name})`});

  return Emitter;
}
