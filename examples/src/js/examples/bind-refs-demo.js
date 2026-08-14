import Component, { html } from '../../../../src/components/Component.js';

class BindRefsDemo extends Component(HTMLElement) {
  static tag = 'bind-refs-demo';

  constructor() {
    super();
    this.state.q = 'hello';
    this.state.done = false;
    this.state.kind = 'all';
    this.state.via = 'open';
  }

  focusQuery() {
    this.refs.query?.focus();
  }

  render() {
    return html`
      <div class="card">
        <h2>bind and refs</h2>

        <div style="display: grid; gap: 10px; max-width: 320px;">
          <label>
            Query
            <input ref="query" bind="{this.state.q}">
          </label>
          <label>
            <input type="checkbox" bind="{this.state.done}">
            Done
          </label>
          <label>
            Kind
            <select bind="{this.state.kind}">
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <div>
            Via
            <label><input type="radio" name="via-demo" value="open" bind="{this.state.via}"> open</label>
            <label><input type="radio" name="via-demo" value="closed" bind="{this.state.via}"> closed</label>
          </div>
          <button onclick="{this.focusQuery}">Focus query</button>
        </div>

        <div style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 6px;">
          <p style="margin: 0;"><strong>q:</strong> {this.state.q}</p>
          <p style="margin: 8px 0 0;"><strong>done:</strong> {this.state.done}</p>
          <p style="margin: 8px 0 0;"><strong>kind:</strong> {this.state.kind}</p>
          <p style="margin: 8px 0 0;"><strong>via:</strong> {this.state.via}</p>
        </div>
      </div>
    `;
  }
}

customElements.define(BindRefsDemo.tag, BindRefsDemo);
