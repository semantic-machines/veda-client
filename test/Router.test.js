import Router from '../src/Router.js';

export default ({test, assert}) => {
  test('Router #01. Singleton', async () => {
    const r1 = new Router();
    const r2 = new Router();
    assert(r1 === r2);
  });

  test.only('Router #02. Rest', async () => {
    const r = new Router();

    let vars = [];
    const handler = (...args) => vars = [...vars, ...args];

    r.add('#', handler);

    r.add('#/hello/:var1', handler);

    r.add('#/hello/new/:var2', handler);

    r.follow('#/hello/new/111/222');

    assert(vars.length === 2 && JSON.stringify(['new', '111']) === JSON.stringify(vars));
  });
};
