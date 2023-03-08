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

function decorator (fn, pre, post, err) {
  return async function (...args) {
    try {
      pre && typeof pre === 'function' && await pre.call(this, ...args);
      const result = await fn.call(this, ...args);
      post && typeof post === 'function' && await post.call(this, ...args);
      return result;
    } catch (error) {
      err && typeof err === 'function' && await err(error);
      throw error;
    }
  };
}

export {genUri, decorator};
