/**
 * Performance panel - render stats
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatRenderTime } from '../utils/formatters.js';

export default class PerformancePanel extends Component(HTMLElement) {
  static tag = 'performance-panel';

  constructor() {
    super();
    this.state.components = [];
  }

  // All components with render info, sorted by render count
  get componentsList() {
    return [...this.state.components]
      .filter(c => c.renderCount > 0)
      .sort((a, b) => b.renderCount - a.renderCount)
      .map(c => ({
        ...c,
        _avgTime: formatRenderTime(c.avgRenderTime || 0)
      }));
  }

  get hasComponents() {
    return this.componentsList.length > 0;
  }

  get noComponents() {
    return !this.hasComponents;
  }

  get totalRenders() {
    return this.state.components.reduce((sum, c) => sum + (c.renderCount || 0), 0);
  }

  get totalRenderTime() {
    return this.state.components.reduce((sum, c) => sum + (c.totalRenderTime || 0), 0);
  }

  get formattedTotalTime() {
    return formatRenderTime(this.totalRenderTime);
  }

  get avgRenderTime() {
    if (this.totalRenders === 0) return 0;
    return this.totalRenderTime / this.totalRenders;
  }

  get formattedAvgTime() {
    return formatRenderTime(this.avgRenderTime);
  }

  render() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Performance</h2>
      </div>

      <div class="performance-content">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{this.state.components.length}</div>
            <div class="stat-label">Components</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{this.totalRenders}</div>
            <div class="stat-label">Total Renders</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{this.formattedTotalTime}</div>
            <div class="stat-label">Total Time</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{this.formattedAvgTime}</div>
            <div class="stat-label">Avg Render</div>
          </div>
        </div>
        <${If} condition="{this.hasComponents}">
          <div class="sub-list">
            <${Loop} items="{this.componentsList}" key="id" as="comp">
              <div class="sub-item">
                <span class="sub-id">&lt;{comp.tagName}&gt;</span>
                <span class="sub-info">
                  <span class="sub-updates">{comp.renderCount}x</span>
                  <span class="sub-time">{comp._avgTime}</span>
                </span>
              </div>
            </${Loop}>
          </div>
        </${If}>
        <${If} condition="{this.noComponents}">
          <div class="sub-empty">No renders recorded</div>
        </${If}>
      </div>
    `;
  }
}
