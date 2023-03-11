const mutatingMethods = ['pop', 'push', 'shift', 'unshift', 'reverse', 'sort', 'splice'];

const handler = {
  'get': function (obj, key, receiver) {
    const value = Reflect.get(obj, key, receiver);
    if (mutatingMethods.includes(key)) {
      return function (...args) {
        const result = value.apply(obj, args);
        obj.observable.emit('modified', obj.prop, obj);
        obj.observable.emit(obj.prop, obj);
        return result;
      };
    }
    return typeof value === 'function' ? value.bind(obj) : value;
  },
  'set': function (obj, key, value, receiver) {
    if (Number.isInteger(Number(key))) {
      obj.observable.emit('modified', obj.prop, obj);
      obj.observable.emit(obj.prop, obj);
    }
    return Reflect.set(obj, key, value, receiver);
  },
};

class NormalizedArray extends Array {
  constructor (...args) {
    return Array.of(...args);
  }
}

export default class ObserverArray extends NormalizedArray {
  observable;
  prop;
  constructor (observable, prop, ...args) {
    super(...args);
    this.observable = observable;
    this.prop = prop;
    return new Proxy(this, handler);
  }
}
