import Component, { html } from '../../../../src/components/Component.js';

class ReactiveExpressions extends Component(HTMLElement) {
  static tag = 'reactive-expressions';

  constructor() {
    super();
    this.state.firstName = 'John';
    this.state.lastName = 'Doe';
    this.state.age = 25;
    this.state.showDetails = true;
  }

  // Computed properties - all logic goes here
  get fullName() {
    return `${this.state.firstName} ${this.state.lastName}`;
  }

  get canVoteText() {
    return this.state.age >= 18 ? '✅ Yes' : '❌ No (under 18)';
  }

  get ageStatus() {
    if (this.state.age < 13) return 'Child';
    if (this.state.age < 20) return 'Teenager';
    return 'Adult';
  }

  get toggleButtonText() {
    return this.state.showDetails ? 'Hide' : 'Show';
  }

  get detailsDisplay() {
    return this.state.showDetails ? 'block' : 'none';
  }

  get stateJson() {
    return JSON.stringify(this.state, null, 2);
  }

  updateFirstName(e) {
    this.state.firstName = e.target.value;
  }

  updateLastName(e) {
    this.state.lastName = e.target.value;
  }

  updateAge(e) {
    this.state.age = parseInt(e.target.value) || 0;
  }

  toggleDetails() {
    this.state.showDetails = !this.state.showDetails;
  }

  render() {
    return html`
      <div class="card">
        <h2>Reactive Expressions</h2>

        <div style="display: grid; gap: 10px; max-width: 300px;">
          <label>
            First Name:
            <input value="{this.state.firstName}" oninput="{updateFirstName}" />
          </label>
          <label>
            Last Name:
            <input value="{this.state.lastName}" oninput="{updateLastName}" />
          </label>
          <label>
            Age:
            <input type="number" value="{this.state.age}" oninput="{updateAge}" />
          </label>
        </div>

        <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 6px;">
          <p><strong>Full Name:</strong> {this.fullName}</p>
          <p><strong>Can Vote:</strong> {this.canVoteText}</p>
          <p><strong>Age Status:</strong> {this.ageStatus}</p>
        </div>

        <button onclick="{toggleDetails}" style="margin-top: 15px;">
          {this.toggleButtonText} Raw State
        </button>

        <div style="margin-top: 10px; display: {this.detailsDisplay};">
          <pre><code>{this.stateJson}</code></pre>
        </div>
      </div>
    `;
  }
}

customElements.define(ReactiveExpressions.tag, ReactiveExpressions);
