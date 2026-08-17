import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {Context} from '../src/components/ContextComponent.js';
import {Slot} from '../src/components/SlotComponent.js';
import {Place} from '../src/components/PlaceComponent.js';
import {If} from '../src/components/IfComponent.js';
import {Loop} from '../src/components/LoopComponent.js';
import {Virtual} from '../src/components/VirtualComponent.js';
import {flushEffects} from '../src/Effect.js';
import {toRaw} from '../src/Reactive.js';
import {createTestComponent} from './helpers.js';

function defineEl(Class) {
  Class.tag = `test-cb-${Math.random().toString(36).slice(2, 8)}`;
  customElements.define(Class.tag, Class);
  return Class;
}

function dispatchInput(node, value) {
  node.value = value;
  const view = node.ownerDocument.defaultView;
  node.dispatchEvent(new view.Event('input', {bubbles: true}));
}

function dispatchChange(node, value) {
  node.value = value;
  const view = node.ownerDocument.defaultView;
  node.dispatchEvent(new view.Event('change', {bubbles: true}));
}

export default ({test, assert}) => {

  test('Cookbook - native button through Context uses the author method, not Context', async () => {
    let owner = null;

    class App extends Component(HTMLElement) {
      handleSave(event, node) {
        owner = {thisArg: this, node};
      }
      render() {
        return html`
          <${Context} :theme="{'light'}">
            <button class="cb-ctx-btn" onclick="{this.handleSave}">Save</button>
          </${Context}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const contextEl = component.querySelector('veda-context');
    let intercepted = false;
    contextEl.handleSave = () => { intercepted = true; };

    const button = component.querySelector('.cb-ctx-btn');
    button.click();

    assert(intercepted === false, 'veda-context.handleSave must not win');
    assert(owner?.thisArg === component, 'this should be the app that owns handleSave');
    assert(owner?.node === button, 'node should be the button');
    cleanup();
  });

  test('Cookbook - native button through Slot uses the author method, not Slot', async () => {
    let owner = null;

    const Layout = defineEl(class extends Component(HTMLElement) {
      render() {
        return html`<div class="cb-layout"><${Slot} name="actions"></${Slot}></div>`;
      }
    });

    class App extends Component(HTMLElement) {
      handleSave(event, node) {
        owner = {thisArg: this, node};
      }
      render() {
        return html`
          <${Layout}>
            <button class="cb-slot-btn" slot="actions" onclick="{this.handleSave}">Save</button>
          </${Layout}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const layout = component.querySelector(Layout.tag);
    await layout.rendered;

    const slotEl = layout.querySelector('veda-slot');
    let intercepted = false;
    slotEl.handleSave = () => { intercepted = true; };

    const button = layout.querySelector('.cb-slot-btn');
    button.click();

    assert(intercepted === false, 'veda-slot.handleSave must not win');
    assert(owner?.thisArg === component, 'this should be the app that owns handleSave');
    cleanup();
  });

  test('Cookbook - child custom element inside Virtual does not find the app method', async () => {
    let owner = null;

    const Child = defineEl(class extends Component(HTMLElement) {
      render() {
        return html`<button class="cb-virt-btn" onclick="{this.handleSave}">Save</button>`;
      }
    });

    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.items = [{id: 1}];
      }
      handleSave(event, node) {
        owner = {thisArg: this, node};
      }
      render() {
        return html`
          <${Virtual} items="{this.state.items}" height="80" item-height="40">
            <${Child}></${Child}>
          </${Virtual}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const virtualEl = component.querySelector('veda-virtual');
    await virtualEl.rendered;
    const child = virtualEl.querySelector(Child.tag);
    await child.rendered;

    let intercepted = false;
    virtualEl.handleSave = () => { intercepted = true; };

    child.querySelector('.cb-virt-btn').click();

    assert(intercepted === false, 'veda-virtual.handleSave must not run');
    assert(owner === null, 'Child render must not find the app method');
    assert(child._findParentComponent() === virtualEl, 'Virtual stays the parent for data');
    cleanup();
  });

  test('Cookbook - native button inside Place finds the parent method after the move', async () => {
    let owner = null;

    class App extends Component(HTMLElement) {
      handleClose(event, node) {
        owner = {thisArg: this, node};
      }
      render() {
        return html`
          <${Place} to="body">
            <button class="cb-place-close" onclick="{this.handleClose}">Close</button>
          </${Place}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const place = component.querySelector('veda-place');
    await place.rendered;

    const button = document.body.querySelector('.cb-place-close');
    assert(button !== null, 'Button should live on document.body');
    assert(place.contains(button) === false, 'Place host should be empty after the move');

    let intercepted = false;
    place.handleClose = () => { intercepted = true; };

    button.click();

    assert(intercepted === false, 'Place must not intercept a button from the app template');
    assert(owner?.thisArg === component, 'Moved button should still call the app method');
    assert(owner?.node === button, 'node should be the moved button');
    cleanup();
    assert(document.body.querySelector('.cb-place-close') === null, 'Moved button should be removed with the host');
  });

  test('Cookbook - child custom element inside Place does not find the app method', async () => {
    let owner = null;
    const missingId = `cb-missing-${Math.random().toString(36).slice(2, 8)}`;

    const Child = defineEl(class extends Component(HTMLElement) {
      render() {
        return html`<button class="cb-place-child-btn" onclick="{this.handleSave}">Save</button>`;
      }
    });

    class App extends Component(HTMLElement) {
      handleSave(event, node) {
        owner = {thisArg: this, node};
      }
      render() {
        return html`
          <${Place} to="#${missingId}">
            <${Child}></${Child}>
          </${Place}>
        `;
      }
    }

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    const {component, cleanup} = await createTestComponent(App);
    console.warn = originalWarn;

    const place = component.querySelector('veda-place');
    await place.rendered;
    const child = place.querySelector(Child.tag);
    await child.rendered;

    assert(warnings.some(w => w.includes(missingId)), 'Place should warn when the target is missing');
    assert(child.parentElement === place, 'Child should stay inside Place when target is missing');

    let intercepted = false;
    place.handleSave = () => { intercepted = true; };

    child.querySelector('.cb-place-child-btn').click();

    assert(intercepted === false, 'veda-place.handleSave must not run');
    assert(owner === null, 'Child render must not find the app method');
    cleanup();
  });

  test('Cookbook - modal close lives on the modal, not the page', async () => {
    let closedBy = null;

    const Modal = defineEl(class extends Component(HTMLElement) {
      close() {
        closedBy = this;
        this.state.open = false;
      }
      render() {
        return html`
          <${If} condition="{this.state.open}">
            <${Place} to="body">
              <button class="cb-modal-close" onclick="{this.close}">Close</button>
            </${Place}>
          </${If}>
        `;
      }
    });

    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = true;
      }
      render() {
        return html`<${Modal} :open="{this.state.open}"></${Modal}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const modal = component.querySelector(Modal.tag);
    await modal.rendered;
    const place = modal.querySelector('veda-place');
    if (place) await place.rendered;

    const button = document.body.querySelector('.cb-modal-close');
    assert(button !== null, 'Close button should live on document.body');
    button.click();
    await flushEffects();

    assert(closedBy === modal, 'Close should run on the modal');
    assert(modal.state.open === false, 'Modal should close itself');
    cleanup();
  });

  test('Cookbook - Context actions cross Shadow DOM', async () => {
    let owner = null;

    const Inner = defineEl(class extends Component(HTMLElement) {
      render() {
        return html`
          <span class="cb-shadow-theme">{this.context.theme}</span>
          <button class="cb-shadow-btn" onclick="{this.context.toggleTheme}">Toggle</button>
        `;
      }
    });

    const Host = defineEl(class extends Component(HTMLElement) {
      render() {
        return html`<${Inner}></${Inner}>`;
      }
    });

    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.theme = 'light';
      }
      toggleTheme() {
        owner = this;
        this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
      }
      render() {
        return html`
          <${Context} :theme="{this.state.theme}" :toggle-theme="{this.toggleTheme}">
            <${Host} shadow></${Host}>
          </${Context}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const host = component.querySelector(Host.tag);
    await host.rendered;
    assert(host.shadowRoot, 'Host should attach an open shadow root');

    const inner = host.shadowRoot.querySelector(Inner.tag);
    await inner.rendered;

    assert(inner.querySelector('.cb-shadow-theme').textContent === 'light', 'Context should be readable from inside shadow');
    assert(component.querySelector(Inner.tag) === null, 'Inner node must not leak into light DOM');

    inner.querySelector('.cb-shadow-btn').click();
    await flushEffects();

    assert(owner === component, 'Context action should keep this = the app that provided it');
    assert(inner.querySelector('.cb-shadow-theme').textContent === 'dark', 'Context value should stay reactive across shadow');
    cleanup();
  });

  test('Cookbook - Slot inside Loop evaluates item expressions and parent methods', async () => {
    const removedByItem = [];
    const removedByParent = [];

    const Row = defineEl(class extends Component(HTMLElement) {
      render() {
        return html`<div class="cb-row"><${Slot}></${Slot}></div>`;
      }
    });

    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.items = [
          {id: 1, label: 'Alpha', remove: () => { removedByItem.push(1); }},
          {id: 2, label: 'Beta', remove: () => { removedByItem.push(2); }},
        ];
      }
      removeItem(event, node) {
        removedByParent.push(node.getAttribute('data-id'));
      }
      render() {
        return html`
          <${Loop} items="{this.state.items}" as="item" key="id">
            <${Row}>
              <span class="cb-row-label">{item.label}</span>
              <button class="cb-row-item" onclick="{item.remove}">item</button>
              <button class="cb-row-parent" data-id="{item.id}" onclick="{this.removeItem}">parent</button>
            </${Row}>
          </${Loop}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const rows = [...component.querySelectorAll(Row.tag)];
    await Promise.all(rows.map(row => row.rendered));

    assert(rows.length === 2, 'Loop should create one row layout per item');
    assert(rows[0].querySelector('.cb-row-label').textContent === 'Alpha', 'First slotted label should see item');
    assert(rows[1].querySelector('.cb-row-label').textContent === 'Beta', 'Second slotted label should see item');

    rows[1].querySelector('.cb-row-item').click();
    assert(removedByItem.join(',') === '2', 'item.remove should run on that row object');

    rows[0].querySelector('.cb-row-parent').click();
    assert(removedByParent.join(',') === '1', 'Parent method should run with this = app');
    cleanup();
  });

  test('Cookbook - If + Place mounts overlay on body and removes it when hidden', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = false;
        this.state.title = 'Hello';
      }
      render() {
        return html`
          <${If} condition="{this.state.open}">
            <${Place} to="body">
              <div class="cb-overlay">{this.state.title}</div>
            </${Place}>
          </${If}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    assert(document.body.querySelector('.cb-overlay') === null, 'Closed overlay must not be in the document');

    component.state.open = true;
    await flushEffects();
    const place = component.querySelector('veda-place');
    assert(place, 'Place should mount when If becomes true');
    await place.rendered;

    const overlay = document.body.querySelector('.cb-overlay');
    assert(overlay !== null, 'Open overlay should be on document.body');
    assert(overlay.textContent === 'Hello', 'Placed content should evaluate in the app');
    assert(place.querySelector('.cb-overlay') === null, 'Place host should be empty');

    component.state.title = 'World';
    await flushEffects();
    assert(document.body.querySelector('.cb-overlay').textContent === 'World', 'Title should update without remounting');
    assert(document.body.querySelector('.cb-overlay') === overlay, 'Same overlay node should stay while open');

    component.state.open = false;
    await flushEffects();
    assert(document.body.querySelector('.cb-overlay') === null, 'Hiding If should disconnect Place and remove the overlay');
    assert(component.querySelector('veda-place') === null, 'Place node should leave the tree');

    component.state.open = true;
    await flushEffects();
    const placeAgain = component.querySelector('veda-place');
    await placeAgain.rendered;
    const overlayAgain = document.body.querySelector('.cb-overlay');
    assert(overlayAgain !== null, 'Re-open should place a new overlay');
    assert(overlayAgain !== overlay, 'A new Place instance should create a new node');
    assert(overlayAgain.textContent === 'World', 'Re-opened overlay should show the current title');
    cleanup();
    assert(document.body.querySelector('.cb-overlay') === null, 'Cleanup should remove the overlay');
  });

  test('Cookbook - Slot + Place + If modal: trigger stays, overlay is placed, close lives on the modal', async () => {
    const Modal = defineEl(class extends Component(HTMLElement) {
      close() {
        this.state.open = false;
      }
      render() {
        return html`
          <${Slot} name="trigger"></${Slot}>
          <${If} condition="{this.state.open}">
            <${Place} to="body">
              <div class="cb-modal">
                <${Slot} name="content"></${Slot}>
                <button class="cb-modal-close" onclick="{this.close}">Close</button>
              </div>
            </${Place}>
          </${If}>
        `;
      }
    });

    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = false;
        this.state.title = 'Contract';
      }
      open() {
        this.state.open = true;
      }
      render() {
        return html`
          <${Modal} :open="{this.state.open}">
            <button slot="trigger" class="cb-modal-open" onclick="{this.open}">Open</button>
            <p slot="content" class="cb-modal-title">{this.state.title}</p>
          </${Modal}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const modal = component.querySelector(Modal.tag);
    await modal.rendered;

    const trigger = modal.querySelector('.cb-modal-open');
    assert(trigger !== null, 'Trigger slot should stay in the modal host');
    assert(document.body.querySelector('.cb-modal') === null, 'Overlay should be absent while closed');

    trigger.click();
    await flushEffects();
    const place = modal.querySelector('veda-place');
    assert(place, 'Place should mount after open');
    await place.rendered;

    const overlay = document.body.querySelector('.cb-modal');
    assert(overlay !== null, 'Modal overlay should be on document.body');
    assert(overlay.querySelector('.cb-modal-title').textContent === 'Contract', 'Content slot should render inside the placed overlay');
    assert(modal.contains(overlay) === false, 'Overlay must not stay inside the modal host');

    component.state.title = 'Updated';
    await flushEffects();
    assert(overlay.querySelector('.cb-modal-title').textContent === 'Updated', 'Slotted content should stay reactive after Place');

    overlay.querySelector('.cb-modal-close').click();
    await flushEffects();
    assert(modal.state.open === false, 'Close should run on the modal');
    assert(document.body.querySelector('.cb-modal') === null, 'Close should unmount the overlay');
    assert(modal.querySelector('.cb-modal-open') !== null, 'Trigger should still be in the host');
    cleanup();
  });

  test('Cookbook - ref on a Place child is stored on the author and points at the moved node', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.open = true;
        this.state.title = 'Menu';
      }
      render() {
        return html`
          <div ref="anchor" class="cb-anchor">Anchor</div>
          <${If} condition="{this.state.open}">
            <${Place} to="body">
              <div ref="menu" class="cb-menu">{this.state.title}</div>
            </${Place}>
          </${If}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const place = component.querySelector('veda-place');
    await place.rendered;

    const menu = document.body.querySelector('.cb-menu');
    assert(component.refs.anchor === component.querySelector('.cb-anchor'), 'anchor ref stays on the app');
    assert(component.refs.menu === menu, 'menu ref should be on the authoring parent, not on veda-place');
    assert(place.refs.menu === undefined, 'Place must not keep the author ref');
    assert(menu.parentNode === document.body, 'ref.menu should be the node that was moved to body');
    assert(menu.textContent === 'Menu', 'Placed ref node should still evaluate expressions');

    component.state.title = 'Moved';
    await flushEffects();
    assert(component.refs.menu === menu, 'Fine-grained text update should keep the same ref');
    assert(menu.textContent === 'Moved', 'Moved node should stay live');

    component.state.open = false;
    await flushEffects();
    assert(document.body.querySelector('.cb-menu') === null, 'Closing If should remove the placed menu');
    cleanup();
  });

  test('Cookbook - bind syncs select and textarea both ways', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.kind = 'open';
        this.state.note = 'hello';
      }
      render() {
        return html`
          <select id="kind" bind="{this.state.kind}">
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <textarea id="note" bind="{this.state.note}"></textarea>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    await flushEffects();

    const select = component.querySelector('#kind');
    const textarea = component.querySelector('#note');
    assert(select.value === 'open', 'Select should take the state value');
    assert(textarea.value === 'hello', 'Textarea should take the state value');

    dispatchChange(select, 'closed');
    await flushEffects();
    assert(component.state.kind === 'closed', 'Select change should write state (change, not input)');
    assert(select.value === 'closed', 'Select should stay on the chosen option');

    component.state.kind = 'all';
    await flushEffects();
    assert(select.value === 'all', 'Select should follow state');

    dispatchInput(textarea, 'typed\nline');
    await flushEffects();
    assert(component.state.note === 'typed\nline', 'Textarea input should write state');

    component.state.note = 'from-state';
    await flushEffects();
    assert(textarea.value === 'from-state', 'Textarea should follow state');
    cleanup();
  });

  test('Cookbook - this.refs is rebuilt on update() and kept across fine-grained updates', async () => {
    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.n = 1;
      }
      render() {
        return html`<input ref="query" data-n="{this.state.n}">`;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const first = component.refs.query;
    assert(first === component.querySelector('input'), 'Initial ref should be the rendered input');

    component.state.n = 2;
    await flushEffects();
    assert(component.refs.query === first, 'Attribute update must not replace the ref');
    assert(first.getAttribute('data-n') === '2', 'Same node should receive the new attribute');

    await component.update();
    const second = component.refs.query;
    assert(second !== first, 'update() should assign a new node');
    assert(second === component.querySelector('input'), 'New ref should be the current input');
    assert(first.isConnected === false, 'Previous ref node should be gone');
    assert(component.refs.query === second, 'refs.query should not keep the old node');
    cleanup();
  });

  test('Cookbook - :on-save passes a specific parent callback into one child', async () => {
    const RowActions = defineEl(class extends Component(HTMLElement) {
      handleClick() {
        this.state.onSave?.(this.state.row);
      }
      render() {
        return html`<button class="cb-save" onclick="{this.handleClick}">Save</button>`;
      }
    });

    class App extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.rowA = {id: 'a'};
        this.state.rowB = {id: 'b'};
        this.which = null;
        this.saved = null;
        this.saveA = (row) => {
          this.which = 'a';
          this.saved = row;
        };
        this.saveB = (row) => {
          this.which = 'b';
          this.saved = row;
        };
      }
      render() {
        return html`
          <${RowActions} class="cb-row-a" :on-save="{this.saveA}" :row="{this.state.rowA}"></${RowActions}>
          <${RowActions} class="cb-row-b" :on-save="{this.saveB}" :row="{this.state.rowB}"></${RowActions}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(App);
    const rowA = component.querySelector('.cb-row-a');
    const rowB = component.querySelector('.cb-row-b');
    await Promise.all([rowA.rendered, rowB.rendered]);

    assert(typeof toRaw(rowA.state).onSave === 'function', 'Child A should receive a function via :on-save');
    assert(typeof toRaw(rowB.state).onSave === 'function', 'Child B should receive a function via :on-save');
    assert(toRaw(rowA.state).onSave !== toRaw(rowB.state).onSave, 'Each child should keep its own callback');

    rowB.querySelector('.cb-save').click();
    assert(component.which === 'b', 'Only the callback passed to that child should run');
    assert(component.saved === component.state.rowB, 'Callback should receive that child row');

    rowA.querySelector('.cb-save').click();
    assert(component.which === 'a', 'The other child should still have its own callback');
    assert(component.saved === component.state.rowA, 'Callback should receive row A');
    cleanup();
  });
};
