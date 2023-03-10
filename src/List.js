import Observable from './Observable.js';

const handler = {
  'get': function (obj, key, receiver) {
    const value = obj[key];
    if (value instanceof Function) {
      return function (...args) {
        if (['pop', 'push', 'shift', 'unshift', 'reverse', 'sort', 'splice'].indexOf(key) >= 0) {
          obj.emit('modified');
        }
        return value.apply(this === receiver ? obj : this, args);
      };
    }
    return Reflect.get(obj, key, receiver);
  },
  'set': function (obj, key, value, receiver) {
    if (Number.isInteger(Number(key))) {
      obj.emit('modified');
    }
    return Reflect.set(obj, key, value, receiver);
  },
};

export default class List extends Observable(Array) {
  constructor (...args) {
    super(...args);
    return new Proxy(this, handler);
  }
}
