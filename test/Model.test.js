import Model from '../src/Model.js';
import Backend from '../src/Backend.js';
import {timeout} from '../src/Util.js';

Backend.init();

export default ({test, assert}) => {
  test('Model - преобразование в строку', () => {
    const m = new Model();
    assert(m.toString() === m.id);
  });

  test('Model - равенство объектов с одинаковым id', () => {
    const m1 = new Model('rdfs:Resource');
    const m2 = new Model('rdfs:Resource');
    assert(m1 === m2);
    let counter = 0;
    const handler = () => counter++;
    m1.on('modified', handler);
    m1.a = 1;
    m2.a = 2;
    assert(m1.a === 2);
    assert(counter === 2);
  });

  test('Model - события modified при изменении свойств', () => {
    let counter = 0;
    const m = new Model();
    m.on('modified', () => counter++);
    m['rdf:type'] = [new Model('rdfs:Resource')];
    m['rdf:type'] = [...m['rdf:type'], new Model('rdfs:Class')];
    assert(counter === 2);
  });

  test('Model - обработка цепочек свойств', async () => {
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

  test('Model - создание модели из URI', () => {
    const m3 = new Model({
      '@': 'd:test1',
      'rdf:type': {data: 'owl:Thing', type: 'Uri'},
    });
    const m4 = new Model('owl:Thing');
    assert(m3['rdf:type'].id === m4.id);
  });

  test('Model - генерация ID для пустой модели', () => {
    const m = new Model();
    assert(/^d:[a-z0-9]+$/.test(m.id));
  });

  test('Model - работа со значениями свойств', () => {
    const m = new Model();

    m['rdfs:label'] = ['test^ru'];
    assert(m['rdfs:label'][0] === 'test^ru');

    m['rdfs:label'] = 'test^en';
    assert(m['rdfs:label'] === 'test^en');

    assert(m.hasValue('rdfs:label', 'test^en'));
    assert(m.hasValue('rdfs:label'));
    assert(m.hasValue(undefined, 'test^en'));

    delete m['rdfs:label'];
    assert(!m.hasValue('rdfs:label'));
  });

  test('Model - операции addValue и removeValue', () => {
    const m = new Model();

    m.addValue('rdfs:label', 1);
    assert(m.hasValue('rdfs:label', 1));

    m.addValue('rdfs:label', 2);
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2));

    m.addValue('rdfs:label', 3);
    assert(m.hasValue('rdfs:label', 1) && m.hasValue('rdfs:label', 2) && m.hasValue('rdfs:label', 3));

    m.removeValue('rdfs:label', 1);
    assert(m.hasValue('rdfs:label', 2) && !m.hasValue('rdfs:label', 1));
    m.removeValue('rdfs:label', 2);
    assert(m.hasValue('rdfs:label', 3) && !m.hasValue('rdfs:label', 2));
    m.removeValue('rdfs:label', 3);
    assert(!m.hasValue('rdfs:label'));

    m.addValue('rdfs:label', 1);
    m.removeValue(undefined, 1);
    assert(!m.hasValue('rdfs:label'));
  });

  test('Model - операции сохранения, загрузки, сброса и удаления', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    const m = new Model();
    m['rdf:type'] = 'rdfs:Resource';
    m['rdfs:label'] = 'test^en';

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

    m.one('beforeremove', assert);
    m.one('afterremove', assert);
    await m.remove();
  });

  test('Model - отложенные операции', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    const m = new Model();
    m['rdf:type'] = 'rdfs:Resource';
    m['rdfs:label'] = 'test^en';

    m.save();
    await m.save();

    m.load(false);
    await m.load(false);

    m.reset();
    await m.reset();

    m.remove();
    await m.remove();
  });

  test('Model - распространение ошибок', async () => {
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
};
