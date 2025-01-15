import Backend from '../src/Backend.js';
import BackendError from '../src/BackendError.js';

export default ({test, assert}) => {
  test('Backend - базовые операции', async () => {
    // Тест аутентификации
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    // Тест get_individual
    const data = await Backend.get_individual('rdfs:Resource');
    assert(data['@'] === 'rdfs:Resource');

    // Тест put_individual
    const testData = {
      '@': 'd:test_individual',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}]
    };
    await Backend.put_individual(testData);

    // Тест remove_individual
    await Backend.remove_individual('d:test_individual');

    // Тест get_individuals
    const uris = ['rdfs:Resource', 'owl:Thing'];
    const results = await Backend.get_individuals(uris);
    assert(Array.isArray(results) && results.length === 2);
  });

  test('Backend - расширенные операции', async () => {
    // Тест put_individuals
    const individuals = [{
      '@': 'd:test1',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}]
    }, {
      '@': 'd:test2',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}]
    }];
    await Backend.put_individuals(individuals);

    // Тест add_to_individual
    await Backend.add_to_individual({
      '@': 'd:test1',
      'rdfs:label': [{data: 'Test Label', type: 'String'}]
    });

    // Тест remove_from_individual
    await Backend.remove_from_individual({
      '@': 'd:test1',
      'rdfs:label': [{data: 'Test Label', type: 'String'}]
    });

    // Очистка
    await Backend.remove_individual('d:test1');
    await Backend.remove_individual('d:test2');
  });

  test('Backend - обработка ошибок', async () => {
    try {
      await Backend.get_individual('non:existent');
      assert(false, 'Должно выбросить ошибку');
    } catch (error) {
      assert(error instanceof BackendError);
    }

    try {
      await Backend.authenticate('wrong', 'credentials');
      assert(false, 'Должно выбросить ошибку аутентификации');
    } catch (error) {
      assert(error instanceof BackendError);
    }

    try {
      await Backend.put_individual({});
      assert(false, 'Должно выбросить ошибку при пустом individual');
    } catch (error) {
      assert(error instanceof BackendError);
    }
  });

  test('Backend - поиск', async () => {
    const query = "'rdf:type' === 'owl:Class'";
    const results = await Backend.query(query);
    assert(Array.isArray(results.result));

    // Тест с limit и offset
    const pagedResults = await Backend.query({query, limit: 10, offset: 0});
    assert(Array.isArray(pagedResults.result));
    assert(pagedResults.result.length === 10);

    // Тест с дополнительными параметрами
    const withParams = await Backend.query({query, limit: 10, offset: 0, top: 1});
    assert(Array.isArray(withParams.result));
    assert(withParams.result.length === 1);
  });

  test('Backend - специальные операции', async () => {
    // Тест get_rights
    const rights = await Backend.get_rights('rdfs:Resource');
    assert(typeof rights === 'object');

    // Тест get_membership
    const membership = await Backend.get_membership('rdfs:Resource');
    assert(typeof membership === 'object');
  });

  test('Backend - расширенная обработка ошибок', async () => {
    // Тест ошибки сети
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('Network error'));

    try {
      await Backend.get_individual('rdfs:Resource');
      assert(false, 'Должно выбросить ошибку сети');
    } catch (error) {
      assert(error instanceof BackendError);
      assert(error.code === 0);
    }

    // Тест ошибки сервера
    globalThis.fetch = () => Promise.resolve({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({})
    });

    try {
      await Backend.get_individual('rdfs:Resource');
      assert(false, 'Должно выбросить ошибку сервера');
    } catch (error) {
      assert(error instanceof BackendError);
      assert(error.code === 500);
    }

    // Тест невалидного JSON
    globalThis.fetch = () => Promise.resolve({
      ok: false,
      json: () => Promise.reject(new Error('Invalid JSON'))
    });

    try {
      await Backend.get_individual('rdfs:Resource');
      assert(false, 'Должно выбросить ошибку парсинга JSON');
    } catch (error) {
      assert(error instanceof Error);
    }

    // Восстановление fetch
    globalThis.fetch = originalFetch;
  });

  test('Backend - дополнительные операции с индивидами', async () => {
    // Тест get_individual с параметрами
    const withTicket = await Backend.get_individual('rdfs:Resource', true);
    assert(withTicket['@'] === 'rdfs:Resource');

    const withoutCache = await Backend.get_individual('rdfs:Resource', false);
    assert(withoutCache['@'] === 'rdfs:Resource');

    // Тест put_individuals с пустым массивом
    await Backend.put_individuals([]);

    // Тест get_individuals с пустым массивом
    const emptyResults = await Backend.get_individuals([]);
    assert(Array.isArray(emptyResults) && emptyResults.length === 0);
  });

  test('Backend - специальные запросы', async () => {
    // Тест query с различными параметрами
    const queryParams = {
      query: "'rdf:type' === 'owl:Class'",
      sort: 'rdfs:label',
      dir: 'desc',
      limit: 5,
      offset: 0,
      top: 0,
      async: true
    };
    const sortedResults = await Backend.query(queryParams);
    assert(Array.isArray(sortedResults.result));

    // Тест с null параметрами
    const nullParams = {
      query: "'rdf:type' === 'owl:Class'",
      sort: null,
      dir: null,
      limit: null,
      offset: null
    };
    const nullResults = await Backend.query(nullParams);
    assert(Array.isArray(nullResults.result));
  });

  test('Backend - права и членство', async () => {
    // Тест с валидными данными
    const rights = await Backend.get_rights('rdfs:Resource');
    assert(rights !== null);
    assert(typeof rights === 'object');

    const membership = await Backend.get_membership('rdfs:Resource');
    assert(membership !== null);
    assert(typeof membership === 'object');
  });
};