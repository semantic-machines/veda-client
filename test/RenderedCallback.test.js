import '../test/setup-dom.js';
import Component, { html } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';

export default ({ test, assert }) => {

  const flush = () => new Promise(resolve => queueMicrotask(resolve));

  // =====================================================================
  // renderedCallback timing: must fire AFTER all children are rendered
  // =====================================================================

  test('renderedCallback - fires after simple child components render', async () => {
    const events = [];

    class ChildComponent extends Component(HTMLElement) {
      static tag = 'rc-child-simple';
      render() {
        return html`<span>child</span>`;
      }
      renderedCallback() {
        events.push('child:rendered');
      }
    }
    customElements.define('rc-child-simple', ChildComponent);

    class ParentComponent extends Component(HTMLElement) {
      static tag = 'rc-parent-simple';
      render() {
        return html`<rc-child-simple></rc-child-simple>`;
      }
      renderedCallback() {
        events.push('parent:rendered');
      }
    }
    customElements.define('rc-parent-simple', ParentComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('rc-parent-simple');
    container.appendChild(parent);

    await parent.rendered;
    await flushEffects();

    assert(events.includes('child:rendered'), 'Child renderedCallback should fire');
    assert(events.includes('parent:rendered'), 'Parent renderedCallback should fire');

    const childIdx = events.indexOf('child:rendered');
    const parentIdx = events.indexOf('parent:rendered');
    assert(childIdx < parentIdx,
      `Child renderedCallback (pos ${childIdx}) must fire BEFORE parent (pos ${parentIdx}). Order: ${events.join(', ')}`);

    container.remove();
  });

  test('renderedCallback - fires after veda-loop children render', async () => {
    const events = [];

    class LoopChild extends Component(HTMLElement) {
      static tag = 'rc-loop-child';
      render() {
        return html`<span>{this.state.name}</span>`;
      }
      renderedCallback() {
        events.push(`loop-child:rendered:${this.state.name}`);
      }
    }
    customElements.define('rc-loop-child', LoopChild);

    class ParentWithLoop extends Component(HTMLElement) {
      static tag = 'rc-parent-loop';
      constructor() {
        super();
        this.state.items = [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
          { id: 3, name: 'C' },
        ];
      }
      render() {
        return html`
          <veda-loop items="{this.state.items}" as="item" key="id">
            <rc-loop-child :name="{item.name}"></rc-loop-child>
          </veda-loop>
        `;
      }
      renderedCallback() {
        events.push('parent:rendered');
      }
    }
    customElements.define('rc-parent-loop', ParentWithLoop);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('rc-parent-loop');
    container.appendChild(parent);

    await parent.rendered;
    await flushEffects();
    await flush();
    await flushEffects();

    const parentIdx = events.indexOf('parent:rendered');
    const childIndices = events
      .map((e, i) => e.startsWith('loop-child:rendered') ? i : -1)
      .filter(i => i >= 0);

    assert(childIndices.length === 3,
      `All 3 loop children should have rendered, got ${childIndices.length}. Events: ${events.join(', ')}`);

    const allChildrenBeforeParent = childIndices.every(i => i < parentIdx);
    assert(allChildrenBeforeParent,
      `All loop children must render BEFORE parent renderedCallback. ` +
      `Parent at pos ${parentIdx}, children at [${childIndices}]. Events: ${events.join(', ')}`);

    container.remove();
  });

  test('renderedCallback - fires after veda-if child renders', async () => {
    const events = [];

    class IfChild extends Component(HTMLElement) {
      static tag = 'rc-if-child';
      render() {
        return html`<span>conditional</span>`;
      }
      renderedCallback() {
        events.push('if-child:rendered');
      }
    }
    customElements.define('rc-if-child', IfChild);

    class ParentWithIf extends Component(HTMLElement) {
      static tag = 'rc-parent-if';
      constructor() {
        super();
        this.state.show = true;
      }
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <rc-if-child></rc-if-child>
          </veda-if>
        `;
      }
      renderedCallback() {
        events.push('parent:rendered');
      }
    }
    customElements.define('rc-parent-if', ParentWithIf);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('rc-parent-if');
    container.appendChild(parent);

    await parent.rendered;
    await flushEffects();
    await flush();
    await flushEffects();

    const parentIdx = events.indexOf('parent:rendered');
    const childIdx = events.indexOf('if-child:rendered');

    assert(childIdx >= 0,
      `If-child renderedCallback should fire. Events: ${events.join(', ')}`);
    assert(childIdx < parentIdx,
      `If-child renderedCallback (pos ${childIdx}) must fire BEFORE parent (pos ${parentIdx}). Events: ${events.join(', ')}`);

    container.remove();
  });

  test('renderedCallback - nested loop inside if fires in correct order', async () => {
    const events = [];

    class NestedChild extends Component(HTMLElement) {
      static tag = 'rc-nested-child';
      render() {
        return html`<span>{this.state.label}</span>`;
      }
      renderedCallback() {
        events.push(`nested-child:rendered:${this.state.label}`);
      }
    }
    customElements.define('rc-nested-child', NestedChild);

    class ParentNested extends Component(HTMLElement) {
      static tag = 'rc-parent-nested';
      constructor() {
        super();
        this.state.show = true;
        this.state.items = [{ id: 1, label: 'X' }, { id: 2, label: 'Y' }];
      }
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <veda-loop items="{this.state.items}" as="item" key="id">
              <rc-nested-child :label="{item.label}"></rc-nested-child>
            </veda-loop>
          </veda-if>
        `;
      }
      renderedCallback() {
        events.push('parent:rendered');
      }
    }
    customElements.define('rc-parent-nested', ParentNested);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('rc-parent-nested');
    container.appendChild(parent);

    await parent.rendered;
    await flushEffects();
    await flush();
    await flushEffects();
    await flush();
    await flushEffects();

    const parentIdx = events.indexOf('parent:rendered');
    const childIndices = events
      .map((e, i) => e.startsWith('nested-child:rendered') ? i : -1)
      .filter(i => i >= 0);

    assert(childIndices.length === 2,
      `Both nested children should render. Got ${childIndices.length}. Events: ${events.join(', ')}`);

    const allBeforeParent = childIndices.every(i => i < parentIdx);
    assert(allBeforeParent,
      `Nested children must render BEFORE parent renderedCallback. ` +
      `Parent at ${parentIdx}, children at [${childIndices}]. Events: ${events.join(', ')}`);

    container.remove();
  });

  test('rendered promise resolves after loop children DOM is ready', async () => {
    class DomCheckParent extends Component(HTMLElement) {
      static tag = 'rc-dom-check';
      constructor() {
        super();
        this.state.items = [
          { id: 1, text: 'first' },
          { id: 2, text: 'second' },
        ];
        this.childCountAtRendered = -1;
      }
      render() {
        return html`
          <veda-loop items="{this.state.items}" as="item" key="id">
            <div class="loop-item">{item.text}</div>
          </veda-loop>
        `;
      }
      renderedCallback() {
        const loop = this.querySelector('veda-loop');
        this.childCountAtRendered = loop ? loop.children.length : 0;
      }
    }
    customElements.define('rc-dom-check', DomCheckParent);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('rc-dom-check');
    container.appendChild(parent);

    await parent.rendered;
    await flushEffects();
    await flush();
    await flushEffects();

    assert(parent.childCountAtRendered === 2,
      `At renderedCallback time, loop should have 2 children, got ${parent.childCountAtRendered}`);

    container.remove();
  });

};
