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

  test('Slot - remount does not throw when refs live on reactive author state', async () => {
    class RemountHost extends Component(HTMLElement) {
      static tag = `test-slot-remount-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<${Slot} name="trigger"></${Slot}>`;
      }
    }
    customElements.define(RemountHost.tag, RemountHost);

    class RemountApp extends Component(HTMLElement) {
      render() {
        return html`
          <${RemountHost}>
            <button slot="trigger" ref="openBtn">Open</button>
          </${RemountHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(RemountApp);
    const host = component.querySelector(RemountHost.tag);
    await host.rendered;

    const button = host.querySelector('button');
    const slot = host.querySelector('veda-slot');
    assert(component.refs.openBtn === button, 'Ref should be registered on the author state');

    await slot.update();
    await host.rendered;

    const remounted = host.querySelector('button');
    assert(remounted instanceof Node, 'Remount should render the slotted button');
    assert(component.refs.openBtn === remounted, 'Remount must re-register refs on reactive state');
    cleanup();
  });

  test('Slot - fallback ${} values follow the layout render values', async () => {
    class FallbackValueHost extends Component(HTMLElement) {
      static tag = `test-slot-value-host-${Math.random().toString(36).slice(2, 8)}`;
      constructor() {
        super();
        this.state.text = 'first';
      }
      render() {
        return html`<div class="slot-value"><${Slot}>fallback ${this.state.text}</${Slot}></div>`;
      }
    }
    customElements.define(FallbackValueHost.tag, FallbackValueHost);

    class FallbackValueApp extends Component(HTMLElement) {
      render() {
        return html`<${FallbackValueHost}></${FallbackValueHost}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(FallbackValueApp);
    const host = component.querySelector(FallbackValueHost.tag);
    await host.rendered;

    const slot = host.querySelector('veda-slot');
    assert(slot.textContent.includes('first'), 'Fallback ${} should render');

    host.state.text = 'second';
    await host.update();

    assert(slot.textContent.includes('second'), 'Fallback ${} should update without remounting the Slot');

    cleanup();
  });

  test('Slot - projected ${} values stay values and update in place', async () => {
    class LiveValueHost extends Component(HTMLElement) {
      static tag = `test-slot-live-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<div class="live"><${Slot}></${Slot}></div>`;
      }
    }
    customElements.define(LiveValueHost.tag, LiveValueHost);

    class LiveValueApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.url = 'https://example.com/one';
        this.state.title = 'One';
      }
      render() {
        return html`
          <${LiveValueHost}>
            <a class="live-link" href=${this.state.url}>${this.state.title}</a>
          </${LiveValueHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(LiveValueApp);
    const host = component.querySelector(LiveValueHost.tag);
    await host.rendered;

    const link = host.querySelector('a.live-link');
    assert(link?.getAttribute('href') === 'https://example.com/one', 'Projected ${} href should render');
    assert(link.textContent === 'One', 'Projected ${} text should render');

    component.state.url = 'https://example.com/two';
    component.state.title = 'Two';
    await component.update();

    assert(host.querySelector('a.live-link') === link, 'Projected ${} should patch the same node');
    assert(link.getAttribute('href') === 'https://example.com/two', 'Projected ${} href should update');
    assert(link.textContent === 'Two', 'Projected ${} text should update');

    cleanup();
  });

  test('Slot - projected ${} values never become markup', async () => {
    class TextValueHost extends Component(HTMLElement) {
      static tag = `test-slot-text-value-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<div class="text-value"><${Slot}></${Slot}></div>`;
      }
    }
    customElements.define(TextValueHost.tag, TextValueHost);

    class TextValueApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.payload = '<img class="pwn" src=x>';
      }
      render() {
        return html`
          <${TextValueHost}>
            <span class="payload-text">${this.state.payload}</span>
            <b class="payload-attr" title=${this.state.payload}></b>
          </${TextValueHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(TextValueApp);
    const host = component.querySelector(TextValueHost.tag);
    await host.rendered;

    const payload = component.state.payload;
    assert(host.querySelector('.pwn') === null, 'Projected ${} must not create markup');
    assert(host.querySelector('.payload-text').textContent === payload, 'Projected ${} text is literal');
    assert(host.querySelector('.payload-attr').getAttribute('title') === payload,
      'Projected ${} attribute is literal');

    cleanup();
  });

  test('Slot - a projected javascript: URL is refused like any other value', async () => {
    class UrlValueHost extends Component(HTMLElement) {
      static tag = `test-slot-url-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<div class="url-value"><${Slot}></${Slot}></div>`;
      }
    }
    customElements.define(UrlValueHost.tag, UrlValueHost);

    class UrlValueApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.url = 'https://example.com/safe';
      }
      render() {
        return html`
          <${UrlValueHost}>
            <a class="url-link" href=${this.state.url}>link</a>
          </${UrlValueHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(UrlValueApp);
    const host = component.querySelector(UrlValueHost.tag);
    await host.rendered;

    const link = host.querySelector('a.url-link');
    assert(link?.getAttribute('href') === 'https://example.com/safe', 'Safe URL should render');

    component.state.url = 'javascript:alert(1)';
    await component.update();

    assert(!component.innerHTML.includes('javascript:'), 'A script URL must not reach the projected DOM');
    assert(link.getAttribute('href') === 'https://example.com/safe', 'The previous safe URL must stay');

    cleanup();
  });

  test('Slot - a spread in projected content applies and updates', async () => {
    class SpreadHost extends Component(HTMLElement) {
      static tag = `test-slot-spread-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<div class="spread"><${Slot}></${Slot}></div>`;
      }
    }
    customElements.define(SpreadHost.tag, SpreadHost);

    class SpreadApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.attrs = {class: 'from-spread', 'data-x': '1'};
        this.state.label = 'One';
      }
      render() {
        return html`
          <${SpreadHost}>
            <span ${this.state.attrs}>${this.state.label}</span>
          </${SpreadHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(SpreadApp);
    const host = component.querySelector(SpreadHost.tag);
    await host.rendered;

    const span = host.querySelector('span');
    assert(span?.className === 'from-spread', 'Projected spread should set the class');
    assert(span.getAttribute('data-x') === '1', 'Projected spread should set attributes');
    assert(span.textContent === 'One', 'Projected text beside the spread should render');

    component.state.attrs = {class: 'updated', '?hidden': true};
    component.state.label = 'Two';
    await component.update();

    assert(host.querySelector('span') === span, 'Projected spread should patch the same node');
    assert(span.className === 'updated', 'Projected spread should update its class');
    assert(span.hasAttribute('hidden'), 'Projected spread should toggle a boolean');
    assert(!span.hasAttribute('data-x'), 'Projected spread should drop stale keys');
    assert(span.textContent === 'Two', 'Projected text should update');

    cleanup();
  });

  test('Slot - a projected slot attribute resolves ${} for matching', async () => {
    class DynamicSlotHost extends Component(HTMLElement) {
      static tag = `test-slot-dyn-value-host-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`
          <div class="named"><${Slot} name="trigger"></${Slot}></div>
          <div class="rest"><${Slot}></${Slot}></div>
        `;
      }
    }
    customElements.define(DynamicSlotHost.tag, DynamicSlotHost);

    class DynamicSlotApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.placement = 'trigger';
      }
      render() {
        return html`
          <${DynamicSlotHost}>
            <button class="dyn-slot" slot=${this.state.placement}>Open</button>
          </${DynamicSlotHost}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(DynamicSlotApp);
    const host = component.querySelector(DynamicSlotHost.tag);
    await host.rendered;

    assert(host.querySelector('.named .dyn-slot') !== null, 'A ${} slot name should select the named slot');

    component.state.placement = 'default';
    await component.update();

    assert(host.querySelector('.rest .dyn-slot') !== null, 'A changed ${} slot name should move the content');
    assert(host.querySelector('.named .dyn-slot') === null, 'The old named slot should be emptied');

    cleanup();
  });

  test('Slot - forwards ${} values through a renamed slot', async () => {
    class ForwardCard extends Component(HTMLElement) {
      static tag = `test-slot-forward-card-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`
          <div class="forward-card">
            <div class="forward-body"><${Slot}></${Slot}></div>
            <div class="forward-aside"><${Slot} name="aside"></${Slot}></div>
          </div>
        `;
      }
    }
    customElements.define(ForwardCard.tag, ForwardCard);

    class ForwardPanel extends Component(HTMLElement) {
      static tag = `test-slot-forward-panel-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`
          <div class="forward-panel">
            <${ForwardCard}>
              <${Slot} name="page-aside" slot="aside"></${Slot}>
            </${ForwardCard}>
          </div>
        `;
      }
    }
    customElements.define(ForwardPanel.tag, ForwardPanel);

    class ForwardPage extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.label = 'first';
      }
      render() {
        return html`
          <${ForwardPanel}>
            <span slot="page-aside" class="forward-badge">${this.state.label}</span>
          </${ForwardPanel}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(ForwardPage);
    await component.rendered;

    const badge = component.querySelector('.forward-aside .forward-badge');
    assert(badge?.textContent === 'first', 'A forwarded ${} value should render in the inner layout');

    component.state.label = 'second';
    await component.update();

    assert(component.querySelector('.forward-aside .forward-badge') === badge,
      'A forwarded ${} value should patch the same node');
    assert(badge.textContent === 'second', 'A forwarded ${} value should update');

    cleanup();
  });


  test('Slot - a host without a compiled template is not projected', async () => {
    class HandBuiltHost extends Component(HTMLElement) {
      constructor() {
        super();
        // A host assembled outside a template has no compiled source; Slot can
        // only project compiled author content, so its fallback is rendered.
        this.template = '<span slot="default" class="hand-built">author</span>';
      }
      render() {
        return html`<div class="hand-built-layout"><${Slot}>fallback</${Slot}></div>`;
      }
    }
    const { component, cleanup } = await createTestComponent(HandBuiltHost);
    await component.rendered;

    assert(component.querySelector('.hand-built') === null, 'String-authored content must not be projected');
    assert(component.querySelector('.hand-built-layout').textContent.trim() === 'fallback',
      'The Slot fallback should render when the host has no compiled template');
    cleanup();
  });

};
