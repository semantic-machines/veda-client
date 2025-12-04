/**
 * Performance panel - render stats and profiling
 */
import { Component, html, Loop, If } from '../../../src/index.js';
import { formatRenderTime } from '../utils/formatters.js';

export default class PerformancePanel extends Component(HTMLElement) {
  static tag = 'performance-panel';

  constructor() {
    super();
    this.state.components = [];
    this.state.profiling = false;
    this.state.profilingResult = null;
    this.state.onStartProfiling = null;
    this.state.onStopProfiling = null;
  }

  // Top components by render count
  get hotComponents() {
    return [...this.state.components]
      .filter(c => c.renderCount > 1)
      .sort((a, b) => b.renderCount - a.renderCount)
      .slice(0, 10);
  }

  get hasHotComponents() {
    return this.hotComponents.length > 0;
  }

  // Top components by average render time
  get slowComponents() {
    return [...this.state.components]
      .filter(c => c.avgRenderTime > 0)
      .sort((a, b) => (b.avgRenderTime || 0) - (a.avgRenderTime || 0))
      .slice(0, 10);
  }

  get hasSlowComponents() {
    return this.slowComponents.length > 0;
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

  get profilingButtonText() {
    return this.state.profiling ? 'Stop Profiling' : 'Start Profiling';
  }

  get profilingButtonClass() {
    return this.state.profiling ? 'btn btn-danger' : 'btn btn-primary';
  }

  get hasProfilingResult() {
    return this.state.profilingResult !== null;
  }

  handleToggleProfiling = () => {
    if (this.state.profiling) {
      if (this.state.onStopProfiling) this.state.onStopProfiling();
    } else {
      if (this.state.onStartProfiling) this.state.onStartProfiling();
    }
  }

  formatAvgTime(comp) {
    return formatRenderTime(comp.avgRenderTime || 0);
  }

  formatTotalTime(comp) {
    return formatRenderTime(comp.totalRenderTime || 0);
  }

  render() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Performance</h2>
        <button class="{this.profilingButtonClass}" onclick="{handleToggleProfiling}">
          {this.profilingButtonText}
        </button>
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

        <${If} condition="{this.hasHotComponents}">
          <div class="perf-section">
            <h3 class="perf-section-title">Most Rendered</h3>
            <div class="perf-list">
              <${Loop} items="{this.hotComponents}" key="id" as="comp">
                <div class="perf-item">
                  <span class="perf-item-name">&lt;{comp.tagName}&gt;</span>
                  <span class="perf-item-count">{comp.renderCount} renders</span>
                </div>
              </${Loop}>
            </div>
          </div>
        </${If}>

        <${If} condition="{this.hasSlowComponents}">
          <div class="perf-section">
            <h3 class="perf-section-title">Slowest Components</h3>
            <div class="perf-list">
              <${Loop} items="{this.slowComponents}" key="id" as="comp">
                <div class="perf-item">
                  <span class="perf-item-name">&lt;{comp.tagName}&gt;</span>
                  <span class="perf-item-time">{this.formatAvgTime(comp)} avg</span>
                </div>
              </${Loop}>
            </div>
          </div>
        </${If}>

        <${If} condition="{this.hasProfilingResult}">
          <div class="perf-section">
            <h3 class="perf-section-title">Profiling Result</h3>
            <pre class="profiling-result">{JSON.stringify(this.state.profilingResult, null, 2)}</pre>
          </div>
        </${If}>
      </div>
    `;
  }
}

