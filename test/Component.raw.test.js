/**
 * Tests for uncovered code in Component.js
 * Covers lines 16-17: array handling in raw()
 */

import './setup-dom.js';
import { raw, html } from '../src/components/Component.js';

export default ({ test, assert }) => {

  test('raw() - handles array values in interpolation (coverage line 16-17)', () => {
    // Test array of strings
    const items = ['alpha', 'beta', 'gamma'];
    const result1 = raw`<div class="${items}">Content</div>`;

    assert(result1.includes('alpha beta gamma'), 'Should join array with spaces');
    assert(!result1.includes(','), 'Should not include commas');

    // Test array with single item
    const single = ['solo'];
    const result2 = raw`<span>${single}</span>`;
    assert(result2.includes('solo'), 'Should handle single-item array');

    // Test empty array
    const empty = [];
    const result3 = raw`<div>${empty}</div>`;
    assert(result3.includes('<div></div>'), 'Should handle empty array');

    // Test array in middle of template
    const mixed = ['class1', 'class2', 'class3'];
    const result4 = raw`<div class="${mixed}" id="test">Content</div>`;
    assert(result4.includes('class1 class2 class3'), 'Should join array in middle of template');
    assert(result4.includes('id="test"'), 'Should preserve other attributes');
  });

  test('raw() - handles nested arrays', () => {
    // Note: The code joins top-level arrays, nested arrays will be toString()
    const nested = [['a', 'b'], ['c', 'd']];
    const result = raw`<div>${nested}</div>`;

    // Arrays will be converted to string with default toString()
    assert(typeof result === 'string', 'Should produce string result');
  });

  test('raw() - handles array with non-string values', () => {
    const numbers = [1, 2, 3];
    const result1 = raw`<div>${numbers}</div>`;
    assert(result1.includes('1 2 3'), 'Should convert numbers to strings and join');

    const mixed = ['text', 123, true, null];
    const result2 = raw`<div>${mixed}</div>`;
    assert(result2.includes('text'), 'Should handle mixed types');
    assert(result2.includes('123'), 'Should convert number');
    assert(result2.includes('true'), 'Should convert boolean');
  });

  test('raw() - does not escape HTML in arrays', () => {
    const htmlItems = ['<span>1</span>', '<span>2</span>'];
    const result = raw`<div>${htmlItems}</div>`;

    // raw() should NOT escape - arrays are joined with space
    // The HTML in array items should remain as-is
    assert(result.includes('<span>1</span>'), 'Should not escape HTML in array items');
    assert(result.includes('<span>2</span>'), 'Should preserve all HTML');
  });

  test('raw() - multiple array interpolations', () => {
    const classes = ['btn', 'btn-primary'];
    const dataAttrs = ['data-x', 'data-y'];

    const result = raw`<button class="${classes}" ${dataAttrs}>Click</button>`;

    assert(result.includes('btn btn-primary'), 'Should handle first array');
    assert(result.includes('data-x data-y'), 'Should handle second array');
  });

  test('html() - does not join arrays (comparison with raw)', () => {
    // html() uses safe() which handles arrays differently
    const items = ['<b>one</b>', '<b>two</b>'];
    const result = html`<div>${items}</div>`;

    // html() escapes HTML
    assert(result.includes('&lt;b&gt;'), 'html() should escape HTML');

    // This is a comparison test showing that raw() and html() behave differently
  });
};

