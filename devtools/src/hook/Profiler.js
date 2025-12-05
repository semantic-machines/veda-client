/**
 * Profiler Module
 * Handles performance profiling
 */

export function createProfiler() {
  let profiling = false;
  const profileData = [];
  let profileStartTime = 0;

  return {
    get profiling() { return profiling; },
    get profileData() { return profileData; },

    start() {
      profiling = true;
      profileData.length = 0;
      profileStartTime = performance.now();
      console.log('[Veda DevTools] Profiling started');
    },

    stop() {
      profiling = false;
      const duration = performance.now() - profileStartTime;
      console.log('[Veda DevTools] Profiling stopped, duration:', duration, 'ms');
      return {
        duration,
        events: profileData.slice(),
        summary: getSummary()
      };
    },

    record(type, data) {
      if (!profiling) return;
      profileData.push({
        type,
        data,
        timestamp: performance.now() - profileStartTime
      });
    }
  };

  function getSummary() {
    const summary = {
      renders: 0,
      totalRenderTime: 0,
      effectTriggers: 0,
      modelUpdates: 0,
      componentsByRenders: {}
    };

    for (const event of profileData) {
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

