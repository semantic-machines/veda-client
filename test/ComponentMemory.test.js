import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {If} from '../src/components/IfComponent.js';
import {Loop} from '../src/components/LoopComponent.js';
import {Slot} from '../src/components/SlotComponent.js';
import {Place} from '../src/components/PlaceComponent.js';
import {Virtual} from '../src/components/VirtualComponent.js';
import {flushEffects} from '../src/Effect.js';
import Model from '../src/Model.js';
import {createTestComponent} from './helpers.js';

function defineEl(Class) {
  Class.tag = `test-mem-${Math.random().toString(36).slice(2, 8)}`;
  customElements.define(Class.tag, Class);
  return Class;
}

export default ({test, assert}) => {

  test('Memory - repeated update() does not grow event listeners', async () => {
    class App extends Component(HTMLElement) {
      ping() {}
      render() {
        return html`<button class="mem-update-btn" onclick="{this.ping}">Go</button>`;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const firstCount = component._getEventListenersCount();
    assert(firstCount === 1, 'Initial render should register one listener');

    const firstBtn = component.querySelector('.mem-update-btn');
    const weakBtn = new WeakRef(firstBtn);

    for (let i = 0; i < 8; i++) {
      await component.update();
    }

    assert(component._getEventListenersCount() === firstCount, 'Listener count should stay stable across update()');
    assert(component.querySelector('.mem-update-btn') !== firstBtn, 'update() should replace the previous button');
    assert(weakBtn.deref() !== firstBtn || !firstBtn.isConnected, 'Previous button should be detached');
    component.querySelector('.mem-update-btn').click();
    cleanup();
  });

  test('Memory - If toggle does not accumulate listeners and drops leftover placeholder', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = true;
        this.state.name = 'Ada';
      }
      ping() {}
      render() {
        return html`
          <${If} condition="{this.state.open}">
            <button class="mem-if-btn" onclick="{this.ping}">Go</button>
            <input class="mem-if-input" bind="{this.state.name}">
          </${If}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const ifEl = component.querySelector('veda-if');
    await flushEffects();

    const shownListeners = ifEl._getEventListenersCount();
    assert(shownListeners === 0, 'If should extract content listeners from the shared list');
    assert(![...ifEl.childNodes].some(node => node.nodeType === Node.COMMENT_NODE),
      'Shown If should not keep a leftover placeholder comment');

    for (let i = 0; i < 20; i++) {
      component.state.open = false;
      await flushEffects();
      assert(ifEl._getEventListenersCount() === 0, 'Hidden If should not keep content listeners');
      component.state.open = true;
      await flushEffects();
    }

    assert(ifEl._getEventListenersCount() === shownListeners, 'If listener list should not grow after toggles');
    assert(ifEl.querySelector('.mem-if-btn'), 'Content should render after the last show');
    assert(![...ifEl.childNodes].some(node => node.nodeType === Node.COMMENT_NODE),
      'Placeholder comment should be removed when content is shown again');
    cleanup();
  });

  test('Memory - Loop item churn does not accumulate listeners', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.items = [
          {id: 1, label: 'A'},
          {id: 2, label: 'B'},
          {id: 3, label: 'C'},
        ];
      }
      ping() {}
      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <button class="mem-loop-btn" onclick="{this.ping}">{item.label}</button>
          </${Loop}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const loop = component.querySelector('veda-loop');
    await flushEffects();

    assert(loop._getEventListenersCount() === 0, 'Loop should extract per-item listeners');
    assert(loop.querySelectorAll('.mem-loop-btn').length === 3, 'All items should render');

    component.state.items = [{id: 2, label: 'B'}];
    await flushEffects();

    assert(loop._getEventListenersCount() === 0, 'Removing items should not leave listeners on Loop');
    assert(loop.querySelectorAll('.mem-loop-btn').length === 1, 'Only the remaining item should stay');
    loop.querySelector('.mem-loop-btn').click();
    cleanup();
  });

  test('Memory - Slot remount does not grow listeners', async () => {
    const Host = defineEl(class extends Component(HTMLElement) {
      ping() {}
      render() {
        return html`
          <${Slot} name="trigger">
            <button class="mem-slot-fallback" onclick="{this.ping}">Default</button>
          </${Slot}>
        `;
      }
    });

    class App extends Component(HTMLElement) {
      ping() {}
      render() {
        return html`
          <${Host}>
            <button slot="trigger" class="mem-slot-assigned" onclick="{this.ping}">Assigned</button>
          </${Host}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const host = component.querySelector(Host.tag);
    await host.rendered;
    const slot = host.querySelector('veda-slot');
    const firstCount = slot._getEventListenersCount();
    assert(firstCount === 1, 'Projected slot content should register one listener');

    for (let i = 0; i < 6; i++) {
      await slot.update();
    }

    assert(slot._getEventListenersCount() === firstCount, 'Slot remount should not grow listeners');
    assert(slot.querySelector('.mem-slot-assigned'), 'Projected content should remain after remount');
    cleanup();
  });

  test('Memory - Place open/close does not grow listeners and clears author refs', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = true;
      }
      ping() {}
      render() {
        return html`
          <${If} condition="{this.state.open}">
            <${Place} to="body">
              <div class="mem-place-overlay">
                <button class="mem-place-btn" ref="overlayBtn" onclick="{this.ping}">Close</button>
              </div>
            </${Place}>
          </${If}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    await flushEffects();
    const place = component.querySelector('veda-place');
    await place.rendered;

    const overlayBtn = document.body.querySelector('.mem-place-btn');
    assert(overlayBtn, 'Placed overlay should be on document.body');
    assert(component.refs.overlayBtn === overlayBtn, 'Author ref should point at the moved node');
    const firstCount = place._getEventListenersCount();

    await place.update();
    assert(place._getEventListenersCount() === firstCount, 'Place remount should not grow listeners');
    assert(component.refs.overlayBtn, 'Author ref should be rewritten after Place update');

    component.state.open = false;
    await flushEffects();
    assert(document.body.querySelector('.mem-place-overlay') === null, 'Overlay should be removed');
    assert(component.refs.overlayBtn === undefined, 'Author ref should be cleared after Place disconnect');
    cleanup();
  });

  test('Memory - Property custom template remount does not grow listeners or effects', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        const model = new Model();
        model['v-s:title'] = ['One^^EN'];
        this.state.model = model;
      }
      ping() {}
      render() {
        return html`
          <span property="v-s:title">
            <button class="mem-prop-btn" onclick="{this.ping}"></button>
          </span>
        `;
      }
    }

    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'en';
    const {component, cleanup} = await createTestComponent(App);
    const prop = component.querySelector('[is$="property-component"]');
    assert(prop, 'Property component should mount');

    const listeners = prop._getEventListenersCount();
    const effects = prop._getRenderEffectsCount();
    assert(listeners >= 1, 'Custom property template should register a listener');

    for (let i = 0; i < 6; i++) {
      prop.state.model['v-s:title'] = [`Value ${i}^^EN`];
      prop.render();
    }

    assert(prop._getEventListenersCount() === listeners, 'Property re-render should not grow listeners');
    assert(prop._getRenderEffectsCount() === effects, 'Property re-render should not grow render effects');
    cleanup();
    document.documentElement.lang = originalLang;
  });

  test('Memory - If hide clears refs that pointed at hidden content', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = true;
      }
      render() {
        return html`
          <${If} condition="{this.state.open}">
            <button class="mem-if-ref" ref="hiddenBtn">Hidden</button>
          </${If}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const ifEl = component.querySelector('veda-if');
    await flushEffects();

    const button = ifEl.querySelector('.mem-if-ref');
    assert(ifEl.refs.hiddenBtn === button, 'If should store the content ref');

    component.state.open = false;
    await flushEffects();
    assert(ifEl.refs.hiddenBtn === undefined, 'Hidden If content should drop its refs');
    cleanup();
  });

  test('Memory - Virtual reconnect keeps a single viewport', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.items = Array.from({length: 20}, (_, i) => ({id: i}));
      }
      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="200" item-height="20">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div class="mem-virtual-item">{item.id}</div>
            </${Loop}>
          </${Virtual}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const virtual = component.querySelector('veda-virtual');
    assert(virtual.querySelectorAll('.virtual-viewport').length === 1, 'Initial Virtual should have one viewport');

    const parent = virtual.parentNode;
    virtual.remove();
    parent.appendChild(virtual);
    await flushEffects();

    assert(virtual.querySelectorAll('.virtual-viewport').length === 1,
      'Reconnect should not stack another viewport');
    cleanup();
  });

  test('Memory - nested reorder does not multiply effects, listeners, or DOM', async () => {
    await exerciseNested(defineNestedApp(), assert);
  });
};

