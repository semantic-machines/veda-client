/**
 * Effect details panel
 */
import { Component, html, If } from '../../../src/index.js';
import { formatTime } from '../utils/formatters.js';

export default class EffectDetails extends Component(HTMLElement) {
  static tag = 'effect-details';

  constructor() {
    super();
    this.state.effect = null;
  }

  get hasEffect() {
    return this.state.effect !== null;
  }

  get effectId() {
    return this.state.effect?.id || 0;
  }

  get createdAt() {
    return formatTime(this.state.effect?.createdAt);
  }

  get triggerCount() {
    return this.state.effect?.triggerCount || 0;
  }

  get lastTriggered() {
    return formatTime(this.state.effect?.lastTriggered);
  }

  get source() {
    return this.state.effect?.source || '';
  }

  get hasSource() {
    return !!this.source;
  }

  get isHot() {
    return this.triggerCount > 10;
  }

  render() {
    if (!this.hasEffect) {
      return html`
        <div class="empty-state">
          <div class="empty-icon">...</div>
          <div class="empty-text">Select an effect</div>
          <div class="empty-hint">Click on an effect to see its details</div>
        </div>
      `;
    }

    return html`
      <div class="details-panel">
        <div class="details-header">
          <span class="details-tag">Effect ##{this.effectId}</span>
          <${If} condition="{this.isHot}">
            <span class="badge badge-warning">hot</span>
          </${If}>
        </div>

        <div class="details-section">
          <div class="details-section-title">Info</div>
          <div class="details-properties">
            <div class="details-property">
              <span class="details-prop-key">Created</span>
              <span class="details-prop-value">{this.createdAt}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Triggers</span>
              <span class="details-prop-value">{this.triggerCount}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Last triggered</span>
              <span class="details-prop-value">{this.lastTriggered}</span>
            </div>
          </div>
        </div>

        <${If} condition="{this.hasSource}">
          <div class="details-section">
            <div class="details-section-title">Source</div>
            <pre class="effect-source">{this.source}</pre>
          </div>
        </${If}>
      </div>
    `;
  }
}

