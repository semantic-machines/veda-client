import ObserverArray from '../ObserverArray.js';
import Observable from '../Observable.js';
const ObservableObject = Observable(Object);

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ({test, assert}) => {
  test('ObserverArray', async () => {
    const observable = new ObservableObject();
    const observerArray = new ObserverArray(observable, 'id');

    let modifiedEmitted = 0;
    let idEmitted = 0;
    const modifiedHandler = () => modifiedEmitted++;
    const idHandler = () => idEmitted++;
    observable.on('modified', modifiedHandler);
    observable.on('id', idHandler);

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