function defineNestedApp () {
  let titleReads = 0;
  let clicks = 0;
  const nodesA = [{ name: 'n1' }, { name: 'n2' }];
  const nodesB = [{ name: 'n3' }];
  const row = (key, nodes) => ({
    key,
    nodes,
    get title () {
      titleReads++;
      return key;
    },
  });

  class App extends Component(HTMLElement) {
    constructor () {
      super();
      this.state.systems = [row('a', nodesA), row('b', nodesB)];
    }

    ping () { clicks++; }

    render () {
      return html`
        <div items="{this.state.systems}" as="system" key="key">
          <section class="system">
            <h4 class="title">{system.title}</h4>
            <div class="nodes" items="{system.nodes}" as="node" key="name">
              <button type="button" class="node" onclick="{this.ping}">{node.name}</button>
            </div>
          </section>
        </div>
      `;
    }
  }

  return {
    App,
    nodesA,
    nodesB,
    row,
    reads: () => titleReads,
    setReads: (value) => { titleReads = value; },
    clicks: () => clicks,
    resetClicks: () => { clicks = 0; },
  };
}

async function exerciseNested (kit, assert) {
  const { component, cleanup } = await createTestComponent(kit.App);
  await flushEffects();

  const loops = () => component.querySelectorAll('[is$="loop-component"]').length;
  const buttons = () => component.querySelectorAll('.node');
  assert.equal(loops(), 3, 'One list per level: groups plus two node lists');
  assert.equal(buttons().length, 3, 'Three node buttons');
  for (const loop of component.querySelectorAll('[is$="loop-component"]')) {
    assert.equal(loop._getEventListenersCount(), 0, 'Item listeners stay on the item, not the list');
  }

  const readsPerReorder = [];
  for (let i = 0; i < 20; i++) {
    kit.setReads(0);
    const swapped = i % 2 === 0;
    component.state.systems = swapped
      ? [kit.row('b', kit.nodesB), kit.row('a', kit.nodesA)]
      : [kit.row('a', kit.nodesA), kit.row('b', kit.nodesB)];
    await flushEffects();
    readsPerReorder.push(kit.reads());
  }

  assert.deepEqual(readsPerReorder, Array(20).fill(2), 'Each reorder should run each parent row effect once');
  assert.equal(loops(), 3, 'Reorder should not create extra lists');
  assert.equal(buttons().length, 3, 'Reorder should not create extra buttons');
  assert.equal(component.querySelectorAll('.system').length, 2, 'Reorder should not create extra rows');

  kit.resetClicks();
  buttons()[0].click();
  assert.equal(kit.clicks(), 1, 'A moved button should keep a single click listener');

  component.state.systems = [kit.row('a', kit.nodesA)];
  await flushEffects();
  assert.equal(component.querySelectorAll('.node').length, 2, 'Removed system should take its nodes with it');
  assert.equal(component.querySelectorAll('.nodes').length, 1, 'Removed system should drop its nested list');
  kit.setReads(0);
  component.state.systems = [kit.row('a', kit.nodesA)];
  await flushEffects();
  assert.equal(kit.reads(), 1, 'A removed row effect should not keep running');
  cleanup();
}

