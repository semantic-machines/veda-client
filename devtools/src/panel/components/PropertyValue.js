/**
 * Property Value - Displays value with clickable links
 */

import { Component, html, Loop, If } from '../../../../src/index.js';

export default class PropertyValue extends Component(HTMLElement) {
  static tag = 'property-value';

  handleLinkClick(e, node) {
    e.preventDefault();
    e.stopPropagation();
    const modelId = node.dataset.uri;
    if (modelId && this.state.onNavigate) {
      this.state.onNavigate(modelId);
    }
  }

  get hasText() {
    return this.state.text && this.state.text.length > 0;
  }

  get hasLinks() {
    return this.state.links && this.state.links.length > 0;
  }

  get linkItems() {
    if (!this.state.links) return [];
    return this.state.links.map((uri, i) => ({
      id: i,
      uri
    }));
  }

  get linksClass() {
    return this.hasText ? 'prop-links with-text' : 'prop-links';
  }

  render() {
    return html`
      <${If} condition="{this.hasText}">
        <span class="prop-value-text">{this.state.text}</span>
      </${If}>
      <${If} condition="{this.hasLinks}">
        <span class="{this.linksClass}">
          <${Loop} items="{this.linkItems}" key="id" as="link">
            <a href="#" class="prop-link" data-uri="{link.uri}" onclick="{handleLinkClick}">{link.uri}</a>
          </${Loop}>
        </span>
      </${If}>
    `;
  }
}

