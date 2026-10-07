import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {Slot} from '../src/components/SlotComponent.js';
import {createTestComponent} from './helpers.js';

function defineSlotEl(Class) {
  Class.tag = `test-slot-${Math.random().toString(36).slice(2, 8)}`;
  customElements.define(Class.tag, Class);
  return Class;
}

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

  test('Slot - renders fallback content in the layout context', async () => {
    let handlerOwner = null;

    class FallbackSlotHost extends Component(HTMLElement) {
      static tag = `test-slot-fallback-host-${Math.random().toString(36).slice(2, 8)}`;
      handleFallback() {
        handlerOwner = this;
      }
      render() {
        return html`
          <div class="trigger">
            <${Slot} name="trigger">
              <button class="fallback-trigger" ref="fallbackTrigger" onclick="{this.handleFallback}">
                Open by default
              </button>
            </${Slot}>
          </div>
          <div class="content">
            <${Slot} name="content"><p class="fallback-content">Default content</p></${Slot}>
          </div>
          <div class="content-copy">
            <${Slot} name="content"><p class="fallback-content-copy">Default content copy</p></${Slot}>
          </div>
          <div class="default">
            <${Slot}><p class="fallback-default">Default slot content</p></${Slot}>
          </div>
        `;
      }
    }
    customElements.define(FallbackSlotHost.tag, FallbackSlotHost);

    class FallbackSlotApp extends Component(HTMLElement) {
      render() {
        return html`<${FallbackSlotHost}></${FallbackSlotHost}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(FallbackSlotApp);
    const host = component.querySelector(FallbackSlotHost.tag);
    await host.rendered;

    const button = host.querySelector('.fallback-trigger');
    assert(button?.textContent.trim() === 'Open by default', 'Named slot should render fallback');
    assert(host.querySelector('.fallback-content'), 'Each empty named slot should render its fallback');
    assert(host.querySelector('.fallback-content-copy'), 'Repeated empty named slot should render its fallback');
    assert(host.querySelector('.fallback-default'), 'Empty default slot should render fallback');
    assert(host.refs.fallbackTrigger === button, 'Fallback ref should belong to the layout');
    button.click();
    assert(handlerOwner === host, 'Fallback handler should belong to the layout');
    cleanup();
  });

  test('Slot - assigned content replaces fallback, including an empty element', async () => {
    class FallbackOverrideHost extends Component(HTMLElement) {
      static tag = `test-slot-fallback-override-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`
          <div class="named">
            <${Slot} name="content"><p class="fallback-named">Default content</p></${Slot}>
          </div>
          <div class="default">
            <${Slot}><p class="fallback-default">Default slot content</p></${Slot}>
          </div>
        `;
      }
    }
    customElements.define(FallbackOverrideHost.tag, FallbackOverrideHost);

    class FallbackOverrideApp extends Component(HTMLElement) {
      render() {
        return html`
          <${FallbackOverrideHost}>
            <div slot="content" class="empty-content"></div>
            <strong class="assigned-default">Assigned default content</strong>
          </${FallbackOverrideHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(FallbackOverrideApp);
    const host = component.querySelector(FallbackOverrideHost.tag);
    await host.rendered;

    assert(host.querySelector('.empty-content'), 'Empty assigned element should be rendered');
    assert(!host.querySelector('.fallback-named'), 'Empty assigned element should suppress named fallback');
    assert(host.querySelector('.assigned-default'), 'Assigned default content should be rendered');
    assert(!host.querySelector('.fallback-default'), 'Assigned default content should suppress fallback');
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

  test('Slot - forwards a same-named slot through a wrapper into the inner layout', async () => {
    const Card = defineSlotEl(class extends Component(HTMLElement) {
      render() {
        return html`
          <div class="card">
            <div class="card__body"><${Slot}></${Slot}></div>
            <div class="card__aside"><${Slot} name="aside"></${Slot}></div>
          </div>
        `;
      }
    });

    const Panel = defineSlotEl(class extends Component(HTMLElement) {
      render() {
        return html`
          <div class="panel">
            <${Card}><${Slot} name="aside" slot="aside"></${Slot}></${Card}>
          </div>
        `;
      }
    });

    class Page extends Component(HTMLElement) {
      render() {
        return html`<${Panel}><span slot="aside" class="badge">5 новых</span></${Panel}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Page);
    const aside = component.querySelector('.card__aside');
    const layout = aside.querySelector('veda-slot');
    const forwarder = layout?.querySelector('veda-slot');

    assert(aside.querySelectorAll('veda-slot').length === 2, 'Aside should keep the layout slot and one forwarder');
    assert(forwarder?.parentElement === layout, 'Forwarder should be the layout slot content');
    assert(forwarder?.querySelector('span.badge')?.textContent === '5 новых', 'Page content should render inside the forwarder');
    assert(forwarder.querySelector('veda-slot') === null, 'Forwarder must not project another slot');
    cleanup();
  });

  test('Slot - forwards a renamed slot and keeps handlers and refs on the page', async () => {
    let clicked = false;

    const Card = defineSlotEl(class extends Component(HTMLElement) {
      render() {
        return html`
          <div class="card">
            <div class="card__body"><${Slot}></${Slot}></div>
            <div class="card__aside"><${Slot} name="aside"></${Slot}></div>
          </div>
        `;
      }
    });

    const Panel = defineSlotEl(class extends Component(HTMLElement) {
      render() {
        return html`
          <div class="panel">
            <${Card}><${Slot} name="page-aside" slot="aside"></${Slot}></${Card}>
          </div>
        `;
      }
    });

    class Page extends Component(HTMLElement) {
      open() {
        clicked = true;
      }
      render() {
        return html`
          <${Panel}>
            <button slot="page-aside" class="badge" ref="badge" onclick="{this.open}">5 новых</button>
          </${Panel}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(Page);
    const aside = component.querySelector('.card__aside');
    const button = aside.querySelector('button.badge');

    assert(aside.querySelectorAll('veda-slot').length === 2, 'Renamed forwarder should project once');
    assert(button?.textContent === '5 новых', 'Page content should render through the renamed slot');
    assert(button.parentElement?.getAttribute('name') === 'page-aside', 'Button should sit in the forwarding slot');
    assert(component.refs.badge === button, 'Ref should belong to the page that authored the button');
    button.click();
    assert(clicked === true, 'Click should call the page method');
    cleanup();
  });
};
