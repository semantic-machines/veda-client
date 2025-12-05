/**
 * Models Tab - list of all model instances
 */
import { Component, html, Loop, If } from '../../../../src/index.js';
import { formatTime, formatValueWithLinks } from '../utils/formatters.js';

export default class ModelsTab extends Component(HTMLElement) {
  static tag = 'models-tab';

  constructor() {
    super();
    this.state.models = [];
    this.state.selectedId = null;
    this.state.filter = '';
    this.state.navigateToId = null;
    this.state.onNavigateToModel = null;
    this._lastNavigateToId = null;
  }

  // Check for navigation request (called from render via getter)
  checkNavigation() {
    const navId = this.state.navigateToId;
    if (navId && navId !== this._lastNavigateToId) {
      this._lastNavigateToId = navId;
      // Find model by modelId (URI) and select it
      const model = this.state.models.find(m => m.modelId === navId);
      if (model) {
        // Use setTimeout to avoid updating state during render
        setTimeout(() => {
          this.state.selectedId = model.id;
          this.state.filter = '';
        }, 0);
      } else {
        setTimeout(() => {
          this.state.filter = navId;
        }, 0);
      }
    }
  }

  handleNavigateToModel = (modelId) => {
    // Find and select model by modelId (URI)
    const model = this.state.models.find(m => m.modelId === modelId);
    if (model) {
      this.state.selectedId = model.id;
      this.state.filter = '';
    } else {
      // Model not found - set filter
      this.state.filter = modelId;
    }
  }

  // Filtering
  get filteredModels() {
    const filter = this.state.filter.toLowerCase();
    if (!filter) return this.state.models;
    return this.state.models.filter(m =>
      m.modelId.toLowerCase().includes(filter) ||
      (m.type && m.type.toLowerCase().includes(filter))
    );
  }

  get hasModels() {
    return this.filteredModels.length > 0;
  }

  get hasFilter() {
    return this.state.filter.length > 0;
  }

  get noModels() {
    return !this.hasModels;
  }

  get noSelected() {
    return !this.hasSelected;
  }

  // Selected model
  get selectedModel() {
    if (!this.state.selectedId) return null;
    return this.state.models.find(m => m.id === this.state.selectedId) || null;
  }

  get hasSelected() {
    return this.selectedModel !== null;
  }

  get selectedInternalId() {
    return this.selectedModel?.id || 0;
  }

  get selectedUri() {
    return this.selectedModel?.modelId || '';
  }

  get selectedType() {
    return this.selectedModel?.type || 'Unknown';
  }

  get selectedIsLoaded() {
    return this.selectedModel?.isLoaded || false;
  }

  get selectedCreatedAt() {
    return formatTime(this.selectedModel?.createdAt);
  }

  get selectedUpdateCount() {
    return this.selectedModel?.updateCount || 0;
  }

  get selectedPropertyEntries() {
    const model = this.selectedModel;
    if (!model?.properties) return [];
    return Object.entries(model.properties)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => {
        const { text, links } = formatValueWithLinks(value);
        return { id: key, key, text, links };
      });
  }

  // Event handlers
  handleFilterInput = (e) => {
    this.state.filter = e.target.value;
  }

  clearFilter = () => {
    this.state.filter = '';
  }

  selectModel = (id) => {
    this.state.selectedId = id;
  }

  render() {
    this.checkNavigation();
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Models</h2>
            <span class="panel-count">{this.state.models.length}</span>
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

          <div class="items-list">
            <${If} condition="{this.hasModels}">
              <${Loop} items="{this.filteredModels}" key="id" as="item">
                <model-item
                  :data="{item}"
                  :selected-id="{this.state.selectedId}"
                  :on-select="{this.selectModel}">
                </model-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noModels}">
              <div class="empty-state">
                <div class="empty-icon">◇</div>
                <div class="empty-text">No models</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelected}">
            <div class="details-panel">
              <div class="details-header">
                <span class="details-tag">{this.selectedUri}</span>
                <span class="details-id">#{this.selectedInternalId}</span>
              </div>

              <div class="details-section">
                <div class="details-section-title">Info</div>
                <div class="details-properties">
                  <div class="details-property">
                    <span class="details-prop-key">Type</span>
                    <span class="details-prop-value">{this.selectedType}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Loaded</span>
                    <span class="details-prop-value">{this.selectedIsLoaded}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Created</span>
                    <span class="details-prop-value">{this.selectedCreatedAt}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Updates</span>
                    <span class="details-prop-value">{this.selectedUpdateCount}</span>
                  </div>
                </div>
              </div>

              <div class="details-section">
                <div class="details-section-title">Properties</div>
                <div class="details-properties">
                  <${Loop} items="{this.selectedPropertyEntries}" key="id" as="entry">
                    <div class="details-property">
                      <span class="details-prop-key">{entry.key}:</span>
                      <property-value :text="{entry.text}" :links="{entry.links}" :on-navigate="{this.handleNavigateToModel}"></property-value>
                    </div>
                  </${Loop}>
                </div>
              </div>
            </div>
          </${If}>

          <${If} condition="{this.noSelected}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select a model</div>
              <div class="empty-hint">Click on a model to see its properties</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }
}

