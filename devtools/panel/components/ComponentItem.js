/**
 * Component Item - Shows component with expandable state
 */

import { Component, html, Loop, If } from '../../../src/index.js';

export default class ComponentItem extends Component(HTMLElement) {
  static tag = 'component-item';

  constructor() {
    super();
    this.state.expanded = false;
  }

  toggleExpand() {
    this.state.expanded = !this.state.expanded;
  }

  get hasState() {
    return this.state.data?.state && Object.keys(this.state.data.state).length > 0;
  }

  get stateEntries() {
    if (!this.state.data?.state) return [];
    return Object.entries(this.state.data.state).map(([key, value]) => ({
      id: key,
      key,
      formattedValue: this.formatValueAsString(value)
    }));
  }

  formatValueAsString(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return `"${value.length > 50 ? value.slice(0, 50) + '...' : value}"`;
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (typeof value === 'object') {
      if (value._type === 'Model') return value.id;
      return `{${Object.keys(value).length} props}`;
    }
    return String(value);
  }

  get expandIcon() {
    return this.state.expanded ? '▼' : '▶';
  }

  get itemClass() {
    return this.state.expanded ? 'item expanded' : 'item';
  }

  formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  render() {
    if (!this.state.data) return '';

    return html`
      <div class="{this.itemClass}">
        <div class="item-header" onclick="{toggleExpand}">
          <span class="expand-icon">{this.expandIcon}</span>
          <span class="item-tag">&lt;{this.state.data.tagName}&gt;</span>
          <${If} condition="{this.state.data.modelId}">
            <span class="item-model-id" title="Bound model">{this.state.data.modelId}</span>
          </${If}>
          <span class="item-id">#{this.state.data.id}</span>
        </div>

        <${If} condition="{this.state.expanded}">
          <div class="item-details">
            <${If} condition="{this.hasState}">
              <div class="detail-section">
                <div class="detail-title">State</div>
                <div class="properties-list">
                  <${Loop} items="{this.stateEntries}" key="id" as="entry">
                    <div class="property-row">
                      <span class="property-key">{entry.key}:</span>
                      <span class="property-value">{entry.formattedValue}</span>
                    </div>
                  </${Loop}>
                </div>
              </div>
            </${If}>

            <div class="detail-section">
              <div class="detail-title">Info</div>
              <div class="properties-list">
                <div class="property-row">
                  <span class="property-key">created:</span>
                  <span class="property-value value-number">${this.formatTime(this.state.data?.createdAt)}</span>
                </div>
                <div class="property-row">
                  <span class="property-key">renders:</span>
                  <span class="property-value value-number">{this.state.data.renderCount}</span>
                </div>
              </div>
            </div>
          </div>
        </${If}>
      </div>
    `;
  }
}

