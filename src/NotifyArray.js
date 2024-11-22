const setters = ['pop', 'push', 'shift', 'unshift', 'reverse', 'sort', 'splice'];

const handler = {
  'get': function (target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (setters.includes(prop)) {
      return function (...args) {
        const result = value.apply(target, args);
        target.notify();
        return result;
      };
    }
    return typeof value === 'function' ? value.bind(target) : value;
  },
  'set': function (target, prop, value, receiver) {
    if (Number.isInteger(Number(prop))) {
      target.notify();
    }
    return Reflect.set(target, prop, value, receiver);
  },
};

export default class NotifyArray extends Array {
  static name = 'NotifyArray';

  #observable;
  #prop;

  notify () {
    this.#observable.emit(this.#prop, this);
    this.#observable.emit('modified', this.#prop, this);
  }

  constructor (observable, prop, ...args) {
    if (args.length === 1 && typeof args[0] === 'number') {
      super();
      this[0] = args[0];
    } else {
      super(...args);
    }
    this.#observable = observable;
    this.#prop = prop;
    return new Proxy(this, handler);
  }
}
