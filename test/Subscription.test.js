import Subscription from '../src/Subscription.js';
import Model from '../src/Model.js';
import {timeout} from '../src/Util.js';

Subscription.init();

export default ({test, assert}) => {
  test('Subscription - базовая подписка', async () => {
    const model = new Model('rdfs:Resource');
    let updateReceived = false;

    Subscription.subscribe(model, [
      model.id,
      0,
      () => {
        updateReceived = true;
      }
    ]);

    await timeout(1000);

    assert(updateReceived, 'Должно прийти уведомление об обновлении');

    Subscription.unsubscribe(model.id);
  });

  test('Subscription - множественные подписки', async () => {
    const models = [
      new Model('rdfs:Resource'),
      new Model('owl:Class')
    ];

    models.forEach(model => {
      model.subscribe();
    });

    await timeout(1000);

    models.forEach(model => {
      assert(model['v-s:updateCounter'][0] > 0, 'Должны прийти обновления для обеих моделей');
    });

    models.forEach(model => model.unsubscribe());
  });

  test('Subscription - очистка по GC', async () => {
    globalThis.gc();
    await timeout(1000);
  });

  test('Subscription - повторная подписка', async () => {
    const model = new Model('rdfs:Class');
    let updateCount = 0;

    const subscription = [
      model.id,
      0,
      () => {
        updateCount++;
      }
    ];

    Subscription.subscribe(model, subscription);

    // Попытка повторной подписки должна быть проигнорирована
    Subscription.subscribe(model, subscription);

    await timeout(1000);

    Subscription.unsubscribe(model.id);

    // Повторная отписка должна быть безопасной
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - _getSubscriptionCount', () => {
    const initialCount = Subscription._getSubscriptionCount();

    const model = new Model('test:subscription');
    Subscription.subscribe(model, [model.id, 0, () => {}]);

    assert(Subscription._getSubscriptionCount() === initialCount + 1);

    Subscription.unsubscribe(model.id);

    assert(Subscription._getSubscriptionCount() === initialCount);
  });

  test('Subscription - обработка несуществующей подписки', async () => {
    // Имитируем получение обновления для несуществующей подписки
    const model = new Model('test:nonexistent');
    const initialCount = Subscription._getSubscriptionCount();

    // Подписываемся
    Subscription.subscribe(model, [model.id, 0, () => {}]);
    assert(Subscription._getSubscriptionCount() === initialCount + 1);

    // Удаляем подписку
    Subscription.unsubscribe(model.id);
    assert(Subscription._getSubscriptionCount() === initialCount);

    // Теперь если придет обновление для удаленной подписки, оно должно быть обработано корректно (line 64)
    await timeout(100);
  });
};
