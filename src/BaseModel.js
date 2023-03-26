import Backend from './Backend.js';
import WeakCache from './WeakCache.js';
import Subscription from './Subscription.js';
import Value from './Value.js';
import Emitter from './Emitter.js';
import {genUri} from './Util.js';

export default class BaseModel extends Emitter() {
  static setters = ['set', 'clearValue', 'addValue', 'removeValue', 'load'];
  static actions = ['load', 'reset', 'save', 'remove'];
  static cache = new WeakCache();
  static subscription = new Subscription();
  static backend = new Backend();

  constructor (resource) {
    super();
    if (typeof resource === 'string') {
      this.id = resource;
      this.#isNew = false;
      this.#isSync = false;
      this.#isLoaded = false;
    } else if (typeof resource === 'undefined') {
      this.id = genUri();
      this.#isNew = true;
      this.#isSync = false;
      this.#isLoaded = false;
    } else if (typeof resource === 'object') {
      Object.getOwnPropertyNames(resource).forEach((prop) => {
        if (prop === '@' || prop === 'id') {
          return this.id = resource.id ?? resource['@'] ?? genUri();
        }
        const value = resource[prop];
        this[prop] = Array.isArray(value) ? value.map(Value.parse) : Value.parse(value);
      });
      this.#isNew = false;
      this.#isSync = true;
      this.#isLoaded = true;
    }
    this.on('modified', () => this.isSync(false));
    return BaseModel.cache.get(this.id) ?? (BaseModel.cache.set(this.id, this), this);
  }

  toJSON () {
    const keys = Object.getOwnPropertyNames(this);
    const json = keys.reduce((acc, key) => {
      if (key === 'id') {
        acc['@'] = this.id;
        return acc;
      }
      const value = this[key];
      if (value instanceof Function) {
        return acc;
      } else if (Array.isArray(value)) {
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

  subscribe () {
    BaseModel.subscription.subscribe(this, [this.id, this.hasValue('v-s:updateCounter') ? this['v-s:updateCounter'][0] : 0, this.updater]);
  }

  updater (id, updateCounter) {
    const model = new BaseModel(id);
    model.reset().catch(() => {});
  }

  unsubscribe () {
    BaseModel.subscription.unsubscribe(this.id);
  }

  #isNew = true;
  isNew (value) {
    return typeof value === 'undefined' ? this.#isNew : this.#isNew = !!value;
  }

  #isLoaded = false;
  isLoaded (value) {
    return typeof value === 'undefined' ? this.#isLoaded : this.#isLoaded = !!value;
  }

  #isSync = false;
  isSync (value) {
    return typeof value === 'undefined' ? this.#isSync : this.#isSync = !!value;
  }

  get (prop) {
    return this[prop];
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

  set (prop, value) {
    this[prop] = value;
  }

  clearValue (prop) {
    delete this[prop];
  }

  addValue (prop, value) {
    if (!this.hasValue(prop)) {
      this[prop] = value;
    } else {
      const existingValue = this[prop];
      if (Array.isArray(existingValue)) {
        existingValue.push(value);
      } else {
        this[prop] = [existingValue, value];
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

  async load (cache = true) {
    const data = await BaseModel.backend.get_individual(this.id, cache);
    Object.getOwnPropertyNames(data).forEach((prop) => {
      if (prop === '@' || prop === 'id') return;
      const value = data[prop];
      this[prop] = Array.isArray(value) ? value.map(Value.parse) : Value.parse(value);
    });
    this.isNew(false);
    this.isSync(true);
    this.isLoaded(true);
  }

  async reset () {
    return await this.load(false);
  }

  async save () {
    if (this.isSync()) return;
    await BaseModel.backend.put_individual(this.toJSON());
    this.isNew(false);
    this.isSync(true);
    this.isLoaded(true);
  }

  async remove () {
    await BaseModel.backend.remove_individual(this.id);
    this.isNew(true);
    this.isSync(false);
    this.isLoaded(false);
  }
}