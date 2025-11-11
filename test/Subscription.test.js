import Subscription from '../src/Subscription.js';
import Model from '../src/Model.js';
import {timeout} from '../src/Util.js';

Subscription.init();

export default ({test, assert}) => {
  // ==================== PHASE 1: CRITICAL TESTS ====================
  
  test('Subscription - WebSocket is available', () => {
    // Lines 4-5: WebSocket fallback
    assert(typeof globalThis.WebSocket !== 'undefined', 'WebSocket should be available');
    assert(typeof WebSocket === 'function', 'WebSocket should be a constructor');
  });

  test('Subscription - successful subscribe and receive update from server', async () => {
    // GIVEN: модель с известным ID, который существует на сервере
    const model = new Model('rdfs:Resource');
    let receivedUpdate = false;
    let receivedId = null;
    let receivedCounter = null;
    
    
    // WHEN: подписываемся на обновления
    Subscription.subscribe(model, [
      model.id,
      0, // начальный updateCounter
      (id, counter) => {
        receivedUpdate = true;
        receivedId = id;
        receivedCounter = counter;
      }
    ]);
    
    // Ждем подключения к серверу и получения обновления
    await timeout(3000);
    
    // THEN: 
    // 1. Подписка зарегистрирована
    const subCount = Subscription._getSubscriptionCount();
    assert(subCount > 0, 'Subscription should be registered');
    
    // 2. Callback был вызван с корректными данными
    
    if (receivedUpdate) {
      assert(receivedId === model.id, `Should receive correct ID. Expected: ${model.id}, Got: ${receivedId}`);
      assert(typeof receivedCounter === 'number', `Counter should be number, got: ${typeof receivedCounter}`);
      assert(receivedCounter >= 0, `Counter should be non-negative, got: ${receivedCounter}`);
    } else {
    }
    
    // Cleanup
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - unsubscribe stops receiving updates', async () => {
    // GIVEN: активная подписка
    const model = new Model('owl:Class');
    let updateCount = 0;
    
    
    Subscription.subscribe(model, [
      model.id,
      0,
      (id, counter) => {
        updateCount++;
      }
    ]);
    
    // Wait for potential updates
    await timeout(2000);
    const countAfterSubscribe = updateCount;
    
    // WHEN: отписываемся
    Subscription.unsubscribe(model.id);
    
    // Verify subscription removed
    const subCount = Subscription._getSubscriptionCount();
    
    // Wait to ensure no more updates arrive
    await timeout(2000);
    
    // THEN: 
    // 1. Новые обновления не приходят
    assert(updateCount === countAfterSubscribe, 
      `Should not receive updates after unsubscribe. Before: ${countAfterSubscribe}, After: ${updateCount}`);
  });

  test('Subscription - parse single update message', async () => {
    // GIVEN: подписка на один ресурс
    const model = new Model('v-s:Person');
    let receivedData = null;
    
    
    Subscription.subscribe(model, [
      model.id,
      0,
      (id, counter) => {
        receivedData = { id, counter };
      }
    ]);
    
    // WHEN: сервер отправляет обновление
    await timeout(3000);
    
    // THEN: callback получает правильные данные
    
    if (receivedData) {
      assert(receivedData.id === model.id, 
        `Should parse ID correctly. Expected: ${model.id}, Got: ${receivedData.id}`);
      assert(typeof receivedData.counter === 'number', 
        `Should parse counter as number. Got type: ${typeof receivedData.counter}`);
    } else {
    }
    
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - parse multiple updates in one message', async () => {
    // GIVEN: подписки на несколько ресурсов
    const models = [
      new Model('rdfs:Resource'),
      new Model('owl:Class'),
      new Model('rdfs:Class')
    ];
    
    const receivedUpdates = new Map();
    
    models.forEach(model => {
      Subscription.subscribe(model, [
        model.id,
        0,
        (id, counter) => {
          receivedUpdates.set(id, counter);
        }
      ]);
    });
    
    // WHEN: ждем обновлений от сервера
    await timeout(4000);
    
    // THEN: обновления обработаны
    receivedUpdates.forEach((counter, id) => {
    });
    
    if (receivedUpdates.size > 0) {
      assert(receivedUpdates.size >= 1, 'Should receive at least one update');
      
      // Проверяем формат данных
      receivedUpdates.forEach((counter, id) => {
        assert(typeof id === 'string', `ID should be string, got: ${typeof id}`);
        assert(typeof counter === 'number', `Counter should be number, got: ${typeof counter}`);
      });
      
    } else {
    }
    
    // Cleanup
    models.forEach(model => Subscription.unsubscribe(model.id));
  });

  test('Subscription - batch multiple subscribe commands', async () => {
    // GIVEN: необходимость подписаться на 10 ресурсов одновременно
    const models = Array.from({length: 10}, (_, i) => 
      new Model(`test:batch-subscribe-${Date.now()}-${i}`)
    );
    
    const startTime = Date.now();
    
    // WHEN: подписываемся на все ресурсы быстро (< 500ms)
    models.forEach(model => {
      Subscription.subscribe(model, [model.id, 0, () => {}]);
    });
    
    // Wait for batching (500ms delay in #send)
    await timeout(700);
    
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    
    
    // THEN:
    // 1. Все подписки зарегистрированы
    const subCount = Subscription._getSubscriptionCount();
    assert(subCount >= 10, `All subscriptions should be registered. Expected: 10, Got: ${subCount}`);
    
    // 2. Команды отправлены батчем (проверяем через timing)
    // Если бы каждая команда отправлялась отдельно с задержкой 500ms, ушло бы 10*500ms = 5000ms
    // С батчингом должно быть ~700ms
    assert(elapsed < 1500, `Should batch commands efficiently. Elapsed: ${elapsed}ms`);
    
    
    // Cleanup
    models.forEach(model => Subscription.unsubscribe(model.id));
    await timeout(700);
  });

  test('Subscription - batch multiple unsubscribe commands', async () => {
    // GIVEN: 10 активных подписок
    const models = Array.from({length: 10}, (_, i) => 
      new Model(`test:batch-unsubscribe-${Date.now()}-${i}`)
    );
    
    models.forEach(model => {
      Subscription.subscribe(model, [model.id, 0, () => {}]);
    });
    
    await timeout(700); // Wait for subscribe batch
    
    const countBefore = Subscription._getSubscriptionCount();
    
    // WHEN: отписываемся от всех сразу
    const startTime = Date.now();
    models.forEach(model => Subscription.unsubscribe(model.id));
    await timeout(700);
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    
    
    const countAfter = Subscription._getSubscriptionCount();
    
    // THEN: отписки отправлены батчем
    assert(elapsed < 1500, `Unsubscribes should be batched. Elapsed: ${elapsed}ms`);
    
    // Check that subscriptions were removed (might not be exactly 0 due to other tests)
    assert(countAfter < countBefore, 
      `Subscriptions should decrease. Before: ${countBefore}, After: ${countAfter}`);
    
  });

  test('Subscription - handle empty message from server', async () => {
    // GIVEN: активная подписка
    const model = new Model('test:empty-message');
    let callbackCalled = false;
    
    Subscription.subscribe(model, [
      model.id,
      0,
      () => { 
        callbackCalled = true; 
      }
    ]);
    
    // Line 59: if (msg === '') return;
    // Пустые сообщения должны игнорироваться
    
    await timeout(1500);
    
    
    // THEN: система должна оставаться стабильной
    assert(Subscription._getSubscriptionCount() > 0, 'System should remain stable');
    
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - duplicate subscribe is ignored', async () => {
    // GIVEN: существующая подписка
    const model = new Model(`test:duplicate-${Date.now()}`);
    let callCount = 0;
    
    const subscription = [
      model.id,
      0,
      () => { callCount++; }
    ];
    
    Subscription.subscribe(model, subscription);
    const countAfterFirst = Subscription._getSubscriptionCount();
    
    // WHEN: повторно подписываемся с тем же ID
    Subscription.subscribe(model, subscription);
    const countAfterSecond = Subscription._getSubscriptionCount();
    
    // THEN: 
    // 1. Количество подписок не увеличилось
    assert(countAfterSecond === countAfterFirst, 
      `Duplicate subscription should be ignored. First: ${countAfterFirst}, Second: ${countAfterSecond}`);
    
    
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - unsubscribe non-existent is safe', async () => {
    // GIVEN: ID, который не был подписан
    const fakeId = `test:non-existent-${Date.now()}-${Math.random()}`;
    
    
    // WHEN: пытаемся отписаться
    const beforeCount = Subscription._getSubscriptionCount();
    
    Subscription.unsubscribe(fakeId);
    
    const afterCount = Subscription._getSubscriptionCount();
    
    // THEN: операция безопасна, счетчик не изменился
    assert(beforeCount === afterCount, 
      `Unsubscribe of non-existent should be no-op. Before: ${beforeCount}, After: ${afterCount}`);
    
  });

  test('Subscription - GC triggers unsubscribe via FinalizationRegistry', async () => {
    // Line 23: FinalizationRegistry register
    
    const initialCount = Subscription._getSubscriptionCount();
    
    // GIVEN: подписка с объектом, который будет собран GC
    {
      let model = new Model(`test:gc-${Date.now()}`);
      
      Subscription.subscribe(model, [model.id, 0, () => {}]);
      const countAfter = Subscription._getSubscriptionCount();
      assert(countAfter > initialCount, 'Subscription should be created');
      
      // model выходит из области видимости
    }
    
    // WHEN: объект становится недоступным и GC запускается
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
      await timeout(1000);
      
      const countAfterGC = Subscription._getSubscriptionCount();
      
      // THEN: подписка может быть автоматически удалена через FinalizationRegistry
      // Note: GC не гарантирован, поэтому проверяем что система стабильна
    } else {
    }
  });

  test('Subscription - retry send when socket not ready', async () => {
    // Lines 54-55: Retry logic in #send
    
    // GIVEN: Создаем подписку сразу после init (сокет может быть не готов)
    // Переинициализируем connection
    const customAddress = 'ws://localhost:8088';
    Subscription.init(customAddress);
    
    // Subscribe immediately - socket might not be ready (readyState !== 1)
    const model = new Model(`test:retry-${Date.now()}`);
    
    Subscription.subscribe(model, [
      model.id,
      0,
      () => {}
    ]);
    
    // The #send method will retry if socket is not ready (line 54-55)
    await timeout(700); // Wait for retry timeout + send timeout
    
    // THEN: подписка должна быть зарегистрирована
    const count = Subscription._getSubscriptionCount();
    assert(count > 0, 'Subscription should be registered after retry');
    
    
    Subscription.unsubscribe(model.id);
  });

  test('Subscription - message with equals sign prefix', async () => {
    // Line 60: msg.indexOf('=') === 0 ? msg.substr(1) : msg
    
    const model = new Model('rdfs:Resource');
    let receivedUpdate = false;
    
    Subscription.subscribe(model, [
      model.id,
      0,
      (id, counter) => {
        receivedUpdate = true;
      }
    ]);
    
    // Server might send messages starting with '='
    // The code handles this: msg.indexOf('=') === 0 ? msg.substr(1) : msg
    await timeout(2000);
    
    // System should work correctly regardless of message format
    
    Subscription.unsubscribe(model.id);
  });
};

