/**
 * DevTools Panel Components
 */

export { default as ComponentItem } from './ComponentItem.js';
export { default as ModelItem } from './ModelItem.js';
export { default as EffectItem } from './EffectItem.js';
export { default as TimelineItem } from './TimelineItem.js';
export { default as PropertyValue } from './PropertyValue.js';

// Register all components
import ComponentItem from './ComponentItem.js';
import ModelItem from './ModelItem.js';
import EffectItem from './EffectItem.js';
import TimelineItem from './TimelineItem.js';
import PropertyValue from './PropertyValue.js';

export function registerComponents() {
  customElements.define(ComponentItem.tag, ComponentItem);
  customElements.define(ModelItem.tag, ModelItem);
  customElements.define(EffectItem.tag, EffectItem);
  customElements.define(TimelineItem.tag, TimelineItem);
  customElements.define(PropertyValue.tag, PropertyValue);
}

