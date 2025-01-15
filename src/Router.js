export default class Router {
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

  add (...args) {
    const fn = args.pop();
    args.forEach((pattern) => {
      const re = this.#parse(pattern);
      this.#routes.push([pattern, fn, re]);
    });
    return this;
  }

  remove (...args) {
    const fn = args.pop();
    args.forEach((pattern) => {
      this.#routes = this.#routes.filter(([p, f]) => p !== pattern && f !== fn);
    });
    return this;
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

  #token_re = /^(#|:?\w+|\*|\*\*|\([^()]+\))$/;

  #parse (pattern) {
    if (pattern.length > 2000) throw Error('Pattern too long');

    const tokens = decodeURIComponent(pattern).split('/');
    if (tokens.length > 10) throw Error('Too many tokens');

    const re = new RegExp(
      '^' + tokens.map((token) => {
        if (!token) return '';

        if (!this.#token_re.test(token)) throw Error(`Invalid token: ${token}`);
        if (token.length > 100) throw Error(`Token too long: ${token}`);

        if (token === '*') return '[^/]+';
        if (token === '**') return '.*';
        if (token.startsWith(':')) return `([^/]*)`;
        if (token.startsWith('(')) return token;

        return token;
      }).join('/') + '$',
    );
    return re;
  }
}
