/**
 * Graph Tab - dependency visualization
 */
import { Component, html, If } from '../../../src/index.js';

export default class GraphTab extends Component(HTMLElement) {
  static tag = 'graph-tab';

  constructor() {
    super();
    this.state.nodes = [];
    this.state.edges = [];
  }

  get hasNodes() {
    return this.state.nodes.length > 0;
  }

  get noNodes() {
    return !this.hasNodes;
  }

  render() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Dependency Graph</h2>
        <span class="panel-count">{this.state.nodes.length} nodes</span>
      </div>

      <div class="graph-container">
        <${If} condition="{this.hasNodes}">
          <graph-view :nodes="{this.state.nodes}" :edges="{this.state.edges}"></graph-view>
        </${If}>

        <${If} condition="{this.noNodes}">
          <div class="empty-state">
            <div class="empty-icon">◈</div>
            <div class="empty-text">No dependencies</div>
            <div class="empty-hint">Component and model relationships will appear here</div>
          </div>
        </${If}>
      </div>

      <div class="graph-legend">
        <span class="legend-item"><span class="legend-color component"></span> Component</span>
        <span class="legend-item"><span class="legend-color model"></span> Model</span>
        <span class="legend-item"><span class="legend-color effect"></span> Effect</span>
      </div>
    `;
  }
}

