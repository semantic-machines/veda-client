/**
 * Inspector Module
 * Handles element highlighting and inspection in the page
 */

export function createInspector(components) {
  let highlightOverlay = null;
  let highlightedComponent = null;
  let scrollHandler = null;
  let mutationObserver = null;

  function createHighlightOverlay() {
    if (highlightOverlay) return highlightOverlay;

    highlightOverlay = document.createElement('div');
    highlightOverlay.id = '__veda_devtools_highlight__';
    highlightOverlay.style.cssText = `
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
    highlightOverlay.appendChild(label);

    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }

  function updateHighlightPosition() {
    if (!highlightedComponent || !highlightOverlay) return;

    if (!document.body.contains(highlightedComponent)) {
      hideHighlight();
      return;
    }

    const rect = highlightedComponent.getBoundingClientRect();
    highlightOverlay.style.top = rect.top + 'px';
    highlightOverlay.style.left = rect.left + 'px';
    highlightOverlay.style.width = rect.width + 'px';
    highlightOverlay.style.height = rect.height + 'px';
  }

  function highlightElement(componentId) {
    const data = components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    highlightedComponent = component;
    const overlay = createHighlightOverlay();
    const label = overlay.querySelector('.__veda_devtools_label__');

    updateHighlightPosition();
    overlay.style.display = 'block';
    label.textContent = `<${data.tagName}>`;

    if (!scrollHandler) {
      scrollHandler = () => updateHighlightPosition();
      window.addEventListener('scroll', scrollHandler, true);
      window.addEventListener('resize', scrollHandler);
    }

    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    mutationObserver = new MutationObserver(() => {
      if (highlightedComponent && !document.body.contains(highlightedComponent)) {
        hideHighlight();
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return true;
  }

  function hideHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
    highlightedComponent = null;
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  function inspectElement(componentId) {
    const data = components.get(componentId);
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

  function scrollToElement(componentId) {
    const data = components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    component.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  function setComponentState(componentId, key, value) {
    const data = components.get(componentId);
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

  return {
    highlightElement,
    hideHighlight,
    inspectElement,
    scrollToElement,
    setComponentState
  };
}

