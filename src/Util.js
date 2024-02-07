export function genUri () {
  return 'd:' + guid();
}

export function guid () {
  let d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); // use high-precision timer if available
  }
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function (c) {
    const r = (d + Math.random() * 36) % 36 | 0;
    d = Math.floor(d / 36);
    return r.toString(36);
  });
}

export function asyncDecorator (fn, pre, post, err) {
  async function decorated (...args) {
    try {
      pre && typeof pre === 'function' && await pre.call(this, ...args);
      const result = await fn.call(this, ...args);
      post && typeof post === 'function' && await post.call(this, ...args);
      return result;
    } catch (error) {
      err && typeof err === 'function' && await err(error);
      throw error;
    }
  }
  Object.defineProperty(decorated, 'name', {value: fn.name});
  return decorated;
}

export function syncDecorator (fn, pre, post, err) {
  function decorated (...args) {
    try {
      pre && typeof pre === 'function' && pre.call(this, ...args);
      const result = fn.call(this, ...args);
      post && typeof post === 'function' && post.call(this, ...args);
      return result;
    } catch (error) {
      err && typeof err === 'function' && err(error);
      throw error;
    }
  }
  Object.defineProperty(decorated, 'name', {value: fn.name});
  return decorated;
}

export function decorator (fn, ...args) {
  return fn.constructor.name === 'AsyncFunction' ? asyncDecorator(fn, ...args) : syncDecorator(fn, ...args);
}

export function timeout (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function diff (first, second) {
  const props = Object.getOwnPropertyNames;
  if (first === second) return [];
  const delta = [];
  for (const prop of props(first)) {
    if (!second.hasOwnProperty(prop) || !eq(first[prop], second[prop])) {
      delta.push(prop);
    }
  }
  for (const prop of props(second)) {
    if (!first.hasOwnProperty(prop)) {
      delta.push(prop);
    }
  }
  return delta;
};

export function eq (first, second) {
  const props = Object.getOwnPropertyNames;
  const firstType = typeof first;
  const secondType = typeof second;
  return first && second && firstType === 'object' && firstType === secondType ? (
    props(first).length === props(second).length &&
    props(first).every((prop) => eq(first[prop], second[prop]))
  ) : (first === second);
}
