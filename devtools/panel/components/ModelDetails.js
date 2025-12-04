/**
 * Model details panel
 */
import { Component, html, Loop } from '../../../src/index.js';
import { formatTime, formatValueWithLinks } from '../utils/formatters.js';

export default class ModelDetails extends Component(HTMLElement) {
  static tag = 'model-details';

  constructor() {
    super();
    this.state.model = null;
  }

  get hasModel() {
    return this.state.model !== null;
  }

  get internalId() {
    return this.state.model?.id || 0;
  }

  get uri() {
    return this.state.model?.modelId || '';
  }

  get type() {
    return this.state.model?.type || 'Unknown';
  }

  get isLoaded() {
    return this.state.model?.isLoaded || false;
  }

  get createdAt() {
    return formatTime(this.state.model?.createdAt);
  }

  get updateCount() {
    return this.state.model?.updateCount || 0;
  }

  get propertyEntries() {
    const model = this.state.model;
    if (!model?.properties) return [];
    return Object.entries(model.properties)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => {
        const { text, links } = formatValueWithLinks(value);
        return { id: key, key, text, links };
      });
  }

  get hasProperties() {
    return this.propertyEntries.length > 0;
  }

  render() {
    if (!this.hasModel) {
      return html`
        <div class="empty-state">
          <div class="empty-icon">...</div>
          <div class="empty-text">Select a model</div>
          <div class="empty-hint">Click on a model to see its properties</div>
        </div>
      `;
    }

    return html`
      <div class="details-panel">
        <div class="details-header">
          <span class="details-tag">{this.uri}</span>
          <span class="details-id">##{this.internalId}</span>
        </div>

        <div class="details-section">
          <div class="details-section-title">Info</div>
          <div class="details-properties">
            <div class="details-property">
              <span class="details-prop-key">Type</span>
              <span class="details-prop-value">{this.type}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Loaded</span>
              <span class="details-prop-value">{this.isLoaded}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Created</span>
              <span class="details-prop-value">{this.createdAt}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Updates</span>
              <span class="details-prop-value">{this.updateCount}</span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <div class="details-section-title">Properties</div>
          <div class="details-properties">
            <${Loop} items="{this.propertyEntries}" key="id" as="entry">
              <div class="details-property">
                <span class="details-prop-key">{entry.key}:</span>
                <property-value :text="{entry.text}" :links="{entry.links}"></property-value>
              </div>
            </${Loop}>
          </div>
        </div>
      </div>
    `;
  }
}

