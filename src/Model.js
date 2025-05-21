import Emitter from './Emitter.js';
import Observable from './Observable.js';
import Backend from './Backend.js';
import WeakCache from './WeakCache.js';
import Subscription from './Subscription.js';
import Value from './Value.js';
import {genUri, decorator} from './Util.js';

const IS_NEW = Symbol('isNew');
const IS_SYNC = Symbol('isSync');
const IS_LOADED = Symbol('isLoaded');
const LOAD_PROMISE = Symbol('loadPromise');
const SAVE_PROMISE = Symbol('savePromise');
const RESET_PROMISE = Symbol('resetPromise');
const REMOVE_PROMISE = Symbol('removePromise');
const MEMBERSHIPS = Symbol('memberships');
const RIGHTS = Symbol('rights');

export default class Model extends Observable(Emitter(Object)) {
  static cache = new WeakCache();

  constructor (data) {
    super();

    this.on('modified', () => this.isSync(false));

    if (typeof data === 'string') {
      this.id = data;
      this.isNew(false);
      this.isSync(false);
      this.isLoaded(false);
      return Model.cache.get(this.id) ?? (Model.cache.set(this.id, this), this);
    } else if (typeof data === 'undefined' || data === null) {
      this.id = genUri();
      this.isNew(true);
      this.isSync(false);
      this.isLoaded(false);
      return (Model.cache.set(this.id, this), this);
    } else if (typeof data === 'object') {
      const id = data['@'];
      const cached = Model.cache.get(id) ?? (Model.cache.set(id, this), this);
      cached.apply(data);
      cached.isNew(false);
      cached.isSync(true);
      cached.isLoaded(true);
      return cached;
    }
  }

  apply (data) {
    const thisProps = new Set(Object.getOwnPropertyNames(this));
    const dataProps = new Set(Object.getOwnPropertyNames(data));

    const propsToDelete = [...thisProps].filter(prop => !dataProps.has(prop));
    propsToDelete.forEach(prop => prop !== 'id' && delete this[prop]);

    dataProps.forEach((prop) => {
      if (prop === '@') return this.id = data['@'] ?? genUri();
      let value = data[prop];
      if (Array.isArray(value)) {
        value = value.map(Value.parse);
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
    const updater = (id) => {
      const model = new Model(id);
      model.reset().catch((error) => {
        console.error(`Error resetting model ${id}`, error);
      });
    };
    Subscription.subscribe(this, [this.id, this.hasValue('v-s:updateCounter') ? this['v-s:updateCounter'][0] : 0, updater]);
  }

  unsubscribe () {
    Subscription.unsubscribe(this.id);
  }

  isNew (value) {
    return typeof value === 'undefined' ? this[IS_NEW] : this[IS_NEW] = !!value;
  }

  isSync (value) {
    return typeof value === 'undefined' ? this[IS_SYNC] : this[IS_SYNC] = !!value;
  }

  isLoaded (value) {
    return typeof value === 'undefined' ? this[IS_LOADED] : this[IS_LOADED] = !!value;
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
        this[prop] = [...currentValue, value];
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
    const next = Array.isArray(this[prop]) ? this[prop][0] : this[prop];
    return next.getPropertyChain(...props);
  }

  async load (cache = true) {
    if (this[LOAD_PROMISE]) {
      return this[LOAD_PROMISE];
    }

    if (this.isNew() || this.isLoaded() && cache) {
      return this;
    }

    this[LOAD_PROMISE] = (async () => {
      try {
        const data = await Backend.get_individual(this.id, cache);
        this.apply(data);
        this.isNew(false);
        this.isSync(true);
        this.isLoaded(true);
        return this;
      } finally {
        this[LOAD_PROMISE] = null;
      }
    })();

    return this[LOAD_PROMISE];
  }

  async reset () {
    if (this[RESET_PROMISE]) {
      return this[RESET_PROMISE];
    }

    this[RESET_PROMISE] = (async () => {
      try {
        await this.load(false);
        return this;
      } finally {
        this[RESET_PROMISE] = null;
      }
    })();

    return this[RESET_PROMISE];
  }

  async save () {
    if (this[SAVE_PROMISE]) {
      return this[SAVE_PROMISE];
    }

    if (this.isSync()) return this;

    this[SAVE_PROMISE] = (async () => {
      try {
        const json = this.toJSON();
        await Backend.put_individual(json);
        this.isNew(false);
        this.isSync(true);
        this.isLoaded(true);
        return this;
      } finally {
        this[SAVE_PROMISE] = null;
      }
    })();

    return this[SAVE_PROMISE];
  }

  async remove () {
    if (this[REMOVE_PROMISE]) {
      return this[REMOVE_PROMISE];
    }

    this[REMOVE_PROMISE] = (async () => {
      try {
        await Backend.remove_individual(this.id);
        this.isNew(true);
        this.isSync(false);
        this.isLoaded(false);
        return this;
      } finally {
        this[REMOVE_PROMISE] = null;
      }
    })();

    return this[REMOVE_PROMISE];
  }

  toLabel (field="rdfs:label", lang = ['RU']) {
    if (!this.hasValue(field)) return '';
    let label = '';
    if (this[field].length == 1) {
      label = this[field][0];
    } else {
      label = this[field].filter((l) => {
        for (const currentLang of lang) {
          const re = new RegExp('\\^\\^' + currentLang);
          if (re.test(l)) return true;
        }
        return false;
      }).join(' ');
    }
    return label.replace(/\^\^../g, "");
  }

  async loadMemberships () {
    const membershipJSON = await Backend.get_membership(this.id);
    this[MEMBERSHIPS] = new Model(membershipJSON);
    return this[MEMBERSHIPS];
  }

  async isMemberOf (id) {
    if (!this[MEMBERSHIPS]) await this.loadMemberships();
    return this[MEMBERSHIPS].hasValue('v-s:memberOf', id);
  }

  async loadRight () {
    if (this[RIGHTS]) return this[RIGHTS];
    if (this.isNew()) {
      this[RIGHTS] = new Model();
      this[RIGHTS]['v-s:canCreate'] = [true];
      this[RIGHTS]['v-s:canRead'] = [true];
      this[RIGHTS]['v-s:canUpdate'] = [true];
      this[RIGHTS]['v-s:canDelete'] = [true];
    } else {
      const rightsJSON = await Backend.get_rights(this.id, Backend.user_uri);
      this[RIGHTS] = new Model(rightsJSON);
    }
    return this[RIGHTS];
  }

  async canCreate () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canCreate');
  }

  async canRead () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canRead');
  }

  async canUpdate () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canUpdate');
  }

  async canDelete () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canDelete');
  }
}

['load', 'save', 'reset', 'remove'].forEach((action) => Model.prototype[action] = actionDecorator(Model.prototype[action]));

function actionDecorator (fn) {
  async function pre () {
    const before = this.toJSON();
    await this.emit('before' + fn.name, before);
  };
  async function post () {
    const after = this.toJSON();
    await this.emit('after' + fn.name, after);
  };
  return decorator(fn, pre, post);
}
