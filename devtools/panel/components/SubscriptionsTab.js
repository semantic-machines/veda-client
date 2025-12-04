/**
 * Subscriptions Tab - WebSocket subscription monitoring
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatRelativeTime } from '../utils/formatters.js';

export default class SubscriptionsTab extends Component(HTMLElement) {
  static tag = 'subscriptions-tab';

  constructor() {
    super();
    this.state.activeSubscriptions = [];
    this.state.history = [];
    this.state.wsConnected = false;
  }

  get hasActive() {
    return this.state.activeSubscriptions.length > 0;
  }

  get hasHistory() {
    return this.state.history.length > 0;
  }

  get reversedHistory() {
    return [...this.state.history].reverse().slice(0, 50);
  }

  get wsStatusClass() {
    return this.state.wsConnected ? 'ws-status connected' : 'ws-status disconnected';
  }

  get wsStatusText() {
    return this.state.wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected';
  }

  formatTime(timestamp) {
    return formatRelativeTime(timestamp);
  }

  render() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Subscriptions</h2>
        <span class="panel-count">{this.state.activeSubscriptions.length} active</span>
        <div class="{this.wsStatusClass}">
          <span class="ws-dot"></span>
          {this.wsStatusText}
        </div>
      </div>

      <div class="subscriptions-content">
        <div class="sub-section">
          <h3 class="sub-section-title">Active Subscriptions</h3>
          <${If} condition="{this.hasActive}">
            <div class="sub-list">
              <${Loop} items="{this.state.activeSubscriptions}" key="id" as="sub">
                <div class="sub-item">
                  <span class="sub-id">{sub.id}</span>
                  <span class="sub-info">
                    <span class="sub-updates">{sub.updateCount} updates</span>
                  </span>
                </div>
              </${Loop}>
            </div>
          </${If}>
          <${If} condition="{!this.hasActive}">
            <div class="sub-empty">No active subscriptions</div>
          </${If}>
        </div>

        <div class="sub-section">
          <h3 class="sub-section-title">History</h3>
          <${If} condition="{this.hasHistory}">
            <div class="sub-history">
              <${Loop} items="{this.reversedHistory}" key="timestamp" as="event">
                <div class="history-item {event.type}">
                  <span class="history-type">{event.type}</span>
                  <span class="history-id">{event.id}</span>
                  <span class="history-time">{this.formatTime(event.timestamp)}</span>
                </div>
              </${Loop}>
            </div>
          </${If}>
          <${If} condition="{!this.hasHistory}">
            <div class="sub-empty">No subscription history</div>
          </${If}>
        </div>
      </div>
    `;
  }
}

