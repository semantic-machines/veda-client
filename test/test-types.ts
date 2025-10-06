// Test file to verify TypeScript definitions work correctly
import Backend, { IndividualData, QueryResult } from '../src/Backend.js';
import Model, { ModelValue } from '../src/Model.js';
import Component, { html, safe } from '../src/components/Component.js';
import Router from '../src/Router.js';
import Subscription from '../src/Subscription.js';
import { genUri, timeout } from '../src/Util.js';
import Value, { ValueData } from '../src/Value.js';

// Test Backend types
async function testBackend() {
  // Auth
  const authResult = await Backend.authenticate('user', 'pass');
  const ticket: string = authResult.ticket;
  const userUri: string = authResult.user_uri;

  // Get individual
  const individual: IndividualData = await Backend.get_individual('rdfs:Resource');
  const id: string = individual['@'];

  // Query
  const result: QueryResult = await Backend.query("'rdf:type' === 'owl:Class'");
  const uris: string[] = result.result;

  // Put individual
  await Backend.put_individual({
    '@': 'd:test',
    'rdf:type': [{ data: 'rdfs:Resource', type: 'Uri' }]
  });
}

// Test Model types
async function testModel() {
  const model = new Model('rdfs:Resource');

  // Properties
  const id: string = model.id;
  const label: ModelValue | ModelValue[] = model['rdfs:label'];

  // Methods
  const isNew: boolean = model.isNew();
  await model.load();
  await model.save();

  // Value operations
  model.addValue('rdfs:label', 'test');
  const hasValue: boolean = model.hasValue('rdfs:label');

  // CRUD checks
  const canRead: boolean = await model.canRead();

  // Events
  model.on('modified', (prop) => {
    console.log('Modified:', prop);
  });
}

// Test Component types
function testComponent() {
  class MyComponent extends Component() {
    added() {
      console.log('Component added');
    }

    render() {
      return html`
        <div>
          <h1>${safe(this.model?.id)}</h1>
        </div>
      `;
    }
  }

  customElements.define('my-component', MyComponent);
}

// Test Router types
function testRouter() {
  const router = new Router();

  router.add('#/users/:id', (id: string) => {
    console.log('User ID:', id);
  });

  router.route('#/users/123');
}

// Test Subscription types
function testSubscription() {
  Subscription.init('ws://localhost:8088');

  const model = new Model('rdfs:Resource');
  Subscription.subscribe(model, [
    model.id,
    0,
    (id: string, updateCounter?: number) => {
      console.log('Update:', id, updateCounter);
    }
  ]);
}

// Test Util types
async function testUtil() {
  const uri: string = genUri();
  await timeout(1000);
}

// Test Value types
function testValue() {
  const value: ValueData = {
    data: 'test',
    type: 'String',
    lang: 'EN'
  };

  const parsed = Value.parse(value);
  const serialized = Value.serialize('test string');
}

console.log('TypeScript types check passed!');

