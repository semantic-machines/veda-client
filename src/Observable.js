const handler = {
  'get': function (target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(receiver) : value;
  },
  'set': function (target, prop, value, receiver) {
    Reflect.set(target, prop, value, receiver);
    if (typeof prop !== 'symbol') {
      target.emit?.(prop, value);
      target.emit?.('modified', prop, value);
    }
    return true;
  },
  'deleteProperty': function (target, prop) {
    if (prop in target) {
      delete target[prop];
      if (typeof prop !== 'symbol') {
        target.emit?.(prop);
        target.emit?.('modified', prop);
      }
      return true;
    }
  },
};

export default function Observable(Base) {
  return class extends Base {
    constructor(...args) {
      super(...args);
      return new Proxy(this, handler);
    }
  };
}
