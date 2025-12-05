/**
 * Effects Tab - list of all effects
 */
import { Component, html, Loop, If } from '../../../../src/index.js';
import { formatTime } from '../utils/formatters.js';

export default class EffectsTab extends Component(HTMLElement) {
  static tag = 'effects-tab';

  constructor() {
    super();
    this.state.effects = [];
    this.state.components = [];  // For component details
    this.state.selectedId = null;  // Selected effect
    this.state.selectedComponentId = null;  // Selected component
    this.state.filter = '';
    this.state.onInspect = null;  // Callback for $v on click
    this.state.onHover = null;    // Callback for highlight on hover
    this.state.onLeave = null;    // Callback for hide highlight
  }

  // Filtering
  get filteredEffects() {
    const filter = this.state.filter.toLowerCase();
    if (!filter) return this.state.effects;
    return this.state.effects.filter(e =>
      String(e.id).includes(filter) ||
      (e.componentTag || '').toLowerCase().includes(filter) ||
      (e.name || '').toLowerCase().includes(filter)
    );
  }

  // Flat list with group headers interspersed (grouped by component instance)
  get effectsWithHeaders() {
    const groups = new Map();

    for (const effect of this.filteredEffects) {
      // Group by componentId (instance), fallback to 'standalone'
      const groupKey = effect.componentId ? `comp-${effect.componentId}` : 'standalone';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          componentId: effect.componentId,
          componentTag: effect.componentTag || 'standalone',
          effects: []
        });
      }
      groups.get(groupKey).effects.push(effect);
    }

    // Sort groups: standalone last, then by componentId
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (!a.componentId) return 1;
      if (!b.componentId) return -1;
      return (a.componentId || 0) - (b.componentId || 0);
    });

    // Build flat list with headers
    const result = [];
    for (const group of sortedGroups) {
      // Add header item
      result.push({
        _key: `header-${group.componentId || 'standalone'}`,
        _isHeader: true,
        componentTag: group.componentTag,
        componentId: group.componentId,
        count: group.effects.length
      });
      // Add effect items
      for (const effect of group.effects) {
        result.push({
          ...effect,
          _key: `effect-${effect.id}`,
          _isHeader: false
        });
      }
    }
    return result;
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

  get noEffects() {
    return !this.hasEffects;
  }

  get noSelected() {
    return !this.hasSelected;
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

  get selectedIsHot() {
    return (this.selectedEffect?.triggerCount || 0) > 10;
  }

  get selectedIsComputed() {
    return this.selectedEffect?.isComputed || false;
  }

  get selectedTypeLabel() {
    return this.selectedIsComputed ? 'computed' : 'effect';
  }

  get selectedDepsCount() {
    return this.selectedEffect?.depsCount || 0;
  }

  get selectedDependencies() {
    return this.selectedEffect?.dependencies || [];
  }

  get hasDependencies() {
    return this.selectedDependencies.length > 0;
  }

  get selectedName() {
    return this.selectedEffect?.name || '';
  }

  get hasName() {
    return Boolean(this.selectedName);
  }

  get selectedComponentTag() {
    return this.selectedEffect?.componentTag || 'standalone';
  }

  // Selected component (for group headers)
  get selectedComponent() {
    if (!this.state.selectedComponentId) return null;
    return this.state.components.find(c => c.id === this.state.selectedComponentId) || null;
  }

  get hasSelectedComponent() {
    return this.selectedComponent !== null;
  }

  get showComponentDetails() {
    return this.hasSelectedComponent && !this.hasSelected;
  }

  get showEffectDetails() {
    return this.hasSelected;
  }

  get showEmptyState() {
    return !this.showComponentDetails && !this.showEffectDetails;
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
    this.state.selectedComponentId = null;  // Clear component selection
  }

  selectComponent = (id) => {
    this.state.selectedComponentId = id;
    this.state.selectedId = null;  // Clear effect selection
    // Set $v in console
    if (this.state.onInspect) {
      this.state.onInspect(id);
    }
  }

  handleComponentHover = (id) => {
    if (this.state.onHover) {
      this.state.onHover(id);
    }
  }

  handleComponentLeave = () => {
    if (this.state.onLeave) {
      this.state.onLeave();
    }
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
              <${Loop} items="{this.effectsWithHeaders}" key="_key" as="item">
                <effect-list-item
                  :data="{item}"
                  :selected-id="{this.state.selectedId}"
                  :selected-component-id="{this.state.selectedComponentId}"
                  :on-select="{this.selectEffect}"
                  :on-select-component="{this.selectComponent}"
                  :on-hover="{this.handleComponentHover}"
                  :on-leave="{this.handleComponentLeave}">
                </effect-list-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noEffects}">
              <div class="empty-state">
                <div class="empty-icon">⚡</div>
                <div class="empty-text">No effects</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer"></div>

        <div class="split-right">
          <${If} condition="{this.showEffectDetails}">
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
                    <span class="details-prop-key">Type</span>
                    <span class="details-prop-value">{this.selectedTypeLabel}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Component</span>
                    <span class="details-prop-value">{this.selectedComponentTag}</span>
                  </div>
                  <${If} condition="{this.hasName}">
                    <div class="details-property">
                      <span class="details-prop-key">Name</span>
                      <span class="details-prop-value">{this.selectedName}</span>
                    </div>
                  </${If}>
                  <div class="details-property">
                    <span class="details-prop-key">Triggers</span>
                    <span class="details-prop-value">{this.selectedTriggerCount}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Last triggered</span>
                    <span class="details-prop-value">{this.selectedLastTriggered}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Dependencies</span>
                    <span class="details-prop-value">{this.selectedDepsCount}</span>
                  </div>
                </div>
              </div>

              <${If} condition="{this.hasDependencies}">
                <div class="details-section">
                  <div class="details-section-title">Tracked Dependencies</div>
                  <div class="deps-list">
                    <${Loop} items="{this.selectedDependencies}" key="key" as="dep">
                      <div class="dep-item">
                        <span class="dep-target">{dep.targetId}</span>
                        <span class="dep-prop">.{dep.property}</span>
                      </div>
                    </${Loop}>
                  </div>
                </div>
              </${If}>
            </div>
          </${If}>

          <${If} condition="{this.showComponentDetails}">
            <component-details
              :component="{this.selectedComponent}"
              :effects="{this.state.effects}">
            </component-details>
          </${If}>

          <${If} condition="{this.showEmptyState}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select an effect or component</div>
              <div class="empty-hint">Click to see details</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }
}

