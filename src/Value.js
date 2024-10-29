import Model from './Model.js';

export default class Value {
  constructor (data, type = null, lang = null) {
    if (typeof data !== 'undefined' && type !== null) {
      this.data = data;
      this.type = type;
      lang && (this.lang = lang.toUpperCase());
    } else if (type === null && typeof data === 'object' && 'data' in data && 'type' in data) {
      this.data = data.data;
      this.type = data.type;
      data.lang && (this.lang = data.lang.toUpperCase());
    } else {
      return Value.serialize(data);
    }
  }

  static parse (value) {
    if (value.type === 'String' && value.data) {
      return `${value.data}${value.lang && value.lang !== 'NONE' ? `^^${value.lang}` : ''}`;
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
  static reg_ml_string = /^(.*)\^\^([a-z]{2})$/ims;
  static reg_round_decimal = /^-?\d+([.,])0$/;

  static serialize (value) {
    if (typeof value === 'number' ) {
      return new Value(value, Number.isInteger(value) ? 'Integer' : 'Decimal');
    } else if (typeof value === 'boolean') {
      return new Value(value, 'Boolean');
    } else if (value instanceof Date) {
      return new Value(value.toISOString().split('.')[0]+'Z', 'Datetime');
    } else if (value instanceof Model) {
      return new Value(value.id, 'Uri');
    } else if (typeof value === 'string' || value instanceof String) {
      if ( Value.reg_uri.test(value) ) {
        return new Value(value.valueOf(), 'Uri');
      } else if ( Value.reg_date.test(value) ) {
        return new Value(value.valueOf().split('.')[0]+'Z', 'Datetime');
      } else if ( Value.reg_ml_string.test(value) ) {
        return new Value(value.replace(Value.reg_ml_string, '$1'), 'String', value.replace(Value.reg_ml_string, '$2').toUpperCase());
      } else if ( Value.reg_round_decimal.test(value) ) {
        return new Value(parseFloat(value), 'Decimal');
      } else if (value.length) {
        return new Value(value.valueOf(), 'String', value.language);
      }
    } else if (typeof value === 'object') {
      return new Value(value);
    }
  }

  static areEqual (first, second) {
    return first.data === second.data && first.type === second.type && first.lang === second.lang;
  }

  isEqual (value) {
    return Value.areEqual(this, value);
  }
}
