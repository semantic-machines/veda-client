/**
 * Component Item - Shows component in tree with expandable children
 */

import { Component, html, Loop, If } from '../../../src/index.js';
import { formatRenderTime } from '../utils/formatters.js';

export default class ComponentItem extends Component(HTMLElement) {
  static tag = 'component-item';

  constructor() {
    super();
    this.state.childrenExpanded = true;
    this.state.data = null;
    this.state.allComponents = [];
    this.state.depth = 0;
    this.state.selectedId = null;
    this.state.onSelect = null;
    this.state.onHover = null;
    this.state.onLeave = null;
  }

  toggleChildren(e) {
    e.stopPropagation();
    this.state.childrenExpanded = !this.state.childrenExpanded;
  }

  handleSelect() {
    if (this.state.onSelect && this.state.data) {
      this.state.onSelect(this.state.data.id);
    }
  }

  handleMouseEnter = () => {
    if (this.state.onHover && this.state.data) {
      this.state.onHover(this.state.data.id);
    }
  }

  handleMouseLeave = () => {
    if (this.state.onLeave) {
      this.state.onLeave();
    }
  }

  get children() {
    if (!this.state.data || !this.state.allComponents) return [];
    const childIds = this.state.data.childIds || [];
    return this.state.allComponents.filter(c => childIds.includes(c.id));
  }

  get hasChildren() {
    return this.children.length > 0;
  }

  get toggleIcon() {
    if (!this.hasChildren) return '·';
    return this.state.childrenExpanded ? '▼' : '▶';
  }

  get isSelected() {
    return this.state.data && this.state.data.id === this.state.selectedId;
  }

  get nodeClass() {
    let cls = 'tree-node';
    if (this.isSelected) cls += ' selected';
    return cls;
  }

  get headerClass() {
    let cls = 'tree-node-header';
    if (this.isSelected) cls += ' selected';
    return cls;
  }

  get indentStyle() {
    const indent = (this.state.depth || 0) * 16;
    return `padding-left: ${indent}px`;
  }

  get childDepth() {
    return (this.state.depth || 0) + 1;
  }

  get renderCount() {
    return this.state.data?.renderCount || 0;
  }

  get hasRenders() {
    return this.renderCount > 0;
  }

  get avgTime() {
    return formatRenderTime(this.state.data?.avgRenderTime || 0);
  }

  render() {
    if (!this.state.data) return '';

    return html`
      <div class="{this.nodeClass}">
        <div class="{this.headerClass}"
             style="{this.indentStyle}"
             onclick="{handleSelect}"
             onmouseenter="{handleMouseEnter}"
             onmouseleave="{handleMouseLeave}">
          <span class="tree-toggle" onclick="{toggleChildren}">{this.toggleIcon}</span>
          <span class="tree-content">
            <span class="tree-tag">&lt;{this.state.data.tagName}&gt;</span>
            <${If} condition="{this.state.data.modelId}">
              <span class="tree-model-id">{this.state.data.modelId}</span>
            </${If}>
          </span>
          <${If} condition="{this.hasRenders}">
            <span class="tree-stats">
              <span class="tree-renders">{this.renderCount}x</span>
              <span class="tree-time">{this.avgTime}</span>
            </span>
          </${If}>
        </div>

        <${If} condition="{this.hasChildren}">
          <${If} condition="{this.state.childrenExpanded}">
            <div class="tree-children">
              <${Loop} items="{this.children}" key="id" as="child">
                <component-item
                  :data="{child}"
                  :all-components="{this.state.allComponents}"
                  :depth="{this.childDepth}"
                  :selected-id="{this.state.selectedId}"
                  :on-select="{this.state.onSelect}"
                  :on-hover="{this.state.onHover}"
                  :on-leave="{this.state.onLeave}">
                </component-item>
              </${Loop}>
            </div>
          </${If}>
        </${If}>
      </div>
    `;
  }
}
