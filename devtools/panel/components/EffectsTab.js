/**
 * Effects Tab - list of all effects
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatTime } from '../utils/formatters.js';

export default class EffectsTab extends Component(HTMLElement) {
  static tag = 'effects-tab';

  constructor() {
    super();
    this.state.effects = [];
    this.state.selectedId = null;
    this.state.filter = '';
  }

  // Filtering
  get filteredEffects() {
    const filter = this.state.filter.toLowerCase();
    if (!filter) return this.state.effects;
    return this.state.effects.filter(e => String(e.id).includes(filter));
  }

  get hasEffects() {
    return this.filteredEffects.length > 0;
  }

  get hasFilter() {
    return this.state.filter.length > 0;
  }

  get hotEffectsCount() {
    return this.state.effects.filter(e => e.triggerCount > 10).length;
  }

  get hasHotEffects() {
    return this.hotEffectsCount > 0;
  }

  // Selected effect
  get selectedEffect() {
    if (!this.state.selectedId) return null;
    return this.state.effects.find(e => e.id === this.state.selectedId) || null;
  }

  get hasSelected() {
    return this.selectedEffect !== null;
  }

  get selectedEffectId() {
    return this.selectedEffect?.id || 0;
  }

  get selectedCreatedAt() {
    return formatTime(this.selectedEffect?.createdAt);
  }

  get selectedTriggerCount() {
    return this.selectedEffect?.triggerCount || 0;
  }

  get selectedLastTriggered() {
    return formatTime(this.selectedEffect?.lastTriggered);
  }

  get selectedSource() {
    return this.selectedEffect?.source || '';
  }

  get selectedIsHot() {
    return (this.selectedEffect?.triggerCount || 0) > 10;
  }

  // Event handlers
  handleFilterInput = (e) => {
    this.state.filter = e.target.value;
  }

  clearFilter = () => {
    this.state.filter = '';
  }

  selectEffect = (id) => {
    this.state.selectedId = id;
  }

  render() {
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Effects</h2>
            <span class="panel-count">{this.state.effects.length}</span>
            <${If} condition="{this.hasHotEffects}">
              <span class="badge badge-warning">{this.hotEffectsCount} hot</span>
            </${If}>
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
            <${If} condition="{this.hasEffects}">
              <${Loop} items="{this.filteredEffects}" key="id" as="item">
                <effect-item
                  :data="{item}"
                  :selected-id="{this.state.selectedId}"
                  :on-select="{this.selectEffect}">
                </effect-item>
              </${Loop}>
            </${If}>

            <${If} condition="{!this.hasEffects}">
              <div class="empty-state">
                <div class="empty-icon">⚡</div>
                <div class="empty-text">No effects</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelected}">
            <div class="details-panel">
              <div class="details-header">
                <span class="details-tag">Effect #{this.selectedEffectId}</span>
                <${If} condition="{this.selectedIsHot}">
                  <span class="badge badge-warning">hot</span>
                </${If}>
              </div>

              <div class="details-section">
                <div class="details-section-title">Info</div>
                <div class="details-properties">
                  <div class="details-property">
                    <span class="details-prop-key">Created</span>
                    <span class="details-prop-value">{this.selectedCreatedAt}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Triggers</span>
                    <span class="details-prop-value">{this.selectedTriggerCount}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Last triggered</span>
                    <span class="details-prop-value">{this.selectedLastTriggered}</span>
                  </div>
                </div>
              </div>

              <${If} condition="{this.selectedSource}">
                <div class="details-section">
                  <div class="details-section-title">Source</div>
                  <pre class="effect-source">{this.selectedSource}</pre>
                </div>
              </${If}>
            </div>
          </${If}>

          <${If} condition="{!this.hasSelected}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select an effect</div>
              <div class="empty-hint">Click on an effect to see its details</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }
}

