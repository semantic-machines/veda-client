import baretest from 'baretest';
import assert from 'assert';
import {readdir} from 'fs/promises';

const test = baretest('Tests');
const re = /^.*\.test\.js$/;

(async function () {
  const files = (await readdir('./src')).filter((f) => re.test(f));
  const modules = await Promise.all(files.map((file) => import('./' + file)));
  modules.forEach((module) => {
    const t = module.default;
    t({test, assert});
  });
  assert(await test.run());
})();
