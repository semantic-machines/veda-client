import Component, { html } from '../../../../src/components/Component.js';
import { Slot } from '../../../../src/components/SlotComponent.js';
import { Place } from '../../../../src/components/PlaceComponent.js';
import { If } from '../../../../src/components/IfComponent.js';

class SlotLayout extends Component(HTMLElement) {
  static tag = 'slot-layout';

  render() {
    return html`
      <div style="display: grid; gap: 10px;">
        <div style="border: 2px dashed #1976d2; border-radius: 6px; padding: 10px; background: #e3f2fd;">
          <div style="font-size: 0.75em; color: #1565c0; margin-bottom: 6px;">layout hole: name="trigger"</div>
          <${Slot} name="trigger"></${Slot}>
        </div>
        <div style="border: 2px dashed #2e7d32; border-radius: 6px; padding: 10px; background: #e8f5e9;">
          <div style="font-size: 0.75em; color: #2e7d32; margin-bottom: 6px;">layout hole: name="content"</div>
          <${Slot} name="content"></${Slot}>
        </div>
        <div style="border: 2px dashed #757575; border-radius: 6px; padding: 10px; background: #f5f5f5;">
          <div style="font-size: 0.75em; color: #616161; margin-bottom: 6px;">layout hole: default (no name)</div>
          <${Slot}></${Slot}>
        </div>
      </div>
    `;
  }
}

class SlotDemo extends Component(HTMLElement) {
  static tag = 'slot-demo';

  constructor() {
    super();
    this.state.title = 'Contract';
    this.state.clicks = 0;
  }

  ping() {
    this.state.clicks++;
  }

  render() {
    return html`
      <div class="card">
        <h2>Slots</h2>
        <p>
          Parent passes three children into <code>slot-layout</code>.
          The layout only decides <em>where</em> they appear.
        </p>
        <p style="font-size: 0.9em; color: #555;">
          Change the title or click Ping — that state lives on this page, not inside the layout.
          After render, <code>this.refs.ping</code> is the slotted button.
        </p>
        <label style="display: block; margin: 0 0 12px;">
          Title
          <input bind="{this.state.title}">
        </label>

        <${SlotLayout}>
          <button slot="trigger" ref="ping" onclick="{this.ping}">Ping ({this.state.clicks})</button>
          <p slot="content" style="margin: 0;">{this.state.title}</p>
          <span>No slot attribute → default</span>
          and plain text
        </${SlotLayout}>
      </div>
    `;
  }
}

class DemoModal extends Component(HTMLElement) {
  static tag = 'demo-modal';

  render() {
    return html`
      <${Slot} name="trigger"></${Slot}>
      <${If} condition="{this.state.open}">
        <${Place} to="body">
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: #fff; padding: 24px; border-radius: 8px; min-width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
              <${Slot} name="content"></${Slot}>
              <button onclick="{this.close}" style="margin-top: 16px;">Close</button>
            </div>
          </div>
        </${Place}>
      </${If}>
    `;
  }
}

class PlaceDemo extends Component(HTMLElement) {
  static tag = 'place-demo';

  constructor() {
    super();
    this.state.open = false;
    this.state.title = 'Placed overlay';
  }

  open() {
    this.state.open = true;
  }

  close() {
    this.state.open = false;
  }

  render() {
    return html`
      <div class="card">
        <h2>Place</h2>
        <p>Modal markup lives here; the overlay is placed into <code>document.body</code>.</p>

        <${DemoModal} :open="{this.state.open}">
          <button slot="trigger" onclick="{this.open}">Open modal</button>
          <p slot="content" style="margin: 0;">{this.state.title}</p>
        </${DemoModal}>
      </div>
    `;
  }
}

customElements.define(SlotLayout.tag, SlotLayout);
customElements.define(SlotDemo.tag, SlotDemo);
customElements.define(DemoModal.tag, DemoModal);
customElements.define(PlaceDemo.tag, PlaceDemo);
