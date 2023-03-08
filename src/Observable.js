export default class Observable {
  constructor () {
    this.callbacks = {};
  }

  on (events, fn) {
    if (typeof fn === 'function') {
      events.replace(/[^\s]+/g, (name, pos) => {
        this.callbacks[name] = this.callbacks[name] || [];
        this.callbacks[name].push(fn);
        fn.typed = pos > 0;
      });
    }
    return this;
  }

  off (events, fn) {
    if (events === '*') this.callbacks = {};
    else if (fn) {
      events.replace(/[^\s]+/g, (name) => {
        if (this.callbacks[name]) {
          this.callbacks[name] = this.callbacks[name].filter((cb) => {
            return cb !== fn;
          });
        }
      });
    } else {
      events.replace(/[^\s]+/g, (name) => {
        this.callbacks[name] = [];
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
  };

  trigger (name, ...args) {
    const fns = this.callbacks[name] || [];
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
  };
}
