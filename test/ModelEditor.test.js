import './setup-dom.js';
import Model from '../src/Model.js';
import Backend from '../src/Backend.js';
import BackendError from '../src/BackendError.js';
import { editModelPredicate as editor } from '../devtools/src/hook/modules/ModelEditor.js';
import { Serializer } from '../devtools/src/hook/modules/Serializer.js';
import { flushEffects } from '../src/Effect.js';
import { registerComponents } from '../devtools/src/panel/components/index.js';

export default function ({ test, assert }) {
  let seq = 0;
  const uri = () => 'd:edit_' + Date.now() + '_' + (++seq);

  async function withBackend(run) {
    const original = {
      set: Backend.set_in_individual,
      remove: Backend.remove_from_individual,
      get: Backend.get_individual,
      put: Backend.put_individual,
      fetch: globalThis.fetch
    };
    const calls = { set: [], remove: [], put: 0 };
    let respond = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
    globalThis.fetch = async (url, options) => {
      if (options?.method !== 'PUT' || options.credentials !== 'include') {
        throw new Error('Editor fetch must be a credentialed PUT');
      }
      const individual = JSON.parse(options.body).individual;
      if (String(url).endsWith('/remove_from_individual')) calls.remove.push(individual);
      else if (String(url).endsWith('/set_in_individual')) calls.set.push(individual);
      else throw new Error('Unexpected editor url ' + url);
      return respond();
    };
    const rejectDirect = async () => {
      throw new Error('Editor must not call Backend individual methods');
    };
    Backend.set_in_individual = rejectDirect;
    Backend.remove_from_individual = rejectDirect;
    Backend.put_individual = async () => {
      calls.put++;
      return { ok: true };
    };
    const server = {
      fail(status) {
        respond = async () => ({ ok: false, status, json: async () => ({}) });
      },
      hang() {
        let release = () => {};
        const gate = new Promise(resolve => { release = resolve; });
        respond = async () => {
          await gate;
          return { ok: true, status: 200, json: async () => ({ ok: true }) };
        };
        return () => release();
      }
    };
    try {
      await run(calls, server);
    } finally {
      Backend.set_in_individual = original.set;
      Backend.remove_from_individual = original.remove;
      Backend.get_individual = original.get;
      Backend.put_individual = original.put;
      globalThis.fetch = original.fetch;
    }
  }

  function person(id) {
    return new Model({
      '@': id,
      'rdf:type': [{ data: 'v-s:Person', type: 'Uri' }],
      'v-s:label': [{ data: 'A', type: 'String', lang: 'RU' }]
    });
  }

  test('model editor lives in devtools', () => {
    assert.strictEqual(typeof editor, 'function');
    assert.strictEqual(window.__VEDA_MODEL_EDITOR__, undefined);
  });

  test('model editor replaces one predicate and leaves the rest untouched', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = person(id);
      const result = await editor(model, {
        op: 'set',
        predicate: 'v-s:label',
        index: 0,
        value: { type: 'String', data: 'B', lang: 'en' }
      });
      assert.strictEqual(result.ok, true, result.error);
      assert.strictEqual(model['v-s:label'][0], 'B^^EN');
      assert.strictEqual(model['rdf:type'][0].id, 'v-s:Person');
      assert.deepStrictEqual(calls.set, [{
        '@': id,
        'v-s:label': [{ data: 'B', type: 'String', lang: 'EN' }]
      }]);
      assert.strictEqual(calls.remove.length, 0);
      assert.strictEqual(calls.put, 0);
    });
  });

  test('model editor appends a value and persists the whole predicate', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = person(id);
      const result = await editor(model, {
        op: 'add',
        predicate: 'v-s:label',
        value: { type: 'String', data: 'B', lang: 'EN' }
      });
      assert.strictEqual(result.ok, true, result.error);
      assert.deepStrictEqual([...model['v-s:label']], ['A^^RU', 'B^^EN']);
      assert.strictEqual(calls.set[0]['v-s:label'].length, 2);
      assert.strictEqual(calls.put, 0);
    });
  });

  test('model editor keeps typed values', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = person(id);
      const uriResult = await editor(model, {
        op: 'add',
        predicate: 'v-s:parent',
        value: { type: 'Uri', data: 'site:Page' }
      });
      assert.strictEqual(uriResult.ok, true, uriResult.error);
      assert.ok(model['v-s:parent'][0] instanceof Model);
      assert.strictEqual(model['v-s:parent'][0].id, 'site:Page');

      const boolResult = await editor(model, {
        op: 'add',
        predicate: 'v-s:deleted',
        value: { type: 'Boolean', data: 'false' }
      });
      assert.strictEqual(boolResult.ok, true, boolResult.error);
      assert.strictEqual(model['v-s:deleted'][0], false);
      assert.strictEqual(calls.set.at(-1)['v-s:deleted'][0].data, false);

      const intResult = await editor(model, {
        op: 'add',
        predicate: 'v-s:order',
        value: { type: 'Integer', data: '10' }
      });
      assert.strictEqual(intResult.ok, true, intResult.error);
      assert.strictEqual(model['v-s:order'][0], 10);

      const decimalResult = await editor(model, {
        op: 'add',
        predicate: 'v-s:weight',
        value: { type: 'Decimal', data: '1.0' }
      });
      assert.strictEqual(decimalResult.ok, true, decimalResult.error);
      assert.strictEqual(model['v-s:weight'][0], '1.0');

      const dateResult = await editor(model, {
        op: 'add',
        predicate: 'v-s:created',
        value: { type: 'Datetime', data: '2020-01-02T03:04:05Z' }
      });
      assert.strictEqual(dateResult.ok, true, dateResult.error);
      assert.ok(model['v-s:created'][0] instanceof Date);
      assert.strictEqual(calls.put, 0);
    });
  });

  test('model editor removes one value by replacing the predicate', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = new Model({
        '@': id,
        'v-s:label': [
          { data: 'A', type: 'String', lang: 'RU' },
          { data: 'B', type: 'String', lang: 'EN' }
        ]
      });
      const result = await editor(model, { op: 'remove', predicate: 'v-s:label', index: 0 });
      assert.strictEqual(result.ok, true, result.error);
      assert.deepStrictEqual([...model['v-s:label']], ['B^^EN']);
      assert.strictEqual(calls.set.length, 1);
      assert.strictEqual(calls.remove.length, 0);
      assert.strictEqual(calls.set[0]['v-s:label'][0].data, 'B');
    });
  });

  test('model editor removes the last value with remove_from_individual', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = person(id);
      const result = await editor(model, { op: 'remove', predicate: 'v-s:label', index: 0 });
      assert.strictEqual(result.ok, true, result.error);
      assert.strictEqual(model['v-s:label'], undefined);
      assert.strictEqual(calls.set.length, 0);
      assert.deepStrictEqual(calls.remove[0], {
        '@': id,
        'v-s:label': [{ data: 'A', type: 'String', lang: 'RU' }]
      });
    });
  });

  test('model editor deletes a predicate', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = new Model({
        '@': id,
        'v-s:label': [
          { data: 'A', type: 'String' },
          { data: 'B', type: 'String' }
        ]
      });
      const result = await editor(model, { op: 'delete', predicate: 'v-s:label' });
      assert.strictEqual(result.ok, true, result.error);
      assert.strictEqual(model['v-s:label'], undefined);
      assert.strictEqual(calls.remove[0]['v-s:label'].length, 2);
      assert.strictEqual(calls.put, 0);
    });
  });

  test('model editor restores the predicate when the server rejects it', async () => {
    await withBackend(async (calls, server) => {
      const model = person(uri());
      server.fail(403);
      const result = await editor(model, {
        op: 'set',
        predicate: 'v-s:label',
        index: 0,
        value: { type: 'String', data: 'B', lang: 'RU' }
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'Forbidden');
      assert.strictEqual(model['v-s:label'][0], 'A^^RU');
    });
  });

  test('model editor refuses an unsaved model and the id predicate', async () => {
    await withBackend(async (calls) => {
      const fresh = new Model();
      const refused = await editor(fresh, {
        op: 'add',
        predicate: 'v-s:label',
        value: { type: 'String', data: 'A' }
      });
      assert.strictEqual(refused.ok, false);
      assert.strictEqual(refused.error, 'Unsaved model cannot be written to the server');

      const model = person(uri());
      const idEdit = await editor(model, {
        op: 'set',
        predicate: 'id',
        index: 0,
        value: { type: 'String', data: 'd:other' }
      });
      assert.strictEqual(idEdit.ok, false);
      assert.strictEqual(calls.set.length, 0);
      assert.strictEqual(calls.put, 0);
    });
  });

  test('model editor loads a bare individual without writing', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = new Model(id);
      Backend.get_individual = async () => ({
        '@': id,
        'rdf:type': [{ data: 'v-s:Person', type: 'Uri' }],
        'v-s:label': [{ data: 'Loaded', type: 'String' }]
      });
      const result = await editor(model, { op: 'load' });
      assert.strictEqual(result.ok, true, result.error);
      assert.strictEqual(model.isLoaded(), true);
      assert.strictEqual(model['v-s:label'][0], 'Loaded');
      assert.strictEqual(calls.set.length, 0);
      assert.strictEqual(calls.remove.length, 0);
      assert.strictEqual(calls.put, 0);
    });
  });

  test('model editor does not fetch an individual that is already loaded', async () => {
    await withBackend(async () => {
      let gets = 0;
      Backend.get_individual = async () => { gets++; };
      const model = person(uri());
      const result = await editor(model, { op: 'load' });
      assert.strictEqual(result.ok, true, result.error);
      assert.strictEqual(gets, 0);
    });
  });

  test('model editor reports a failed load and leaves the individual empty', async () => {
    await withBackend(async (calls) => {
      const model = new Model(uri());
      Backend.get_individual = async () => { throw new BackendError(404); };
      const result = await editor(model, { op: 'load' });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'Not found');
      assert.strictEqual(model.isLoaded(), false);
      assert.strictEqual(calls.set.length, 0);
    });
  });

  test('model editor refuses to load an unsaved model', async () => {
    await withBackend(async () => {
      let gets = 0;
      Backend.get_individual = async () => { gets++; };
      const result = await editor(new Model(), { op: 'load' });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'Unsaved model cannot be loaded from the server');
      assert.strictEqual(gets, 0);
    });
  });

  test('model editor loads a bare individual before writing', async () => {
    await withBackend(async (calls) => {
      const id = uri();
      const model = new Model(id);
      assert.strictEqual(model.isLoaded(), false);
      Backend.get_individual = async () => ({
        '@': id,
        'rdf:type': [{ data: 'v-s:Person', type: 'Uri' }],
        'v-s:label': [{ data: 'Old', type: 'String' }]
      });
      const result = await editor(model, {
        op: 'set',
        predicate: 'v-s:label',
        index: 0,
        value: { type: 'String', data: 'New' }
      });
      assert.strictEqual(result.ok, true, result.error);
      assert.strictEqual(model.isLoaded(), true);
      assert.strictEqual(model['v-s:label'][0], 'New');
      assert.strictEqual(calls.set[0]['v-s:label'][0].data, 'New');
    });
  });

  test('model editor does not write when load fails', async () => {
    await withBackend(async (calls) => {
      const model = new Model(uri());
      Backend.get_individual = async () => {
        throw new BackendError(404);
      };
      const result = await editor(model, {
        op: 'add',
        predicate: 'v-s:label',
        value: { type: 'String', data: 'X' }
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'Not found');
      assert.strictEqual(model['v-s:label'], undefined);
      assert.strictEqual(model.isLoaded(), false);
      assert.strictEqual(calls.set.length, 0);
      assert.strictEqual(calls.remove.length, 0);
    });
  });

  test('model editor rejects an invalid value before calling the server', async () => {
    await withBackend(async (calls) => {
      const model = person(uri());
      const result = await editor(model, {
        op: 'set',
        predicate: 'v-s:label',
        index: 0,
        value: { type: 'Datetime', data: 'yesterday' }
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(model['v-s:label'][0], 'A^^RU');
      assert.strictEqual(calls.set.length, 0);
    });
  });

  test('model editor allows only one write at a time', async () => {
    await withBackend(async (calls, server) => {
      const firstModel = person(uri());
      const secondModel = person(uri());
      const release = server.hang();
      const first = editor(firstModel, {
        op: 'set',
        predicate: 'v-s:label',
        index: 0,
        value: { type: 'String', data: 'B', lang: 'RU' }
      });
      try {
        const second = await editor(secondModel, {
          op: 'set',
          predicate: 'v-s:label',
          index: 0,
          value: { type: 'String', data: 'C', lang: 'RU' }
        });
        assert.strictEqual(second.ok, false);
        assert.strictEqual(secondModel['v-s:label'][0], 'A^^RU');
      } finally {
        release();
        await first;
      }
    });
  });

  test('serializer describes typed fields and skips id', () => {
    const id = uri();
    const model = new Model({
      '@': id,
      'rdf:type': [{ data: 'site:MenuItem', type: 'Uri' }],
      'rdfs:label': [
        { data: 'Платформа', type: 'String', lang: 'RU' },
        { data: 'Platform', type: 'String', lang: 'EN' }
      ],
      'v-s:order': [{ data: 10, type: 'Integer' }],
      'v-s:created': [{ data: '2020-01-02T03:04:05Z', type: 'Datetime' }],
      'v-s:deleted': [{ data: false, type: 'Boolean' }]
    });
    model['v-s:weird'] = [{ nope: true }];
    const fields = new Serializer().describeModelFields(model);
    const byName = Object.fromEntries(fields.map(field => [field.predicate, field]));
    assert.strictEqual(byName.id, undefined);
    assert.deepStrictEqual(byName['rdf:type'], {
      predicate: 'rdf:type',
      editable: true,
      values: [{ type: 'Uri', data: 'site:MenuItem' }]
    });
    assert.deepStrictEqual(byName['rdfs:label'].values, [
      { type: 'String', data: 'Платформа', lang: 'RU' },
      { type: 'String', data: 'Platform', lang: 'EN' }
    ]);
    assert.deepStrictEqual(byName['v-s:order'].values, [{ type: 'Integer', data: 10 }]);
    assert.deepStrictEqual(byName['v-s:created'].values, [{ type: 'Datetime', data: '2020-01-02T03:04:05Z' }]);
    assert.deepStrictEqual(byName['v-s:deleted'].values, [{ type: 'Boolean', data: false }]);
    assert.strictEqual(byName['v-s:weird'].editable, false);
    assert.deepStrictEqual(byName['v-s:weird'].values, []);
  });

  test('described values round-trip through the editor', async () => {
    await withBackend(async () => {
      const model = new Model({
        '@': uri(),
        'rdfs:label': [
          { data: 'Платформа', type: 'String', lang: 'RU' },
          { data: 'Platform', type: 'String', lang: 'EN' }
        ]
      });
      const before = JSON.parse(JSON.stringify(model.toJSON()['rdfs:label']));
      const described = new Serializer().describeModelFields(model)
        .find(field => field.predicate === 'rdfs:label');
      const result = await editor(model, {
        op: 'set',
        predicate: 'rdfs:label',
        index: 0,
        value: described.values[0]
      });
      assert.strictEqual(result.ok, true, result.error);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(model.toJSON()['rdfs:label'])), before);
    });
  });

  registerComponents();

  async function settle() {
    for (let i = 0; i < 8; i++) {
      await flushEffects();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  async function mount(snapshot) {
    const el = document.createElement('models-tab');
    const commands = [];
    el.state.onEditModel = (command) => commands.push(command);
    document.body.appendChild(el);
    await el.rendered;
    el.state.models = [snapshot];
    el.state.selectedId = snapshot.id;
    await settle();
    return {
      el,
      commands,
      destroy() { el.remove(); }
    };
  }

  function loadedSnapshot(extra = {}) {
    return {
      id: 7,
      modelId: 'd:card',
      type: 'v-s:Person',
      isLoaded: true,
      isNew: false,
      updateCount: 1,
      createdAt: 1700000000000,
      properties: {
        'v-s:label': ['Платформа^^RU']
      },
      fields: [{
        predicate: 'v-s:label',
        editable: true,
        values: [{ type: 'String', data: 'Платформа', lang: 'RU' }]
      }],
      ...extra
    };
  }

  test('predicate editor saves the typed value', async () => {
    const view = await mount(loadedSnapshot());
    try {
      const edit = view.el.querySelector('.predicate-edit');
      assert.ok(edit, view.el.innerHTML.slice(0, 400));
      edit.click();
      await settle();
      const input = view.el.querySelector('.edit-data');
      assert.ok(input, view.el.innerHTML.slice(0, 400));
      assert.strictEqual(input.value, 'Платформа');
      input.value = 'Next';
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      view.el.querySelector('.predicate-save').click();
      assert.strictEqual(view.commands.length, 1);
      assert.deepStrictEqual(view.commands[0], {
        id: 7,
        op: 'set',
        predicate: 'v-s:label',
        index: 0,
        value: { type: 'String', data: 'Next', lang: 'RU' }
      });
    } finally {
      view.destroy();
    }
  });

  test('predicate editor asks before deleting a predicate', async () => {
    const view = await mount(loadedSnapshot());
    try {
      view.el.querySelector('.predicate-edit').click();
      await settle();
      view.el.querySelector('.predicate-delete').click();
      await settle();
      assert.strictEqual(view.commands.length, 0);
      assert.ok(view.el.textContent.includes('Remove this predicate from the server?'));
      view.el.querySelector('.predicate-delete-confirm').click();
      assert.deepStrictEqual(view.commands[0], {
        id: 7,
        op: 'delete',
        predicate: 'v-s:label',
        index: undefined,
        value: undefined
      });
    } finally {
      view.destroy();
    }
  });

  test('predicate editor is disabled for an unsaved model', async () => {
    const view = await mount(loadedSnapshot({ isNew: true }));
    try {
      assert.strictEqual(view.el.querySelector('.predicate-edit'), null);
      assert.strictEqual(view.el.querySelector('.predicate-add'), null);
      assert.strictEqual(view.el.querySelector('.model-load'), null);
      assert.ok(view.el.textContent.includes('This model has not been saved'));
    } finally {
      view.destroy();
    }
  });

  test('predicate editor adds a predicate and a value', async () => {
    const view = await mount(loadedSnapshot());
    try {
      const name = view.el.querySelector('.new-predicate');
      name.value = 'comment';
      name.dispatchEvent(new window.Event('input', { bubbles: true }));
      view.el.querySelector('button.predicate-add').click();
      await settle();
      assert.ok(view.el.textContent.includes('Predicate name is not valid'));

      name.value = 'v-s:comment';
      name.dispatchEvent(new window.Event('input', { bubbles: true }));
      view.el.querySelector('button.predicate-add').click();
      await settle();
      const row = view.el.querySelector('[data-predicate="v-s:comment"]');
      assert.ok(row, view.el.innerHTML.slice(0, 500));
      const input = row.querySelector('.edit-data');
      input.value = 'Hello';
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle();
      view.el.querySelector('[data-predicate="v-s:comment"] .predicate-save').click();
      assert.strictEqual(view.commands[0].op, 'add');
      assert.strictEqual(view.commands[0].predicate, 'v-s:comment');
      assert.strictEqual(view.commands[0].value.data, 'Hello');
      assert.strictEqual(view.commands[0].value.type, 'String');
    } finally {
      view.destroy();
    }
  });

  test('predicate editor closes after the server accepts the edit', async () => {
    const view = await mount(loadedSnapshot());
    try {
      view.el.querySelector('.predicate-edit').click();
      await settle();
      assert.ok(view.el.querySelector('.predicate-editor'));
      view.el.state.modelEdit = { requestId: 1, status: 'saved', predicate: 'v-s:label', error: '' };
      await settle();
      assert.ok(view.el.textContent.includes('Saved v-s:label'));
      assert.strictEqual(view.el.querySelector('.predicate-editor'), null);
    } finally {
      view.destroy();
    }
  });

  test('predicate editor keeps the row open when the server rejects the edit', async () => {
    const view = await mount(loadedSnapshot());
    try {
      view.el.querySelector('.predicate-edit').click();
      await settle();
      view.el.state.pending = true;
      view.el.state.modelEdit = { requestId: 2, status: 'error', predicate: 'v-s:label', error: 'Forbidden' };
      await settle();
      assert.ok(view.el.querySelector('.predicate-editor'));
      assert.ok(view.el.textContent.includes('Forbidden'));
      assert.strictEqual(view.el.state.pending, false);
    } finally {
      view.destroy();
    }
  });

  test('unloaded model can be loaded from its card', async () => {
    const view = await mount(loadedSnapshot({ isLoaded: false, fields: [], properties: {} }));
    try {
      const button = view.el.querySelector('.model-load');
      assert.ok(button, view.el.innerHTML.slice(0, 400));
      assert.strictEqual(button.textContent, 'Load');
      button.click();
      assert.deepStrictEqual(view.commands[0], { id: 7, op: 'load' });
      view.el.state.modelEdit = { requestId: 3, status: 'saved', op: 'load', error: '' };
      await settle();
      assert.ok(view.el.textContent.includes('Loaded'));
    } finally {
      view.destroy();
    }
  });

  test('loaded model has no load button', async () => {
    const view = await mount(loadedSnapshot());
    try {
      assert.strictEqual(view.el.querySelector('.model-load'), null);
    } finally {
      view.destroy();
    }
  });
};
