import Emitter from './Emitter.js';

import Backend from './Backend.js';

import WeakCache from './WeakCache.js';

import Subscription from './Subscription.js';

import NotifyArray from './NotifyArray.js';

import Value from './Value.js';

import {genUri} from './Util.js';

export default class BaseModel extends Emitter() {
  static name = 'BaseModel';

  static cache = new WeakCache();

  constructor (data) {
    super();
    if (typeof data === 'string') {
      this.id = data;

      this.isNew(false);
      this.isSync(false);
    } else if (typeof data === 'undefined') {
      this.id = genUri();

      this.isNew(true);
      this.isSync(false);
    } else if (typeof data === 'object') {
      this.apply(data);

      this.isNew(false);
      this.isSync(true);
    }
    this.on('modified', () => this.isSync(false));
    return BaseModel.cache.get(this.id) ?? (BaseModel.cache.set(this.id, this), this);
  }

  apply (data) {
    Object.getOwnPropertyNames(data).forEach((prop) => {
      if (prop === '@') return this.id = data['@'] ?? genUri();
      let value = data[prop];
      if (Array.isArray(value)) {
        value = new NotifyArray(this, prop, ...value.map(Value.parse));
      } else {
        value = Value.parse(value);
      }
      this[prop] = value;
    });
  }

  toJSON () {
    const keys = Object.getOwnPropertyNames(this);
    const json = keys.reduce((acc, key) => {
      if (key === 'id') {
        acc['@'] = this.id;
        return acc;
      }
      const value = this[key];
      if (Array.isArray(value)) {
        acc[key] = value.map(Value.serialize).filter(Boolean);
        if (!acc[key].length) delete acc[key];
      } else {
        acc[key] = [Value.serialize(value)].filter(Boolean);
        if (!acc[key].length) delete acc[key];
      }
      return acc;
    }, {});
    return json;
  }

  toString () {
    return this.id;
  }

  subscribe () {
    Subscription.subscribe(this, [this.id, this.hasValue('v-s:updateCounter') ? this['v-s:updateCounter'][0] : 0, this.updater]);
  }

  updater (id) {
    const model = new BaseModel(id);
    model.reset().catch((error) => {
      console.error(`Error resetting model ${id}`, error);
    });
  }

  unsubscribe () {
    Subscription.unsubscribe(this.id);
  }

  #isNew;
  isNew (value) {
    return typeof value === 'undefined' ? this.#isNew : this.#isNew = !!value;
  }

  #isSync;
  isSync (value) {
    return typeof value === 'undefined' ? this.#isSync : this.#isSync = !!value;
  }

  hasValue (prop, value) {
    if (!prop && typeof value !== 'undefined') {
      return Object.getOwnPropertyNames(this).reduce((prev, prop) => prev || this.hasValue(prop, value), false);
    }
    let found = !!(typeof this[prop] !== 'undefined');
    if (typeof value !== 'undefined' && value !== null) {
      const serialized = Value.serialize(value);
      let propValue = this[prop];
      if (propValue instanceof Function) return false;
      propValue = Array.isArray(propValue) ? propValue : [propValue];
      found = found && propValue.some((item) => serialized.isEqual(Value.serialize(item)));
    }
    return found;
  }

  addValue (prop, value) {
    if (!this.hasValue(prop)) {
      this[prop] = value;
    } else {
      const currentValue = this[prop];
      if (Array.isArray(currentValue)) {
        currentValue.push(value);
      } else {
        this[prop] = [currentValue, value];
      }
    }
  }

  removeValue (prop, value) {
    if (!prop && typeof value !== 'undefined') {
      return Object.getOwnPropertyNames(this).forEach((prop) => this.removeValue(prop, value));
    }
    if (this.hasValue(prop, value)) {
      if (Array.isArray(this[prop])) {
        const serializedValue = Value.serialize(value);
        this[prop] = this[prop].filter((item) => !serializedValue.isEqual(Value.serialize(item)));
        if (!this[prop].length) delete this[prop];
      } else {
        delete this[prop];
      }
    }
  }

  async getPropertyChain (...props) {
    await this.load();
    const prop = props.shift();
    if (!this.hasValue(prop)) return;
    if (!props.length) return this[prop];
    return this.getPropertyChain.apply(Array.isArray(this[prop]) ? this[prop][0] : this[prop], props);
  }

  #loadPromise = null;

  async load (cache = true) {
    if (this.#loadPromise) {
      return this.#loadPromise;
    }

    if (this.isNew() || this.isSync() && cache) {
      return this;
    }

    this.#loadPromise = (async () => {
      try {
        const data = await Backend.get_individual(this.id, cache);
        this.apply(data);

        this.isNew(false);
        this.isSync(true);
        return this;
      } finally {
        this.#loadPromise = null;
      }
    })();

    return this.#loadPromise;
  }

  #resetPromise = null;

  async reset () {
    if (this.#resetPromise) {
      return this.#resetPromise;
    }

    this.#resetPromise = (async () => {
      try {
        await this.load(false);
        return this;
      } finally {
        this.#resetPromise = null;
      }
    })();

    return this.#resetPromise;
  }

  #savePromise = null;

  async save () {
    if (this.#savePromise) {
      return this.#savePromise;
    }

    if (this.isSync()) return this;

    this.#savePromise = (async () => {
      try {
        await Backend.put_individual(this.toJSON());

        this.isNew(false);
        this.isSync(true);
        return this;
      } finally {
        this.#savePromise = null;
      }
    })();

    return this.#savePromise;
  }

  #removePromise = null;

  async remove () {
    if (this.#removePromise) {
      return this.#removePromise;
    }

    this.#removePromise = (async () => {
      try {
        await Backend.remove_individual(this.id);

        this.isNew(true);
        this.isSync(false);
        return this;
      } finally {
        this.#removePromise = null;
      }
    })();

    return this.#removePromise;
  }
}
