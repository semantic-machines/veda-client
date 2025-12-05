/**
 * Serializer
 * Serializes values for DevTools display
 */

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

    try {
      for (const key in model) {
        if (key.startsWith('v-') || key.startsWith('rdf:') ||
            key.startsWith('rdfs:') || key.startsWith('@') ||
            key === 'id') {

          try {
            const value = model[key];
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
      }
    } catch (e) {
      // Model may not be enumerable
    }

    return props;
  }
}
