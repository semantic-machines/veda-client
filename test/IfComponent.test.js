import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';
import IfComponentFunc, { If } from '../src/components/IfComponent.js';

export default ({ test, assert }) => {

  test('If component - module exports correctly', () => {
    // Verify the IfComponent function is exported
    assert.ok(IfComponentFunc, 'IfComponent function should be exported as default');
    assert.ok(typeof IfComponentFunc === 'function', 'IfComponentFunc should be a function');

    // Verify If is exported
    assert.ok(If, 'If should be exported');
  });

  test('If component - can be instantiated with mock', () => {
    // Create a minimal mock base class for testing
    class MockElement {
      constructor() {
        this.childNodes = [];
      }
      querySelector() { return null; }
      querySelectorAll() { return []; }
      appendChild(node) {
        this.childNodes.push(node);
        return node;
      }
      removeChild(node) {
        const index = this.childNodes.indexOf(node);
        if (index > -1) this.childNodes.splice(index, 1);
      }
      getAttribute() { return null; }
      setAttribute() {}
      remove() {}
    }

    // Create If component class with mock
    const IfClass = IfComponentFunc(MockElement);
    const instance = new IfClass();

    // Verify critical methods exist
    assert.ok(typeof instance.connectedCallback === 'function', 'connectedCallback should exist');
    assert.ok(typeof instance.disconnectedCallback === 'function', 'disconnectedCallback should exist');
    assert.ok(typeof instance.render === 'function', 'render should exist');
  });

  test('Reactive effects work correctly (If component depends on this)', async () => {
    // Test that effects work properly (this is what If component relies on)
    const state = reactive({ count: 0 });
    let runCount = 0;

    const stopEffect = effect(() => {
      const _ = state.count;
      runCount++;
    });

    await flushEffects();
    assert.equal(runCount, 1, 'Effect should run once initially');

    state.count++;
    await flushEffects();
    assert.equal(runCount, 2, 'Effect should run again on change');

    // Stop the effect
    stopEffect();

    state.count++;
    await flushEffects();
    assert.equal(runCount, 2, 'Effect should not run after being stopped');
  });

  test('Reactive state changes are properly tracked', async () => {
    const state = reactive({ visible: true });
    let changes = [];

    effect(() => {
      changes.push(state.visible);
    });

    await flushEffects();
    assert.equal(changes.length, 1, 'Should have one initial change');
    assert.equal(changes[0], true, 'Initial value should be true');

    state.visible = false;
    await flushEffects();
    assert.equal(changes.length, 2, 'Should have two changes');
    assert.equal(changes[1], false, 'Second value should be false');
  });

};
