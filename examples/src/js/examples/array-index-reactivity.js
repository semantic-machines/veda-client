import Component, { html } from '../../../../src/components/Component.js';
import { Loop } from '../../../../src/components/LoopComponent.js';

/**
 * This example demonstrates array reactivity.
 */
class ArrayIndexReactivity extends Component(HTMLElement) {
  static tag = 'array-index-reactivity';

  constructor() {
    super();
    this.state.numbers = [1, 2, 3, 4, 5];
  }

  get sum() {
    return this.state.numbers.reduce((acc, n) => acc + n, 0);
  }

  get average() {
    const len = this.state.numbers.length;
    return len > 0 ? (this.sum / len).toFixed(2) : '0';
  }

  get arrayString() {
    return '[' + this.state.numbers.toString() + ']';
  }

  get length() {
    return this.state.numbers.length;
  }

  handleInput(e) {
    const index = parseInt(e.target.dataset.index);
    const value = parseInt(e.target.value) || 0;
    this.state.numbers[index] = value;
  }

  push() {
    this.state.numbers.push(Math.floor(Math.random() * 100));
  }

  pop() {
    if (this.state.numbers.length > 1) {
      this.state.numbers.pop();
    }
  }

  doubleAll() {
    this.state.numbers = this.state.numbers.map(n => n*2);
  }

  shuffle() {
    const arr = this.state.numbers;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  reverse() {
    this.state.numbers.reverse();
  }

  sort() {
    this.state.numbers.sort((a, b) => a - b);
  }

  render() {
    return html`
      <div class="card">
        <h2>Array Index Reactivity</h2>

        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
          <${Loop} items="{this.state.numbers}" as="num">
            <input
              type="number"
              :value="{num}"
              data-index="{index}"
              oninput="{handleInput}"
              style="width: 60px; text-align: center;"
            />
          </${Loop}>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
          <button onclick="{push}">Push Random</button>
          <button onclick="{pop}">Pop</button>
          <button onclick="{doubleAll}">Double All</button>
          <button onclick="{shuffle}">Shuffle</button>
          <button onclick="{reverse}">Reverse</button>
          <button onclick="{sort}">Sort</button>
        </div>

        <div style="padding: 15px; background: #f5f5f5; border-radius: 6px;">
          <p><strong>Array:</strong> {this.arrayString}</p>
          <p><strong>Length:</strong> {this.length}</p>
          <p><strong>Sum:</strong> {this.sum}</p>
          <p><strong>Average:</strong> {this.average}</p>
        </div>
      </div>
    `;
  }
}

customElements.define(ArrayIndexReactivity.tag, ArrayIndexReactivity);
