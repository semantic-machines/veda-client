/**
 * Serializer
 * Serializes values for DevTools display.
 * Typed fields stay in this file so the hook bundle does not import Value.
 */

const LANG_STRING = /^(.*)\^\^([a-z]{2})$/ims;
const DECIMAL_STRING = /^-?\d+([.,])0$/;
const DATETIME_STRING = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const URI_STRING = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;

export class Serializer {
  serializeValue(value, depth = 0) {
    if (depth > 3) return '[Deep Object]';
    if (value === null) return null;
    if (value === undefined) return undefined;

    const type = typeof value;
    if (type === 'function') return '[Function]';
    if (type !== 'object') return value;

    // Check for Model-like objects
    if (value.id || value['@']) {
      return { _type: 'Model', id: value.id || value['@'] };
    }

    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Set) return `Set(${value.size})`;
    if (value instanceof Map) return `Map(${value.size})`;

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (value.length <= 5) {
        return value.map(item => this.serializeValue(item, depth + 1));
      }
      return value.slice(0, 5).map(item => this.serializeValue(item, depth + 1))
        .concat([`... +${value.length - 5} more`]);
    }

    // Plain object
    const result = {};
    let count = 0;
    for (const key in value) {
      if (key.startsWith('_') || key.startsWith('#')) continue;
      if (count++ > 15) {
        result['...'] = `${Object.keys(value).length - 15} more`;
        break;
      }
      try {
        result[key] = this.serializeValue(value[key], depth + 1);
      } catch (e) {
        result[key] = '[Error]';
      }
    }
    return result;
  }

  extractComponentState(component) {
    const state = {};

    if (!component.state) return state;

    try {
      const stateObj = component.state;

      const keys = [];
      for (const key in stateObj) {
        if (Object.prototype.hasOwnProperty.call(stateObj, key)) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        if (key.startsWith('_') || key.startsWith('#')) continue;
        if (key === '__isReactive') continue;
        if (key === 'model') continue;

        try {
          const value = stateObj[key];
          state[key] = this.serializeValue(value);
        } catch (e) {
          state[key] = '[Error]';
        }
      }
    } catch (e) {
      console.warn('[Veda DevTools] extractComponentState error:', e);
    }

    return state;
  }

  getModelType(model) {
    try {
      const type = model['rdf:type'] || model['@type'];
      if (!type) return 'No type';

      if (Array.isArray(type) && type.length > 0) {
        const t = type[0];
        if (t && typeof t === 'object' && t.id) return t.id;
        if (t && typeof t === 'object') return t['@'] || t.data || String(t);
        if (typeof t === 'string') return t;
        return String(t);
      }

      if (typeof type === 'object' && type.id) return type.id;
      if (typeof type === 'object') return type['@'] || type.data || 'Unknown';
      if (typeof type === 'string') return type;

      return 'Unknown';
    } catch (e) {
      console.warn('[Veda DevTools] getModelType error:', e);
      return 'Error';
    }
  }

  serializeModelProperties(model) {
    const props = {};

    if (!model) return props;

    let keys = [];
    try {
      keys = Object.keys(model);
    } catch (e) {
      return props;
    }

    for (const key of keys) {
      if (key.startsWith('_') || key.startsWith('#')) continue;
      try {
        const value = model[key];
        if (typeof value === 'function') continue;
        if (Array.isArray(value)) {
          props[key] = value.slice(0, 10).map(v => {
            if (typeof v === 'object' && v !== null) {
              if (v.id || v['@']) {
                return { _type: 'Model', id: v.id || v['@'] };
              }
              if (v.data !== undefined) {
                return v.data;
              }
            }
            return this.serializeValue(v);
          });
          if (value.length > 10) {
            props[key].push(`... +${value.length - 10} more`);
          }
        } else {
          props[key] = this.serializeValue(value);
        }
      } catch (e) {
        props[key] = '[Error]';
      }
    }

    return props;
  }

  // Full predicate values for the editor. Display properties stay truncated.
  describeModelFields(model) {
    const fields = [];
    if (!model) return fields;

    let keys = [];
    try {
      keys = Object.keys(model);
    } catch (e) {
      return fields;
    }

    for (const key of keys) {
      if (key === 'id' || key.startsWith('_') || key.startsWith('#')) continue;
      let raw;
      try {
        raw = model[key];
      } catch (e) {
        continue;
      }
      if (typeof raw === 'function') continue;
      const list = Array.isArray(raw) ? raw : [raw];
      const values = [];
      let editable = true;
      for (const item of list) {
        const described = describeLiteral(item);
        if (!described) {
          editable = false;
          break;
        }
        values.push(described);
      }
      fields.push({
        predicate: key,
        values: editable ? values : [],
        editable
      });
    }

    return fields;
  }
}

function describeLiteral(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return { type: 'Boolean', data: value };
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    if (Number.isInteger(value)) return { type: 'Integer', data: value };
    return { type: 'Decimal', data: String(value) };
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { type: 'Datetime', data: value.toISOString().split('.')[0] + 'Z' };
  }
  if (typeof value === 'object') {
    const id = value.id || value['@'];
    if (typeof id !== 'string' || !id) return null;
    return { type: 'Uri', data: id };
  }
  if (typeof value !== 'string') return null;

  const lang = LANG_STRING.exec(value);
  if (lang) return { type: 'String', data: lang[1], lang: lang[2].toUpperCase() };
  if (DECIMAL_STRING.test(value)) return { type: 'Decimal', data: value };
  if (DATETIME_STRING.test(value)) return { type: 'Datetime', data: value.split('.')[0] + 'Z' };
  if (URI_STRING.test(value)) return { type: 'Uri', data: value };
  return { type: 'String', data: value };
}
