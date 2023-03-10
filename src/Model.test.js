import Model from './Model.js';

export default ({test, assert}) => {
  test('Model', async () => {
    for (let i = 0; i < 1; i++) {
      const m = new Model();

      // Check id of empty model
      assert(/^d:[a-z0-9]+$/.test(m.id));

      // Check setter / getter
      m['v-s:updateCounter'] = [1];
      assert(m['v-s:updateCounter'][0] === 1);

      m['v-s:updateCounter'] = [2];
      assert(m['v-s:updateCounter'][0] === 2);

      m['v-s:updateCounter'] = 3;
      assert(m['v-s:updateCounter'][0] === 3);

      m['rdf:value'] = {data: 1, type: 'Integer'};
      assert(m['rdf:value'][0] === 1);

      // Check isSync flag alter on property change
      m.isSync(true);
      assert(m.isSync());
      m['rdfs:comment'] = 'comment^en';
      assert(!m.isSync());

      // Check that event is emitted event on property change
      const handler = (event, [value1, value2]) => {
        assert(event === 'rdfs:label');
        assert(value1 == 'label1' && value2 == 'label2');
      };
      m.one('modified', handler);
      m['rdfs:label'] = ['label1', 'label2'];
      assert(m['rdfs:label'][0] == 'label1');
      assert(m['rdfs:label'][1] == 'label2');

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
      m.one('beforeload', assert);
      m.one('afterload', assert);
      await m.load(true);

      m.one('beforereset', assert);
      m.one('afterreset', assert);
      await m.reset(true);

      m.one('beforesave', assert);
      m.one('aftersave', assert);
      await m.save(true);

      m.one('beforeremove', assert);
      m.one('afterremove', assert);
      await m.remove(true);

      // Check error propagation
      try {
        m.one('beforeload', () => {
          throw new Error('test');
        });
        await m.load(true);
      } catch (error) {
        assert(error.message === 'test');
      }

      // Check constructor
      const m2 = new Model({
        '@': 'd:test',
        'rdf:value': [{data: 'test', type: 'String'}],
      });
      m2['rdfs:comment'] = ['comment 1^ru', 'comment 2^en'];
      assert(m2['rdf:value'][0] == 'test');
      assert(m2['rdfs:comment'][0] == 'comment 1');
      assert(m2['rdfs:comment'][1] == 'comment 2');

      // Check toJSON
      const ethalon = '{"rdf:value":[{"data":"test","type":"String"}],"rdfs:comment":[{"data":"comment 1","type":"String","lang":"RU"},{"data":"comment 2","type":"String","lang":"EN"}],"@":"d:test"}';
      assert(JSON.stringify(m2) === JSON.stringify(JSON.parse(ethalon)));
    }
  });
};
