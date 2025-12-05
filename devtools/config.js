/**
 * DevTools Configuration
 */

export const DEVTOOLS_CONFIG = {
  // Timeline & History
  MAX_TIMELINE_EVENTS: 100,
  MAX_SUBSCRIPTION_HISTORY: 200,
  
  // Timing
  SNAPSHOT_DEBOUNCE_MS: 50,
  RECONNECT_DELAY_MS: 1000,
  RECONNECT_DELAY_ERROR_MS: 2000,
  
  // Performance
  MAX_SERIALIZATION_DEPTH: 3,
  MAX_ARRAY_PREVIEW_LENGTH: 100,
  
  // Colors (matching VS Code Dark+ theme)
  COLORS: {
    COMPONENT: '#4ec9b0',
    MODEL: '#c586c0',
    EFFECT: '#dcdcaa',
    SUBSCRIPTION: '#569cd6',
    ERROR: '#f48771',
    WARNING: '#d7ba7d',
    SUCCESS: '#4ec9b0',
  },
  
  // Profiling
  HOT_COMPONENT_THRESHOLD: 10, // renders per second
  WARM_COMPONENT_THRESHOLD: 5,
};

