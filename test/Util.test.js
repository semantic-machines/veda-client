import {genUri, decorator} from '../src/Util.js';

export default ({test, assert}) => {
  test('genUri', async () => {
    const uri = genUri();
    assert(/^d:[a-z0-9]+$/.test(uri));
  });

  test('decorator', async () => {
    let res;
    let pre;
    let post;
    let err;
    const decorated = decorator(() => res = true, () => pre = true, () => post = true, () => err = true);
    await decorated();
    assert(res && pre && post && !err);

    let resBuggy;
    let preBuggy;
    let errBuggy;
    let postBuggy;
    const buggy = decorator(
      () => {
        resBuggy = true;
        throw Error();
      },
      () => preBuggy = true,
      () => postBuggy = true,
      () => errBuggy = true,
    );
    try {
      await buggy();
    } catch (error) {
      assert(resBuggy && preBuggy && errBuggy && !postBuggy);
    }
  });
};
