/**
 * Loop Component Performance Benchmarks
 * Measures actual performance of Loop reconciliation with different data sizes
 */

import '../setup-dom.js';
import Component, { html } from '../../src/components/Component.js';
import { Loop } from '../../src/components/LoopComponent.js';
import { flushEffects } from '../../src/Effect.js';

export default ({ test, assert }) => {
  const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

  // Helper to measure operation time
  async function measureTime(fn) {
    const start = performance.now();
    await fn();
    await flushEffects();
    await flushAsync();
    const end = performance.now();
    return Math.round((end - start) * 100) / 100; // Round to 2 decimals
  }

  // Helper to generate test items
  function generateItems(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: Math.random()
    }));
  }

  test('Loop Performance - Initial render (100 items)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-100';

      constructor() {
        super();
        this.state.items = generateItems(100);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-100', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const time = await measureTime(async () => {
      const component = document.createElement('test-list-100');
      container.appendChild(component);
      await component.rendered;
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 100, 'Should render 100 items');

    console.log(`✓ Initial render (100 items): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Initial render (500 items)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-500';

      constructor() {
        super();
        this.state.items = generateItems(500);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-500', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const time = await measureTime(async () => {
      const component = document.createElement('test-list-500');
      container.appendChild(component);
      await component.rendered;
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 500, 'Should render 500 items');

    console.log(`✓ Initial render (500 items): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Initial render (1000 items)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-1000';

      constructor() {
        super();
        this.state.items = generateItems(1000);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-1000', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const time = await measureTime(async () => {
      const component = document.createElement('test-list-1000');
      container.appendChild(component);
      await component.rendered;
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 1000, 'Should render 1000 items');

    console.log(`✓ Initial render (1000 items): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Add items (100→200)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-add-100';

      constructor() {
        super();
        this.state.items = generateItems(100);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-add-100', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-add-100');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      // Add 100 more items
      component.state.items = [...component.state.items, ...generateItems(100).map(item => ({
        ...item,
        id: item.id + 100
      }))];
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 200, 'Should have 200 items');

    console.log(`✓ Add items (100→200): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Remove items (500→250)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-remove-500';

      constructor() {
        super();
        this.state.items = generateItems(500);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-remove-500', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-remove-500');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      // Remove half
      component.state.items = component.state.items.slice(0, 250);
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 250, 'Should have 250 items');

    console.log(`✓ Remove items (500→250): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Reorder items (100 reverse)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-reorder-100';

      constructor() {
        super();
        this.state.items = generateItems(100);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-reorder-100', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-reorder-100');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      component.state.items = [...component.state.items].reverse();
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 100, 'Should still have 100 items');

    console.log(`✓ Reorder items (100 reverse): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Reorder items (500 reverse)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-reorder-500';

      constructor() {
        super();
        this.state.items = generateItems(500);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-reorder-500', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-reorder-500');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      component.state.items = [...component.state.items].reverse();
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 500, 'Should still have 500 items');

    console.log(`✓ Reorder items (500 reverse): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Reorder items (1000 reverse)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-reorder-1000';

      constructor() {
        super();
        this.state.items = generateItems(1000);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-reorder-1000', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-reorder-1000');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      component.state.items = [...component.state.items].reverse();
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 1000, 'Should still have 1000 items');

    console.log(`✓ Reorder items (1000 reverse): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Update items (500 change values)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-update-500';

      constructor() {
        super();
        this.state.items = generateItems(500);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-update-500', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-update-500');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      component.state.items = component.state.items.map(item => ({
        ...item,
        name: `Updated ${item.name}`,
        value: Math.random()
      }));
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 500, 'Should still have 500 items');

    console.log(`✓ Update items (500 change values): ${time}ms`);
    container.remove();
  });

  test('Loop Performance - Mixed operations (500 items)', async () => {
    class TestList extends Component(HTMLElement) {
      static tag = 'test-list-mixed-500';

      constructor() {
        super();
        this.state.items = generateItems(500);
      }

      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <div class="item">{item.name}</div>
          </${Loop}>
        `;
      }
    }

    customElements.define('test-list-mixed-500', TestList);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-list-mixed-500');
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const time = await measureTime(async () => {
      // Remove first 100, add 50 new at end, reverse middle 200
      const items = component.state.items;
      const removed = items.slice(100); // Remove first 100
      const middle = removed.slice(0, 200).reverse(); // Reverse first 200 of remaining
      const end = removed.slice(200); // Keep rest
      const newItems = generateItems(50).map(item => ({
        ...item,
        id: item.id + 1000
      }));
      component.state.items = [...middle, ...end, ...newItems];
    });

    const loop = container.querySelector('veda-loop');
    assert(loop.children.length === 450, 'Should have 450 items (500-100+50)');

    console.log(`✓ Mixed operations (500 items): ${time}ms`);
    container.remove();
  });
};

