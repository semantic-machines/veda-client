import Observable from './Observable.js';

class _Array extends Array {
  static setters = ['pop', 'push', 'shift', 'unshift', 'reverse', 'sort', 'splice'];

  constructor (...args) {
    super(...args);
    if (args.length === 1 && Number.isInteger(args[0])) this[0] = args[0]; // Array(number) workaround
  }

  toJSON () {
    return Object.getOwnPropertyNames(this).reduce((acc, prop) => Number.isNaN(Number(prop)) ? acc : (acc[prop] = this[prop], acc), []);
  }
}

export default Observable(_Array);
