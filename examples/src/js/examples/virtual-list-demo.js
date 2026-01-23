import Component, { html } from '../../../../src/components/Component.js';
import { Virtual } from '../../../../src/components/VirtualComponent.js';
import { Loop } from '../../../../src/components/LoopComponent.js';

// Browser max height ~33,554,432px limits scrollable items
const MAX_BROWSER_HEIGHT = 33554432;

class VirtualListDemo extends Component(HTMLElement) {
  static tag = 'virtual-list-demo';

  constructor() {
    super();
    this.state.itemCount = 10000;
    this.state.items = this.generateItems(10000);
    this.state.itemHeight = 50;
  }

  get maxScrollableItems() {
    return Math.floor(MAX_BROWSER_HEIGHT / this.state.itemHeight);
  }

  get maxScrollableFormatted() {
    return this.maxScrollableItems.toLocaleString();
  }

  get totalItemsFormatted() {
    return this.state.items.length.toLocaleString();
  }

  get isLimited() {
    return this.state.items.length > this.maxScrollableItems;
  }

  get limitedDisplay() {
    return this.isLimited ? 'block' : 'none';
  }

  generateItems(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 1000)
    }));
  }

  setItemCount(e) {
    const count = parseInt(e.target.value) || 1000;
    this.state.itemCount = count;
  }

  applyCount() {
    const start = performance.now();
    this.state.items = this.generateItems(this.state.itemCount);
    requestAnimationFrame(() => {
      const duration = (performance.now() - start).toFixed(2);
      console.log(`Generated ${this.state.itemCount} items in ${duration}ms`);
    });
  }

  shuffleItems() {
    const start = performance.now();
    const shuffled = [...this.state.items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.state.items = shuffled;
    requestAnimationFrame(() => {
      const duration = (performance.now() - start).toFixed(2);
      console.log(`Shuffled ${this.state.items.length} items in ${duration}ms`);
    });
  }

  addItems() {
    const newItems = Array.from({ length: 100 }, (_, i) => ({
      id: this.state.items.length + i,
      name: `New Item ${this.state.items.length + i + 1}`,
      value: Math.floor(Math.random() * 1000)
    }));
    this.state.items = [...this.state.items, ...newItems];
  }

  render() {
    return html`
      <div class="card">
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center;">
          <input type="number" :value="{this.state.itemCount}" oninput="{setItemCount}" style="width: 100px;" />
          <button onclick="{applyCount}">Set Count</button>
          <button onclick="{shuffleItems}">Shuffle</button>
          <button onclick="{addItems}">Add 100</button>
        </div>

        <div style="padding: 10px 15px; background: #f5f5f5; border-radius: 6px; margin-bottom: 15px; font-size: 14px;">
          <span style="margin-right: 20px;"><strong>Total items:</strong> {this.totalItemsFormatted}</span>
          <span style="margin-right: 20px;"><strong>DOM nodes:</strong> ~15-20 (only visible)</span>
          <span><strong>Max scrollable:</strong> {this.maxScrollableFormatted}</span>
        </div>

        <div style="display: {this.limitedDisplay}; padding: 10px 15px; background: #fff3e0; border: 1px solid #ffb74d; border-radius: 6px; margin-bottom: 15px; font-size: 14px; color: #e65100;">
          ⚠️ Browser height limit reached. Only {this.maxScrollableFormatted} of {this.totalItemsFormatted} items are scrollable.
          Use pagination or reduce item-height for larger datasets.
        </div>

        <div style="border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
          <${Virtual} items="{this.state.items}" height="400" item-height="50" overscan="3">
            <${Loop} items="{this.visibleItems}" key="id" as="item">
              <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee;">
                <span style="color: #999; font-size: 12px; width: 60px;">#{item.id}</span>
                <span style="flex: 1; font-weight: 500;">{item.name}</span>
                <span style="color: #2196F3; font-weight: bold;">{item.value}</span>
              </div>
            </${Loop}>
          </${Virtual}>
        </div>
      </div>
    `;
  }
}

customElements.define(VirtualListDemo.tag, VirtualListDemo);
