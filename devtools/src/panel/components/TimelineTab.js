/**
 * Timeline Tab - real-time event log
 */
import { Component, html, Loop, If } from '../../../../src/index.js';

export default class TimelineTab extends Component(HTMLElement) {
  static tag = 'timeline-tab';

  constructor() {
    super();
    this.state.timeline = [];
  }

  get hasEvents() {
    return this.state.timeline.length > 0;
  }

  get noEvents() {
    return !this.hasEvents;
  }

  get reversedTimeline() {
    return [...this.state.timeline].reverse();
  }

  render() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Timeline</h2>
        <span class="panel-count">{this.state.timeline.length} events</span>
      </div>

      <div class="timeline-container">
        <${If} condition="{this.hasEvents}">
          <${Loop} items="{this.reversedTimeline}" key="id" as="item">
            <timeline-item :data="{item}"></timeline-item>
          </${Loop}>
        </${If}>

        <${If} condition="{this.noEvents}">
          <div class="empty-state">
            <div class="empty-icon">◷</div>
            <div class="empty-text">No events yet</div>
            <div class="empty-hint">Events will appear here in real-time as your app runs</div>
          </div>
        </${If}>
      </div>
    `;
  }
}

