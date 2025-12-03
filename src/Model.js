import Emitter from './Emitter.js';
import Backend from './Backend.js';
import WeakCache from './WeakCache.js';
import Subscription from './Subscription.js';
import Value from './Value.js';
import {genUri, decorator} from './Util.js';
import {reactive} from './Reactive.js';

const IS_NEW = Symbol('isNew');
const IS_SYNC = Symbol('isSync');
const IS_LOADED = Symbol('isLoaded');
const LOAD_PROMISE = Symbol('loadPromise');
const SAVE_PROMISE = Symbol('savePromise');
const RESET_PROMISE = Symbol('resetPromise');
const REMOVE_PROMISE = Symbol('removePromise');
const MEMBERSHIPS = Symbol('memberships');
const RIGHTS = Symbol('rights');

// Dangerous property names that could break Model or cause prototype pollution
const DANGEROUS_PROPS = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);

/**
 * Semantic Data Model.
 * Represents an RDF resource with properties.
 * Automatically handles loading, saving, and reactivity.
 */
export default class Model extends Emitter(Object) {
  static cache = new WeakCache();

  /**
   * Create or retrieve a Model instance.
   * @param {string|Object} [data] - URI string or JSON resource data object. If undefined, creates new blank model.
   * @returns {Model} Reactive model instance
   */
  constructor (data) {
    super(); // eslint-disable-line constructor-super

    // Note: For cached models returning early, this listener is already attached
    // from the first construction, so we don't duplicate it
    this.on('modified', () => {
      this.isSync(false);
    });

    if (typeof data === 'string') {
      this.id = data;
      this.isNew(false);
      this.isSync(false);
      this.isLoaded(false);

      const cached = Model.cache.get(this.id);
      if (cached) {
        // Factory pattern: return existing instance from cache
        // eslint-disable-next-line no-constructor-return
        return cached; // Already reactive and has listener
      }
    } else if (typeof data === 'undefined' || data === null) {
      this.id = genUri();
      this.isNew(true);
      this.isSync(false);
      this.isLoaded(false);
    } else if (typeof data === 'object') {
      const id = data['@'];
      const cached = Model.cache.get(id);

      if (cached) {
        // No need to reattach listener - already attached from first construction
        cached.apply(data);
        cached.isNew(false);
        cached.isSync(true);
        cached.isLoaded(true);
        // Factory pattern: return existing instance from cache
        // eslint-disable-next-line no-constructor-return
        return cached; // Already reactive and has listener
      }

      this.id = id;
      this.apply(data);
      this.isNew(false);
      this.isSync(true);
      this.isLoaded(true);
    }

    const reactiveModel = reactive(this, {
      onSet: function(key, value) {
        if (typeof this.emit === 'function') {
          this.emit(key, value);
          this.emit('modified', key, value);
        }
      },
      onDelete: function(key) {
        if (typeof this.emit === 'function') {
          this.emit(key);
          this.emit('modified', key);
        }
      }
    });

    // Cache the reactive proxy
    Model.cache.set(this.id, reactiveModel);

    // DevTools integration
    if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
      window.__VEDA_DEVTOOLS_HOOK__.trackModel(reactiveModel);
    }

