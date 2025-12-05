/**
 * Inspector
 * Handles element highlighting and inspection in the page
 */

export class Inspector {
  constructor(components) {
    this.components = components;
    this.highlightOverlay = null;
    this.highlightedComponent = null;
    this.scrollHandler = null;
    this.mutationObserver = null;
  }

  createHighlightOverlay() {
    if (this.highlightOverlay) return this.highlightOverlay;

    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = '__veda_devtools_highlight__';
    this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid #0e639c;
      background: rgba(14, 99, 156, 0.1);
      display: none;
    `;

    const label = document.createElement('div');
    label.className = '__veda_devtools_label__';
    label.style.cssText = `
      position: absolute;
      top: -24px;
      left: -2px;
      background: #0e639c;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 2px 2px 0 0;
      white-space: nowrap;
    `;
    this.highlightOverlay.appendChild(label);

    document.body.appendChild(this.highlightOverlay);
    return this.highlightOverlay;
  }

  updateHighlightPosition() {
    if (!this.highlightedComponent || !this.highlightOverlay) return;

    if (!document.body.contains(this.highlightedComponent)) {
      this.hideHighlight();
      return;
    }

    const rect = this.highlightedComponent.getBoundingClientRect();
    this.highlightOverlay.style.top = rect.top + 'px';
    this.highlightOverlay.style.left = rect.left + 'px';
    this.highlightOverlay.style.width = rect.width + 'px';
    this.highlightOverlay.style.height = rect.height + 'px';
  }

  highlightElement(componentId) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    this.highlightedComponent = component;
    const overlay = this.createHighlightOverlay();
    const label = overlay.querySelector('.__veda_devtools_label__');

    this.updateHighlightPosition();
    overlay.style.display = 'block';
    label.textContent = `<${data.tagName}>`;

    if (!this.scrollHandler) {
      this.scrollHandler = () => this.updateHighlightPosition();
      window.addEventListener('scroll', this.scrollHandler, true);
      window.addEventListener('resize', this.scrollHandler);
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    this.mutationObserver = new MutationObserver(() => {
      if (this.highlightedComponent && !document.body.contains(this.highlightedComponent)) {
        this.hideHighlight();
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });

    return true;
  }

  hideHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
    this.highlightedComponent = null;
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  inspectElement(componentId) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    window.$v = component;

    if (!window.__veda_inspect_history__) {
      window.__veda_inspect_history__ = [];
    }

    const history = window.__veda_inspect_history__;
    history.unshift(component);
    if (history.length > 5) history.pop();

    history.forEach((el, i) => {
      window['$v' + i] = el;
    });

    console.log(
      '%c[Veda DevTools]%c Selected component stored in %c$v%c',
      'color: #0e639c; font-weight: bold;',
      'color: inherit;',
      'color: #4ec9b0; font-weight: bold;',
      'color: inherit;'
    );

    return true;
  }

  scrollToElement(componentId) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    component.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  setComponentState(componentId, key, value) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component || !component.state) return false;

    try {
      component.state[key] = value;
      return true;
    } catch (e) {
      console.warn('[Veda DevTools] Failed to set state:', e);
      return false;
    }
  }
}
