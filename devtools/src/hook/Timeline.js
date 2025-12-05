/**
 * Timeline Module
 * Tracks timeline of events
 */

export function createTimeline(maxEvents = 100) {
  const timeline = [];

  return {
    timeline,

    add(event, data) {
      const entry = {
        id: Date.now() + Math.random(),
        event,
        data,
        timestamp: Date.now()
      };

      timeline.push(entry);

      if (timeline.length > maxEvents) {
        timeline.shift();
      }
    },

    get(limit = 50) {
      return timeline.slice(-limit);
    },

    clear() {
      timeline.length = 0;
    }
  };
}

