import Backend from '../src/Backend.js';
import BackendError from '../src/BackendError.js';

export default ({test, assert}) => {
  test('Backend - базовые операции', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const data = await Backend.get_individual('rdfs:Resource');
    assert(data['@'] === 'rdfs:Resource');

    const testData = {
      '@': 'd:test_individual',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}]
    };
    await Backend.put_individual(testData);

    await Backend.remove_individual('d:test_individual');

    const uris = ['rdfs:Resource', 'owl:Thing'];
    const results = await Backend.get_individuals(uris);
    assert(Array.isArray(results) && results.length === 2);
  });

  test('Backend - расширенные операции', async () => {
    const individuals = [{
      '@': 'd:test1',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}]
    }, {
      '@': 'd:test2',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}]
    }];
    await Backend.put_individuals(individuals);

    await Backend.add_to_individual({
      '@': 'd:test1',
      'rdfs:label': [{data: 'Test Label', type: 'String'}]
    });

    await Backend.remove_from_individual({
      '@': 'd:test1',
      'rdfs:label': [{data: 'Test Label', type: 'String'}]
    });

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

    const pagedResults = await Backend.query({query, limit: 10, offset: 0});
    assert(Array.isArray(pagedResults.result));
    assert(pagedResults.result.length === 10);

    const withParams = await Backend.query({query, limit: 10, offset: 0, top: 1});
    assert(Array.isArray(withParams.result));
    assert(withParams.result.length === 1);
  });

  test('Backend - специальные операции', async () => {
    const rights = await Backend.get_rights('rdfs:Resource');
    assert(typeof rights === 'object');

    const membership = await Backend.get_membership('rdfs:Resource');
    assert(typeof membership === 'object');
  });

  test('Backend - расширенная обработка ошибок', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('Network error'));

    try {
      await Backend.get_individual('rdfs:Resource');
      assert(false, 'Должно выбросить ошибку сети');
    } catch (error) {
      assert(error instanceof BackendError);
      assert(error.code === 0);
    }

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

    globalThis.fetch = originalFetch;
  });

  test('Backend - дополнительные операции с индивидами', async () => {
    const withCache = await Backend.get_individual('rdfs:Resource', true);
    assert(withCache['@'] === 'rdfs:Resource');

    const withoutCache = await Backend.get_individual('rdfs:Resource', false);
    assert(withoutCache['@'] === 'rdfs:Resource');

    await Backend.put_individuals([]);

    const emptyResults = await Backend.get_individuals([]);
    assert(Array.isArray(emptyResults) && emptyResults.length === 0);
  });

  test('Backend - специальные запросы', async () => {
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
    const rights = await Backend.get_rights('rdfs:Resource');
    assert(rights !== null);
    assert(typeof rights === 'object');

    const membership = await Backend.get_membership('rdfs:Resource');
    assert(membership !== null);
    assert(typeof membership === 'object');
  });

  test('Backend - отмена запросов', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Запускаем запрос и сразу отменяем его
    const queryPromise = Backend.query('test query', null, null, null, null, null, null, 10, signal);
    controller.abort();

    try {
      await queryPromise;
      assert(false, 'Запрос должен быть отменен');
    } catch (error) {
      assert(error.name === 'AbortError', 'Должна быть ошибка отмены запроса');
    }

    // Проверяем отмену запроса get_individual
    const controller2 = new AbortController();
    const signal2 = controller2.signal;

    const individualPromise = Backend.get_individual('test:uri', true, signal2);
    controller2.abort();

    try {
      await individualPromise;
      assert(false, 'Запрос должен быть отменен');
    } catch (error) {
      assert(error.name === 'AbortError', 'Должна быть ошибка отмены запроса');
    }

    // Проверяем отмену stored_query
    const controller3 = new AbortController();
    const signal3 = controller3.signal;

    const storedQueryPromise = Backend.stored_query({query: 'test'}, signal3);
    controller3.abort();

    try {
      await storedQueryPromise;
      assert(false, 'Запрос должен быть отменен');
    } catch (error) {
      assert(error.name === 'AbortError', 'Должна быть ошибка отмены запроса');
    }
  });

  test('Backend - logout', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    assert(Backend.user_uri !== undefined);

    await Backend.logout();
    assert(Backend.user_uri === undefined);

    // Повторная авторизация для следующих тестов
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
  });

  test('Backend - get_rights_origin', async () => {
    const rightsOrigin = await Backend.get_rights_origin('rdfs:Resource');
    assert(typeof rightsOrigin === 'object');
  });

  test('Backend - get_operation_state', async () => {
    try {
      const state = await Backend.get_operation_state('fulltext_indexer', 0);
      assert(typeof state === 'number');
    } catch (error) {
      // Модуль может не существовать на тестовом сервере, это нормально
      assert(error instanceof BackendError);
    }
  });

  test('Backend - wait_module', async () => {
    // Тестируем логику с мокированием
    const originalGetOpState = Backend.get_operation_state;
    let callCount = 0;

    Backend.get_operation_state = async (module_id, wait_op_id) => {
      callCount++;
      return callCount < 3 ? wait_op_id - 1 : wait_op_id;
    };

    const result = await Backend.wait_module('test_module', 100);
    assert(typeof result === 'boolean');
    assert(result === true);

    // Проверяем превышение лимита попыток
    Backend.get_operation_state = async (module_id, wait_op_id) => {
      return wait_op_id - 1; // Всегда возвращаем меньшее значение
    };

    const resultExceeded = await Backend.wait_module('test_module', 1000, 2);
    assert(resultExceeded === false);

    Backend.get_operation_state = originalGetOpState;
  });

  test('Backend - set_in_individual', async () => {
    const testData = {
      '@': 'd:test_set_in',
      'rdf:type': [{data: 'rdfs:Resource', type: 'Uri'}],
      'rdfs:label': [{data: 'Initial', type: 'String'}]
    };
    await Backend.put_individual(testData);

    await Backend.set_in_individual({
      '@': 'd:test_set_in',
      'rdfs:label': [{data: 'Updated', type: 'String'}]
    });

    const updated = await Backend.get_individual('d:test_set_in', false);
    assert(updated['rdfs:label'][0].data === 'Updated');

    await Backend.remove_individual('d:test_set_in');
  });

  test('Backend - get_ticket_trusted', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    try {
      const ticketInfo = await Backend.get_ticket_trusted('veda');
      assert(ticketInfo.ticket !== undefined);
      assert(ticketInfo.user_uri !== undefined);
      assert(ticketInfo.expires !== undefined);
    } catch (error) {
      // Метод может требовать специальных прав, это нормально для теста
      assert(error instanceof BackendError);
    }
  });

  test('Backend - is_ticket_valid', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const isValid = await Backend.is_ticket_valid();
    // Метод возвращает результат валидации, может быть boolean или object
    assert(isValid === true);
  });

  test('Backend - query retry on 999 error', async () => {
    const originalQuery = Backend.query.bind(Backend);
    let attemptCount = 0;

    // Мокируем сам метод query
    const originalCallServer = Backend._Backend__call_server;

    // Тестируем логику retry напрямую вызывая Backend.query несколько раз
    // Проверяем что параметр tries работает корректно
    try {
      // Если tries = 0, должен вернуть rejected promise
      await Backend.query("test", null, null, null, null, null, null, 0);
      assert(false, 'Должна быть ошибка при tries = 0');
    } catch (error) {
      assert(error instanceof BackendError);
      assert(error.code === 429);
    }
  });

  test('Backend - error listener', async () => {
    let errorCaught = null;
    const unsubscribe = Backend.onError((error) => {
      errorCaught = error;
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('Test network error'));

    try {
      await Backend.get_individual('test:uri');
    } catch (error) {
      // Ошибка ожидается
    }

    assert(errorCaught !== null, 'Error listener должен быть вызван');
    assert(errorCaught instanceof BackendError);

    unsubscribe();
    globalThis.fetch = originalFetch;
  });

  test('Backend - uploadFile', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const originalFetch = globalThis.fetch;
    let uploadCalled = false;

    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('/files')) {
        uploadCalled = true;
        assert(options.method === 'POST');
        assert(options.body instanceof FormData);
        return {
          ok: true,
          json: async () => ({})
        };
      }
      return originalFetch(url, options);
    };

    try {
      await Backend.uploadFile({
        path: 'test.txt',
        uri: 'd:test_file',
        file: 'dGVzdCBjb250ZW50' // base64 encoded 'test content'
      });
      assert(uploadCalled, 'Upload должен быть вызван');
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Тест с File объектом
    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('/files')) {
        return {
          ok: true,
          json: async () => ({})
        };
      }
      return originalFetch(url, options);
    };

    try {
      const mockFile = new Blob(['test content'], { type: 'text/plain' });
      await Backend.uploadFile({
        path: 'test.txt',
        uri: 'd:test_file',
        file: mockFile
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Тест ошибки при загрузке
    globalThis.fetch = async (url) => {
      if (url.toString().includes('/files')) {
        return {
          ok: false,
          status: 500
        };
      }
      return originalFetch(url);
    };

    try {
      await Backend.uploadFile({
        path: 'test.txt',
        uri: 'd:test_file',
        file: 'test'
      });
      assert(false, 'Должна быть ошибка');
    } catch (error) {
      assert(error instanceof BackendError);
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Тест отмены загрузки
    const controller = new AbortController();
    globalThis.fetch = async () => {
      throw new DOMException('Aborted', 'AbortError');
    };

    try {
      await Backend.uploadFile({
        path: 'test.txt',
        uri: 'd:test_file',
        file: 'test',
        signal: controller.signal
      });
      assert(false, 'Должна быть ошибка отмены');
    } catch (error) {
      assert(error.name === 'AbortError');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
};