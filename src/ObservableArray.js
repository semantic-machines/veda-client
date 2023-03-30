import Emitter from './Emitter.js';

import Observable from './Observable.js';

class _Array extends Emitter(Array) {
  toJSON () {
    return Object.getOwnPropertyNames(this).reduce((acc, prop) => Number.isNaN(Number(prop)) ? acc : (acc[prop] = this[prop], acc), []);
  }
}

Object.defineProperty(_Array, 'name', {value: 'Array'});

export default Observable(_Array, {
  setters: ['pop', 'push', 'shift', 'unshift', 'reverse', 'sort', 'splice'],
});
