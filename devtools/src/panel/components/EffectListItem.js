/**
 * Effect List Item - Renders either component group header or effect item
 */

import { Component, html, If } from '../../../../src/index.js';

export default class EffectListItem extends Component(HTMLElement) {
  static tag = 'effect-list-item';

  constructor() {
    super();
    this.state.data = null;
    this.state.selectedId = null;
    this.state.selectedComponentId = null;
    this.state.onSelect = null;
    this.state.onSelectComponent = null;
    this.state.onHover = null;
    this.state.onLeave = null;
  }

  // Is this a header or effect?
  get isHeader() {
    return this.state.data?._isHeader || false;
  }

  get isEffect() {
    return !this.isHeader;
  }

  // ========== Header (Component) properties ==========
  get headerTag() {
    return this.state.data?.componentTag || 'standalone';
  }

  get headerId() {
    return this.state.data?.componentId || null;
  }

  get isStandalone() {
    return !this.headerId;
  }

  get headerCount() {
    return this.state.data?.count || 0;
  }

  get headerModelId() {
    return this.state.data?.modelId || '';
  }

  get hasHeaderModelId() {
    return Boolean(this.headerModelId);
  }

  get isComponentSelected() {
    return this.headerId && this.headerId === this.state.selectedComponentId;
  }

  get headerClass() {
    let cls = 'tree-node-header';
    if (this.isComponentSelected) cls += ' selected';
    return cls;
  }

  handleSelectComponent() {
    if (this.state.onSelectComponent && this.headerId) {
      this.state.onSelectComponent(this.headerId);
    }
  }

  handleMouseEnter = () => {
    if (this.state.onHover && this.headerId) {
      this.state.onHover(this.headerId);
    }
  }

  handleMouseLeave = () => {
    if (this.state.onLeave) {
      this.state.onLeave();
    }
  }

  // ========== Effect properties ==========
  handleSelect() {
    if (this.state.onSelect && this.state.data && !this.isHeader) {
      this.state.onSelect(this.state.data.id);
    }
  }

  get isSelected() {
    return this.isEffect && this.state.data?.id === this.state.selectedId;
  }

  get isHot() {
    return (this.state.data?.triggerCount || 0) > 10;
  }

  get isWarm() {
    const count = this.state.data?.triggerCount || 0;
    return count > 5 && count <= 10;
  }

  get itemClass() {
    let cls = 'list-item effect-list-effect';
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

  get depsCount() {
    return this.state.data?.depsCount || 0;
  }

  get isComputed() {
    return this.state.data?.isComputed || false;
  }

  get typeLabel() {
    return this.isComputed ? 'computed' : '';
  }

  get hasTypeLabel() {
    return this.typeLabel !== '';
  }

  get effectName() {
    return this.state.data?.name || '';
  }

  get displayName() {
    if (this.effectName) return this.effectName;
    return `Effect #${this.effectId}`;
  }

  get effectId() {
    return this.state.data?.id || 0;
  }

  get triggerCount() {
    return this.state.data?.triggerCount || 0;
  }

  render() {
    if (!this.state.data) return '';

    // Render component header (same style as ComponentItem)
    if (this.isHeader) {
      if (this.isStandalone) {
        // Standalone effects - simple header
        return html`
          <div class="tree-node-header standalone-header">
            <span class="tree-tag">standalone</span>
            <span class="effect-group-count">{this.headerCount} effects</span>
          </div>
        `;
      }

      // Component header (same as ComponentItem)
      return html`
        <div class="{this.headerClass}"
             onclick="{handleSelectComponent}"
             onmouseenter="{handleMouseEnter}"
             onmouseleave="{handleMouseLeave}">
          <span class="tree-tag">&lt;{this.headerTag}&gt;</span>
          <${If} condition="{this.hasHeaderModelId}">
            <span class="tree-model-id">{this.headerModelId}</span>
          </${If}>
          <span class="effect-group-count">{this.headerCount} effects</span>
        </div>
      `;
    }

    // Render effect item
    return html`
      <div class="{this.itemClass}" onclick="{handleSelect}">
        <span class="list-item-title">{this.displayName}</span>
        <${If} condition="{this.hasTypeLabel}">
          <span class="effect-type">{this.typeLabel}</span>
        </${If}>
        <span class="effect-deps">{this.depsCount} deps</span>
        <span class="{this.triggerBadgeClass}">{this.triggerCount}x</span>
        <${If} condition="{this.isHot}">
          <span class="hot-indicator">🔥</span>
        </${If}>
      </div>
    `;
  }
}
