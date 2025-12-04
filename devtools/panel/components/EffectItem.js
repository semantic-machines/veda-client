/**
 * Effect Item - Shows effect in list with selection support
 */

import { Component, html, If } from '../../../src/index.js';

export default class EffectItem extends Component(HTMLElement) {
  static tag = 'effect-item';

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

  get isHot() {
    return (this.state.data?.triggerCount || 0) > 10;
  }

  get isWarm() {
    const count = this.state.data?.triggerCount || 0;
    return count > 5 && count <= 10;
  }

  get itemClass() {
    let cls = 'list-item';
    if (this.isSelected) cls += ' selected';
    if (this.isHot) cls += ' hot';
    else if (this.isWarm) cls += ' warm';
    return cls;
  }

  get triggerBadgeClass() {
    if (this.isHot) return 'badge badge-danger';
    if (this.isWarm) return 'badge badge-warning';
    return 'badge badge-info';
  }

  render() {
    if (!this.state.data) return '';

    return html`
      <div class="{this.itemClass}" onclick="{handleSelect}">
        <span class="list-item-title">Effect #{this.state.data.id}</span>
        <span class="{this.triggerBadgeClass}">{this.state.data.triggerCount}x</span>
        <${If} condition="{this.isHot}">
          <span class="hot-indicator">🔥</span>
        </${If}>
      </div>
    `;
  }
}
