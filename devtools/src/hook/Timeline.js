/**
 * Timeline
 * Tracks timeline of events
 */

export class Timeline {
  constructor(maxEvents = 100) {
    this.timeline = [];
    this.maxEvents = maxEvents;
  }

  add(event, data) {
    const entry = {
      id: Date.now() + Math.random(),
      event,
      data,
      timestamp: Date.now()
    };

    this.timeline.push(entry);

    if (this.timeline.length > this.maxEvents) {
      this.timeline.shift();
    }
  }

  get(limit = 50) {
    return this.timeline.slice(-limit);
  }

  clear() {
    this.timeline.length = 0;
  }
}
