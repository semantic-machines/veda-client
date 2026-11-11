/**
 * Edits one predicate on a live page model.
 * Uses the model's own load() and toJSON(), so Value and Backend stay the page's.
 * The write is a same-origin fetch with the page cookies, not put_individual.
 */

const EDIT_OPS = new Set(['set', 'add', 'remove', 'delete']);
const EDIT_TYPES = new Set(['String', 'Uri', 'Integer', 'Decimal', 'Boolean', 'Datetime']);
const PREDICATE_NAME = /^[A-Za-z][A-Za-z0-9-]*:[A-Za-z0-9_.:-]+$/;
const STATUS_TEXT = {
  400: 'Bad request',
  403: 'Forbidden',
  404: 'Not found',
  422: 'Unprocessable entity',
  423: 'Locked',
  429: 'Too many requests',
  472: 'Not authorized',
  500: 'Internal server error',
  503: 'Service unavailable'
};

let editorBusy = false;

function editError(error) {
  const message = error && typeof error.message === 'string' ? error.message : '';
  if (message && message !== 'undefined') return message;
  return error ? String(error) : 'Save failed';
}

function predicateIndex(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) return Number(value);
  return null;
}

function readPredicate(model, predicate) {
  const value = model[predicate];
  if (value == null) return [];
  return Array.isArray(value) ? value.slice() : [value];
}

function writePredicate(model, predicate, list) {
  if (list.length) model[predicate] = list;
  else delete model[predicate];
}

function storedPredicate(model, predicate) {
  const values = model.toJSON()[predicate];
  if (!values) return [];
  return JSON.parse(JSON.stringify(values));
}

function materializeValue(model, value) {
  const type = value && value.type;
  if (!EDIT_TYPES.has(type)) throw new Error('Unsupported value type');
  const raw = value.data;

  if (type === 'Boolean') {
    if (raw !== true && raw !== false && raw !== 'true' && raw !== 'false') {
      throw new Error('Boolean must be true or false');
    }
    return raw === true || raw === 'true';
  }

  if (type === 'Integer') {
    const data = String(raw).trim();
    if (!/^-?\d+$/.test(data)) throw new Error('Invalid integer');
    return Number(data);
  }

  if (type === 'Decimal') {
    const data = String(raw).trim();
    if (!/^-?\d+(\.\d+)?$/.test(data)) throw new Error('Invalid decimal');
    const number = Number(data);
    if (Number.isNaN(number)) throw new Error('Invalid decimal');
    // A whole decimal must stay a string, or toJSON() stores it as Integer.
    return Number.isInteger(number) ? number.toFixed(1) : number;
  }

  if (raw == null || String(raw).trim() === '') throw new Error('Value is required');
  const data = String(raw);

  if (type === 'Datetime') {
    const date = new Date(data);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid datetime');
    return date;
  }

  if (type === 'Uri') {
    const ModelClass = model.constructor;
    if (typeof ModelClass !== 'function') throw new Error('URI is required');
    const linked = new ModelClass(data);
    if (!linked || typeof linked.id !== 'string' || !linked.id) throw new Error('Invalid URI');
    return linked;
  }

  let lang = value.lang ? String(value.lang).trim().toUpperCase() : '';
  if (lang === 'NONE') lang = '';
  if (lang && !/^[A-Z]{2}$/.test(lang)) throw new Error('Language must be two letters');
  return lang ? `${data}^^${lang}` : data;
}

function serverBase() {
  if (typeof location !== 'undefined' && location.origin) return location.origin;
  return 'http://localhost:8080';
}

async function persistPredicate(kind, model, predicate, values) {
  const url = new URL(kind, serverBase());
  let response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ individual: { '@': model.id, [predicate]: values } })
    });
  } catch (error) {
    throw new Error('Server unavailable');
  }
  if (!response.ok) {
    throw new Error(STATUS_TEXT[response.status] || `Server error ${response.status}`);
  }
  try {
    await response.json();
  } catch (error) {
    throw new Error('Server unavailable');
  }
}

export async function editModelPredicate(model, command) {
  if (editorBusy) return { ok: false, error: 'Another edit is still running' };
  if (!model || typeof model.id !== 'string' || !model.id) {
    return { ok: false, error: 'Model is not available' };
  }
  const op = command && command.op;
  const predicate = command && command.predicate;
  if (op === 'load') {
    if (typeof model.isNew === 'function' && model.isNew()) {
      return { ok: false, error: 'Unsaved model cannot be loaded from the server' };
    }
    editorBusy = true;
    try {
      if (typeof model.load === 'function') await model.load();
      if (typeof model.isLoaded === 'function' && !model.isLoaded()) {
        return { ok: false, error: 'Model could not be loaded' };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: editError(error) };
    } finally {
      editorBusy = false;
    }
  }
  if (!EDIT_OPS.has(op)) return { ok: false, error: 'Unknown edit' };
  if (predicate === 'id' || predicate === '@' || !PREDICATE_NAME.test(predicate || '')) {
    return { ok: false, error: 'This predicate cannot be edited' };
  }

  if (typeof model.isNew === 'function' && model.isNew()) {
    return { ok: false, error: 'Unsaved model cannot be written to the server' };
  }

  editorBusy = true;
  let before = null;
  let mutated = false;
  try {
    if (typeof model.isLoaded === 'function' && !model.isLoaded()) {
      await model.load();
      if (!model.isLoaded()) return { ok: false, error: 'Model could not be loaded' };
    }

    before = readPredicate(model, predicate);
    const beforeStored = storedPredicate(model, predicate);
    if (beforeStored.length !== before.length) throw new Error('Cannot serialize a value');
    let next = before.slice();

    if (op === 'set' || op === 'add') {
      const parsed = materializeValue(model, command.value);
      if (op === 'add') {
        next.push(parsed);
      } else {
        const index = predicateIndex(command.index);
        if (index === null || index >= before.length) {
          return { ok: false, error: 'Value index is out of range' };
        }
        next[index] = parsed;
      }
      writePredicate(model, predicate, next);
      mutated = true;
      const stored = storedPredicate(model, predicate);
      if (stored.length !== next.length) throw new Error('Nothing to save');
      await persistPredicate('set_in_individual', model, predicate, stored);
    } else if (op === 'remove') {
      const index = predicateIndex(command.index);
      if (index === null || index >= before.length) {
        return { ok: false, error: 'Value index is out of range' };
      }
      next = before.filter((_, itemIndex) => itemIndex !== index);
      writePredicate(model, predicate, next);
      mutated = true;
      if (next.length) {
        const stored = storedPredicate(model, predicate);
        if (stored.length !== next.length) throw new Error('Nothing to save');
        await persistPredicate('set_in_individual', model, predicate, stored);
      } else {
        await persistPredicate('remove_from_individual', model, predicate, [beforeStored[index]]);
      }
    } else if (!before.length) {
      return { ok: true };
    } else {
      writePredicate(model, predicate, []);
      mutated = true;
      await persistPredicate('remove_from_individual', model, predicate, beforeStored);
    }
    return { ok: true };
  } catch (error) {
    if (mutated) {
      try { writePredicate(model, predicate, before || []); } catch { /* keep the server error */ }
    }
    return { ok: false, error: editError(error) };
  } finally {
    editorBusy = false;
  }
}
