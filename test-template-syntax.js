import Component, { html } from './src/components/Component.js';
import { If } from './src/components/IfComponent.js';
import { Loop } from './src/components/LoopComponent.js';
import { reactive } from './src/Reactive.js';

// Test If without template
class TestIfComponent extends Component(HTMLElement) {
  static tag = 'test-if-component';

  constructor() {
    super();
    this.state = reactive({ showIf: true });
  }

  handleToggle = () => {
    this.state.showIf = !this.state.showIf;
  }

  render() {
    return html`
      <div class="result">
        <button onclick="{handleToggle}">
          Toggle (currently: {this.state.showIf})
        </button>
        <${If} condition="{this.state.showIf}">
          <div>✅ If content visible!</div>
        </${If}>
      </div>
    `;
  }
}
customElements.define(TestIfComponent.tag, TestIfComponent);

// Test If with template
class TestIfTemplateComponent extends Component(HTMLElement) {
  static tag = 'test-if-template-component';

  constructor() {
    super();
    this.state = reactive({ showIf: true });
  }

  handleToggle = () => {
    this.state.showIf = !this.state.showIf;
  }

  render() {
    return html`
      <div class="result">
        <button onclick="{handleToggle}">
          Toggle (currently: {this.state.showIf})
        </button>
        <${If} condition="{this.state.showIf}">
          <template>
            <div>✅ If with template visible!</div>
          </template>
        </${If}>
      </div>
    `;
  }
}
customElements.define(TestIfTemplateComponent.tag, TestIfTemplateComponent);

// Test Loop without template
class TestLoopComponent extends Component(HTMLElement) {
  static tag = 'test-loop-component';

  constructor() {
    super();
    this.state = reactive({
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]
    });
  }

  render() {
    return html`
      <div class="result">
        <${Loop} items="{this.state.items}" item-key="id">
          <div>✅ {this.model.name}</div>
        </${Loop}>
      </div>
    `;
  }
}
customElements.define(TestLoopComponent.tag, TestLoopComponent);

// Test Loop with template
class TestLoopTemplateComponent extends Component(HTMLElement) {
  static tag = 'test-loop-template-component';

  constructor() {
    super();
    this.state = reactive({
      items: [
        { id: 1, name: 'Template Item 1' },
        { id: 2, name: 'Template Item 2' },
        { id: 3, name: 'Template Item 3' }
      ]
    });
  }

  render() {
    return html`
      <div class="result">
        <${Loop} items="{this.state.items}" item-key="id">
          <template>
            <div>✅ {this.model.name}</div>
          </template>
        </${Loop}>
      </div>
    `;
  }
}
customElements.define(TestLoopTemplateComponent.tag, TestLoopTemplateComponent);

// Test Property simple
class TestPropertySimple extends Component(HTMLElement) {
  static tag = 'test-property-simple';

  async connectedCallback() {
    // Create mock model
    this.model = {
      'rdfs:label': ['Simple Property Value'],
      hasValue(prop) { return !!this[prop]; }
    };
    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        Label: <span property="rdfs:label"></span>
      </div>
    `;
  }
}
customElements.define(TestPropertySimple.tag, TestPropertySimple);

// Test Property without template
class TestPropertyComponent extends Component(HTMLElement) {
  static tag = 'test-property-component';

  async connectedCallback() {
    // Create mock model
    this.model = {
      'v-s:tags': ['tag1', 'tag2', 'tag3'],
      hasValue(prop) { return !!this[prop]; }
    };
    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <div property="v-s:tags">
          <span class="tag"><slot></slot></span>
        </div>
      </div>
    `;
  }
}
customElements.define(TestPropertyComponent.tag, TestPropertyComponent);

// Test Property with template
class TestPropertyTemplateComponent extends Component(HTMLElement) {
  static tag = 'test-property-template-component';

