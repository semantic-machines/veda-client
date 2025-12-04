/**
 * DevTools Panel Components
 */

// Item components
export { default as ComponentItem } from './ComponentItem.js';
export { default as ModelItem } from './ModelItem.js';
export { default as EffectItem } from './EffectItem.js';
export { default as TimelineItem } from './TimelineItem.js';
export { default as PropertyValue } from './PropertyValue.js';

// Detail components (legacy, may be removed)
export { default as ComponentDetails } from './ComponentDetails.js';
export { default as ModelDetails } from './ModelDetails.js';
export { default as EffectDetails } from './EffectDetails.js';

// Tab components
export { default as ComponentsTab } from './ComponentsTab.js';
export { default as ModelsTab } from './ModelsTab.js';
export { default as EffectsTab } from './EffectsTab.js';
export { default as TimelineTab } from './TimelineTab.js';
export { default as GraphTab } from './GraphTab.js';
export { default as SubscriptionsTab } from './SubscriptionsTab.js';
export { default as PerformancePanel } from './PerformancePanel.js';
export { default as GraphView } from './GraphView.js';

// Register all components
import ComponentItem from './ComponentItem.js';
import ModelItem from './ModelItem.js';
import EffectItem from './EffectItem.js';
import TimelineItem from './TimelineItem.js';
import PropertyValue from './PropertyValue.js';
import ComponentDetails from './ComponentDetails.js';
import ModelDetails from './ModelDetails.js';
import EffectDetails from './EffectDetails.js';
import ComponentsTab from './ComponentsTab.js';
import ModelsTab from './ModelsTab.js';
import EffectsTab from './EffectsTab.js';
import TimelineTab from './TimelineTab.js';
import GraphTab from './GraphTab.js';
import SubscriptionsTab from './SubscriptionsTab.js';
import PerformancePanel from './PerformancePanel.js';
import GraphView from './GraphView.js';

export function registerComponents() {
  // Item components
  customElements.define(ComponentItem.tag, ComponentItem);
  customElements.define(ModelItem.tag, ModelItem);
  customElements.define(EffectItem.tag, EffectItem);
  customElements.define(TimelineItem.tag, TimelineItem);
  customElements.define(PropertyValue.tag, PropertyValue);

  // Detail components
  customElements.define(ComponentDetails.tag, ComponentDetails);
  customElements.define(ModelDetails.tag, ModelDetails);
  customElements.define(EffectDetails.tag, EffectDetails);

  // Tab components
  customElements.define(ComponentsTab.tag, ComponentsTab);
  customElements.define(ModelsTab.tag, ModelsTab);
  customElements.define(EffectsTab.tag, EffectsTab);
  customElements.define(TimelineTab.tag, TimelineTab);
  customElements.define(GraphTab.tag, GraphTab);
  customElements.define(SubscriptionsTab.tag, SubscriptionsTab);
  customElements.define(PerformancePanel.tag, PerformancePanel);
  customElements.define(GraphView.tag, GraphView);
}
