/**
 * Model Item - Shows model with all RDF properties
 */

import { Component, html, Loop, If } from '../../../src/index.js';

export default class ModelItem extends Component(HTMLElement) {
  static tag = 'model-item';

  constructor() {
    super();
    this.state.expanded = false;
  }

  toggleExpand() {
    this.state.expanded = !this.state.expanded;
  }

  get hasProperties() {
    return this.state.data?.properties && Object.keys(this.state.data.properties).length > 0;
  }

  get propertyEntries() {
    if (!this.state.data?.properties) return [];
    return Object.entries(this.state.data.properties)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => {
        const links = this.extractLinks(value);
        const showText = links.length === 0 || this.hasNonLinkValues(value, links);
        return {
          id: key,
          key,
          formattedValue: showText ? this.formatValueAsString(value) : '',
          links
        };
      });
  }

  hasNonLinkValues(value, links) {
    if (!Array.isArray(value)) {
      return links.length === 0;
    }
    return value.some(v => {
      if (typeof v === 'object' && v._type === 'Model') return false;
      if (this.isUri(v)) return false;
      return true;
    });
  }

  isUri(value) {
    if (typeof value !== 'string') return false;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
    if (value.startsWith('http://') || value.startsWith('https://')) return false;
    return /^[a-z][a-z0-9-]*:[a-zA-Z0-9_-]+$/i.test(value);
  }

  extractLinks(value) {
    const links = [];
    if (Array.isArray(value)) {
      value.forEach(v => {
        if (typeof v === 'object' && v._type === 'Model' && v.id) {
          links.push(v.id);
        } else if (this.isUri(v)) {
          links.push(v);
        }
      });
    } else if (typeof value === 'object' && value._type === 'Model' && value.id) {
      links.push(value.id);
    } else if (this.isUri(value)) {
      links.push(value);
    }
    return links;
  }

  handleLinkClick(e, node) {
    e.stopPropagation();
    const modelId = node.dataset.modelId;
    if (modelId) {
      let parent = this.parentElement;
      while (parent && parent.tagName !== 'DEVTOOLS-PANEL') {
        parent = parent.parentElement;
      }
      if (parent && parent.navigateToModel) {
        parent.navigateToModel(modelId);
      }
    }
  }

  formatValueAsString(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      if (value.includes(':') && !value.includes(' ')) {
        return value;
      }
      const str = value.length > 60 ? value.slice(0, 60) + '...' : value;
      return `"${str}"`;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const items = value.slice(0, 5).map(v => this.formatSingleValue(v));
      if (value.length > 5) {
        items.push(`... +${value.length - 5} more`);
      }
      return items.join(', ');
    }
    if (typeof value === 'object') {
      if (value._type === 'Model') return value.id;
      return JSON.stringify(value).slice(0, 50);
    }
    return String(value);
  }

  formatSingleValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      if (value.includes(':') && !value.includes(' ')) {
        return value;
      }
      const str = value.length > 30 ? value.slice(0, 30) + '...' : value;
      return `"${str}"`;
    }
    if (typeof value === 'object') {
      if (value._type === 'Model') return value.id;
      return '{...}';
    }
    return String(value);
  }

  get expandIcon() {
    return this.state.expanded ? '▼' : '▶';
  }

  get itemClass() {
    return this.state.expanded ? 'item expanded' : 'item';
  }

  get isLoaded() {
    return this.state.data?.isLoaded === true;
  }

  get loadedStatusClass() {
    return this.isLoaded ? 'status-dot loaded' : 'status-dot not-loaded';
  }

  get typeOrStatus() {
    if (this.isLoaded && this.state.data?.type) {
      return this.state.data.type;
    }
    return 'Not loaded';
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
          <span class="item-model-id">{this.state.data.modelId}</span>
          <span class="item-type"><span class="{this.loadedStatusClass}"></span>{this.typeOrStatus}</span>
        </div>

        <${If} condition="{this.state.expanded}">
          <div class="item-details">
            <${If} condition="{this.hasProperties}">
              <div class="detail-section">
                <div class="detail-title">Properties</div>
                <div class="properties-list">
                  <${Loop} items="{this.propertyEntries}" key="id" as="entry">
                    <div class="property-row">
                      <span class="property-key">{entry.key}:</span>
                      <property-value :text="{entry.formattedValue}" :links="{entry.links}"></property-value>
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
                  <span class="property-key">updates:</span>
                  <span class="property-value value-number">{this.state.data.updateCount}</span>
                </div>
              </div>
            </div>
          </div>
        </${If}>
      </div>
    `;
  }
}

