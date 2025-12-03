/**
 * Effect Item - Shows effect with trigger count and warnings
 */

import { Component, html, If } from '../../../src/index.js';

export default class EffectItem extends Component(HTMLElement) {
  static tag = 'effect-item';

  constructor() {
    super();
    this.state.expanded = false;
  }

  toggleExpand() {
    this.state.expanded = !this.state.expanded;
  }

  get isHot() {
    return (this.state.data?.triggerCount || 0) > 10;
  }

  get isWarm() {
    const count = this.state.data?.triggerCount || 0;
    return count > 5 && count <= 10;
  }

  get expandIcon() {
    return this.state.expanded ? '▼' : '▶';
  }

  get itemClass() {
    let cls = this.state.expanded ? 'item expanded' : 'item';
    if (this.isHot) cls += ' item-hot';
    else if (this.isWarm) cls += ' item-warm';
    return cls;
  }

  get triggerBadgeClass() {
    if (this.isHot) return 'badge badge-danger';
    if (this.isWarm) return 'badge badge-warning';
    return 'badge badge-info';
  }

  formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return 'never';
    const diff = Date.now() - timestamp;
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return this.formatTime(timestamp);
  }

  render() {
    if (!this.state.data) return '';

    return html`
      <div class="{this.itemClass}">
        <div class="item-header" onclick="{toggleExpand}">
          <span class="expand-icon">{this.expandIcon}</span>
          <span class="effect-icon">⚡</span>
          <span class="item-id">Effect #{this.state.data.id}</span>
          <span class="{this.triggerBadgeClass}">{this.state.data.triggerCount}x</span>
          <${If} condition="{this.isHot}">
            <span class="hot-indicator" title="This effect triggers frequently">🔥</span>
          </${If}>
        </div>

        <${If} condition="{this.state.expanded}">
          <div class="item-details">
            <div class="detail-section">
              <div class="detail-title">Stats</div>
              <div class="properties-list">
                <div class="property-row">
                  <span class="property-key">triggers:</span>
                  <span class="property-value value-number">{this.state.data.triggerCount}</span>
                </div>
                <div class="property-row">
                  <span class="property-key">last triggered:</span>
                  <span class="property-value value-string">${this.formatRelativeTime(this.state.data?.lastTriggered)}</span>
                </div>
                <div class="property-row">
                  <span class="property-key">created:</span>
                  <span class="property-value value-number">${this.formatTime(this.state.data?.createdAt)}</span>
                </div>
              </div>
            </div>

            <${If} condition="{this.isHot}">
              <div class="warning-box">
                <span class="warning-icon">⚠️</span>
                <span class="warning-text">This effect has triggered {this.state.data.triggerCount} times. Consider optimizing or using debounce.</span>
              </div>
            </${If}>
          </div>
        </${If}>
      </div>
    `;
  }
}

