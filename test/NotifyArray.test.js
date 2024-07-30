import NotifyArray from '../src/NotifyArray.js';

import Observable from '../src/Observable.js';

import Emitter from '../src/Emitter.js';

const ObservableObject = Observable(Emitter(Object));

export default ({test, assert}) => {
  test('NotifyArray', async () => {
    const observable = new ObservableObject();

    let modifiedEmitted = 0;
    let idEmitted = 0;
    const modifiedHandler = () => modifiedEmitted++;
    const idHandler = () => idEmitted++;
    observable.on('modified', modifiedHandler);
    observable.on('id', idHandler);

    const notifyArray = new NotifyArray(observable, 'id', 0);

    notifyArray[0] = 1;
    notifyArray.push(2);
    notifyArray.unshift(0);
    notifyArray.any = 'any';

    assert(Array.isArray(notifyArray));
    assert(notifyArray.length === 3);

    assert(modifiedEmitted === 3);
    assert(idEmitted === 3);
  });

  test('NotifyArray', async () => {
    const array = new NotifyArray(null , null, "123123123");
    const array1 = new NotifyArray(null , null, 6904324967);
    const array2 = new NotifyArray(null , null, 6904324967);
    console.log(array);
    assert(array.length === 1);
    assert(array1.length === 1);
    assert(array2.length === 1);

    assert(array[0] === "123123123");
    assert(array1[0] === 6904324967);
    assert(array2[0] === 6904324967);
  })
};
