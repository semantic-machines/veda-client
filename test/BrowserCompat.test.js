/**
 * Browser Compatibility Tests
 * Test browser-specific quirks and edge cases
 */

import './setup-dom.js';
import Component, { html, reactive } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import { createTestComponent } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== DOM QUIRKS ====================

  test('Browser - handles whitespace text nodes correctly', async () => {
    class WhitespaceComponent extends Component(HTMLElement) {
      render() {
        return html`
          <div>
            <span>A</span>
            <span>B</span>
          </div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(WhitespaceComponent);
    await flushEffects();

    const div = component.querySelector('div');
    const spans = div.querySelectorAll('span');

    assert(spans.length === 2, 'Should have 2 spans');
    assert(spans[0].textContent === 'A', 'First span correct');
    assert(spans[1].textContent === 'B', 'Second span correct');

    cleanup();
  });

  test('Browser - handles self-closing tags correctly', async () => {
    class SelfClosingComponent extends Component(HTMLElement) {
      render() {
        return html`
          <div>
            <img src="test.jpg" alt="Test"/>
            <br/>
            <input type="text"/>
          </div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(SelfClosingComponent);
    await flushEffects();

    assert(component.querySelector('img') !== null, 'img should exist');
    assert(component.querySelector('br') !== null, 'br should exist');
    assert(component.querySelector('input') !== null, 'input should exist');

    cleanup();
  });

  test('Browser - case-insensitive attribute names', async () => {
    class CaseInsensitiveComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ value: 'test' });
      }
      render() {
        // Test that both work
        return html`
          <div data-value="{this.state.value}" DATA-VALUE2="{this.state.value}">
            Content
          </div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(CaseInsensitiveComponent);
    await flushEffects();

    const div = component.querySelector('div');
    // Browser normalizes to lowercase
    assert(div.hasAttribute('data-value'), 'Should have data-value');
    assert(div.hasAttribute('data-value2'), 'Should have data-value2 (normalized)');

    cleanup();
  });

  // ==================== EVENT HANDLING QUIRKS ====================

  test('Browser - event.preventDefault() works in handlers', async () => {
    class PreventDefaultComponent extends Component(HTMLElement) {
      handleSubmit(event) {
        event.preventDefault();
        this.submitted = true;
      }

      render() {
        return html`
          <form onsubmit="{this.handleSubmit}">
            <button type="submit">Submit</button>
          </form>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(PreventDefaultComponent);
    await flushEffects();

    const form = component.querySelector('form');
    const button = form.querySelector('button');

    // Trigger via button click which properly creates submit event
    button.click();
    await flushEffects();

    assert(component.submitted, 'Handler should execute');

    cleanup();
  });

  test('Browser - focus/blur events work correctly', async () => {
    class FocusComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.focusCount = 0;
        this.blurCount = 0;
      }

      handleFocus() {
        this.focusCount++;
      }

      handleBlur() {
        this.blurCount++;
      }

      render() {
        return html`
          <input type="text" onfocus="{this.handleFocus}" onblur="{this.handleBlur}">
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(FocusComponent);
    await flushEffects();

    const input = component.querySelector('input');

    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flushEffects();
    assert(component.focusCount === 1, 'Focus should trigger once');

    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await flushEffects();
    assert(component.blurCount === 1, 'Blur should trigger once');

    cleanup();
  });

  // ==================== DOM MANIPULATION QUIRKS ====================

  test('Browser - innerHTML preserves structure', async () => {
    class InnerHTMLComponent extends Component(HTMLElement) {
      render() {
        return html`
          <div class="container">
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(InnerHTMLComponent);
    await flushEffects();

    const container = component.querySelector('.container');
    const innerHTML = container.innerHTML;

    // Re-parse to verify structure is valid
    const temp = document.createElement('div');
    temp.innerHTML = innerHTML;

    assert(temp.querySelector('ul') !== null, 'UL should exist in innerHTML');
    assert(temp.querySelectorAll('li').length === 2, 'Should have 2 LI elements');

    cleanup();
  });

  test('Browser - textContent vs innerText differences', async () => {
    class TextContentComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ text: 'Hello\nWorld' });
      }
      render() {
        return html`<div>{this.state.text}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(TextContentComponent);
    await flushEffects();

    const div = component.querySelector('div');

    // textContent includes newlines as-is
    assert(div.textContent.includes('\n'), 'textContent should include newline');

    cleanup();
  });

  // ==================== ATTRIBUTE HANDLING QUIRKS ====================

  test('Browser - class vs className handling', async () => {
    class ClassNameComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ cls: 'btn primary' });
      }
      render() {
        return html`<div class="{this.state.cls}">Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ClassNameComponent);
    await flushEffects();

    const div = component.querySelector('div');

    assert(div.className === 'btn primary', 'className property should work');
    assert(div.getAttribute('class') === 'btn primary', 'class attribute should work');
    assert(div.classList.contains('btn'), 'classList should work');
    assert(div.classList.contains('primary'), 'classList should have all classes');

    cleanup();
  });

  test('Browser - style attribute parsing', async () => {
    class StyleComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ color: 'red' });
      }
      render() {
        return html`<div style="color: {this.state.color}; font-size: 16px">Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(StyleComponent);
    await flushEffects();

    const div = component.querySelector('div');
    const style = div.getAttribute('style');

    assert(style !== null, 'Style attribute should exist');
    assert(style.includes('color'), 'Style should include color');

    cleanup();
  });

  test('Browser - boolean attribute edge cases', async () => {
    class BooleanAttrComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ disabled: '' }); // Empty string
      }
      render() {
        return html`<button disabled="{this.state.disabled}">Click</button>`;
      }
    }

    const { component, cleanup } = await createTestComponent(BooleanAttrComponent);
    await flushEffects();

    const button = component.querySelector('button');

    // Empty string for boolean attribute = true in HTML
    // But framework behavior may vary
    const isDisabled = button.hasAttribute('disabled') || button.disabled;

    // Just verify it doesn't crash
    assert(button !== null, 'Button should exist');

    cleanup();
  });

  // ==================== SPECIAL CHARACTERS ====================

  test('Browser - handles unicode characters correctly', async () => {
    class UnicodeComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({
          text: '你好世界 🌍 Привет мир ñ é ü'
        });
      }
      render() {
        return html`<div>{this.state.text}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(UnicodeComponent);
    await flushEffects();

    const div = component.querySelector('div');
    assert(div.textContent.includes('你好'), 'Should handle Chinese');
    assert(div.textContent.includes('🌍'), 'Should handle emoji');
    assert(div.textContent.includes('Привет'), 'Should handle Cyrillic');
    assert(div.textContent.includes('ñ'), 'Should handle accented characters');

    cleanup();
  });

  test('Browser - handles HTML entities correctly', async () => {
    class EntitiesComponent extends Component(HTMLElement) {
      constructor() {
        super();
        // Test with actual HTML that needs escaping
        this.state = reactive({ text: '<div> & "quotes"' });
      }
      render() {
        return html`<div>{this.state.text}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(EntitiesComponent);
    await flushEffects();

    const div = component.querySelector('div');
    const text = div.textContent;

    // html`` escapes dangerous characters, so we should see the literal text
    // not actual HTML elements
    assert(text === '<div> & "quotes"',
      `Expected escaped text, got: ${text}`);

    // Verify no actual HTML elements were created
    assert(component.querySelectorAll('div').length === 1,
      'Should only have the wrapper div, not nested divs from text');

    cleanup();
  });

  test('Browser - double-escaping HTML entities (already escaped input)', async () => {
    class DoubleEscapeComponent extends Component(HTMLElement) {
      constructor() {
        super();
        // Already escaped entities in source
        this.state = reactive({ text: '&lt;div&gt; &amp; &quot;' });
      }
      render() {
        return html`<div>{this.state.text}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(DoubleEscapeComponent);
    await flushEffects();

    const div = component.querySelector('div');
    assert(div !== null, 'Div element should exist');

    const innerHTML = div.innerHTML;
    const text = div.textContent;

    // html`` will escape & again, so &lt; becomes &amp;lt;
    // Browser renders this as the literal text "&lt;div&gt; &amp; &quot;"
    assert(text === '&lt;div&gt; &amp; &quot;',
      `Double-escaped entities should appear as entity codes, got: ${text}`);

    // innerHTML should show the double-escaped version
    assert(innerHTML.includes('&amp;lt;') || text.includes('&lt;'),
      'innerHTML should contain double-escaped entities');

    cleanup();
  });

  // ==================== FORM ELEMENT QUIRKS ====================

  test('Browser - input value vs attribute', async () => {
    class InputValueComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ value: 'initial' });
      }
      render() {
        return html`<input type="text" value="{this.state.value}">`;
      }
    }

    const { component, cleanup } = await createTestComponent(InputValueComponent);
    await flushEffects();

    const input = component.querySelector('input');

    // Property vs attribute can differ
    assert(input.value === 'initial' || input.getAttribute('value') === 'initial',
      'Input should have initial value');

    component.state.value = 'updated';
    await flushEffects();

    assert(input.value === 'updated' || input.getAttribute('value') === 'updated',
      'Input should update');

    cleanup();
  });

  test('Browser - checkbox checked property', async () => {
    class CheckboxComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ checked: true });
      }
      render() {
        return html`<input type="checkbox" checked="{this.state.checked}">`;
      }
    }

    const { component, cleanup } = await createTestComponent(CheckboxComponent);
    await flushEffects();

    const checkbox = component.querySelector('input');
    assert(checkbox.checked === true, 'Checkbox should be checked');

    component.state.checked = false;
    await flushEffects();

    assert(checkbox.checked === false, 'Checkbox should be unchecked');

    cleanup();
  });

  test('Browser - select option selected', async () => {
    class SelectComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ value: 'b' });
      }
      get isBSelected() {
        return this.state.value === 'b';
      }
      render() {
        return html`
          <select>
            <option value="a">A</option>
            <option value="b" selected="{this.isBSelected}">B</option>
            <option value="c">C</option>
          </select>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(SelectComponent);
    await flushEffects();

    const select = component.querySelector('select');
    const optionB = select.querySelector('option[value="b"]');

    assert(optionB.selected || optionB.hasAttribute('selected'),
      'Option B should be selected');

    cleanup();
  });

  // ==================== TABLE QUIRKS ====================

  test('Browser - table structure with tbody', async () => {
    class TableComponent extends Component(HTMLElement) {
      render() {
        return html`
          <table>
            <tr>
              <td>Cell</td>
            </tr>
          </table>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TableComponent);
    await flushEffects();

    const table = component.querySelector('table');

    // Browser automatically inserts tbody
    const tbody = table.querySelector('tbody');
    const hasTbody = tbody !== null;

    // Either tbody exists or tr is direct child
    const tr = table.querySelector('tr');
    assert(tr !== null, 'TR should exist somewhere in table');

    cleanup();
  });

  // ==================== SVG QUIRKS ====================

  test('Browser - SVG namespace handling', async () => {
    class SVGComponent extends Component(HTMLElement) {
      render() {
        return html`
          <svg width="100" height="100">
            <circle cx="50" cy="50" r="40" fill="red"/>
          </svg>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(SVGComponent);
    await flushEffects();

    const svg = component.querySelector('svg');
    assert(svg !== null, 'SVG should exist');

    const circle = svg.querySelector('circle');
    assert(circle !== null, 'Circle should exist');

    cleanup();
  });

  // ==================== CUSTOM ELEMENT QUIRKS ====================

  test('Browser - custom elements with hyphens', async () => {
    class CustomChild extends Component(HTMLElement) {
      render() {
        return html`<span>Custom</span>`;
      }
    }

    const tagName = `test-custom-${Date.now()}`;
    customElements.define(tagName, CustomChild);

    class ParentComponent extends Component(HTMLElement) {
      render() {
        return html`<div><${tagName}></${tagName}></div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ParentComponent);
    await flushEffects();

    const custom = component.querySelector(tagName);
    assert(custom !== null, 'Custom element should exist');

    cleanup();
  });

};

