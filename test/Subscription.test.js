import Model from '../src/Model.js';
import {timeout} from '../src/Util.js';

export default ({test, assert}) => {
  test('Subscription #01', async () => {
    const m = new Model();
    m.subscribe();
  });

  test('Subscription #02', async () => {
    await timeout(2000);

    globalThis.gc();
  });
};