  async connectedCallback() {
    // Create mock model
    this.model = {
      'v-s:tags': ['template-tag1', 'template-tag2', 'template-tag3'],
      hasValue(prop) { return !!this[prop]; }
    };
    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <div property="v-s:tags">
          <template>
            <span class="tag"><slot></slot></span>
          </template>
        </div>
      </div>
    `;
  }
}
customElements.define(TestPropertyTemplateComponent.tag, TestPropertyTemplateComponent);

// TodoItem for rel tests
class TodoItemTest extends Component(HTMLLIElement) {
  static tag = 'todo-item-test';

  render() {
    return html`
      <span property="v-s:title"></span>
    `;
  }
}
customElements.define(TodoItemTest.tag, TodoItemTest, { extends: 'li' });

// Test Rel without template
class TestRelComponent extends Component(HTMLElement) {
  static tag = 'test-rel-component';

  async connectedCallback() {
    // Create mock models
    const todo1 = {
      id: 'd:todo1',
      'v-s:title': ['Todo 1'],
      hasValue(prop) { return !!this[prop]; }
    };
    const todo2 = {
      id: 'd:todo2',
      'v-s:title': ['Todo 2'],
      hasValue(prop) { return !!this[prop]; }
    };

    this.model = {
      'v-s:hasTodo': [todo1, todo2],
      hasValue(prop) { return !!this[prop]; }
    };

    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <ul rel="v-s:hasTodo">
          <li is="todo-item-test"></li>
        </ul>
      </div>
    `;
  }
}
customElements.define(TestRelComponent.tag, TestRelComponent);

// Test Rel with template
class TestRelTemplateComponent extends Component(HTMLElement) {
  static tag = 'test-rel-template-component';

  async connectedCallback() {
    // Create mock models
    const todo1 = {
      id: 'd:template-todo1',
      'v-s:title': ['Template Todo 1'],
      hasValue(prop) { return !!this[prop]; }
    };
    const todo2 = {
      id: 'd:template-todo2',
      'v-s:title': ['Template Todo 2'],
      hasValue(prop) { return !!this[prop]; }
    };

    this.model = {
      'v-s:hasTodo': [todo1, todo2],
      hasValue(prop) { return !!this[prop]; }
    };

    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <ul rel="v-s:hasTodo">
          <template>
            <li is="todo-item-test"></li>
          </template>
        </ul>
      </div>
    `;
  }
}
customElements.define(TestRelTemplateComponent.tag, TestRelTemplateComponent);

// Test Rel with property (without custom component)
class TestRelPropertyComponent extends Component(HTMLElement) {
  static tag = 'test-rel-property-component';

  async connectedCallback() {
    // Create mock models
    const todo1 = {
      id: 'd:property-todo1',
      'v-s:title': ['Property Todo 1'],
      hasValue(prop) { return !!this[prop]; }
    };
    const todo2 = {
      id: 'd:property-todo2',
      'v-s:title': ['Property Todo 2'],
      hasValue(prop) { return !!this[prop]; }
    };

    this.model = {
      'v-s:hasTodo': [todo1, todo2],
      hasValue(prop) { return !!this[prop]; }
    };

    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <ul rel="v-s:hasTodo">
          <li property="v-s:title"></li>
        </ul>
      </div>
    `;
  }
}
customElements.define(TestRelPropertyComponent.tag, TestRelPropertyComponent);

// Test Rel with property and template
class TestRelPropertyTemplateComponent extends Component(HTMLElement) {
  static tag = 'test-rel-property-template-component';

