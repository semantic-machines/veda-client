export default class Router {
  static #instance;

  constructor () {
    if (Router.#instance) return Router.#instance;

    Router.#instance = this;

    if (typeof window !== 'undefined') {
      window.onhashchange = () => this.follow(location.hash);
    }
  }

  #routes = [];

  add (pattern, fn) {
    const re = this.#parse(pattern);
    this.#routes.push([pattern, fn, re]);
    return this;
  }

  remove (pattern) {
    this.#routes = this.#routes.filter(([p]) => p !== pattern);
  }

  get (pattern) {
    return this.#routes.filter(([p]) => p === pattern);
  }

  check (hash) {
    return this.#routes.filter(([p, fn, re]) => re.test(hash));
  }

  clear () {
    this.#routes = [];
  }

  follow (hash) {
    this.#routes.forEach(([p, fn, re]) => {
      const [match, ...vars] = hash.match(re) ?? [];
      if (match) fn(...vars);
    });
  }

  #token_re = /^(#|:?\w+)$/;

  #parse (route) {
    const tokens = decodeURIComponent(route).split('/').filter(Boolean);
    const re = new RegExp(
      '^' + tokens.map((token) => {
        if (!this.#token_re.test(token)) throw Error('invalid token: ' + token);
        return !!~token.indexOf(':') ? `(?<${token.substring(1)}>[^/]+)` : token;
      }).join('/'),
    );
    return re;
  }
}
