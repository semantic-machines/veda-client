import Model from './Model.js';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ({test, assert}) => {
  test('Model', async () => {
    for (let i = 0; i < 1; i++) {
      const m = new Model();

      m['v-s:updateCounter'] = 1;
      assert(m['v-s:updateCounter'][0] === 1);

      m['rdf:value'] = {data: 1, type: 'Integer'};
      assert(m['rdf:value'][0] === 1);

      m.isSync(true);
      assert(m.isSync());
      m['rdfs:comment'] = 'comment^en';
      assert(!m.isSync());

      const handler = (event, [value]) => {
        assert(event === 'rdfs:label');
        assert(value == 'label');
      };
      m.one('modified', handler);

      m['rdfs:label'] = 'label';
      assert(m['rdfs:label'][0] == 'label');

      assert(!m.isLoaded());
      m.isLoaded(true);
      assert(m.isLoaded());

      assert(!m.isSync());
      m.isSync(true);
      assert(m.isSync());

      assert(m.isNew());
      m.isNew(false);
      assert(!m.isNew());

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

      console.log(m.resource, m.id);
    }
  });
};
