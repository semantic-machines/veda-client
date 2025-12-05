/**
 * Subscription Tracker Module
 * Tracks WebSocket subscriptions for models
 */

export function createSubscriptionTracker(emit) {
  const subscriptions = new Map();
  const subscriptionHistory = [];
  const maxSubscriptionHistory = 200;

  return {
    subscriptions,
    subscriptionHistory,

    track(id, updateCounter) {
      const now = Date.now();
      if (!subscriptions.has(id)) {
        subscriptions.set(id, {
          id,
          subscribedAt: now,
          updateCounter,
          updateCount: 0,
          lastUpdate: null
        });

        subscriptionHistory.push({
          type: 'subscribe',
          id,
          timestamp: now,
          updateCounter
        });

        if (subscriptionHistory.length > maxSubscriptionHistory) {
          subscriptionHistory.shift();
        }

        emit('subscription:added', { id, updateCounter, timestamp: now });
      }
    },

    trackUnsubscription(id) {
      const now = Date.now();
      if (subscriptions.has(id)) {
        const data = subscriptions.get(id);
        subscriptions.delete(id);

        subscriptionHistory.push({
          type: 'unsubscribe',
          id,
          timestamp: now,
          duration: now - data.subscribedAt
        });

        if (subscriptionHistory.length > maxSubscriptionHistory) {
          subscriptionHistory.shift();
        }

        emit('subscription:removed', { id, timestamp: now });
      }
    },

    trackUpdate(id, updateCounter) {
      const data = subscriptions.get(id);
      if (data) {
        data.updateCount++;
        data.lastUpdate = Date.now();
        data.updateCounter = updateCounter;
      }
    },

    getStats(wsConnected) {
      return {
        active: Array.from(subscriptions.values()),
        history: subscriptionHistory.slice(-100),
        totalSubscriptions: subscriptions.size,
        wsConnected: wsConnected || false
      };
    }
  };
}

