/**
 * Component details panel
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatTime, formatValue } from '../utils/formatters.js';

export default class ComponentDetails extends Component(HTMLElement) {
  static tag = 'component-details';

  constructor() {
    super();
    this.state.component = null;
    this.state.effects = [];  // All effects for counting
    this.state.onNavigateToModel = null;
  }

  get hasComponent() {
    return this.state.component !== null;
  }

  get tagName_() {
    return this.state.component?.tagName || '';
  }

  get componentId() {
    return this.state.component?.id || 0;
  }

  get modelId() {
    return this.state.component?.modelId || null;
  }

  get parentId() {
    return this.state.component?.parentId || null;
  }

  get renderCount() {
    return this.state.component?.renderCount || 0;
  }

  get childCount() {
    return this.state.component?.childIds?.length || 0;
  }

  get createdAt() {
    return formatTime(this.state.component?.createdAt);
  }

  get stateEntries() {
    const comp = this.state.component;
    if (!comp?.state) return [];
    return Object.entries(comp.state).map(([key, value]) => ({
      id: key,
      key,
      formattedValue: formatValue(value)
    }));
  }

  get hasState() {
    return this.stateEntries.length > 0;
  }

  get hasModelId() {
    return !!this.modelId;
  }

  get hasParentId() {
    return !!this.parentId;
  }

  get hasChildren() {
    return this.childCount > 0;
  }

  get effectCount() {
    const compId = this.componentId;
    if (!compId || !this.state.effects) return 0;
    return this.state.effects.filter(e => e.componentId === compId).length;
  }

  get hasEffects() {
    return this.effectCount > 0;
  }

  handleNavigateToModel = () => {
    if (this.state.onNavigateToModel && this.modelId) {
      this.state.onNavigateToModel(this.modelId);
    }
  }

  render() {
    if (!this.hasComponent) {
      return html`
        <div class="empty-state">
          <div class="empty-icon">...</div>
          <div class="empty-text">Select a component</div>
          <div class="empty-hint">Click on a component in the tree to see its details</div>
        </div>
      `;
    }

    return html`
      <div class="details-panel">
        <div class="details-header">
          <span class="details-tag">&lt;{this.tagName_}&gt;</span>
          <span class="details-id">#{this.componentId}</span>
        </div>

        <div class="details-section">
          <div class="details-section-title">State</div>
          <div class="details-properties">
            <${If} condition="{this.hasModelId}">
              <div class="details-property">
                <span class="details-prop-key">model</span>
                <span class="details-prop-value details-model-link" onclick="{handleNavigateToModel}">{this.modelId}</span>
              </div>
            </${If}>
            <${Loop} items="{this.stateEntries}" key="id" as="entry">
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
              <span class="details-prop-value">{this.createdAt}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Renders</span>
              <span class="details-prop-value">{this.renderCount}</span>
            </div>
            <${If} condition="{this.hasEffects}">
              <div class="details-property">
                <span class="details-prop-key">Effects</span>
                <span class="details-prop-value">{this.effectCount}</span>
              </div>
            </${If}>
            <${If} condition="{this.hasChildren}">
              <div class="details-property">
                <span class="details-prop-key">Children</span>
                <span class="details-prop-value">{this.childCount}</span>
              </div>
            </${If}>
          </div>
        </div>
      </div>
    `;
  }
}

