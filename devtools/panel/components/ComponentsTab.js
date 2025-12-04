/**
 * Components Tab - tree view of all components
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatTime, formatValue } from '../utils/formatters.js';

export default class ComponentsTab extends Component(HTMLElement) {
  static tag = 'components-tab';

  constructor() {
    super();
    this.state.components = [];
    this.state.selectedId = null;
    this.state.filter = '';
    this.state.onNavigateToModel = null;
    this.state.onInspect = null;
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

  get noSelected() {
    return !this.hasSelected;
  }

  // Selected component
  get selectedComponent() {
    if (!this.state.selectedId) return null;
    return this.state.components.find(c => c.id === this.state.selectedId) || null;
  }

  get hasSelected() {
    return this.selectedComponent !== null;
  }

  get selectedTagName() {
    return this.selectedComponent?.tagName || '';
  }

  get selectedComponentId() {
    return this.selectedComponent?.id || 0;
  }

  get selectedModelId() {
    return this.selectedComponent?.modelId || null;
  }

  get selectedParentId() {
    return this.selectedComponent?.parentId || null;
  }

  get selectedRenderCount() {
    return this.selectedComponent?.renderCount || 0;
  }

  get selectedChildCount() {
    return this.selectedComponent?.childIds?.length || 0;
  }

  get selectedCreatedAt() {
    return formatTime(this.selectedComponent?.createdAt);
  }

  get selectedStateEntries() {
    const comp = this.selectedComponent;
    if (!comp?.state) return [];
    return Object.entries(comp.state).map(([key, value]) => ({
      id: key,
      key,
      formattedValue: formatValue(value)
    }));
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
          </div>

          <div class="items-list component-tree">
            <${If} condition="{this.hasComponents}">
              <${Loop} items="{this.rootComponents}" key="id" as="item">
                <component-item
                  :data="{item}"
                  :all-components="{this.state.components}"
                  :depth="{0}"
                  :selected-id="{this.state.selectedId}"
                  :on-select="{this.selectComponent}">
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
            <div class="details-panel">
              <div class="details-header">
                <span class="details-tag">&lt;{this.selectedTagName}&gt;</span>
                <span class="details-id">#{this.selectedComponentId}</span>
              </div>

              <div class="details-section">
                <div class="details-section-title">State</div>
                <div class="details-properties">
                  <${If} condition="{this.selectedModelId}">
                    <div class="details-property">
                      <span class="details-prop-key">model</span>
                      <span class="details-prop-value details-model-link" onclick="{handleNavigateToModel}">{this.selectedModelId}</span>
                    </div>
                  </${If}>
                  <${Loop} items="{this.selectedStateEntries}" key="id" as="entry">
                    <div class="details-property">
                      <span class="details-prop-key">{entry.key}</span>
                      <span class="details-prop-value">{entry.formattedValue}</span>
                    </div>
                  </${Loop}>
                </div>
              </div>

              <div class="details-section">
                <div class="details-section-title">Info</div>
                <div class="details-properties">
                  <div class="details-property">
                    <span class="details-prop-key">Created</span>
                    <span class="details-prop-value">{this.selectedCreatedAt}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Renders</span>
                    <span class="details-prop-value">{this.selectedRenderCount}</span>
                  </div>
                  <${If} condition="{this.selectedParentId}">
                    <div class="details-property">
                      <span class="details-prop-key">Parent ID</span>
                      <span class="details-prop-value">#{this.selectedParentId}</span>
                    </div>
                  </${If}>
                  <${If} condition="{this.selectedChildCount}">
                    <div class="details-property">
                      <span class="details-prop-key">Children</span>
                      <span class="details-prop-value">{this.selectedChildCount} components</span>
                    </div>
                  </${If}>
                </div>
              </div>
            </div>
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

