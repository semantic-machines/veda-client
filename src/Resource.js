import Model from './Model.js';

export default class Resource {
  constructor (data, type = null, lang = null) {
    if (typeof data !== 'undefined' && type !== null) {
      this.data = data;
      this.type = type;
      lang && (this.lang = lang);
    } else if (type === null && typeof data === 'object' && 'data' in data && 'type' in data) {
      this.data = data.data;
      this.type = data.type;
      data.lang && (this.lang = data.lang);
    } else {
      return Resource.serialize(data);
    }
  }

  static parse (value) {
    if (value.type === 'String' && value.data) {
      const string = new String(value.data);
      if (value.lang && value.lang !== 'NONE') {
        string.language = value.lang;
      }
      return string;
    } else if (value.type === 'Uri') {
      return new Model(value.data);
    } else if (value.type === 'Datetime') {
      return new Date(Date.parse(value.data));
    } else if (value.type === 'Decimal') {
      return parseFloat(value.data);
    } else if (value.type === 'Integer') {
      return parseInt(value.data);
    } else if (value.type === 'Boolean') {
      return Boolean(value.data);
    }
  }

  static reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;
  static reg_date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  static reg_ml_string = /^(.*)\^([a-z]{2})$/ims;
  static reg_round_decimal = /^-?\d+([\.\,])0$/;

  static serialize (value) {
    if (typeof value === 'number' ) {
      return new Resource(value, Number.isInteger(value) ? 'Integer' : 'Decimal');
    } else if (typeof value === 'boolean') {
      return new Resource(value, 'Boolean');
    } else if (value instanceof Date) {
      return new Resource(value.toISOString().split('.')[0]+'Z', 'Datetime');
    } else if (value instanceof Model) {
      return new Resource(value.id, 'Uri');
    } else if (typeof value === 'string' || value instanceof String) {
      if ( this.reg_uri.test(value) ) {
        return new Resource(value.valueOf(), 'Uri');
      } else if ( this.reg_date.test(value) ) {
        return new Resource(value.valueOf(), 'Datetime');
      } else if ( this.reg_ml_string.test(value) ) {
        return new Resource(value.replace(this.reg_ml_string, '$1'), 'String', value.replace(this.reg_ml_string, '$2').toUpperCase());
      } else if ( this.reg_round_decimal.test(value) ) {
        return new Resource(parseFloat(value), 'Decimal');
      } else if (value.length) {
        return new Resource(value.valueOf(), 'String', value.language);
      }
    }
  }

  static areEqual (first, second) {
    return first.data === second.data && first.type === second.type && first.lang === second.lang;
  }

  isEqual (resource) {
    return Resource.areEqual(this, resource);
  }
}
