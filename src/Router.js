export default class Router {
  static name = 'Router';

  static #instance;

  constructor () {
    if (Router.#instance) return Router.#instance;

    Router.#instance = this;

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (e) => this.go(e));
    }
  }

  #routes = [];

  go (to) {
    if (typeof window === 'undefined') return;
    if (to instanceof PopStateEvent) {
      this.route(location.hash);
    } else {
      history.pushState(0, 0, to);
      this.route(to);
    }
  }

  route (to) {
    this.#routes.forEach(([, fn, re]) => {
      const [match, ...vars] = to.match(re) ?? [];
      if (match) {
        fn(...vars);
      }
    });
  }

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

  check (to) {
    return this.#routes.filter(([, , re]) => re.test(to));
  }

  clear () {
    this.#routes = [];
  }

  #token_re = /^(#|:?\w+|\*|\*\*)$/;

  #parse (pattern) {
    const tokens = decodeURIComponent(pattern).split('/').filter(Boolean);
    const re = new RegExp(
      '^' + tokens.map((token) => {
        if (!this.#token_re.test(token)) throw Error('invalid token: ' + token);

        if (token === '*') return '[^/]+';
        if (token === '**') return '.*';
        if (token.startsWith(':')) return `(?<${token.slice(1)}>[^/]+)`;

        return token;
      }).join('/') + '$',
    );
    return re;
  }
}
