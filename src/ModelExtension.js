import Model from './Model.js';
import Value from './Value.js';

export default class ModelExtension extends Model {
  constructor (resource) {
    super(resource);
  }

  get (prop) {
    return this[prop];
  }

  set (prop, value) {
    this[prop] = value;
    this.emit('modified', prop, this[prop]);
    this.emit(prop, this[prop]);
  }

  clearValue (prop) {
    delete this[prop];
    this.emit('modified', prop, this[prop]);
    this.emit(prop, this[prop]);
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
    this.emit('modified', prop, this[prop]);
    this.emit(prop, this[prop]);
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
    this.emit('modified', prop, this[prop]);
    this.emit(prop, this[prop]);
  }
}
