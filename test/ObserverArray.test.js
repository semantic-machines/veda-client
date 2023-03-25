import ObserverArray from '../src/ObserverArray.js';
import Observable from '../src/Observable.js';
import Emitter from '../src/Emitter.js';
const ObservableObject = Observable(Emitter(Object));

import {timeout} from '../src/Util.js';

export default ({test, assert}) => {
  test('ObserverArray', async () => {
    const observable = new ObservableObject();

    let modifiedEmitted = 0;
    let idEmitted = 0;
    const modifiedHandler = () => modifiedEmitted++;
    const idHandler = () => idEmitted++;
    observable.on('modified', modifiedHandler);
    observable.on('id', idHandler);

    const observerArray = new ObserverArray(observable, 'id', 0);

    observerArray[0] = 1;
    observerArray.push(2);
    observerArray.unshift(0);
    observerArray.any = 'any';

    assert(Array.isArray(observerArray));
    assert(observerArray.length === 3);

    await timeout(); // observable callbacks are async
    assert(modifiedEmitted === 3);
    assert(idEmitted === 3);
  });
};
