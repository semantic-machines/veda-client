/**
 * Timeline Item - Shows event in timeline
 */

import { Component, html } from '../../../../src/index.js';

export default class TimelineItem extends Component(HTMLElement) {
  static tag = 'timeline-item';

  get eventIcon() {
    const event = this.state.data?.event || '';
    if (event.includes('component')) return '◆';
    if (event.includes('model')) return '◇';
    if (event.includes('effect')) return '⚡';
    return '•';
  }

  get eventClass() {
    const event = this.state.data?.event || '';
    if (event.includes('created')) return 'timeline-event event-created';
    if (event.includes('removed')) return 'timeline-event event-removed';
    if (event.includes('triggered')) return 'timeline-event event-triggered';
    if (event.includes('changed')) return 'timeline-event event-changed';
    return 'timeline-event';
  }

  get eventLabel() {
    const event = this.state.data?.event || '';
    return event.replace(':', ' → ').replace(/-/g, ' ');
  }

  get eventDetail() {
    const data = this.state.data?.data;
    if (!data) return '';

    if (data.tagName) return `<${data.tagName}>`;
    if (data.modelId) return data.modelId;
    if (data.id) return `#${data.id}`;
    return '';
  }

  formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  render() {
    if (!this.state.data) return '';

    return html`
      <div class="{this.eventClass}">
        <span class="timeline-time">${this.formatTime(this.state.data?.timestamp)}</span>
        <span class="timeline-icon">{this.eventIcon}</span>
        <span class="timeline-label">{this.eventLabel}</span>
        <span class="timeline-detail">{this.eventDetail}</span>
      </div>
    `;
  }
}

