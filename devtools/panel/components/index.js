/**
 * DevTools Panel Components
 */

// Item components
export { default as ComponentItem } from './ComponentItem.js';
export { default as ModelItem } from './ModelItem.js';
export { default as EffectListItem } from './EffectListItem.js';
export { default as TimelineItem } from './TimelineItem.js';
export { default as PropertyValue } from './PropertyValue.js';

// Detail components
export { default as ComponentDetails } from './ComponentDetails.js';

// Tab components
export { default as ComponentsTab } from './ComponentsTab.js';
export { default as ModelsTab } from './ModelsTab.js';
export { default as EffectsTab } from './EffectsTab.js';
export { default as TimelineTab } from './TimelineTab.js';
export { default as SubscriptionsTab } from './SubscriptionsTab.js';

// Register all components
import ComponentItem from './ComponentItem.js';
import ModelItem from './ModelItem.js';
import EffectListItem from './EffectListItem.js';
import TimelineItem from './TimelineItem.js';
import PropertyValue from './PropertyValue.js';
import ComponentDetails from './ComponentDetails.js';
import ComponentsTab from './ComponentsTab.js';
import ModelsTab from './ModelsTab.js';
import EffectsTab from './EffectsTab.js';
import TimelineTab from './TimelineTab.js';
import SubscriptionsTab from './SubscriptionsTab.js';

export function registerComponents() {
  // Item components
  customElements.define(ComponentItem.tag, ComponentItem);
  customElements.define(ModelItem.tag, ModelItem);
  customElements.define(EffectListItem.tag, EffectListItem);
  customElements.define(TimelineItem.tag, TimelineItem);
  customElements.define(PropertyValue.tag, PropertyValue);

  // Detail components
  customElements.define(ComponentDetails.tag, ComponentDetails);

  // Tab components
  customElements.define(ComponentsTab.tag, ComponentsTab);
  customElements.define(ModelsTab.tag, ModelsTab);
  customElements.define(EffectsTab.tag, EffectsTab);
  customElements.define(TimelineTab.tag, TimelineTab);
  customElements.define(SubscriptionsTab.tag, SubscriptionsTab);
}
