import Component, { html } from '../../../../src/components/Component.js';
import { Virtual } from '../../../../src/components/VirtualComponent.js';

class VirtualTableDemo extends Component(HTMLElement) {
  static tag = 'virtual-table-demo';

  constructor() {
    super();
    this.state.itemCount = 5000;
    this.state.items = this.generateItems(5000);
    this.state.showSummary = true;
  }

  get totalValue() {
    return this.state.items.reduce((sum, item) => sum + item.salary, 0);
  }

  get averageSalary() {
    const items = this.state.items;
    if (!items.length) return 0;
    return Math.round(this.totalValue / items.length);
  }

  get totalFormatted() {
    return this.totalValue.toLocaleString();
  }

  get averageFormatted() {
    return this.averageSalary.toLocaleString();
  }

  get totalItemsFormatted() {
    return this.state.items.length.toLocaleString();
  }

  generateItems(count) {
    const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Support', 'Design', 'Product'];
    const roles = ['Junior', 'Middle', 'Senior', 'Lead', 'Manager', 'Director'];
    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];

    return Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`,
      department: departments[i % departments.length],
      role: roles[i % roles.length],
      salary: 40000 + Math.floor(Math.random() * 80000),
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
      console.log(`Generated ${this.state.itemCount} rows in ${(performance.now() - start).toFixed(2)}ms`);
    });
  }

  toggleSummary() {
    this.state.showSummary = !this.state.showSummary;
  }

  autoScroll() {
    if (this._autoScrollId) {
      cancelAnimationFrame(this._autoScrollId);
      this._autoScrollId = null;
      return;
    }

    const viewport = this.querySelector('.virtual-viewport');
    if (!viewport) return;

    const speed = 1; // px per frame (~60px/s at 60fps)
    const step = () => {
      viewport.scrollTop += speed;
      // Stop at the bottom
      if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight) {
        this._autoScrollId = null;
        return;
      }
      this._autoScrollId = requestAnimationFrame(step);
    };
    this._autoScrollId = requestAnimationFrame(step);
  }

  render() {
    return html`
      <div class="card">

        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center;">
          <input type="number" :value="{this.state.itemCount}" oninput="{setItemCount}" style="width: 100px;" />
          <button onclick="{applyCount}">Set Count</button>
          <button onclick="{toggleSummary}">Toggle Summary</button>
          <button onclick="{autoScroll}" style="background: #1976d2; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer;">Auto Scroll</button>
        </div>

        <div style="padding: 10px 15px; background: #f5f5f5; border-radius: 6px; margin-bottom: 15px; font-size: 14px;">
          <span style="margin-right: 20px;"><strong>Total rows:</strong> {this.totalItemsFormatted}</span>
          <span><strong>DOM nodes:</strong> ~15-20 (only visible)</span>
        </div>

        <div style="border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
          <${Virtual} items="{this.state.items}" height="400" item-height="42">
            <table>
              <thead>
                <tr style="background: #f8f9fa; box-shadow: inset 0 -2px 0 #dee2e6;">
                  <th style="padding: 0 12px; height: 42px; line-height: 42px; text-align: left; font-size: 13px; color: #495057; width: 50px; white-space: nowrap; overflow: hidden;">#</th>
                  <th style="padding: 0 12px; height: 42px; line-height: 42px; text-align: left; font-size: 13px; color: #495057; white-space: nowrap; overflow: hidden;">Name</th>
                  <th style="padding: 0 12px; height: 42px; line-height: 42px; text-align: left; font-size: 13px; color: #495057; white-space: nowrap; overflow: hidden;">Department</th>
                  <th style="padding: 0 12px; height: 42px; line-height: 42px; text-align: left; font-size: 13px; color: #495057; white-space: nowrap; overflow: hidden;">Role</th>
                  <th style="padding: 0 12px; height: 42px; line-height: 42px; text-align: right; font-size: 13px; color: #495057; width: 100px; white-space: nowrap; overflow: hidden;">Salary</th>
                </tr>
              </thead>
              <tbody items="{this.visibleItems}" as="row" key="id">
                <tr style="box-shadow: inset 0 -1px 0 #eee;">
                  <td style="padding: 0 12px; height: 42px; line-height: 42px; font-size: 12px; color: #999; white-space: nowrap; overflow: hidden;">{row.id}</td>
                  <td style="padding: 0 12px; height: 42px; line-height: 42px; font-weight: 500; white-space: nowrap; overflow: hidden;">{row.name}</td>
                  <td style="padding: 0 12px; height: 42px; line-height: 42px; color: #666; white-space: nowrap; overflow: hidden;">{row.department}</td>
                  <td style="padding: 0 12px; height: 42px; line-height: 42px; color: #666; white-space: nowrap; overflow: hidden;">{row.role}</td>
                  <td style="padding: 0 12px; height: 42px; line-height: 42px; text-align: right; color: #2e7d32; font-weight: bold; white-space: nowrap; overflow: hidden;">{row.salary.toLocaleString()}</td>
                </tr>
              </tbody>
              <tfoot condition="{this.state.showSummary}">
                <tr style="background: #e8f5e9; box-shadow: inset 0 2px 0 #4caf50;">
                  <td colspan="3" style="padding: 0 12px; height: 42px; line-height: 42px; font-size: 14px;"><strong>Average salary:</strong> {this.averageFormatted}</td>
                  <td colspan="2" style="padding: 0 12px; height: 42px; line-height: 42px; font-size: 14px; text-align: right;"><strong>Total payroll:</strong> {this.totalFormatted}</td>
                </tr>
              </tfoot>
            </table>
          </${Virtual}>
        </div>
      </div>
    `;
  }
}

customElements.define(VirtualTableDemo.tag, VirtualTableDemo);
