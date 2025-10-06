type RouteHandler = (...vars: string[]) => void;

export default class Router {
  constructor();

  go(to: string | PopStateEvent): void;
  route(to: string): void;

  add(...args: [...patterns: string[], handler: RouteHandler]): this;
  remove(...args: [...patterns: string[], handler: RouteHandler]): this;

  get(pattern: string): Array<[string, RouteHandler, RegExp]>;
  check(to: string): Array<[string, RouteHandler, RegExp]>;

  clear(): void;
}

