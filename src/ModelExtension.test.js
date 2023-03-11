import ModelExtension from './ModelExtension.js';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ({test, assert}) => {
  test('ModelExtension', async () => {
    const m = new ModelExtension();

    m['rdfs:label'] = ['test^ru'];
    assert(m.get('rdfs:label')[0] === 'test^ru');

    m.set('rdfs:label', 'test^en');
    assert(m.get('rdfs:label') === 'test^en');

    assert(m.hasValue('rdfs:label', 'test^en'));
    assert(m.hasValue('rdfs:label'));
    assert(m.hasValue(undefined, 'test^en'));

    m.clearValue('rdfs:label');
    assert(!m.hasValue('rdfs:label'));

    m.addValue('rdfs:label', 1);
    assert(m.hasValue('rdfs:label', 1));

    m.addValue('rdfs:label', 2);
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2));

    m.addValue('rdfs:label', 3);
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2) && m.hasValue('rdfs:label', 3));

    m.removeValue('rdfs:label', 1);
    assert(m.hasValue('rdfs:label', 2) && m.hasValue('rdfs:label', 3) && m['rdfs:label'].length === 2);

    m.removeValue(undefined, 2);
    assert(m.hasValue('rdfs:label', 3) && m['rdfs:label'].length === 1);

    m.removeValue('rdfs:label', 3);
    assert(!m.hasValue('rdfs:label'));
    assert(!m['rdfs:label']);

    m['rdfs:label'] = 4;
    m.removeValue('rdfs:label', 4);
    assert(!m['rdfs:label']);

    const m1 = new ModelExtension();

    let counter = 0;
    const handler1 = (...args) => {
      counter++;
    };
    m1.on('rdf:type', handler1);
    m1['rdf:type'] = ['owl:Thing'];
    m1['rdf:type'][1] = 'v-s:Thing';
    delete m1['rdf:type'];
    await timeout();
    assert(counter === 3);

    m1.addValue('rdf:type', 'v-s:Thing');
    await timeout();
    assert(counter === 4);
  });
};
