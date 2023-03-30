function genUri () {
  return 'd:' + guid();
}

function guid () {
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

function asyncDecorator (fn, pre, post, err) {
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

function syncDecorator (fn, pre, post, err) {
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

function decorator (fn, ...args) {
  return fn.constructor.name === 'AsyncFunction' ? asyncDecorator(fn, ...args) : syncDecorator(fn, ...args);
}

function timeout (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {genUri, decorator, syncDecorator, asyncDecorator, timeout};
