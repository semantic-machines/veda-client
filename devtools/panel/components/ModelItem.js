/**
 * Model Item - Shows model in list with selection support
 */

import { Component, html, If } from '../../../src/index.js';

export default class ModelItem extends Component(HTMLElement) {
  static tag = 'model-item';

  constructor() {
    super();
    this.state.data = null;
    this.state.selectedId = null;
    this.state.onSelect = null;
  }

  handleSelect() {
    if (this.state.onSelect && this.state.data) {
      this.state.onSelect(this.state.data.id);
    }
  }

  get isSelected() {
    return this.state.data && this.state.data.id === this.state.selectedId;
  }

  get itemClass() {
    let cls = 'list-item';
    if (this.isSelected) cls += ' selected';
    return cls;
  }

  get isLoaded() {
    return this.state.data?.isLoaded === true;
  }

  get statusClass() {
    return this.isLoaded ? 'status-dot loaded' : 'status-dot not-loaded';
  }

  get typeLabel() {
    if (this.isLoaded && this.state.data?.type && this.state.data.type !== 'No type') {
      return this.state.data.type;
    }
    return '';
  }

  get modelId() {
    return this.state.data?.modelId || '';
  }

  render() {
    if (!this.state.data) return '';

    return html`
      <div class="{this.itemClass}" onclick="{handleSelect}">
        <span class="{this.statusClass}"></span>
        <span class="list-item-title">{this.modelId}</span>
        <${If} condition="{this.typeLabel}">
          <span class="list-item-type">{this.typeLabel}</span>
        </${If}>
      </div>
    `;
  }
}
