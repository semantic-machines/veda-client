import ObservableModel from '../src/ObservableModel.js';
import Backend from '../src/Backend.js';
import {timeout} from '../src/Util.js';

export default ({test, assert}) => {
  test('Model #01', async () => {
    for (let i = 0; i < 1; i++) {
      try {
        const backend = new Backend();
        await backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
        assert(backend.user === 'cfg:VedaSystem');
      } catch (error) {
        console.error('Authentication failed', error);
        throw error;
      }

      const m = new ObservableModel();

      // Check id of empty model
      assert(/^d:[a-z0-9]+$/.test(m.id));

      // Check setter / getter
      m['rdf:type'] = new ObservableModel('rdfs:Resource');
      assert(m['rdf:type'].id === 'rdfs:Resource');

      // Check setter / getter
      m['v-s:updateCounter'] = [1];
      assert(m['v-s:updateCounter'][0] === 1);

      m['v-s:updateCounter'] = [2];
      assert(m['v-s:updateCounter'][0] === 2);

      m['v-s:updateCounter'] = 3;
      assert(m['v-s:updateCounter'] === 3);

      m['rdf:value'] = {data: 1, type: 'Integer'};
      assert(m['rdf:value'].data === 1);

      // Check that event is emitted event on property change
      const handler = (event, [value1, value2]) => {
        assert(event === 'rdfs:label');
        assert(value1 === 'label1' && value2 === 'label2');
      };
      m.one('modified', handler);
      m['rdfs:label'] = ['label1', 'label2'];
      await timeout();
      assert(m['rdfs:label'][0] === 'label1');
      assert(m['rdfs:label'][1] === 'label2');

      // Check default flags
      assert(!m.isLoaded());
      m.isLoaded(true);
      assert(m.isLoaded());

      assert(!m.isSync());
      m.isSync(true);
      assert(m.isSync());

      assert(m.isNew());
      m.isNew(false);
      assert(!m.isNew());

      // Check events
      m.one('beforesave', assert);
      m.one('aftersave', assert);
      await m.save();

      await timeout(300);

      m.one('beforeload', assert);
      m.one('afterload', assert);
      await m.load();

      m.one('beforereset', assert);
      m.one('afterreset', assert);
      await m.reset();

      // Check error propagation
      try {
        m.one('beforeload', () => {
          throw new Error('test');
        });
        await m.load(true);
      } catch (error) {
        assert(error.message === 'test');
      }

      // Cleanup
      m.one('beforeremove', assert);
      m.one('afterremove', assert);
      await m.remove();

      let counter = 0;
      const handler1 = (...args) => {
        counter++;
        assert(args.length);
      };
      m.on('rdf:type', handler1);

      m['rdf:type'] = 'rdfs:Resource';
      m['rdf:type'] = [m['rdf:type'], 'rdfs:Class'];
      m['rdf:type'].push('owl:Class');
      await timeout();
      assert(counter === 3);
      m['rdf:type'][4] = 'owl:Thing';
      await timeout();
      assert(counter === 4);

      // Check constructor
      const m2 = new ObservableModel({
        '@': 'd:test',
        'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}],
        'rdf:value': [{data: 'test', type: 'String'}],
      });
      m2['rdfs:comment'] = ['comment 1^^ru', 'comment 2^^en'];
      m2['rdf:value'] = {data: 1, type: 'Integer'};
      assert(m2['rdf:value'].data === 1);
      assert(m2['rdfs:comment'][0] === 'comment 1^^ru');
      assert(m2['rdfs:comment'][1] === 'comment 2^^en');
      assert(m2['rdf:type'][0] instanceof ObservableModel);

      // Check toJSON
      const ethalon = '{"@":"d:test","rdf:type":[{"data":"rdfs:Resource","type":"Uri"}],"rdf:value":[{"data":"test","type":"String"}],"rdfs:comment":[{"data":"comment 1","type":"String","lang":"RU"},{"data":"comment 2","type":"String","lang":"EN"}],"rdf:value":[{"data":1,"type":"Integer"}]}';
      assert(JSON.stringify(m2) === JSON.stringify(JSON.parse(ethalon)));
    }
  });


  test('Model #2', async () => {
    const m = new ObservableModel();

    m['rdfs:label'] = ['test^ru'];
    assert(m.get('rdfs:label')[0] === 'test^ru');

    m.set('rdfs:label', 'test^en');
    await timeout();
    assert(m.get('rdfs:label') === 'test^en');

    assert(m.hasValue('rdfs:label', 'test^en'));
    assert(m.hasValue('rdfs:label'));
    assert(m.hasValue(undefined, 'test^en'));

    m.clearValue('rdfs:label');
    await timeout();
    assert(!m.hasValue('rdfs:label'));

    m.addValue('rdfs:label', 1);
    await timeout();
    assert(m.hasValue('rdfs:label', 1));

    m.addValue('rdfs:label', 2);
    await timeout();
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2));

    m.addValue('rdfs:label', 3);
    await timeout();
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2) && m.hasValue('rdfs:label', 3));

    m.removeValue('rdfs:label', 1);
    await timeout();
    assert(m.hasValue('rdfs:label', 2) && m.hasValue('rdfs:label', 3) && m['rdfs:label'].length === 2);

    m.removeValue(undefined, 2);
    await timeout();
    assert(m.hasValue('rdfs:label', 3) && m['rdfs:label'].length === 1);

    m.removeValue('rdfs:label', 3);
    await timeout();
    assert(!m.hasValue('rdfs:label'));
    assert(!m['rdfs:label']);

    m['rdfs:label'] = 4;
    m.removeValue('rdfs:label', 4);
    await timeout();
    assert(!m['rdfs:label']);

    const m1 = new ObservableModel();

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
