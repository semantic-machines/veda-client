import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {Context} from '../src/components/ContextComponent.js';
import {Loop} from '../src/components/LoopComponent.js';
import {flushEffects} from '../src/Effect.js';
import {createTestComponent} from './helpers.js';

export default ({test, assert}) => {

  test('Context - descendant reads provided values', async () => {
    class CtxChild extends Component(HTMLElement) {
      static tag = `test-ctx-child-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<span class="theme">{this.context.theme}</span><span class="locale">{this.context.locale}</span>`;
      }
    }
    customElements.define(CtxChild.tag, CtxChild);

    class CtxApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.theme = 'light';
        this.state.locale = 'ru';
      }
      render() {
        return html`
          <${Context} :theme="{this.state.theme}" :locale="{this.state.locale}">
            <${CtxChild}></${CtxChild}>
          </${Context}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(CtxApp);
    const child = component.querySelector(CtxChild.tag);
    await child.rendered;

    assert(child.querySelector('.theme').textContent === 'light', 'Should read theme from context');
    assert(child.querySelector('.locale').textContent === 'ru', 'Should read locale from context');
    cleanup();
  });

  test('Context - nested provider overrides one key and keeps the rest', async () => {
    class CtxNestedChild extends Component(HTMLElement) {
      static tag = `test-ctx-nested-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<span class="theme">{this.context.theme}</span><span class="locale">{this.context.locale}</span>`;
      }
    }
    customElements.define(CtxNestedChild.tag, CtxNestedChild);

    class CtxNestedApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.theme = 'light';
        this.state.locale = 'ru';
      }
      render() {
        return html`
          <${Context} :theme="{this.state.theme}" :locale="{this.state.locale}">
            <${Context} :theme="{'dark'}">
              <${CtxNestedChild}></${CtxNestedChild}>
            </${Context}>
          </${Context}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(CtxNestedApp);
    const child = component.querySelector(CtxNestedChild.tag);
    await child.rendered;

    assert(child.querySelector('.theme').textContent === 'dark', 'Nearest theme should win');
    assert(child.querySelector('.locale').textContent === 'ru', 'Outer locale should remain');
    cleanup();
  });

  test('Context - values stay reactive', async () => {
    class CtxReactiveChild extends Component(HTMLElement) {
      static tag = `test-ctx-rx-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<span class="theme">{this.context.theme}</span>`;
      }
    }
    customElements.define(CtxReactiveChild.tag, CtxReactiveChild);

    class CtxReactiveApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.theme = 'light';
      }
      render() {
        return html`
          <${Context} :theme="{this.state.theme}">
            <${CtxReactiveChild}></${CtxReactiveChild}>
          </${Context}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(CtxReactiveApp);
    const child = component.querySelector(CtxReactiveChild.tag);
    await child.rendered;
    await flushEffects();

    component.state.theme = 'dark';
    await flushEffects();

    assert(child.querySelector('.theme').textContent === 'dark', 'Context value should update');
    cleanup();
  });

  test('Context - missing key warns once', async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    class CtxMissingChild extends Component(HTMLElement) {
      static tag = `test-ctx-miss-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<span>{this.context.missingKey}</span><span>{this.context.missingKey}</span>`;
      }
    }
    customElements.define(CtxMissingChild.tag, CtxMissingChild);

    class CtxMissingApp extends Component(HTMLElement) {
      render() {
        return html`
          <${Context} :theme="{'light'}">
            <${CtxMissingChild}></${CtxMissingChild}>
          </${Context}>
        `;
      }
    }

    const {cleanup} = await createTestComponent(CtxMissingApp);
    console.warn = originalWarn;

    const hits = warnings.filter(w => w.includes('missingKey'));
    assert(hits.length === 1, 'Should warn once per missing key');
    cleanup();
  });

  test('Context - inspector keys do not warn', async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    class CtxInspectChild extends Component(HTMLElement) {
      static tag = `test-ctx-insp-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        void this.context.then;
        void this.context.toJSON;
        return html`<span>{this.context.theme}</span>`;
      }
    }
    customElements.define(CtxInspectChild.tag, CtxInspectChild);

    class CtxInspectApp extends Component(HTMLElement) {
      render() {
        return html`
          <${Context} :theme="{'light'}">
            <${CtxInspectChild}></${CtxInspectChild}>
          </${Context}>
        `;
      }
    }

    const {cleanup} = await createTestComponent(CtxInspectApp);
    console.warn = originalWarn;

    const hits = warnings.filter(w => w.includes('then') || w.includes('toJSON'));
    assert(hits.length === 0, 'Inspector keys should not warn');
    cleanup();
  });

  test('Context - works inside Loop', async () => {
    class CtxLoopChild extends Component(HTMLElement) {
      static tag = `test-ctx-loop-${Math.random().toString(36).slice(2, 8)}`;
      render() {
        return html`<span class="row">{this.state.item.id}:{this.context.theme}</span>`;
      }
    }
    customElements.define(CtxLoopChild.tag, CtxLoopChild);

    class CtxLoopApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.theme = 'light';
        this.state.items = [{id: 1}, {id: 2}];
      }
      render() {
        return html`
          <${Context} :theme="{this.state.theme}">
            <${Loop} items="{this.state.items}" as="item" key="id">
              <${CtxLoopChild} :item="{item}"></${CtxLoopChild}>
            </${Loop}>
          </${Context}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(CtxLoopApp);
    const children = [...component.querySelectorAll(CtxLoopChild.tag)];
    await Promise.all(children.map(c => c.rendered));

    assert(children[0].querySelector('.row').textContent === '1:light', 'First row should see context');
    assert(children[1].querySelector('.row').textContent === '2:light', 'Second row should see context');
    cleanup();
  });
};
