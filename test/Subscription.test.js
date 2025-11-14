/**
 * Improved Subscription tests with mocks
 * Now uses injectable WebSocket for full isolation
 */

import Subscription from '../src/Subscription.js';
import Model from '../src/Model.js';
import { MockWebSocket } from './mocks/WebSocket.mock.js';
import { waitForCondition, clearModelCache, generateTestId } from './helpers.js';

export default ({ test, assert }) => {

  test('Subscription (mock) - subscribe and receive update', async () => {
    clearModelCache();

    // Initialize with mock WebSocket
    Subscription.init('ws://mock-server:8088', MockWebSocket);

    const model = new Model(generateTestId('test:mock-update'));
    let receivedUpdate = false;
    let receivedId = null;
    let receivedCounter = null;

    Subscription.subscribe(model, [
      model.id,
      0,
      (id, counter) => {
        receivedUpdate = true;
        receivedId = id;
        receivedCounter = counter;
      }
    ]);

    // Wait for socket to open
    await waitForCondition(
      () => Subscription._socket && Subscription._socket.readyState === MockWebSocket.OPEN,
      { timeout: 1000, message: 'Socket should be open' }
    );

    // Wait for subscription to be sent (batching delay is 500ms)
    await new Promise(resolve => setTimeout(resolve, 600));

    // Verify subscription was registered
    await waitForCondition(
      () => Subscription._getSubscriptionCount() > 0,
      { timeout: 1000, message: 'Subscription should be registered' }
    );

    // Verify subscription was sent to mock
    const socket = Subscription._socket;
    const subs = socket.getSubscriptions();
    assert(subs.has(model.id), `Mock should have subscription for ${model.id}, has: ${Array.from(subs.keys()).join(', ')}`);

    // Simulate server update
    socket.simulateUpdate(model.id, 1);

    // Wait for update to be processed
    await waitForCondition(
      () => receivedUpdate === true,
      { timeout: 1000, message: 'Should receive update' }
    );

    assert(receivedId === model.id, 'Should receive correct ID');
    assert(receivedCounter === 1, 'Should receive correct counter');

    // Cleanup
    Subscription.unsubscribe(model.id);
    clearModelCache();
  });

  test('Subscription (mock) - handles empty message', async () => {
    clearModelCache();

    Subscription.init('ws://mock-server:8088', MockWebSocket);

    const model = new Model(generateTestId('test:empty'));
    let callbackCalled = false;

    Subscription.subscribe(model, [
      model.id,
      0,
      () => { callbackCalled = true; }
    ]);

    await waitForCondition(
      () => Subscription._socket && Subscription._socket.readyState === MockWebSocket.OPEN,
      { timeout: 1000 }
    );

    // Simulate empty message (should be ignored)
    const socket = Subscription._socket;
    socket.simulateMessage('');

    await new Promise(resolve => setTimeout(resolve, 100));

    assert(!callbackCalled, 'Empty message should not trigger callback');

    Subscription.unsubscribe(model.id);
    clearModelCache();
  });

  test('Subscription (mock) - handles message with equals prefix', async () => {
    clearModelCache();

    Subscription.init('ws://mock-server:8088', MockWebSocket);

    const id = generateTestId('test:equals');
    const model = new Model(id);
    let receivedId = null;

    Subscription.subscribe(model, [
      model.id,
      0,
      (id) => { receivedId = id; }
    ]);

    await waitForCondition(
      () => Subscription._socket && Subscription._socket.readyState === MockWebSocket.OPEN,
      { timeout: 1000 }
    );

    // Simulate message with '=' prefix
    const socket = Subscription._socket;
    socket.simulateMessage(`=${id}=1`);

    await waitForCondition(
      () => receivedId !== null,
      { timeout: 1000, message: 'Should process message with = prefix' }
    );

    assert(receivedId === id, 'Should handle = prefix correctly');

    Subscription.unsubscribe(model.id);
    clearModelCache();
  });

  test('Subscription (improved) - basic subscribe/unsubscribe lifecycle', async () => {
    clearModelCache();

    const model = new Model(generateTestId('test:lifecycle'));

    // Subscribe
    Subscription.subscribe(model, [model.id, 0, () => {}]);

    // Wait for subscription to be registered
    await waitForCondition(
      () => Subscription._getSubscriptionCount() > 0,
      { timeout: 1000, message: 'Subscription should be registered' }
    );

    const countAfterSubscribe = Subscription._getSubscriptionCount();
    assert(countAfterSubscribe > 0, 'Should have active subscription');

    // Unsubscribe
    Subscription.unsubscribe(model.id);

    const countAfterUnsubscribe = Subscription._getSubscriptionCount();
    assert(countAfterUnsubscribe < countAfterSubscribe, 'Should remove subscription');

    clearModelCache();
  });

  test('Subscription (improved) - duplicate subscribe is idempotent', async () => {
    clearModelCache();

    const id = generateTestId('test:duplicate');
    const model = new Model(id);
    const subscription = [model.id, 0, () => {}];

    Subscription.subscribe(model, subscription);

    await waitForCondition(
      () => Subscription._getSubscriptionCount() > 0,
      { timeout: 1000 }
    );

    const countAfterFirst = Subscription._getSubscriptionCount();

    // Subscribe again with same ID
    Subscription.subscribe(model, subscription);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    const countAfterSecond = Subscription._getSubscriptionCount();

    assert(countAfterSecond === countAfterFirst, 'Duplicate subscription should be ignored or reuse same slot');

    Subscription.unsubscribe(model.id);
    clearModelCache();
  });

  test('Subscription (improved) - unsubscribe non-existent is safe', () => {
    clearModelCache();

    const fakeId = generateTestId('test:nonexistent');
    const beforeCount = Subscription._getSubscriptionCount();

    // Should not throw
    Subscription.unsubscribe(fakeId);

    const afterCount = Subscription._getSubscriptionCount();

    assert(beforeCount === afterCount, 'Unsubscribe of non-existent should be no-op');

    clearModelCache();
  });

  test('Subscription (improved) - batches multiple subscribe commands', async () => {
    clearModelCache();

    // Create multiple subscriptions quickly
    const models = Array.from({ length: 5 }, (_, i) =>
      new Model(generateTestId(`test:batch-${i}`))
    );

    const initialCount = Subscription._getSubscriptionCount();

    models.forEach(model => {
      Subscription.subscribe(model, [model.id, 0, () => {}]);
    });

    // Wait for subscriptions to be registered
    await waitForCondition(
      () => Subscription._getSubscriptionCount() >= initialCount + 5,
      { timeout: 2000, message: 'All subscriptions should be registered' }
    );

    const finalCount = Subscription._getSubscriptionCount();
    assert(finalCount >= initialCount + 5, `Should register all subscriptions (${finalCount} >= ${initialCount + 5})`);

    // Cleanup
    models.forEach(model => Subscription.unsubscribe(model.id));

    clearModelCache();
  });

  test('Subscription (improved) - Model.subscribe() integration', async () => {
    clearModelCache();

    const model = new Model(generateTestId('test:model-integration'));
    model['rdfs:label'] = ['Test'];

    const initialCount = Subscription._getSubscriptionCount();

    // Use Model's subscribe method
    model.subscribe();

    await waitForCondition(
      () => Subscription._getSubscriptionCount() > initialCount,
      { timeout: 1000, message: 'Model.subscribe() should register subscription' }
    );

    assert(Subscription._getSubscriptionCount() > initialCount, 'Model.subscribe() should work');

    // Cleanup
    model.unsubscribe();

    clearModelCache();
  });

  test('Subscription (improved) - Model.unsubscribe() integration', async () => {
    clearModelCache();

    const model = new Model(generateTestId('test:model-unsub'));

    model.subscribe();

    await waitForCondition(
      () => Subscription._getSubscriptionCount() > 0,
      { timeout: 1000 }
    );

    const countBefore = Subscription._getSubscriptionCount();

    // Use Model's unsubscribe method
    model.unsubscribe();

    await new Promise(resolve => setTimeout(resolve, 100));

    const countAfter = Subscription._getSubscriptionCount();
    assert(countAfter < countBefore || countAfter === 0, 'Model.unsubscribe() should remove subscription');

    clearModelCache();
  });

  test('Subscription (improved) - rapid subscribe/unsubscribe cycles', async () => {
    clearModelCache();

    const model = new Model(generateTestId('test:rapid'));

    // Rapidly subscribe and unsubscribe
    for (let i = 0; i < 5; i++) {
      model.subscribe();
      model.unsubscribe();
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    // System should remain stable
    const finalCount = Subscription._getSubscriptionCount();
    assert(finalCount >= 0, 'System should remain stable after rapid cycles');

    clearModelCache();
  });

  test('Subscription (improved) - handles empty subscription list gracefully', () => {
    clearModelCache();

    const count = Subscription._getSubscriptionCount();

    // Should be 0 or some number, but should not throw
    assert(typeof count === 'number', 'Should return subscription count');
    assert(count >= 0, 'Count should be non-negative');

    clearModelCache();
  });
};

