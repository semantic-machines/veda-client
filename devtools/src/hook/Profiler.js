/**
 * Profiler
 * Handles performance profiling
 */

export class Profiler {
  constructor() {
    this.profiling = false;
    this.profileData = [];
    this.profileStartTime = 0;
  }

  start() {
    this.profiling = true;
    this.profileData = [];
    this.profileStartTime = performance.now();
    console.log('[Veda DevTools] Profiling started');
  }

  stop() {
    this.profiling = false;
    const duration = performance.now() - this.profileStartTime;
    console.log('[Veda DevTools] Profiling stopped, duration:', duration, 'ms');
    return {
      duration,
      events: this.profileData.slice(),
      summary: this.getSummary()
    };
  }

  record(type, data) {
    if (!this.profiling) return;
    this.profileData.push({
      type,
      data,
      timestamp: performance.now() - this.profileStartTime
    });
  }

  getSummary() {
    const summary = {
      renders: 0,
      totalRenderTime: 0,
      effectTriggers: 0,
      modelUpdates: 0,
      componentsByRenders: {}
    };

    for (const event of this.profileData) {
      if (event.type === 'render') {
        summary.renders++;
        summary.totalRenderTime += event.data.time || 0;
        const tag = event.data.tagName || 'unknown';
        summary.componentsByRenders[tag] = (summary.componentsByRenders[tag] || 0) + 1;
      } else if (event.type === 'effect') {
        summary.effectTriggers++;
      } else if (event.type === 'model-update') {
        summary.modelUpdates++;
      }
    }

    return summary;
  }
}
