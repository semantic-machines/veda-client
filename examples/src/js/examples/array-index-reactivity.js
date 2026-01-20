import Component, { html } from '../../../../src/components/Component.js';
import { Loop } from '../../../../src/components/LoopComponent.js';

class ArrayIndexReactivity extends Component(HTMLElement) {
  static tag = 'array-index-reactivity';

  constructor() {
    super();
    // Use objects with id for Loop key
    this.state.numbers = [
      { id: 0, value: 1 },
      { id: 1, value: 2 },
      { id: 2, value: 3 },
      { id: 3, value: 4 },
      { id: 4, value: 5 },
    ];
    this.state.nextId = 5;
  }

  get values() {
    return this.state.numbers.map(n => n.value);
  }

  get sum() {
    return this.values.reduce((a, b) => a + b, 0);
  }

  get average() {
    const len = this.state.numbers.length;
    return len > 0 ? (this.sum / len).toFixed(2) : '0';
  }

  get arrayString() {
    return '[' + this.values.join(', ') + ']';
  }

  get length() {
    return this.state.numbers.length;
  }

  updateByIndex(e) {
    const index = parseInt(e.target.dataset.index);
    const value = parseInt(e.target.value) || 0;
    this.state.numbers[index].value = value;
  }

  push() {
    const newNum = { id: this.state.nextId++, value: Math.floor(Math.random() * 100) };
    this.state.numbers = [...this.state.numbers, newNum];
  }

  pop() {
    if (this.state.numbers.length > 1) {
      this.state.numbers = this.state.numbers.slice(0, -1);
    }
  }

  doubleAll() {
    this.state.numbers = this.state.numbers.map(n => ({ ...n, value: n.value * 2 }));
  }

  shuffle() {
    const arr = [...this.state.numbers];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.state.numbers = arr;
  }

  reverse() {
    this.state.numbers = [...this.state.numbers].reverse();
  }

  sort() {
    this.state.numbers = [...this.state.numbers].sort((a, b) => a.value - b.value);
  }

  render() {
    return html`
      <div class="card">
        <h2>Array Index Reactivity</h2>

        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
          <${Loop} items="{this.state.numbers}" key="id" as="num">
            <input
              type="number"
              value="{num.value}"
              data-index="{index}"
              oninput="{updateByIndex}"
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
