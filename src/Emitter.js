const CALLBACKS = Symbol('callbacks');

export default function Emitter(Class = Object) {
  class Emitter extends Class {
    constructor(...args) {
      super(...args);
      this[CALLBACKS] = {};
    }

    on (events, fn) {
      if (typeof fn === 'function') {
        events.replace(/[^\s]+/g, (name, pos) => {
          const callbacks = this[CALLBACKS];
          // Initialize array directly to avoid prototype chain issues
          if (!Object.hasOwnProperty.call(callbacks, name)) {
            callbacks[name] = [];
          }
          callbacks[name].push(fn);
          fn.typed = pos > 0;
        });
      }
      return this;
    }

    off (events, fn) {
      if (events === '*') this[CALLBACKS] = {};
      else if (fn) {
        events.replace(/[^\s]+/g, (name) => {
          const callbacks = this[CALLBACKS];
          if (Object.hasOwnProperty.call(callbacks, name)) {
            callbacks[name] = callbacks[name].filter((cb) => {
              return cb !== fn;
            });
          }
        });
      } else {
        events.replace(/[^\s]+/g, (name) => {
          this[CALLBACKS][name] = [];
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
      // Use CALLBACKS symbol to avoid prototype chain conflicts
      const callbacks = this[CALLBACKS];
      const fns = (callbacks && Object.hasOwnProperty.call(callbacks, name)) 
        ? callbacks[name] 
        : [];
      
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
