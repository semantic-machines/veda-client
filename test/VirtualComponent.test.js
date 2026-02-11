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

  // ==================== SEMANTIC HTML INSIDE VIRTUAL ====================

  test('VirtualComponent - semantic ul with items renders list', async () => {
    class SemanticUlVirtual extends Component(HTMLElement) {
      static tag = 'test-virtual-semantic-ul';

      constructor() {
        super();
        this.state.items = Array.from({ length: 50 }, (_, i) => ({ id: i, label: `Entry ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <ul items="{this.visibleItems}" as="entry" key="id">
              <li class="semantic-item">{entry.label}</li>
            </ul>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(SemanticUlVirtual);

    const viewport = component.querySelector('.virtual-viewport');
    assert(viewport !== null, 'Should render viewport');

    const ul = component.querySelector('ul');
    assert(ul !== null, 'Should have a <ul> element');

    const items = ul.querySelectorAll('.semantic-item');
    assert(items.length > 0, 'Should render list items via semantic loop');
    assert(items[0].textContent === 'Entry 0', 'First item should have correct text');

    cleanup();
  });

  test('VirtualComponent - semantic tbody with items renders table rows', async () => {
    class SemanticTbodyVirtual extends Component(HTMLElement) {
      static tag = 'test-virtual-semantic-tbody';

      constructor() {
        super();
        this.state.items = Array.from({ length: 30 }, (_, i) => ({
          id: i, name: `User ${i}`, email: `user${i}@test.com`
        }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <table>
              <tbody items="{this.visibleItems}" as="user" key="id">
                <tr>
                  <td class="name">{user.name}</td>
                  <td class="email">{user.email}</td>
                </tr>
              </tbody>
            </table>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(SemanticTbodyVirtual);

    // In table mode, spacer tbodies are added; find the content tbody (has 'is' attr)
    const contentBody = component.querySelector('tbody[is]');
    assert(contentBody !== null, 'Should have a content <tbody> element');

    const rows = contentBody.querySelectorAll('tr');
    assert(rows.length > 0, 'Should render table rows via semantic loop');

    const names = contentBody.querySelectorAll('.name');
    assert(names[0].textContent === 'User 0', 'First row name should be correct');

    const emails = contentBody.querySelectorAll('.email');
    assert(emails[0].textContent === 'user0@test.com', 'First row email should be correct');

    cleanup();
  });

  test('VirtualComponent - semantic div with condition accesses parent state', async () => {
    class SemanticIfVirtual extends Component(HTMLElement) {
      static tag = 'test-virtual-semantic-if';

      constructor() {
        super();
        this.state.items = [{ id: 1, name: 'Only item' }];
        this.state.showInfo = true;
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="row">
                <span class="name">{item.name}</span>
              </div>
            </${Loop}>
            <div condition="{this.state.showInfo}" class="info-panel">
              <span class="info-text">Extra info</span>
            </div>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(SemanticIfVirtual);

    // Semantic If should access the user component's state via merged eval context
    const infoPanel = component.querySelector('.info-panel');
    assert(infoPanel !== null, 'Info panel should exist');
    assert(infoPanel.querySelector('.info-text') !== null, 'Info content should be visible');

    cleanup();
  });

  // ==================== TABLE MODE ====================

  test('VirtualComponent - table mode: auto-detects table and creates spacer tbodies', async () => {
    class TableModeBasic extends Component(HTMLElement) {
      static tag = 'test-virtual-table-mode';

      constructor() {
        super();
        this.state.items = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Row ${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th></tr>
              </thead>
              <tbody items="{this.visibleItems}" as="row" key="id">
                <tr>
                  <td class="id">{row.id}</td>
                  <td class="name">{row.name}</td>
                </tr>
              </tbody>
            </table>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TableModeBasic);

    // Should NOT have the list-mode spacer/content divs
    const spacerDiv = component.querySelector('.virtual-spacer');
    assert(spacerDiv === null, 'Should not have list-mode spacer div');
    const contentDiv = component.querySelector('.virtual-content');
    assert(contentDiv === null, 'Should not have list-mode content div');

    // Should have the viewport
    const viewport = component.querySelector('.virtual-viewport');
    assert(viewport !== null, 'Should have viewport');

    // Should have a single <table> inside viewport
    const table = viewport.querySelector('table');
    assert(table !== null, 'Should have table inside viewport');

    // Should have spacer tbodies
    const spacerTop = table.querySelector('.virtual-spacer-top');
    assert(spacerTop !== null, 'Should have spacer-top tbody');
    const spacerBottom = table.querySelector('.virtual-spacer-bottom');
    assert(spacerBottom !== null, 'Should have spacer-bottom tbody');

    // Should have thead with sticky style
    const thead = table.querySelector('thead');
    assert(thead !== null, 'Should have thead');
    assert(thead.style.position === 'sticky', 'thead should be sticky');

    // Should render content rows
    const contentBody = table.querySelector('tbody[is]');
    assert(contentBody !== null, 'Should have content tbody');
    const rows = contentBody.querySelectorAll('tr');
    assert(rows.length > 0, 'Should render rows');
    assert(component.querySelector('.name').textContent === 'Row 0', 'First row should have correct content');

    cleanup();
  });

  test('VirtualComponent - table mode: semantic tfoot with condition accesses parent state', async () => {
    class TableModeTfoot extends Component(HTMLElement) {
      static tag = 'test-virtual-table-tfoot';

      constructor() {
        super();
        this.state.items = [{ id: 1, name: 'Item' }];
        this.state.showFooter = true;
      }

      get summary() {
        return 'Total: 1 item';
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <table>
              <tbody items="{this.visibleItems}" as="row" key="id">
                <tr><td>{row.name}</td></tr>
              </tbody>
              <tfoot condition="{this.state.showFooter}">
                <tr><td class="footer-cell">{this.summary}</td></tr>
              </tfoot>
            </table>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TableModeTfoot);

    // tfoot should be rendered (condition is true)
    const tfoot = component.querySelector('tfoot');
    assert(tfoot !== null, 'tfoot should exist');
    assert(tfoot.style.position === 'sticky', 'tfoot should be sticky');

    // tfoot content should access parent state via merged eval context
    const footerCell = component.querySelector('.footer-cell');
    assert(footerCell !== null, 'Footer cell should exist');
    assert(footerCell.textContent === 'Total: 1 item', 'Footer should show parent computed property');

    cleanup();
  });

  test('VirtualComponent - table mode: spacer heights reflect scroll position', async () => {
    class TableModeSpacer extends Component(HTMLElement) {
      static tag = 'test-virtual-table-spacer';

      constructor() {
        super();
        this.state.items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `R${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <table>
              <tbody items="{this.visibleItems}" as="row" key="id">
                <tr><td>{row.name}</td></tr>
              </tbody>
            </table>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TableModeSpacer);

    const table = component.querySelector('table');
    const spacerTop = table.querySelector('.virtual-spacer-top');
    const spacerBottom = table.querySelector('.virtual-spacer-bottom');

    assert(spacerTop !== null, 'Spacer top should exist');
    assert(spacerBottom !== null, 'Spacer bottom should exist');

    // At initial scroll position (0), top spacer should be 0
    // Total height = 100 * 40 = 4000px
    // Bottom spacer should account for remaining height
    const topHeight = parseInt(spacerTop.style.height) || 0;
    assert(topHeight === 0, 'Top spacer should be 0 at initial scroll');

    const bottomHeight = parseInt(spacerBottom.style.height) || 0;
    assert(bottomHeight > 0, 'Bottom spacer should have positive height');

    cleanup();
  });

  test('VirtualComponent - list mode still works (no table child)', async () => {
    class ListModeCheck extends Component(HTMLElement) {
      static tag = 'test-virtual-list-mode-check';

      constructor() {
        super();
        this.state.items = Array.from({ length: 20 }, (_, i) => ({ id: i, label: `L${i}` }));
      }

      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="40">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="list-item">{item.label}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(ListModeCheck);

    // Should use list mode (spacer div + content div)
    const spacerDiv = component.querySelector('.virtual-spacer');
    assert(spacerDiv !== null, 'List mode should have spacer div');
    const contentDiv = component.querySelector('.virtual-content');
    assert(contentDiv !== null, 'List mode should have content div');

    // Should NOT have table mode elements
    const spacerTop = component.querySelector('.virtual-spacer-top');
    assert(spacerTop === null, 'List mode should not have spacer-top tbody');

    // Should render items
    const items = component.querySelectorAll('.list-item');
    assert(items.length > 0, 'Should render list items');

    cleanup();
  });

};
