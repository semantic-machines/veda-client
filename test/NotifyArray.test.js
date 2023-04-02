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
};
