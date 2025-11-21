import './setup-dom.js';
import Component, { html } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';

/**
 * Tests for watch() reference equality behavior
 * See REACTIVITY.md for documentation
 */
export default ({ test, assert }) => {
  test('Component - watch() uses reference equality (documented behavior)', async () => {
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-watch-ref-equality';

      constructor() {
        super();
        this.state.items = [1, 2, 3];
        this.state.user = { name: 'Alice' };
        this.watchCallCount = 0;
      }
    }

    customElements.define('test-watch-ref-equality', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-watch-ref-equality');
    container.appendChild(component);

    await component.rendered;

    // Watch array - should only trigger on reference change
    component.watch(
      () => component.state.items,
      () => component.watchCallCount++
    );

    await flushEffects();
    assert(component.watchCallCount === 0, 'Initial: no callback on setup');

    // ❌ Mutation - won't trigger (documented limitation)
    component.state.items.push(4);
    await flushEffects();
    assert(component.watchCallCount === 0, 'push() does NOT trigger watch callback');
    assert(component.state.items.length === 4, 'Array is mutated, but watch not triggered');

    // ✅ Reassignment - triggers
    component.state.items = [...component.state.items, 5];
    await flushEffects();
    assert(component.watchCallCount === 1, 'Reassignment DOES trigger watch callback');

    container.remove();
  });

  test('Component - watch() alternative: watch length instead of array', async () => {
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-watch-length';

      constructor() {
        super();
        this.state.items = [1, 2, 3];
        this.lengthCallCount = 0;
      }
    }

    customElements.define('test-watch-length', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-watch-length');
    container.appendChild(component);

    await component.rendered;

    // ✅ Watch length instead of array
    component.watch(
      () => component.state.items.length,
      () => component.lengthCallCount++
    );

    await flushEffects();

    component.state.items.push(4);
    await flushEffects();
    assert(component.lengthCallCount === 1, 'Watching length DOES catch mutations');

    component.state.items.pop();
    await flushEffects();
    assert(component.lengthCallCount === 2, 'pop() also triggers length watch');

    container.remove();
  });

  test('Component - watch() with objects: only reference changes trigger', async () => {
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-watch-object';

      constructor() {
        super();
        this.state.user = { name: 'Alice', age: 30 };
        this.watchCallCount = 0;
      }
    }

    customElements.define('test-watch-object', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-watch-object');
    container.appendChild(component);

    await component.rendered;

    // Watch object
    component.watch(
      () => component.state.user,
      () => component.watchCallCount++
    );

    await flushEffects();

    // ❌ Property mutation - won't trigger
    component.state.user.name = 'Bob';
    await flushEffects();
    assert(component.watchCallCount === 0, 'Property mutation does NOT trigger');

    // ✅ Object reassignment - triggers
    component.state.user = { ...component.state.user, age: 31 };
    await flushEffects();
    assert(component.watchCallCount === 1, 'Object reassignment DOES trigger');

    container.remove();
  });

  test('Component - watch() workaround: watch specific property', async () => {
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-watch-property';

      constructor() {
        super();
        this.state.user = { name: 'Alice', age: 30 };
        this.nameCallCount = 0;
      }
    }

    customElements.define('test-watch-property', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-watch-property');
    container.appendChild(component);

    await component.rendered;

    // ✅ Watch specific property instead of object
    component.watch(
      () => component.state.user.name,
      () => component.nameCallCount++
    );

    await flushEffects();

    // ✅ Property change triggers
    component.state.user.name = 'Bob';
    await flushEffects();
    assert(component.nameCallCount === 1, 'Property watch DOES trigger on mutation');

    // Age change doesn't trigger (not watched)
    component.state.user.age = 31;
    await flushEffects();
    assert(component.nameCallCount === 1, 'Other property changes do not trigger');

    container.remove();
  });
};

