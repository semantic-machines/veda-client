import ValueComponent from './ValueComponent.js';

export default function PropertyComponent (Class = HTMLElement) {
  return class PropertyComponentClass extends ValueComponent(Class) {
    static observedAttributes = ['lang'];

    attributeChangedCallback (name, oldValue, newValue) {
      if (oldValue && oldValue !== newValue) {
        super.render();
      }
    }

    renderValue (value, container, index) {
      if (typeof value === 'string') {
        const lang = document.documentElement.lang;
        this.setAttribute('lang', lang);
        const langSuffix = `^^${lang.toUpperCase()}`;

        if (value.endsWith(langSuffix)) {
          value = value.slice(0, -langSuffix.length);
        } else if (value.includes('^^') && value.length - value.lastIndexOf('^^') === 4) {
          return;
        }
      }

      const hasCustomContent = this.template?.trim();
      if (!hasCustomContent) {
        return super.renderValue(value, container, index);
      }

      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content.cloneNode(true);

      const slot = fragment.querySelector('slot');
      // Sanitize to prevent XSS via !{ } in data
      const valueText = value.toString().replace(/!\{/g, '!\u200B{');

      if (slot) {
        const textNode = document.createTextNode(valueText);
        textNode.__vedaProcessed = true; // Mark as processed to skip re-parsing
        slot.replaceWith(textNode);
      } else {
        const node = fragment.firstElementChild;
        if (node) {
          node.textContent = valueText;
          // Mark all text nodes as processed
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let textNode;
          while ((textNode = walker.nextNode())) {
            textNode.__vedaProcessed = true;
          }
        }
      }

      this._process(fragment);
      container.appendChild(fragment);
    }
  };
}
