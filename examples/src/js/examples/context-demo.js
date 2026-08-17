import Component, { html } from '../../../../src/components/Component.js';
import { Context } from '../../../../src/components/ContextComponent.js';

class ContextStatusBar extends Component(HTMLElement) {
  static tag = 'context-status-bar';

  get hello() {
    return this.context.locale === 'en' ? 'Hello' : 'Привет';
  }

  render() {
    return html`
      <p style="margin: 0; font-size: 1.05em;">
        {this.hello} · theme: <strong>{this.context.theme}</strong>
        · locale: <strong>{this.context.locale}</strong>
      </p>
    `;
  }
}

class ContextNestedPanel extends Component(HTMLElement) {
  static tag = 'context-nested-panel';

  render() {
    return html`
      <${Context} :theme="{'dark'}">
        <div style="padding: 14px; border-radius: 8px; background: #2a1f3d; color: #f3e8ff; border: 1px solid #7c5cbf;">
          <p style="margin: 0 0 8px; font-size: 0.85em; opacity: 0.85;">Nested provider: theme locked to dark, locale still comes from outside</p>
          <context-status-bar></context-status-bar>
        </div>
      </${Context}>
    `;
  }
}

class ContextThemedBox extends Component(HTMLElement) {
  static tag = 'context-themed-box';

  get boxStyle() {
    return this.context.theme === 'dark'
      ? 'padding: 16px; border-radius: 8px; background: #1c2330; color: #e8eef7; border: 1px solid #4a5a70;'
      : 'padding: 16px; border-radius: 8px; background: #fff6d8; color: #1a1408; border: 1px solid #e6d089;';
  }

  get buttonStyle() {
    return this.context.theme === 'dark'
      ? 'background: #2d3a4d; color: #e8eef7; border-color: #6a7a90;'
      : 'background: #fff; color: #1a1408; border-color: #c4a035;';
  }

  render() {
    return html`
      <div style="{this.boxStyle}">
        <p style="margin: 0 0 8px;">Outer provider</p>
        <context-status-bar></context-status-bar>
        <div style="display: flex; gap: 10px; margin: 14px 0;">
          <button onclick="{this.context.toggleTheme}" style="{this.buttonStyle}">Toggle theme</button>
          <button onclick="{this.context.toggleLocale}" style="{this.buttonStyle}">Toggle locale</button>
        </div>
        <context-nested-panel></context-nested-panel>
      </div>
    `;
  }
}

class ContextDemo extends Component(HTMLElement) {
  static tag = 'context-demo';

  constructor() {
    super();
    this.state.theme = 'light';
    this.state.locale = 'ru';
  }

  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
  }

  toggleLocale() {
    this.state.locale = this.state.locale === 'ru' ? 'en' : 'ru';
  }

  render() {
    return html`
      <div class="card">
        <h2>Context</h2>
        <p>Descendants read <code>this.context</code>. Toggle theme to recolor the outer panel. The inner panel stays dark.</p>

        <${Context}
          :theme="{this.state.theme}"
          :locale="{this.state.locale}"
          :toggle-theme="{this.toggleTheme}"
          :toggle-locale="{this.toggleLocale}">
          <context-themed-box></context-themed-box>
        </${Context}>
      </div>
    `;
  }
}

customElements.define(ContextStatusBar.tag, ContextStatusBar);
customElements.define(ContextNestedPanel.tag, ContextNestedPanel);
customElements.define(ContextThemedBox.tag, ContextThemedBox);
customElements.define(ContextDemo.tag, ContextDemo);