    // Factory pattern: return reactive proxy instead of this
    // eslint-disable-next-line no-constructor-return
    return reactiveModel;
  }

  /**
   * Apply data to the model.
   * @param {Object} data - JSON resource data
   */
  apply (data) {
    const thisProps = new Set(Object.getOwnPropertyNames(this));
    const dataProps = new Set(Object.getOwnPropertyNames(data));

    const propsToDelete = [...thisProps].filter(prop => !dataProps.has(prop));
    propsToDelete.forEach(prop => prop !== 'id' && delete this[prop]);

    dataProps.forEach((prop) => {
      // Skip dangerous property names to prevent prototype pollution
      if (DANGEROUS_PROPS.has(prop)) {
        console.warn(`Model.apply: Skipping dangerous property name: ${prop}`);
        return;
      }

      if (prop === '@') {
        this.id = data['@'] ?? genUri();
        return;
      }
      let value = data[prop];
      if (Array.isArray(value)) {
        value = value.map(Value.parse);
      } else {
        value = Value.parse(value);
      }
      this[prop] = value;
    });
  }

  /**
   * Convert model to JSON resource data.
   * @returns {Object} JSON resource data
   */
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

  /**
   * Subscribe to server-side updates for this individual.
   */
  subscribe () {
    const updater = (id) => {
      const model = new Model(id);
      model.reset().catch((error) => {
        console.error(`Error resetting model ${id}`, error);
      });
    };
    Subscription.subscribe(this, [this.id, this.hasValue('v-s:updateCounter') ? this['v-s:updateCounter'][0] : 0, updater]);
  }

  /**
   * Unsubscribe from server-side updates.
   */
  unsubscribe () {
    Subscription.unsubscribe(this.id);
  }

  /**
   * Check if model is new (not saved).
   * @param {boolean} [value] - Set value
   * @returns {boolean}
   */
  isNew (value) {
    if (typeof value === 'undefined') {
      return this[IS_NEW];
    }
    this[IS_NEW] = !!value;
    return this[IS_NEW];
  }

  /**
   * Check if model is synced with backend.
   * @param {boolean} [value] - Set value
   * @returns {boolean}
   */
  isSync (value) {
    if (typeof value === 'undefined') {
      return this[IS_SYNC];
    }
    this[IS_SYNC] = !!value;
    return this[IS_SYNC];
  }

  /**
   * Check if model data is loaded.
   * @param {boolean} [value] - Set value
   * @returns {boolean}
   */
  isLoaded (value) {
    if (typeof value === 'undefined') {
      return this[IS_LOADED];
    }
    this[IS_LOADED] = !!value;
    return this[IS_LOADED];
  }

  /**
   * Check if property has specific value(s).
   * @param {string} prop - Property URI
   * @param {any} [value] - Value to check. If undefined, checks if property exists.
   * @returns {boolean}
   */
  hasValue (prop, value) {
    if (!prop && typeof value !== 'undefined') {
      return Object.getOwnPropertyNames(this).reduce((prev, prop) => prev || this.hasValue(prop, value), false);
    }
    const found = typeof this[prop] !== 'undefined';
    if (typeof value !== 'undefined' && value !== null) {
      const serialized = Value.serialize(value);
      let propValue = this[prop];
      if (propValue instanceof Function) return false;
      propValue = Array.isArray(propValue) ? propValue : [propValue];
      return found && propValue.some((item) => serialized.isEqual(Value.serialize(item)));
    }
    return found;
  }

  /**
   * Add value to a property.
   * @param {string} prop - Property URI
   * @param {any} value - Value to add
   */
  addValue (prop, value) {
    if (!this.hasValue(prop)) {
      this[prop] = value;
    } else {
      const currentValue = this[prop];
      if (Array.isArray(currentValue)) {
        const newValue = [...currentValue, value];
        this[prop] = newValue;
      } else {
        this[prop] = [currentValue, value];
      }
    }
  }

  /**
   * Remove value from a property.
   * @param {string} prop - Property URI
   * @param {any} value - Value to remove
   */
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
      this.isSync(false); // Mark model as modified
    }
  }

  /**
   * Get property value chain (traversal).
   * @param {...string} props - Property chain
   * @returns {Promise<any>} Resulting value
   */
  async getPropertyChain (...props) {
    await this.load();
    const prop = props.shift();
    if (!this.hasValue(prop)) return;
    if (!props.length) return this[prop];
    const next = Array.isArray(this[prop]) ? this[prop][0] : this[prop];
    return next.getPropertyChain(...props);
  }

  /**
   * Load data from backend.
   * @param {boolean} [cache=true] - Use cache
   * @returns {Promise<Model>} This model
   */
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

        // DevTools: update model info after load (now has rdf:type etc)
        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.trackModelUpdate(this);
        }

        return this;
      } finally {
        this[LOAD_PROMISE] = null;
      }
    })();

    return this[LOAD_PROMISE];
  }

  /**
   * Reload data from backend (bypass cache).
   * @returns {Promise<Model>} This model
   */
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

  /**
   * Save model to backend.
   * @returns {Promise<Model>} This model
   */
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

  /**
   * Remove model from backend.
   * @returns {Promise<Model>} This model (marked as new/removed)
   */
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

  /**
   * Get label for this object based on preferred language.
   * @param {string} [prop="rdfs:label"] - Property to use for label
   * @param {string[]} [lang=['RU']] - Preferred languages (e.g. ['EN', 'RU'])
   * @returns {string} Label text
   */
  toLabel (prop="rdfs:label", lang = ['RU']) {
    if (!this.hasValue(prop)) return '';
    let label = '';
    if (this[prop].length == 1) {
      label = this[prop][0];
    } else {
      label = this[prop].filter((l) => {
        for (const currentLang of lang) {
          const re = new RegExp('\\^\\^' + currentLang);
          if (re.test(l)) return true;
        }
        return false;
      }).join(' ');
    }
    return label.replace(/\^\^../g, "");
  }

  /**
   * Load membership information (groups/orgs).
   * @returns {Promise<Model>} Memberships model
   */
  async loadMemberships () {
    const membershipJSON = await Backend.get_membership(this.id);
    membershipJSON['@'] = genUri();
    this[MEMBERSHIPS] = new Model(membershipJSON);
    return this[MEMBERSHIPS];
  }

  /**
   * Check if model is a member of a group/org.
   * @param {string} id - Group/Org URI
   * @returns {Promise<boolean>}
   */
  async isMemberOf (id) {
    if (!this[MEMBERSHIPS]) await this.loadMemberships();
    return this[MEMBERSHIPS].hasValue('v-s:memberOf', id);
  }

  /**
   * Load effective rights for current user on this object.
   * @returns {Promise<Model>} Rights model
   */
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
      rightsJSON['@'] = genUri();
      this[RIGHTS] = new Model(rightsJSON);
    }
    return this[RIGHTS];
  }

  /**
   * Check if current user can create this type of object.
   * @returns {Promise<boolean>}
   */
  async canCreate () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canCreate', true);
  }

  /**
   * Check if current user can read this object.
   * @returns {Promise<boolean>}
   */
  async canRead () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canRead', true);
  }

  /**
   * Check if current user can update this object.
   * @returns {Promise<boolean>}
   */
  async canUpdate () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canUpdate', true);
  }

  /**
   * Check if current user can delete this object.
   * @returns {Promise<boolean>}
   */
  async canDelete () {
    await this.loadRight();
    return this[RIGHTS].hasValue('v-s:canDelete', true);
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