  async connectedCallback() {
    // Create mock models
    const todo1 = {
      id: 'd:property-template-todo1',
      'v-s:title': ['Property Template Todo 1'],
      hasValue(prop) { return !!this[prop]; }
    };
    const todo2 = {
      id: 'd:property-template-todo2',
      'v-s:title': ['Property Template Todo 2'],
      hasValue(prop) { return !!this[prop]; }
    };

    this.model = {
      'v-s:hasTodo': [todo1, todo2],
      hasValue(prop) { return !!this[prop]; }
    };

    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <ul rel="v-s:hasTodo">
          <template>
            <li property="v-s:title"></li>
          </template>
        </ul>
      </div>
    `;
  }
}
customElements.define(TestRelPropertyTemplateComponent.tag, TestRelPropertyTemplateComponent);

// Test Rel deep nesting: rel -> rel -> rel -> property
class TestRelDeepNestingComponent extends Component(HTMLElement) {
  static tag = 'test-rel-deep-nesting-component';

  async connectedCallback() {
    // Create deeply nested structure
    // Level 3: Items with titles
    const item1 = {
      id: 'd:item1',
      'v-s:title': ['Item 1'],
      hasValue(prop) { return !!this[prop]; }
    };
    const item2 = {
      id: 'd:item2',
      'v-s:title': ['Item 2'],
      hasValue(prop) { return !!this[prop]; }
    };
    const item3 = {
      id: 'd:item3',
      'v-s:title': ['Item 3'],
      hasValue(prop) { return !!this[prop]; }
    };

    // Level 2: Categories with items
    const category1 = {
      id: 'd:category1',
      'v-s:title': ['Category A'],
      'v-s:hasItem': [item1, item2],
      hasValue(prop) { return !!this[prop]; }
    };
    const category2 = {
      id: 'd:category2',
      'v-s:title': ['Category B'],
      'v-s:hasItem': [item1],
      hasValue(prop) { return !!this[prop]; }
    };

    const category3 = {
      id: 'd:category3',
      'v-s:title': ['Category C'],
      'v-s:hasItem': [item3],
      hasValue(prop) { return !!this[prop]; }
    };

    // Level 1: Sections with categories
    const section1 = {
      id: 'd:section1',
      'v-s:title': ['Section One'],
      'v-s:hasCategory': [category1, category2],
      hasValue(prop) { return !!this[prop]; }
    };
    const section2 = {
      id: 'd:section2',
      'v-s:title': ['Section Two'],
      'v-s:hasCategory': [category3],
      hasValue(prop) { return !!this[prop]; }
    };

    // Root: Document with sections
    this.model = {
      id: 'd:document',
      'v-s:hasSection': [section1, section2],
      hasValue(prop) { return !!this[prop]; }
    };

    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="result">
        <div rel="v-s:hasSection">
          <h4 property="v-s:title"></h4>
          <div rel="v-s:hasCategory">
            <h5 property="v-s:title"></h5>
            <ul rel="v-s:hasItem">
              <li property="v-s:title"></li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define(TestRelDeepNestingComponent.tag, TestRelDeepNestingComponent);

// Test mixed nesting: rel -> Loop -> rel -> Loop -> property
class TestMixedNestingComponent extends Component(HTMLElement) {
  static tag = 'test-mixed-nesting-component';

  constructor() {
    super();

    // Create nested structure with filtering
    // Level 3: Tasks
    const task1 = {
      id: 't1',
      'v-s:title': ['Task 1'],
      'v-s:priority': 'high',
      hasValue(prop) { return !!this[prop]; }
    };
    const task2 = {
      id: 't2',
      'v-s:title': ['Task 2'],
      'v-s:priority': 'low',
      hasValue(prop) { return !!this[prop]; }
    };
    const task3 = {
      id: 't3',
      'v-s:title': ['Task 3'],
      'v-s:priority': 'high',
      hasValue(prop) { return !!this[prop]; }
    };

    // Level 2: Projects with tasks
    const project1 = {
      id: 'p1',
      'v-s:title': ['Project Alpha'],
      'v-s:hasTask': [task1, task2],
      hasValue(prop) { return !!this[prop]; }
    };
    const project2 = {
      id: 'p2',
      'v-s:title': ['Project Beta'],
      'v-s:hasTask': [task3],
      hasValue(prop) { return !!this[prop]; }
    };

    // Level 1: Organization with projects
    this.model = {
      id: 'org1',
      'v-s:hasProject': [project1, project2],
      hasValue(prop) { return !!this[prop]; }
    };

    this.state = reactive({
      filter: 'high',
      projects: [project1, project2]
    });
  }

  get projects() {
    return this.model['v-s:hasProject'] || [];
  }

  // Filter tasks for current project in Loop context
  get projectTasks() {
    // This getter will be called in Loop context where this.model is a project
    if (!this.model || !this.model['v-s:hasTask']) {
      return [];
    }
    // Get parent component's filter
    const parent = this.parentElement?.closest('test-mixed-nesting-component');
    const filter = parent?.state?.filter || 'high';

    return this.model['v-s:hasTask'].filter(task =>
      task['v-s:priority'] === filter
    );
  }

  render() {
    return html`
      <div class="result">
        <div>Filter: <strong>{this.state.filter}</strong> priority</div>

        <!-- Loop over projects -->
        <${Loop} items="{this.projects}" item-key="id">
          <div>
            <h4 property="v-s:title"></h4>

            <!-- Nested Loop: show filtered tasks -->
            <ul rel="v-s:hasTask">
              <li property="v-s:title"></li>
            </ul>
          </div>
        </${Loop}>
      </div>
    `;
  }
}
customElements.define(TestMixedNestingComponent.tag, TestMixedNestingComponent);




