import Component, { html } from '../../../../src/components/Component.js';

class ReactiveCounter extends Component(HTMLElement) {
  static tag = 'reactive-counter';

  constructor() {
    super();
    this.state.count = 0;
  }

  get doubled() {
    return this.state.count * 2;
  }

  get isEven() {
    return this.state.count % 2 === 0 ?  'Yes' : 'No';
  }

  async connectedCallback() {
    await super.connectedCallback();

    this.watch(() => this.state.count, (newVal, oldVal) => {
      console.log(`Count changed from ${oldVal} to ${newVal}`);
    });

    this.watch(() => this.isEven, (even) => {
      this.style.background = even ? '#e8f5e9' : '#fff3e0';
    });
  }

  increment() {
    this.state.count++;
  }

  decrement() {
    this.state.count--;
  }

  reset() {
    this.state.count = 0;
  }

  render() {
    return html`
      <div class="card">
        <h2>Counter: {this.state.count}</h2>

        <div style="display: flex; gap: 10px;">
          <button onclick="{decrement}">-1</button>
          <button onclick="{increment}">+1</button>
          <button onclick="{reset}">Reset</button>
        </div>

        <div style="margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 6px;">
          <p><strong>Doubled:</strong> {this.doubled}</p>
          <p><strong>Is Even:</strong> {this.isEven}</p>
        </div>
      </div>
    `;
  }
}

customElements.define(ReactiveCounter.tag, ReactiveCounter);
