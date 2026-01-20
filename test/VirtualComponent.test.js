import './setup-dom.js';
import Component, { html } from '../src/components/Component.js';
import VirtualComponent, { Virtual } from '../src/components/VirtualComponent.js';
import { Loop } from '../src/components/LoopComponent.js';
import { flushEffects } from '../src/Effect.js';
import { createTestComponent, clearModelCache } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== BASIC RENDERING ====================

  test('VirtualComponent - renders with basic props', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-basic';

      constructor() {
        super();
        this.state.items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const viewport = component.querySelector('.virtual-viewport');
    assert(viewport !== null, 'Should render viewport');
    assert(viewport.style.height === '200px', 'Viewport should have correct height');

    const spacer = component.querySelector('.virtual-spacer');
    assert(spacer !== null, 'Should render spacer');
    assert(spacer.style.height === '4000px', 'Spacer should have total height (100 * 40)');

    const items = component.querySelectorAll('.item');
    assert(items.length < 100, 'Should not render all items');
    assert(items.length > 0, 'Should render some items');

    cleanup();
  });

  test('VirtualComponent - calculates visible items correctly', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-visible';

      constructor() {
        super();
        this.state.items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40" overscan="3">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item" data-id="{item.id}">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const items = component.querySelectorAll('.item');
    // viewport 400px / item 40px = 10 visible + 3 overscan top + 3 overscan bottom = 16
    // But starting at 0, so: 0-2 (overscan) + 3-12 (visible ~10) + 13-15 (overscan) = ~16
    assert(items.length <= 20, `Should render limited items, got ${items.length}`);
    assert(items.length >= 10, `Should render at least visible items, got ${items.length}`);

    // First item should be Item 0
    const firstItem = items[0];
    assert(firstItem.textContent.includes('Item 0'), 'First item should be Item 0');

    cleanup();
  });

  test('VirtualComponent - updates on scroll', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-scroll';

      constructor() {
        super();
        this.state.items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const viewport = component.querySelector('.virtual-viewport');
    const virtual = component.querySelector('veda-virtual');

    // Simulate scroll to 2000px (item 50)
    viewport.scrollTop = 2000;
    virtual.handleScroll({ target: viewport });
    await flushEffects();

    const items = component.querySelectorAll('.item');
    const itemTexts = Array.from(items).map(i => i.textContent);

    // After scrolling to 2000px, first visible should be around item 47-50
    assert(itemTexts.some(t => t.includes('Item 50')), 'Should show items around scroll position');
    assert(!itemTexts.some(t => t.includes('Item 0')), 'Should not show items from start');

    cleanup();
  });

  test('VirtualComponent - handles empty items', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-empty';

      constructor() {
        super();
        this.state.items = [];
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const viewport = component.querySelector('.virtual-viewport');
    assert(viewport !== null, 'Should render viewport even with empty items');

    const items = component.querySelectorAll('.item');
    assert(items.length === 0, 'Should render no items');

    cleanup();
  });

  test('VirtualComponent - handles items shorter than viewport', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-short';

      constructor() {
        super();
        // Only 5 items, total height 200px < viewport 400px
        this.state.items = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const items = component.querySelectorAll('.item');
    assert(items.length === 5, 'Should render all items when list is short');

    cleanup();
  });

  test('VirtualComponent - reacts to items change', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-reactive';

      constructor() {
        super();
        this.state.items = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    let items = component.querySelectorAll('.item');
    assert(items.length === 10, 'Should render initial items');

    // Add more items
    component.state.items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `New Item ${i}` }));
    await flushEffects();

    items = component.querySelectorAll('.item');
    assert(items.length < 100, 'Should virtualize after adding items');
    assert(items[0].textContent.includes('New Item'), 'Should show new items');

    cleanup();
  });

  test('VirtualComponent - provides virtualStart and virtualEnd', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-indices';

      constructor() {
        super();
        this.state.items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40" overscan="3">
            <div class="info">Start: {this.virtualStart}, End: {this.virtualEnd}</div>
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const virtual = component.querySelector('veda-virtual');

    assert(virtual.virtualStart === 0, 'virtualStart should be 0 at top');
    assert(virtual.virtualEnd > 0, 'virtualEnd should be > 0');
    assert(virtual.virtualEnd <= 20, 'virtualEnd should be reasonable');

    cleanup();
  });

  test('VirtualComponent - transform offset is correct', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-offset';

      constructor() {
        super();
        this.state.items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.name}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const content = component.querySelector('.virtual-content');
    const virtual = component.querySelector('veda-virtual');

    // At scroll 0, offset should be 0
    assert(content.style.transform === 'translateY(0px)', 'Initial offset should be 0');

    // Scroll down
    const viewport = component.querySelector('.virtual-viewport');
    viewport.scrollTop = 2000;
    virtual.handleScroll({ target: viewport });
    await flushEffects();

    // Offset should match virtualStart * itemHeight
    const expectedOffset = virtual.virtualStart * 40;
    assert(
      content.style.transform === `translateY(${expectedOffset}px)`,
      `Offset should be ${expectedOffset}px after scroll`
    );

    cleanup();
  });

  test('VirtualComponent - default values', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-defaults';

      constructor() {
        super();
        this.state.items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      }

      render() {
        // No height, item-height, or overscan specified
        return html`
          <${Virtual} items="{this.state.items}">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.id}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const virtual = component.querySelector('veda-virtual');

    assert(virtual.itemHeight === 40, 'Default itemHeight should be 40');
    assert(virtual.overscan === 3, 'Default overscan should be 3');
    // viewportHeight defaults to 400 or measured

    cleanup();
  });

  test('VirtualComponent - cleanup on disconnect', async () => {
    class TestApp extends Component(HTMLElement) {
      static tag = 'test-virtual-cleanup';

      constructor() {
        super();
        this.state.items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="400" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="item">{item.id}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestApp);

    const virtual = component.querySelector('veda-virtual');
    assert(virtual !== null, 'Virtual should exist');

    // Disconnect
    cleanup();

    // Should not throw on subsequent operations
    assert(true, 'Cleanup should not throw');
  });

};
