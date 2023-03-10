import List from './List.js';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ({test, assert}) => {
  test('List', async () => {
    const list = new List();
    let emitted = 0;
    const handler = () => emitted++;
    list.on('modified', handler);
    list[0] = 1;
    list.push(2);
    list.unshift(0);
    list.any = 'any';
    assert(list.length === 3);
    await timeout();
    assert(emitted === 3);
    assert(Array.isArray(list));

    const list2 = new List(1,2,3);
    assert(list2.length === 3);
  });
};
