import Subscription from '../src/Subscription.js';
import Model from '../src/Model.js';
import {timeout} from '../src/Util.js';

Subscription.init();

export default ({test, assert}) => {
  test('Subscription - базовая подписка', async () => {
    // Создаем модель без загрузки данных
    const model = new Model('rdfs:Resource');
    let updateReceived = false;

    // Подписываемся на обновления
    Subscription.subscribe(model, [
      model.id,
      0, // updateCounter = 0 должен вызвать обновление
      () => {
        updateReceived = true;
      }
    ]);

    // Ждем некоторое время для получения обновления
    await timeout(1000);

    assert(updateReceived, 'Должно прийти уведомление об обновлении');

    // Отписываемся
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - множественные подписки', async () => {
    const models = [
      new Model('rdfs:Resource'),
      new Model('owl:Class')
    ];

    // Подписываемся на несколько моделей
    models.forEach(model => {
      model.subscribe();
    });

    // Ждем обновлений
    await timeout(1000);

    models.forEach(model => {
      assert(model['v-s:updateCounter'][0] > 0, 'Должны прийти обновления для обеих моделей');
    });

    // Отписываемся
    models.forEach(model => model.unsubscribe());
  });

  test('Subscription - очистка по GC', async () => {
    globalThis.gc();
    await timeout(1000);
  });
};
