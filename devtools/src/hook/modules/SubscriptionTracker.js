/**
 * Subscription Tracker
 * Tracks WebSocket subscriptions for models
 */

export class SubscriptionTracker {
  constructor(emit) {
    this.emit = emit;
    this.subscriptions = new Map();
    this.subscriptionHistory = [];
    this.maxSubscriptionHistory = 200;
  }

  track(id, updateCounter) {
    const now = Date.now();
    if (!this.subscriptions.has(id)) {
      this.subscriptions.set(id, {
        id,
        subscribedAt: now,
        updateCounter,
        updateCount: 0,
        lastUpdate: null
      });

      this.subscriptionHistory.push({
        type: 'subscribe',
        id,
        timestamp: now,
        updateCounter
      });

      if (this.subscriptionHistory.length > this.maxSubscriptionHistory) {
        this.subscriptionHistory.shift();
      }

      this.emit('subscription:added', { id, updateCounter, timestamp: now });
    }
  }

  trackUnsubscription(id) {
    const now = Date.now();
    if (this.subscriptions.has(id)) {
      const data = this.subscriptions.get(id);
      this.subscriptions.delete(id);

      this.subscriptionHistory.push({
        type: 'unsubscribe',
        id,
        timestamp: now,
        duration: now - data.subscribedAt
      });

      if (this.subscriptionHistory.length > this.maxSubscriptionHistory) {
        this.subscriptionHistory.shift();
      }

      this.emit('subscription:removed', { id, timestamp: now });
    }
  }

  trackUpdate(id, updateCounter) {
    const data = this.subscriptions.get(id);
    if (data) {
      data.updateCount++;
      data.lastUpdate = Date.now();
      data.updateCounter = updateCounter;
    }
  }

  getStats(wsConnected) {
    return {
      active: Array.from(this.subscriptions.values()),
      history: this.subscriptionHistory.slice(-100),
      totalSubscriptions: this.subscriptions.size,
      wsConnected: wsConnected || false
    };
  }
}
