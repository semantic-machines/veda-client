import Model from '../src/Model.js';
import Backend from '../src/Backend.js';
import {timeout} from '../src/Util.js';

Backend.init();

export default ({test, assert}) => {
  // Basic functionality
  test('Model - should convert to string representation', () => {
    const m = new Model();
    assert(m.toString() === m.id);
  });

  test('Model - should emit modified events when properties change', () => {
    let counter = 0;
    const m = new Model();
    m.on('modified', () => counter++);
    m['rdf:type'] = [new Model('rdfs:Resource')];
    m['rdf:type'] = [...m['rdf:type'], new Model('rdfs:Class')];
    assert(counter === 2);
  });

  test('Model - should handle property chain retrieval', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    const m1 = new Model('rdfs:Resource');

    let counter = 0;
    m1.on('beforeload afterload', () => counter++);
    await m1.load();
    assert(counter === 2);
    assert(m1.isSync());

    const type = await m1.getPropertyChain('rdf:type', 'rdf:type', 'id');
    assert(type === 'rdfs:Class');
  });

  // Constructor
  test('Model - should create model from URI string', () => {
    const m3 = new Model({
      '@': 'd:test1',
      'rdf:type': {data: 'owl:Thing', type: 'Uri'},
    });
    const m4 = new Model('owl:Thing');
    assert(m3['rdf:type'].id === m4.id);
  });

  test('Model - should generate valid ID for empty model', () => {
    const m = new Model();
    assert(/^d:[a-z0-9]+$/.test(m.id));
  });

  // Property operations
  test('Model - should handle property value operations', () => {
    const m = new Model();

    // Test single value assignment
    m['rdfs:label'] = ['test^ru'];
    assert(m['rdfs:label'][0] === 'test^ru');

    m['rdfs:label'] = 'test^en';
    assert(m['rdfs:label'] === 'test^en');

    // Test hasValue functionality
    assert(m.hasValue('rdfs:label', 'test^en'));
    assert(m.hasValue('rdfs:label'));
    assert(m.hasValue(undefined, 'test^en'));

    // Test property deletion
    delete m['rdfs:label'];
    assert(!m.hasValue('rdfs:label'));
  });

  test('Model - should handle addValue and removeValue operations', () => {
    const m = new Model();

    // Test addValue
    m.addValue('rdfs:label', 1);
    assert(m.hasValue('rdfs:label', 1));

    m.addValue('rdfs:label', 2);
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2));

    // Test removeValue
    m.removeValue('rdfs:label', 1);
    assert(m.hasValue('rdfs:label', 2) && !m.hasValue('rdfs:label', 1));
  });

  // CRUD Operations
  test('Model - should handle save, load, reset and remove operations', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    const m = new Model();
    m['rdf:type'] = 'rdfs:Resource';
    m['rdfs:label'] = 'test^en';

    // Test save
    m.one('beforesave', assert);
    m.one('aftersave', assert);
    await m.save();

    await timeout(300);

    // Test load
    m.one('beforeload', assert);
    m.one('afterload', assert);
    await m.load();

    // Test reset
    m.one('beforereset', assert);
    m.one('afterreset', assert);
    await m.reset();

    // Test remove
    m.one('beforeremove', assert);
    m.one('afterremove', assert);
    await m.remove();
  });

  test('Model - should handle error propagation', async () => {
    const m = new Model();
    try {
      m.one('beforeload', () => {
        throw new Error('test');
      });
      await m.load(true);
    } catch (error) {
      assert(error.message === 'test');
    }
  });

  // Data Types
  test('Model - should handle integer values', () => {
    const m = new Model();
    m['rdfs:label'] = [1];
    assert(m['rdfs:label'][0] === 1);
  });

  test('Model - should handle decimal values', () => {
    const m = new Model();
    m['rdfs:label'] = [0.5];
    assert(m['rdfs:label'][0] === 0.5);
  });
};
