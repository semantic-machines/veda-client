import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {Slot} from '../src/components/SlotComponent.js';
import {createTestComponent} from './helpers.js';

export default ({test, assert}) => {

  test('Slot - projects named and default content from the host template', async () => {
    class SlotHost extends Component(HTMLElement) {
      static tag = `test-slot-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`
          <div class="host">
            <div class="trigger"><${Slot} name="trigger"></${Slot}></div>
            <div class="content"><${Slot} name="content"></${Slot}></div>
            <div class="rest"><${Slot}></${Slot}></div>
          </div>
        `;
      }
    }
    customElements.define(SlotHost.tag, SlotHost);

    class SlotApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.label = 'Open';
      }
      render() {
        return html`
          <${SlotHost}>
            <button slot="trigger">{this.state.label}</button>
            <p slot="content">Hello</p>
            <span>Default</span>
          </${SlotHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(SlotApp);
    const host = component.querySelector(SlotHost.tag);
    await host.rendered;

    assert(host.querySelector('.trigger button').textContent === 'Open', 'Named trigger slot should render');
    assert(host.querySelector('.content p').textContent === 'Hello', 'Named content slot should render');
    assert(host.querySelector('.rest span').textContent === 'Default', 'Default slot should render unslotted nodes');
    assert(host.querySelector('veda-slot').style.display === 'contents', 'Slot host should not create a CSS box');
    cleanup();
  });

  test('Slot - event handler in slotted content finds the outer method', async () => {
    let clicked = false;

    class SlotEventHost extends Component(HTMLElement) {
      static tag = `test-slot-ev-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<${Slot} name="trigger"></${Slot}>`;
      }
    }
    customElements.define(SlotEventHost.tag, SlotEventHost);

    class SlotEventApp extends Component(HTMLElement) {
      handleOpen() {
        clicked = true;
      }
      render() {
        return html`
          <${SlotEventHost}>
            <button slot="trigger" onclick="{this.handleOpen}">Open</button>
          </${SlotEventHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(SlotEventApp);
    const host = component.querySelector(SlotEventHost.tag);
    await host.rendered;

    host.querySelector('button').click();
    assert(clicked === true, 'Slotted button should call the outer component method');
    cleanup();
  });

  test('Slot - default slot keeps non-empty text nodes', async () => {
    class TextSlotHost extends Component(HTMLElement) {
      static tag = `test-slot-text-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`
          <div class="named"><${Slot} name="trigger"></${Slot}></div>
          <div class="rest"><${Slot}></${Slot}></div>
        `;
      }
    }
    customElements.define(TextSlotHost.tag, TextSlotHost);

    class TextSlotApp extends Component(HTMLElement) {
      render() {
        return html`
          <${TextSlotHost}>
            <button slot="trigger">Open</button>
            Hello text
          </${TextSlotHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(TextSlotApp);
    const host = component.querySelector(TextSlotHost.tag);
    await host.rendered;

    assert(host.querySelector('.named button').textContent === 'Open', 'Named slot still works');
    assert(host.querySelector('.rest').textContent.includes('Hello text'), 'Default slot should keep text nodes');
    cleanup();
  });

  test('Slot - ref on slotted content is stored on the authoring parent', async () => {
    class RefSlotHost extends Component(HTMLElement) {
      static tag = `test-slot-ref-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<${Slot} name="trigger"></${Slot}>`;
      }
    }
    customElements.define(RefSlotHost.tag, RefSlotHost);

    class RefSlotApp extends Component(HTMLElement) {
      render() {
        return html`
          <${RefSlotHost}>
            <button slot="trigger" ref="openBtn">Open</button>
          </${RefSlotHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(RefSlotApp);
    const host = component.querySelector(RefSlotHost.tag);
    await host.rendered;

    const button = host.querySelector('button');
    assert(component.refs.openBtn === button, 'Parent refs.openBtn should be the slotted button');
    assert(host.querySelector('veda-slot').refs.openBtn === undefined, 'Slot wrapper should not keep the ref');
    cleanup();
  });

  test('Slot - name attribute interpolates', async () => {
    class DynSlotHost extends Component(HTMLElement) {
      static tag = `test-slot-dyn-host-${Math.random().toString(36).slice(2, 8)}`;
      constructor() {
        super();
        this.state.hole = 'trigger';
      }
      render() {
        return html`<div class="dyn"><${Slot} name="{this.state.hole}"></${Slot}></div>`;
      }
    }
    customElements.define(DynSlotHost.tag, DynSlotHost);

    class DynSlotApp extends Component(HTMLElement) {
      render() {
        return html`
          <${DynSlotHost}>
            <button slot="trigger">Open</button>
          </${DynSlotHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(DynSlotApp);
    const host = component.querySelector(DynSlotHost.tag);
    await host.rendered;

    assert(host.querySelector('.dyn button').textContent === 'Open', 'Interpolated slot name should match');
    cleanup();
  });
};
