import Component, { html } from '../../../../src/components/Component.js';

/**
 * Example demonstrating complex expressions with auto-detection.
 *
 * All expressions use unified {expr} syntax.
 * Simple property paths and complex JS expressions are auto-detected.
 */
class ComplexExpressions extends Component(HTMLElement) {
  static tag = 'complex-expressions';

  constructor() {
    super();
    this.state.count = 5;
    this.state.price = 99.99;
    this.state.discount = 0.2;
    this.state.items = [
      { id: 1, name: 'Apple', active: true },
      { id: 2, name: 'Banana', active: false },
      { id: 3, name: 'Cherry', active: true },
    ];
    this.state.status = 'active';
    this.state.name = 'hello world';
  }

  increment() {
    this.state.count++;
  }

  decrement() {
    this.state.count--;
  }

  toggleItem(id) {
    const item = this.state.items.find(i => i.id === id);
    if (item) {
      item.active = !item.active;
      // Trigger reactivity by reassigning array
      this.state.items = [...this.state.items];
    }
  }

  render() {
    return html`
      <div class="card">
        <h2>Complex Expressions</h2>
        <p style="color: #666; margin-bottom: 20px;">
          All expressions use unified {expr} syntax — auto-detects simple paths vs complex JS
        </p>

        <!-- Arithmetic -->
        <section style="margin-bottom: 20px;">
          <h3>Arithmetic Operations</h3>
          <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
            <button onclick="{decrement}">-</button>
            <span style="font-size: 24px; min-width: 40px; text-align: center;">
              {this.state.count}
            </span>
            <button onclick="{increment}">+</button>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Doubled</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">
                { this.state.count * 2 }
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Squared</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">
                { this.state.count ** 2 }
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Is Even</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">
                { this.state.count % 2 === 0 ? 'Yes' : 'No' }
              </td>
            </tr>
          </table>
        </section>

        <!-- Price Calculation -->
        <section style="margin-bottom: 20px;">
          <h3>Price Calculation</h3>
          <p>Price: { this.state.price.toFixed(2) }</p>
          <p>Discount: { this.state.discount * 100 }%</p>
          <p>
            <strong>Final: { (this.state.price * (1 - this.state.discount)).toFixed(2) }</strong>
          </p>
        </section>

        <!-- String Methods -->
        <section style="margin-bottom: 20px;">
          <h3>String Methods</h3>
          <p>Original: "{this.state.name}"</p>
          <p>Uppercase: "{ this.state.name.toUpperCase() }"</p>
          <p>Capitalized: "{ this.state.name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') }"</p>
          <p>Length: { this.state.name.length } characters</p>
        </section>

        <!-- Ternary & Conditions -->
        <section style="margin-bottom: 20px;">
          <h3>Ternary & Conditions</h3>
          <p>Status: {this.state.status}</p>
          <p>
            Badge:
            <span style="padding: 4px 8px; border-radius: 4px; background: { this.state.status === 'active' ? '#4caf50' : '#f44336' }; color: white;">
              { this.state.status === 'active' ? 'Active' : 'Inactive' }
            </span>
          </p>
          <p>
            Count status: { this.state.count > 10 ? 'High' : this.state.count > 5 ? 'Medium' : 'Low' }
          </p>
        </section>

        <!-- Array Operations -->
        <section style="margin-bottom: 20px;">
          <h3>Array Operations</h3>
          <p>Total items: { this.state.items.length }</p>
          <p>Active items: { this.state.items.filter(i => i.active).length }</p>
          <p>All names: { this.state.items.map(i => i.name).join(', ') }</p>
          <p>Active names: { this.state.items.filter(i => i.active).map(i => i.name).join(', ') || 'None' }</p>

          <div style="margin-top: 10px;">
            <veda-loop items="{this.state.items}" key="id" as="item">
              <div style="display: flex; gap: 10px; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                <span style="flex: 1;">{item.name}</span>
                <span style="color: { item.active ? 'green' : 'red' };">
                  { item.active ? '✓ Active' : '✗ Inactive' }
                </span>
              </div>
            </veda-loop>
          </div>
        </section>

        <!-- Auto-detection Examples -->
        <section style="background: #f5f5f5; padding: 15px; border-radius: 6px;">
          <h3>Auto-Detection</h3>
          <p>The parser auto-detects expression complexity:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #e0e0e0;">
              <th style="padding: 8px; text-align: left;">Expression</th>
              <th style="padding: 8px; text-align: left;">Type</th>
              <th style="padding: 8px; text-align: left;">Result</th>
            </tr>
            <tr>
              <td style="padding: 8px; font-family: monospace;">{this.state.count}</td>
              <td style="padding: 8px;">Simple path</td>
              <td style="padding: 8px;">{this.state.count}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-family: monospace;">{ this.state.count * 2 }</td>
              <td style="padding: 8px;">Complex (auto)</td>
              <td style="padding: 8px;">{ this.state.count * 2 }</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-family: monospace;">{this.state.items.0.name}</td>
              <td style="padding: 8px;">Simple path</td>
              <td style="padding: 8px;">{this.state.items.0.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-family: monospace;">{ this.state.items[0].name }</td>
              <td style="padding: 8px;">Complex (auto)</td>
              <td style="padding: 8px;">{ this.state.items[0].name }</td>
            </tr>
          </table>
        </section>
      </div>
    `;
  }
}

customElements.define(ComplexExpressions.tag, ComplexExpressions);
