/**
 * Components Tab - tree view of all components
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatTime, formatValue, formatRenderTime } from '../utils/formatters.js';

export default class ComponentsTab extends Component(HTMLElement) {
  static tag = 'components-tab';

  constructor() {
    super();
    this.state.components = [];
    this.state.effects = [];  // For counting effects per component
    this.state.selectedId = null;
    this.state.filter = '';
    this.state.onNavigateToModel = null;
    this.state.onInspect = null;
    this.state.onHover = null;
    this.state.onLeave = null;
  }

  // Filtering
  get filteredComponents() {
    const filter = this.state.filter.toLowerCase();
    if (!filter) return this.state.components;
    return this.state.components.filter(c =>
      c.tagName.toLowerCase().includes(filter) ||
      (c.modelId && c.modelId.toLowerCase().includes(filter))
    );
  }

  get rootComponents() {
    const filter = this.state.filter.toLowerCase();
    if (filter) {
      return this.filteredComponents;
    }
    return this.state.components.filter(c => c.parentId === null);
  }

  get hasComponents() {
    return this.filteredComponents.length > 0;
  }

  get hasFilter() {
    return this.state.filter.length > 0;
  }

  get noComponents() {
    return !this.hasComponents;
  }

  // Performance stats
  get totalRenders() {
    return this.state.components.reduce((sum, c) => sum + (c.renderCount || 0), 0);
  }

  get totalRenderTime() {
    return this.state.components.reduce((sum, c) => sum + (c.totalRenderTime || 0), 0);
  }

  get formattedTotalTime() {
    return formatRenderTime(this.totalRenderTime);
  }

  // Selected component
  get selectedComponent() {
    if (!this.state.selectedId) return null;
    return this.state.components.find(c => c.id === this.state.selectedId) || null;
  }

  get hasSelected() {
    return this.selectedComponent !== null;
  }

  get noSelected() {
    return !this.hasSelected;
  }

  // Event handlers
  handleFilterInput = (e) => {
    this.state.filter = e.target.value;
  }

  clearFilter = () => {
    this.state.filter = '';
  }

  selectComponent = (id) => {
    this.state.selectedId = id;
    // Highlight and set $v on selection
    if (this.state.onInspect) {
      this.state.onInspect(id);
    }
  }

  handleNavigateToModel = () => {
    if (this.state.onNavigateToModel && this.selectedModelId) {
      this.state.onNavigateToModel(this.selectedModelId);
    }
  }

  render() {
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Components</h2>
            <span class="panel-count">{this.state.components.length}</span>
            <div class="filter-wrapper">
              <input type="text"
                     class="filter-input"
                     placeholder="Filter..."
                     value="{this.state.filter}"
                     oninput="{handleFilterInput}">
              <${If} condition="{this.hasFilter}">
                <button class="filter-clear" onclick="{clearFilter}" title="Clear">×</button>
              </${If}>
            </div>
            <div class="header-stats">
              <span class="header-stat">{this.totalRenders} renders</span>
              <span class="header-stat">{this.formattedTotalTime}</span>
            </div>
          </div>

          <div class="items-list component-tree">
            <${If} condition="{this.hasComponents}">
              <${Loop} items="{this.rootComponents}" key="id" as="item">
                <component-item
                  :data="{item}"
                  :all-components="{this.state.components}"
                  :depth="{0}"
                  :selected-id="{this.state.selectedId}"
                  :on-select="{this.selectComponent}"
                  :on-hover="{this.state.onHover}"
                  :on-leave="{this.state.onLeave}">
                </component-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noComponents}">
              <div class="empty-state">
                <div class="empty-icon">◆</div>
                <div class="empty-text">No components</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelected}">
            <component-details
              :component="{this.selectedComponent}"
              :effects="{this.state.effects}"
              :on-navigate-to-model="{this.state.onNavigateToModel}">
            </component-details>
          </${If}>

          <${If} condition="{this.noSelected}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select a component</div>
              <div class="empty-hint">Click on a component in the tree to see its details</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }
}

