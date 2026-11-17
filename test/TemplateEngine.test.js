import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {Loop} from '../src/components/LoopComponent.js';
import {If} from '../src/components/IfComponent.js';
import {flushEffects} from '../src/Effect.js';
import {createTestComponent, createTestContainer} from './helpers.js';
import {clearTemplateCache, compileTemplate, render} from '../src/template/Template.js';
import {
  TemplateResult, nothing, noChange, unsafeHTML, unsafeStatic,
} from '../src/template/TemplateResult.js';
import {ELEMENT_MARKER} from '../src/template/markers.js';

export default ({test, assert}) => {

  test('TemplateEngine - html returns a TemplateResult object', () => {
    const result = html`<div class="a ${'b'}">${'<x>'}</div>`;

    assert(result instanceof TemplateResult, 'html() should return TemplateResult');
    assert(!(result instanceof String), 'TemplateResult must not be a String object');
    assert(result.toString === Object.prototype.toString,
      'TemplateResult should not implement a template serializer');
    assert(result.strings.length === 3, 'TemplateResult should retain strings');
    assert(result.values.length === 2, 'TemplateResult should retain values');
  });

  test('TemplateEngine - template is compiled once per call site', () => {
    clearTemplateCache();

    // Same call site (same strings array) and same value shape must reuse the
    // compiled template; a different dynamic value must not create a new one.
    const row = (label) => html`<span class="item">${label}</span>`;

    const first = compileTemplate(row('one'));
    const second = compileTemplate(row('one'));
    assert(first === second, 'The same call site should reuse the compiled template');

    const third = compileTemplate(row('two'));
    assert(third === first, 'Dynamic values should not create a new compiled template');
  });

  test('TemplateEngine - update() patches instead of replacing the DOM', async () => {
    class Counter extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.n = 0;
        this.state.suffix = 'a';
      }
      render() {
        return html`<div class="row ${this.state.suffix}"><span>{this.state.n}</span><b>${this.state.n}</b></div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Counter);
    const div = component.querySelector('div');
    const span = component.querySelector('span');
    const bold = component.querySelector('b');

    component.state.n = 5;
    await flushEffects();
    assert(span.textContent === '5', 'Reactive {} text should update');
    assert(component.querySelector('div') === div, 'Reactive update must not replace the div');

    await component.update();
    assert(component.querySelector('div') === div, 'update() should reuse the div');
    assert(component.querySelector('span') === span, 'update() should reuse the span');
    assert(bold.textContent === '5', '${} text should be patched');

    component.state.suffix = 'b';
    await component.update();
    assert(div.getAttribute('class') === 'row b', '${} attribute should be patched');
    assert(component.querySelector('b') === bold, '${} text node should be reused');

    cleanup();
  });

  test('TemplateEngine - static tag and attribute names come from unsafeStatic', async () => {
    class Dynamic extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'one';
      }
      render() {
        return html`<div><${unsafeStatic('section')} ${unsafeStatic('data-x')}="{this.state.value}">text</${unsafeStatic('section')}></div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Dynamic);
    const section = component.querySelector('section');
    assert(section !== null, 'A static-trusted tag name should create the element');
    assert(section.getAttribute('data-x') === 'one', 'A static-trusted attribute name should be set');

    component.state.value = 'two';
    await flushEffects();
    assert(section.getAttribute('data-x') === 'two', 'The attribute value should stay reactive');

    cleanup();
  });

  test('TemplateEngine - a spread object applies attributes through the DOM', async () => {
    class SpreadApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.attrs = {class: 'one', 'data-value': 1, '?disabled': false};
      }
      render() {
        return html`<button class="base" ${this.state.attrs}>go</button>`;
      }
    }

    const {component, cleanup} = await createTestComponent(SpreadApp);
    const button = component.querySelector('button');
    assert(button.className === 'one', 'class from the spread should be applied');
    assert(button.getAttribute('data-value') === '1', 'attribute from the spread should be applied');
    assert(!button.hasAttribute('disabled'), '?name should not set a falsy boolean');

    component.state.attrs = {class: 'two', '?disabled': true};
    await component.update();
    await flushEffects();
    assert(button.className === 'two', 'spread values should update in place');
    assert(button.hasAttribute('disabled'), '?name should set a truthy boolean');
    assert(!button.hasAttribute('data-value'), 'stale spread keys should be removed');

    cleanup();
  });

  test('TemplateEngine - a spread reads its own value after other interpolations', () => {
    const {container, cleanup} = createTestContainer();
    const view = (attrs, title) => html`<div title="${title}" ${attrs}>hi</div>`;

    render(view({class: 'one'}, 'a'), container);
    const div = container.firstElementChild;
    assert(div.getAttribute('title') === 'a', 'The preceding value should stay in its position');
    assert(div.className === 'one', 'The spread should read its own value, not the preceding one');

    render(view({class: 'two', 'data-x': '1'}, 'b'), container);
    assert(container.firstElementChild === div, 'The element should be patched in place');
    assert(div.getAttribute('title') === 'b', 'The preceding value should update');
    assert(div.className === 'two', 'The spread should update');
    assert(div.getAttribute('data-x') === '1', 'The spread should keep its own attributes');
    cleanup();
  });

  test('TemplateEngine - unsafeStatic works as a value too', () => {
    const container = document.createElement('div');
    render(html`<div class="${unsafeStatic('cls')}" data-x="${unsafeStatic('v')}">text</div>`, container);
    const div = container.firstElementChild;
    assert(div.className === 'cls', 'A static value in an attribute value is its string');
    assert(div.getAttribute('data-x') === 'v', 'A static value in an attribute value is its string');
    assert(div.textContent === 'text');
  });

  test('TemplateEngine - a component class must own its static tag', () => {
    class NoTag extends Component(HTMLElement) {}
    assert.throws(
      () => compileTemplate(html`<${NoTag}></${NoTag}>`),
      /has no own "static tag"/,
    );

    class WithTag extends Component(HTMLElement) {
      static tag = 'test-engine-own-tag';
    }
    const compiled = compileTemplate(html`<${WithTag}></${WithTag}>`);
    assert(compiled.source.includes('<test-engine-own-tag></test-engine-own-tag>'),
      'A class with its own static tag should fold');
  });

  test('TemplateEngine - unsafeStatic cannot be forged by JSON', () => {
    // The brand is a symbol, so a value that went through JSON.parse (or any
    // other data channel) can never be mistaken for trusted static source.
    const forged = JSON.parse('{"value":"section"}');
    assert.throws(
      () => compileTemplate(html`<${forged}></${forged}>`),
      /Dynamic tag names are not supported/,
    );
    // A Component class with a static tag is trusted code, not data.
    class Trusted extends Component(HTMLElement) {
      static tag = 'test-engine-trusted-json';
    }
    const compiled = compileTemplate(html`<${Trusted}></${Trusted}>`);
    assert(compiled.source.includes('<test-engine-trusted-json>'), 'A class tag should fold');
  });

  test('TemplateEngine - a data string is not a spread object', () => {
    const container = document.createElement('div');
    assert.throws(
      () => render(html`<div ${'data-x="1"'}></div>`, container),
      /expects an object/,
    );
  });

  test('TemplateEngine - child component is reused across parent update()', async () => {
    let childTag = '';
    class Child extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.own = 0;
      }
      bump() {
        this.state.own++;
      }
      render() {
        return html`<button onclick="{this.bump}">{this.state.own}</button>`;
      }
    }
    childTag = `test-engine-child-${Date.now()}`;
    Child.tag = childTag;
    customElements.define(childTag, Child);

    class Parent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.label = 'a';
      }
      render() {
        return html`<p>{this.state.label}</p><${unsafeStatic(childTag)}></${unsafeStatic(childTag)}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Parent);
    const child = component.querySelector(childTag);
    await child.rendered;

    child.bump();
    await flushEffects();
    const button = child.querySelector('button');
    assert(button.textContent === '1', 'Child state should update');

    component.state.label = 'b';
    await flushEffects();
    await component.update();

    assert(component.querySelector(childTag) === child, 'Child component should be reused');
    assert(child.querySelector('button') === button, 'Child DOM should be reused');
    assert(button.textContent === '1', 'Child state should survive the parent update');

    cleanup();
  });

  test('TemplateEngine - nested TemplateResult renders as DOM and updates', async () => {
    class Nested extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.name = 'first';
      }
      render() {
        const inner = html`<em>{this.state.name}</em>`;
        return html`<div>${inner}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Nested);
    const em = component.querySelector('em');
    assert(em !== null, 'Nested TemplateResult should render as DOM');
    assert(em.textContent === 'first', 'Nested TemplateResult should render its value');

    component.state.name = 'second';
    await flushEffects();
    assert(component.querySelector('em')?.textContent === 'second', 'Nested TemplateResult should update');

    cleanup();
  });

  test('TemplateEngine - refs stay stable across update()', async () => {
    class RefComponent extends Component(HTMLElement) {
      render() {
        return html`<input ref="query" type="text">`;
      }
    }

    const {component, cleanup} = await createTestComponent(RefComponent);
    const first = component.refs.query;
    assert(first === component.querySelector('input'), 'Initial ref should be the input');

    await component.update();
    assert(component.refs.query === first, 'Ref should point to the same node after update()');
    assert(first.isConnected, 'Ref node should stay attached');

    cleanup();
  });

  test('TemplateEngine - component with changed template still replaces the DOM', async () => {
    class Switch extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.alt = false;
      }
      render() {
        return this.state.alt
          ? html`<section class="alt">alt</section>`
          : html`<div class="main">main</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Switch);
    const main = component.querySelector('.main');
    assert(main !== null, 'Initial template should render');

    component.state.alt = true;
    await component.update();

    assert(component.querySelector('.main') === null, 'Old template should be removed');
    assert(component.querySelector('.alt') !== null, 'New template should be rendered');
    assert(main.isConnected === false, 'Old node should be detached');

    cleanup();
  });
  test('TemplateEngine - ${} inside child content updates without replacing the child', async () => {
    class ValueChild extends Component(HTMLElement) {
      static tag = `test-engine-value-child-${Date.now()}`;
    }
    customElements.define(ValueChild.tag, ValueChild);

    class ValueParent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.title = 'one';
      }
      render() {
        return html`
          <${ValueChild}>
            <span class="value-text">${this.state.title}</span>
            <b class="value-attr" data-title="${this.state.title}">x</b>
          </${ValueChild}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(ValueParent);
    const child = component.querySelector(ValueChild.tag);
    await child.rendered;

    const text = child.querySelector('.value-text');
    const attr = child.querySelector('.value-attr');
    assert(text.textContent === 'one', 'Child content ${} text should render');
    assert(attr.getAttribute('data-title') === 'one', 'Child content ${} attribute should render');

    component.state.title = 'two';
    await component.update();

    assert(component.querySelector(ValueChild.tag) === child, 'Child component should be reused');
    assert(child.querySelector('.value-text') === text, 'Child text node should be reused');
    assert(text.textContent === 'two', 'Child content ${} text should update');
    assert(attr.getAttribute('data-title') === 'two', 'Child content ${} attribute should update');

    cleanup();
  });

  test('TemplateEngine - ${} inside nested child content propagates to grandchildren', async () => {
    class NestedValueGrandchild extends Component(HTMLElement) {
      static tag = `test-engine-nested-grand-${Date.now()}`;
    }
    customElements.define(NestedValueGrandchild.tag, NestedValueGrandchild);

    class NestedValueChild extends Component(HTMLElement) {
      static tag = `test-engine-nested-child-${Date.now()}`;
    }
    customElements.define(NestedValueChild.tag, NestedValueChild);

    class NestedValueParent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.title = 'first';
      }
      render() {
        return html`
          <${NestedValueChild}>
            <${NestedValueGrandchild}>
              <i class="nested-value">${this.state.title}</i>
            </${NestedValueGrandchild}>
          </${NestedValueChild}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(NestedValueParent);
    const child = component.querySelector(NestedValueChild.tag);
    const grand = child.querySelector(NestedValueGrandchild.tag);
    await grand.rendered;

    assert(grand.querySelector('.nested-value').textContent === 'first', 'Nested ${} should render');

    component.state.title = 'second';
    await component.update();

    assert(grand.querySelector('.nested-value').textContent === 'second', 'Nested ${} should update');

    cleanup();
  });

  test('TemplateEngine - ${} inside If/Loop content updates from parent values', async () => {
    class SlotValueParent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.title = 'alpha';
        this.state.items = [{id: 1}];
      }
      render() {
        return html`
          <${If} condition="{this.state.items.length}">
            <span class="if-value">${this.state.title}</span>
          </${If}>
          <${Loop} items="{this.state.items}" key="id" as="item">
            <span class="loop-value">${this.state.title}-{item.id}</span>
          </${Loop}>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(SlotValueParent);
    assert(component.querySelector('.if-value').textContent === 'alpha', 'If child ${} should render');
    assert(component.querySelector('.loop-value').textContent === 'alpha-1', 'Loop child ${} should render');

    component.state.title = 'beta';
    await component.update();

    assert(component.querySelector('.if-value').textContent === 'beta', 'If child ${} should update');
    assert(component.querySelector('.loop-value').textContent === 'beta-1', 'Loop child ${} should update');

    cleanup();
  });

  test('TemplateEngine - structured values keep later sibling parts on their own nodes', async () => {
    class StructuredSiblings extends Component(HTMLElement) {
      render() {
        const first = html`<b class="first">1</b>`;
        const second = html`<i class="second">2</i>`;
        return html`<div class="structured">${first}<span class="middle">mid</span>${second}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(StructuredSiblings);
    const div = component.querySelector('.structured');
    const tags = [...div.children].map(child => child.tagName);

    assert.deepEqual(tags, ['B', 'SPAN', 'I'], 'Structured ${} parts must not shift later sibling paths');
    assert(div.querySelector('.middle').textContent === 'mid', 'Static sibling should keep its content');

    cleanup();
  });

  test('TemplateEngine - nested TemplateResult keeps its own ${} values', async () => {
    class NestedLazy extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.name = 'first';
      }
      render() {
        return html`<div class="nested-lazy">${html`<em>${this.state.name}</em>`}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(NestedLazy);
    assert(component.querySelector('em').textContent === 'first', 'Nested ${} should render its value');

    component.state.name = 'second';
    await component.update();
    await flushEffects();

    assert(component.querySelector('em').textContent === 'second', 'Nested ${} should follow update() values');

    cleanup();
  });

  test('TemplateEngine - unquoted attribute values stay dynamic and escaped', async () => {
    class UnquotedAttribute extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'safe';
      }
      render() {
        return html`<div class="unquoted" data-value=${this.state.value}></div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(UnquotedAttribute);
    const div = component.querySelector('.unquoted');
    assert(div.getAttribute('data-value') === 'safe', 'Unquoted ${} should be attached as an attribute');

    const payload = 'a><img class="pwn" src=x>';
    component.state.value = payload;
    await component.update();
    await flushEffects();

    assert(div.getAttribute('data-value') === payload, 'Attribute value should be preserved verbatim');
    assert(component.querySelector('.pwn') === null, 'Attribute value must not inject markup');

    cleanup();
  });

  test('TemplateEngine - a literal < in text does not fold the following ${}', async () => {
    class LessThanText extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'one';
      }
      render() {
        return html`<p class="less-than">1 < 2 ${this.state.value}</p>`;
      }
    }

    const {component, cleanup} = await createTestComponent(LessThanText);
    const p = component.querySelector('.less-than');
    assert(p.textContent === '1 < 2 one', 'Text with < should render');

    const payload = '<img class="pwn" src=x>';
    component.state.value = payload;
    await component.update();
    await flushEffects();

    assert(p.textContent === `1 < 2 ${payload}`, 'Value after < should stay dynamic text');
    assert(component.querySelector('.pwn') === null, 'Text value must not inject markup');

    cleanup();
  });

  test('TemplateEngine - ${} inside an HTML comment is a compile error', () => {
    assert.throws(
      () => compileTemplate(html`<!-- ${'--> <img class="pwn">'} -->`),
      /comments are not supported/,
    );
  });

  test('TemplateEngine - ${} inside script/style raw text is rejected', () => {
    assert.throws(
      () => compileTemplate(html`<script>const t = ${'x'};</script>`),
      /Expressions inside <script> are not supported/,
    );
    assert.throws(
      () => compileTemplate(html`<style>.a { color: ${'red'}; }</style>`),
      /Expressions inside <style> are not supported/,
    );
  });

  test('TemplateEngine - clearTemplateCache clears call-site templates too', () => {
    clearTemplateCache();
    const make = () => html`<div class="cache-clear">${1}</div>`;

    const first = compileTemplate(make());
    clearTemplateCache();
    const second = compileTemplate(make());

    assert(first !== second, 'clearTemplateCache should drop the per-call-site cache');
  });

  test('TemplateEngine - changed folded values use a new compiled template', async () => {
    class DynamicTagSwitch extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.tag = 'section';
      }
      render() {
        return html`<${unsafeStatic(this.state.tag)} class="dynamic-tag">text</${unsafeStatic(this.state.tag)}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(DynamicTagSwitch);
    assert(component.querySelector('section.dynamic-tag') !== null, 'Dynamic tag should render');

    component.state.tag = 'article';
    await component.update();

    assert(component.querySelector('section.dynamic-tag') === null, 'Old folded template should be removed');
    assert(component.querySelector('article.dynamic-tag') !== null, 'New folded value should compile a new template');

    cleanup();
  });

  test('TemplateEngine - is="${Comp}" resolves the component tag', async () => {
    class IsTarget extends Component(HTMLElement) {
      static tag = 'test-engine-is-target';
      render() {
        return '<span class="is-inner">ok</span>';
      }
    }
    if (!customElements.get(IsTarget.tag)) customElements.define(IsTarget.tag, IsTarget);

    class UsesIs extends Component(HTMLElement) {
      render() {
        return html`<div class="is-host"><p has="x" is="${IsTarget}"></p></div>`;
      }
    }

    // Regression: an unresolved `${}` in `is` used to reach the custom elements
    // registry as a template token and abort the render.
    const {component, cleanup} = await createTestComponent(UsesIs);
    const el = component.querySelector('.is-host p');

    assert(el !== null, 'Element with is="${Comp}" should render');
    assert(el.getAttribute('is') === IsTarget.tag, 'is should carry the resolved tag name');
    assert(el.getAttribute('has') === 'x', 'Other static attributes should survive');

    cleanup();
  });

  test('TemplateEngine - declaration attribute does not swallow a sibling dynamic attribute', async () => {
    class IsSibling extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.cls = 'first';
      }
      render() {
        return html`<div class="is-sibling" data-cls="${this.state.cls}"></div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(IsSibling);
    const div = component.querySelector('.is-sibling');
    assert(div.getAttribute('data-cls') === 'first', 'Attribute after a declaration one should be dynamic');

    component.state.cls = 'second';
    await component.update();
    await flushEffects();

    assert(div.getAttribute('data-cls') === 'second', 'Dynamic attribute should keep patching');

    cleanup();
  });

  test('TemplateEngine - whitespace around = keeps the value dynamic', async () => {
    class SpacedAttr extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'safe';
      }
      render() {
        return html`<div class="spaced" data-value = ${this.state.value}></div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(SpacedAttr);
    const div = component.querySelector('.spaced');
    assert(div.getAttribute('data-value') === 'safe', 'Spaced unquoted ${} should attach as an attribute');

    const payload = '<img class="pwn-spaced" src=x>';
    component.state.value = payload;
    await component.update();
    await flushEffects();

    assert(div.getAttribute('data-value') === payload, 'Value should be preserved verbatim');
    assert(component.querySelector('.pwn-spaced') === null, 'Spaced value must not inject markup');

    cleanup();
  });

  test('TemplateEngine - spaced unquoted attribute is escaped on first render', () => {
    const compiled = compileTemplate(html`<b data-x = ${'"><img class="pwn-static">'}></b>`);
    const template = document.createElement('template');
    template.innerHTML = compiled.source;

    assert(template.content.querySelector('.pwn-static') === null, 'First render must not splice markup');
  });

  test('TemplateEngine - parent update keeps the child own ${} values', async () => {
    class OwnValueChild extends Component(HTMLElement) {
      static tag = `test-engine-own-value-${Date.now()}`;
      constructor() {
        super();
        this.state.label = 'child-own';
      }
      render() {
        return html`<span class="own-value">${this.state.label}</span>`;
      }
    }
    customElements.define(OwnValueChild.tag, OwnValueChild);

    class OwnValueParent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.parent = 'parent-value';
      }
      render() {
        return html`<div>${this.state.parent}</div><${OwnValueChild}></${OwnValueChild}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(OwnValueParent);
    const child = component.querySelector(OwnValueChild.tag);
    await child.rendered;

    assert(child.querySelector('.own-value').textContent === 'child-own', 'Initial child value');
    await component.update();
    await flushEffects();
    assert(child.querySelector('.own-value').textContent === 'child-own',
      'A parent update must not overwrite the child own ${} values');

    cleanup();
  });

  test('TemplateEngine - dynamic event handlers are re-resolved on dispatch', async () => {
    const calls = [];
    class EventSwitch extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.handler = () => calls.push('first');
      }
      render() {
        return html`<button onclick="{this.state.handler}">go</button>`;
      }
    }

    const {component, cleanup} = await createTestComponent(EventSwitch);
    const button = component.querySelector('button');
    button.click();

    component.state.handler = () => calls.push('second');
    await component.update();
    button.click();

    assert.deepEqual(calls, ['first', 'second'], 'The current handler should be used');
    cleanup();
  });

  test('TemplateEngine - is values require a class or unsafeStatic', () => {
    assert.throws(
      () => compileTemplate(html`<div is='${"x' onmouseover='alert(1)"}'></div>`),
      /requires a Component class or unsafeStatic/,
    );
    assert.throws(
      () => compileTemplate(html`<div is=${"foo onmouseover=alert(1)"}></div>`),
      /requires a Component class or unsafeStatic/,
    );
    assert.throws(
      () => compileTemplate(html`<div is="${unsafeStatic('plain')}"></div>`),
      /Invalid is=/,
    );
  });

  test('TemplateEngine - framework attributes reject ${} values', () => {
    assert.throws(
      () => compileTemplate(html`<veda-loop items="${[1, 2]}"></veda-loop>`),
      /does not support \$\{\} values/,
    );
    assert.throws(
      () => compileTemplate(html`<veda-if condition="${true}"></veda-if>`),
      /does not support \$\{\} values/,
    );
    assert.throws(
      () => compileTemplate(html`<veda-virtual height="${10}"></veda-virtual>`),
      /does not support \$\{\} values/,
    );
    assert.throws(
      () => compileTemplate(html`<veda-loop as="${'row'}"></veda-loop>`),
      /does not support \$\{\} values/,
    );
  });

  test('TemplateEngine - key/as/height stay ordinary attributes on user components', () => {
    // Only Loop/If/Virtual read these names as framework config. On a user
    // component they are normal attributes and must accept ${} values.
    assert.doesNotThrow(
      () => compileTemplate(html`<my-card key="${'k'}" as="${'a'}" height="${10}"></my-card>`),
      'User component attributes must not be treated as framework config',
    );
    const compiled = compileTemplate(html`<ul class="list" items="{this.state.items}"></ul>`);
    assert(compiled.source.includes('items="{this.state.items}"'), 'Semantic Loop keeps items');
  });

  test('TemplateEngine - dynamic tag names require explicit trust and cannot inject markup', () => {
    // Plain strings are data: they never become markup.
    assert.throws(
      () => compileTemplate(html`<${'123'}></${'123'}>`),
      /Dynamic tag names are not supported/,
    );
    assert.throws(
      () => compileTemplate(html`<${'img src=x onerror=alert(1)'}></div>`),
      /Dynamic tag names are not supported/,
    );
    assert.throws(
      () => compileTemplate(html`<div></${'div><img src=x onerror=alert(1)>'}>`),
      /Dynamic tag names are not supported/,
    );
    assert.throws(
      () => compileTemplate(html`<${'div onclick=alert(1)'}></div>`),
      /Dynamic tag names are not supported/,
    );

    // unsafeStatic() is trusted, but it is still a name: markup and dangerous
    // elements are rejected.
    assert.throws(
      () => compileTemplate(html`<${unsafeStatic('<img src=x>')}></${unsafeStatic('img>')}>`),
      /Invalid dynamic tag name/,
    );
    assert.throws(
      () => compileTemplate(html`<${unsafeStatic('script')}></${unsafeStatic('script')}>`),
      /cannot be created/,
    );

    // A Component class is always trusted and keeps folding to its tag.
    class SafeTag extends Component(HTMLElement) {
      static tag = 'test-engine-safe-tag';
    }
    const compiled = compileTemplate(html`<${SafeTag}></${SafeTag}>`);
    assert(compiled.source.includes('<test-engine-safe-tag></test-engine-safe-tag>'),
      'Component classes must keep folding to their tag');
  });

  test('TemplateEngine - attribute names never come from data', () => {
    // A data value in an attribute-name position is never a name.
    assert.throws(
      () => compileTemplate(html`<div ${'onclick'}="alert(1)"></div>`),
      /Dynamic attribute names are not supported/,
    );
    assert.throws(
      () => compileTemplate(html`<div on${'click'}="alert(1)"></div>`),
      /Dynamic attribute names are not supported/,
    );
    assert.throws(
      () => compileTemplate(html`<div data-${'id'}="1"></div>`),
      /Dynamic attribute names are not supported/,
    );

    // A string in a whole slot is a spread value, and a spread value must be an
    // object: markup is never parsed from data.
    const container = document.createElement('div');
    for (const payload of [
      'onmouseover=window.x=1',
      'x><img src=x onerror=alert(1)',
      'srcdoc="<img src=x onerror=alert(1)>"',
      'title="&#123;globalThis.__pwn=42&#125;"',
    ]) {
      assert.throws(
        () => render(html`<div ${payload}></div>`, container),
        /expects an object/,
        `snippet ${JSON.stringify(payload)} must not be parsed`,
      );
    }
  });

  test('TemplateEngine - an HTML comment inside an attribute stays data', async () => {
    class CommentAttribute extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'one';
      }
      render() {
        return html`<div class="comment-attr" title="<!-- ${this.state.value} -->">x</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(CommentAttribute);
    const div = component.querySelector('.comment-attr');
    assert(div.getAttribute('title') === '<!-- one -->', 'Initial attribute value');

    component.state.value = 'two';
    await component.update();
    await flushEffects();

    assert(component.querySelector('.comment-attr') === div, 'The element should be patched, not remounted');
    assert(div.getAttribute('title') === '<!-- two -->', 'The dynamic attribute should update');
    cleanup();
  });

  test('TemplateEngine - a spread after an unquoted literal stays a DOM slot', () => {
    const container = document.createElement('div');
    render(html`<div data-x=foo ${{'data-y': '1'}}></div>`, container);
    const div = container.firstElementChild;
    assert(div.getAttribute('data-x') === 'foo', 'The literal unquoted value should stay');
    assert(div.getAttribute('data-y') === '1', 'The spread should apply through the DOM');
  });

  test('TemplateEngine - html("...") reuses the string cache and the mounted DOM', async () => {
    clearTemplateCache();
    const source = '<div class="plain-string">plain</div>';
    assert(compileTemplate(source) === compileTemplate(source), 'The string cache should reuse the compiled template');

    class PlainString extends Component(HTMLElement) {
      render() {
        return html(source);
      }
    }

    const {component, cleanup} = await createTestComponent(PlainString);
    const div = component.querySelector('.plain-string');
    await component.update();
    await component.update();

    assert(component.querySelector('.plain-string') === div, 'The string template should be patched in place');
    cleanup();
  });

  test('TemplateEngine - nested TemplateResult is patched instead of remounted', async () => {
    class NestedFocus extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'one';
      }
      render() {
        return html`<div class="nested-focus">${html`<input class="nested-input" value="${this.state.value}">`}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(NestedFocus);
    const input = component.querySelector('.nested-input');
    input.focus();
    component.state.value = 'two';
    await component.update();
    await flushEffects();

    assert(component.querySelector('.nested-input') === input, 'Nested input should be reused');
    assert(document.activeElement === input, 'Focus should survive the nested patch');
    assert(component.querySelector('.nested-input').value === 'two', 'Nested value should update');
    cleanup();
  });

  test('TemplateEngine - clearing a parent removes nodes added by a nested template later', () => {
    const {container, cleanup} = createTestContainer();
    const view = (value, show = true) => html`<div>${show ? html`${value}<span>end</span>` : null}</div>`;

    render(view('one'), container);
    assert(container.innerHTML === '<div>one<span>end</span></div>', 'Initial nested text');

    render(view(html`<b>bold</b>`), container);
    assert(container.innerHTML === '<div><b>bold</b><span>end</span></div>', 'Nested template replaces text');

    render(view(null, false), container);
    assert(container.innerHTML === '<div></div>', 'Clearing the parent must remove nested nodes');
    cleanup();
  });

  test('TemplateEngine - structured DocumentFragment is replaced cleanly', async () => {
    class FragmentValue extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 1;
      }
      render() {
        const fragment = document.createDocumentFragment();
        const span = document.createElement('span');
        span.className = 'fragment-value';
        span.textContent = String(this.state.value);
        fragment.append(span);
        return html`<div>${fragment}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(FragmentValue);
    component.state.value = 2;
    await component.update();

    assert(component.querySelectorAll('.fragment-value').length === 1, 'Only one fragment child should remain');
    assert(component.querySelector('.fragment-value').textContent === '2', 'The new fragment should render');
    cleanup();
  });

  test('TemplateEngine - nothing, noChange and unsafeHTML have Lit semantics', async () => {
    class Sentinels extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'a';
        this.state.mode = 'value';
      }
      render() {
        const value = this.state.mode === 'nothing'
          ? nothing
          : this.state.mode === 'unsafe'
            ? unsafeHTML('<b class="trusted">ok</b>')
            : this.state.value;
        return html`<div class="sentinel">${value}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(Sentinels);
    const div = component.querySelector('.sentinel');
    assert(div.textContent === 'a', 'Initial value');

    component.state.value = noChange;
    await component.update();
    assert(div.textContent === 'a', 'noChange should keep the previous text');

    component.state.mode = 'nothing';
    await component.update();
    assert(div.textContent === '', 'nothing should clear the child');
    assert(component.querySelector('.sentinel') === div, 'The container should be reused');

    component.state.mode = 'unsafe';
    await component.update();
    assert(component.querySelector('.trusted')?.textContent === 'ok', 'unsafeHTML should render trusted markup');
    cleanup();
  });

  test('TemplateEngine - standalone render() patches the same container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = (value) => html`<div class="standalone">${value}</div>`;
    const first = render(view('a'), container);
    const div = container.querySelector('.standalone');
    const second = render(view('b'), container);

    assert(container.querySelector('.standalone') === div, 'Standalone render should patch in place');
    assert(div.textContent === 'b', 'Standalone render should update values');
    assert(first === second, 'The root instance should be reused');
    container.remove();
  });

  test('TemplateEngine - expressions inside nested <template> are rejected', () => {
    assert.throws(
      () => compileTemplate(html`<template><span>${'x'}</span></template>`),
      /nested <template> are not supported/,
    );
  });


  test('TemplateEngine - refs inside nested TemplateResult survive update', async () => {
    class NestedRefs extends Component(HTMLElement) {
      render() {
        return html`<div class="nested-refs">${html`<input ref="deep" class="deep">`}</div>`;
      }
    }

    const {component, cleanup} = await createTestComponent(NestedRefs);
    const input = component.querySelector('.deep');
    assert(component.refs.deep === input, 'Initial nested ref');
    await component.update();
    assert(component.refs.deep === input, 'Nested ref should be restored after update');
    cleanup();
  });

  test('TemplateEngine - static script and style braces are not expressions', () => {
    const compiled = compileTemplate(html`<style>.a { color: red; }</style><script>if (x) { y(); }</script>`);
    assert(compiled.source.includes('color: red'), 'Static CSS should be preserved');
    assert(compiled.source.includes('if (x)'), 'Static JS should be preserved');
  });


  test('TemplateEngine - spread supports properties and event listeners', () => {
    const calls = [];
    const container = document.createElement('div');
    render(html`<button ${{
      '@click': () => calls.push('a'),
      '.value': 'one',
      'aria-label': 'x',
    }}>go</button>`, container);
    const button = container.firstElementChild;
    button.click();
    assert.deepEqual(calls, ['a'], 'A spread @event should add a listener');
    assert(button.value === 'one', 'A spread .property should set the property');
    assert(button.getAttribute('aria-label') === 'x', 'A spread name should set the attribute');

    // A spread listener must be a function, and names stay validated.
    assert.throws(
      () => render(html`<div ${{'@click': 'alert(1)'}}></div>`, document.createElement('div')),
      /must be a function/,
    );
    assert.throws(
      () => render(html`<div ${{'@bad name': () => {}}}></div>`, document.createElement('div')),
      /Invalid event name/,
    );
    assert.throws(
      () => render(html`<div ${{'.onclick': 'alert(1)'}}></div>`, document.createElement('div')),
      /event handler property/,
    );
    assert.throws(
      () => render(html`<div ${{'.srcdoc': '<b>x</b>'}}></div>`, document.createElement('div')),
      /framework attribute|unsafeHTML/,
    );
  });

  test('TemplateEngine - data cannot inject expressions, framework attributes or sinks', () => {
    const container = document.createElement('div');

    // `items`/`condition` are evaluated as JavaScript by Loop/If, so they are
    // framework attributes and only the template may author them.
    assert.throws(
      () => render(html`<div class="victim" ${{items: 'globalThis.__pwn=1'}}></div>`, container),
      /framework attribute/,
    );
    assert.throws(
      () => render(html`<div class="victim" ${{condition: 'globalThis.__pwn=1'}}></div>`, container),
      /framework attribute/,
    );

    // HTML sinks and event handler content attributes are refused.
    assert.throws(
      () => render(html`<div ${{onclick: 'alert(1)'}}></div>`, container),
      /event handler attribute/,
    );
    assert.throws(
      () => render(html`<iframe ${{srcdoc: '<b>x</b>'}}></iframe>`, container),
      /framework attribute|not supported/,
    );

    // Compiler markers live in a reserved namespace and cannot be forged.
    assert.throws(
      () => render(html`<span ${{[ELEMENT_MARKER]: '1'}}></span>`, container),
      /reserved|framework attribute/,
    );
  });

  test('TemplateEngine - a script URL from a value is refused', () => {
    const container = document.createElement('div');
    assert.throws(
      () => render(html`<a href="${'java\nscript:alert(1)'}">x</a>`, container),
      /javascript:/,
    );
  });

  test('TemplateEngine - hyphenated custom events bind through on* attributes', async () => {
    class CustomEventChild extends Component(HTMLElement) {
      render() {
        return html`<button class="emit" onclick="{this.emit}">emit</button>`;
      }
      emit() {
        this.dispatchEvent(new CustomEvent('tab-change', {
          bubbles: true,
          composed: true,
          detail: {id: 'b'},
        }));
      }
    }

    const childTag = `test-event-child-${Date.now()}`;
    CustomEventChild.tag = childTag;
    customElements.define(childTag, CustomEventChild);

    class CustomEventParent extends Component(HTMLElement) {
      constructor() {
        super();
        this.received = null;
      }
      handleTabChange(event) {
        this.received = event.detail;
      }
      render() {
        return html`<${CustomEventChild} ontab-change="{this.handleTabChange}"></${CustomEventChild}>`;
      }
    }

    const {component, cleanup} = await createTestComponent(CustomEventParent);
    component.querySelector('.emit').click();
    await flushEffects();
    assert(component.received?.id === 'b', 'Custom event should reach the parent handler');
    cleanup();
  });



  test('Trusted Types - template compilation uses the veda-template policy', async () => {
    const policies = [];
    const previous = globalThis.trustedTypes;
    globalThis.trustedTypes = {
      createPolicy(name) {
        policies.push(name);
        return {createHTML: (source) => source};
      },
    };
    try {
      // A fresh module instance so the policy is created under the stub above.
      const mod = await import(`../src/template/Template.js?trusted-types=${Date.now()}`);
      mod.compileTemplate('<div class="tt">x</div>');
      assert(policies.includes('veda-template'), 'Compilation should create and use the veda-template policy');
    } finally {
      if (previous === undefined) delete globalThis.trustedTypes;
      else globalThis.trustedTypes = previous;
    }
  });

};
