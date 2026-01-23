import ExpressionParser from '../src/components/ExpressionParser.js';

export default ({test, assert}) => {
  test('ExpressionParser - простые свойства', () => {
    const context = {
      model: {
        id: 'test:123',
        name: 'Test Name'
      }
    };

    assert(ExpressionParser.evaluate('model.id', context) === 'test:123');
    assert(ExpressionParser.evaluate('model.name', context) === 'Test Name');
    assert(ExpressionParser.evaluate('this.model.id', context) === 'test:123');
  });

  test('ExpressionParser - RDF properties', () => {
    const context = {
      model: {
        'rdfs:label': 'Label',
        'rdf:type': 'Type'
      }
    };

    // Новый синтаксис: точки вместо brackets
    assert(ExpressionParser.evaluate('model.rdfs:label', context) === 'Label');
    assert(ExpressionParser.evaluate('model.rdf:type', context) === 'Type');
  });

  test('ExpressionParser - массивы', () => {
    const context = {
      model: {
        items: ['first', 'second', 'third'],
        'rdfs:label': ['Label1', 'Label2']
      }
    };

    // Новый синтаксис: числовые индексы через точку
    assert(ExpressionParser.evaluate('model.items.0', context) === 'first');
    assert(ExpressionParser.evaluate('model.items.2', context) === 'third');
    assert(ExpressionParser.evaluate('model.rdfs:label.0', context) === 'Label1');
    assert(ExpressionParser.evaluate('model.rdfs:label.1', context) === 'Label2');
  });

  test('ExpressionParser - цепочки свойств', () => {
    const context = {
      model: {
        rel: {
          id: 'rel:123',
          nested: {
            value: 'deep'
          }
        }
      }
    };

    assert(ExpressionParser.evaluate('model.rel.id', context) === 'rel:123');
    assert(ExpressionParser.evaluate('model.rel.nested.value', context) === 'deep');
  });

  test('ExpressionParser - optional chaining', () => {
    const context = {
      model: {
        rel: null,
        items: [
          { id: 'item1' },
          null,
          { id: 'item3' }
        ]
      }
    };

    assert(ExpressionParser.evaluate('model.rel?.id', context) === undefined);
    assert(ExpressionParser.evaluate('model.items.0?.id', context) === 'item1');
    assert(ExpressionParser.evaluate('model.items.1?.id', context) === undefined);
    assert(ExpressionParser.evaluate('model.items.2?.id', context) === 'item3');
  });

  test('ExpressionParser - комплексные выражения', () => {
    const context = {
      model: {
        'v-s:hasApplication': [
          { id: 'app:1', name: 'App 1' },
          { id: 'app:2', name: 'App 2' }
        ]
      }
    };

    // Новый синтаксис с точками
    assert(ExpressionParser.evaluate('model.v-s:hasApplication.0.id', context) === 'app:1');
    assert(ExpressionParser.evaluate('model.v-s:hasApplication.1.name', context) === 'App 2');
    assert(ExpressionParser.evaluate('model.v-s:hasApplication?.0?.id', context) === 'app:1');
  });

  test('ExpressionParser - несуществующие свойства', () => {
    const context = {
      model: { id: 'test' }
    };

    assert(ExpressionParser.evaluate('model.nonexistent', context) === undefined);
    assert(ExpressionParser.evaluate('model.nonexistent?.nested', context) === undefined);

    // Ошибка для несуществующего корневого свойства
    try {
      ExpressionParser.evaluate('nonexistent.prop', context);
      assert(false, 'Should throw error');
    } catch (error) {
      assert(error.message.includes('Cannot read property'));
    }
  });

  test('ExpressionParser - методы и функции', () => {
    const context = {
      testMethod: () => 'method result',
      model: {
        method: () => 'model method'
      }
    };

    const result = ExpressionParser.evaluate('testMethod', context);
    assert(typeof result === 'function');
    assert(result() === 'method result');

    const result2 = ExpressionParser.evaluate('model.method', context);
    assert(typeof result2 === 'function');
    assert(result2() === 'model method');
  });

  test('ExpressionParser - безопасность', () => {
    const context = {
      alert: () => 'should not be called',
      model: {
        method: () => 'function',
        count: 5
      }
    };

    // Скобки, операторы, спецсимволы не поддерживаются
    // Парсер просто попытается найти свойство с таким именем

    // alert() будет искать свойство 'alert()' - не найдет
    assert(ExpressionParser.evaluate('alert()', context) === undefined);
    assert(ExpressionParser.evaluate('model.method()', context) === undefined);

    // Операторы в именах свойств - тоже не найдет
    assert(ExpressionParser.evaluate('model.count + 1', context) === undefined);
    assert(ExpressionParser.evaluate('model.count > 0', context) === undefined);

    // Только доступ к свойствам работает
    const fn = ExpressionParser.evaluate('alert', context);
    assert(typeof fn === 'function');
    assert(ExpressionParser.evaluate('model.count', context) === 5);
  });

  test('ExpressionParser - edge cases', () => {
    const context = {
      model: {
        emptyString: '',
        zero: 0,
        false: false,
        null: null,
        undefined: undefined
      }
    };

    assert(ExpressionParser.evaluate('model.emptyString', context) === '');
    assert(ExpressionParser.evaluate('model.zero', context) === 0);
    assert(ExpressionParser.evaluate('model.false', context) === false);
    assert(ExpressionParser.evaluate('model.null', context) === null);
    assert(ExpressionParser.evaluate('model.undefined', context) === undefined);
  });

  test('ExpressionParser - пустые и невалидные выражения', () => {
    const context = { model: { id: 'test' } };

    assert(ExpressionParser.evaluate('', context) === undefined);
    assert(ExpressionParser.evaluate(null, context) === undefined);
    assert(ExpressionParser.evaluate(undefined, context) === undefined);
  });

  test('ExpressionParser - выражение "this"', () => {
    const context = { 
      model: { id: 'test' },
      count: 42 
    };

    // 'this' должно вернуть весь контекст
    assert(ExpressionParser.evaluate('this', context) === context);
    
    // Проверяем что это действительно тот же объект
    const result = ExpressionParser.evaluate('this', context);
    assert(result.model.id === 'test');
    assert(result.count === 42);
  });

  test('ExpressionParser - методы без сохранения контекста', () => {
    const model = {
      id: 'test:123',
      save: function() {
        return `saved:${this.id}`;
      }
    };

    const context = { model };

    // Получаем метод через парсер (preserveContext = false)
    const saveMethod = ExpressionParser.evaluate('model.save', context, false);
    assert(typeof saveMethod === 'function');

    // Вызываем с правильным контекстом вручную
    const result = saveMethod.call(model);
    assert(result === 'saved:test:123');
  });

  test('ExpressionParser - методы с сохранением контекста', () => {
    const model = {
      id: 'test:123',
      save: function() {
        return `saved:${this.id}`;
      }
    };

    const context = { model };

    // Получаем метод с контекстом (preserveContext = true)
    const result = ExpressionParser.evaluate('model.save', context, true);
    assert(result && typeof result === 'object');
    assert(typeof result.value === 'function');
    assert(result.context === model);

    // Вызываем с сохраненным контекстом
    const bound = result.value.bind(result.context);
    assert(bound() === 'saved:test:123');
  });

  // === UNSAFE MODE TESTS (for !{ expr } syntax) ===

  test('ExpressionParser.evaluateUnsafe - comparison operators', () => {
    const context = {
      model: {
        count: 5,
        status: 'active',
        items: [1, 2, 3]
      }
    };

    assert(ExpressionParser.evaluateUnsafe('model.count > 0', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.count < 10', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.count === 5', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.count !== 0', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.status === "active"', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.items.length > 0', context) === true);
  });

  test('ExpressionParser.evaluateUnsafe - arithmetic operators', () => {
    const context = {
      model: {
        price: 100,
        quantity: 3,
        discount: 0.1
      }
    };

    assert(ExpressionParser.evaluateUnsafe('model.price * model.quantity', context) === 300);
    assert(ExpressionParser.evaluateUnsafe('model.price + 50', context) === 150);
    assert(ExpressionParser.evaluateUnsafe('model.price - model.price * model.discount', context) === 90);
    assert(ExpressionParser.evaluateUnsafe('model.quantity * 2', context) === 6);
  });

  test('ExpressionParser.evaluateUnsafe - logical operators', () => {
    const context = {
      model: {
        isActive: true,
        isAdmin: false,
        count: 5
      }
    };

    assert(ExpressionParser.evaluateUnsafe('model.isActive && model.count > 0', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.isActive || model.isAdmin', context) === true);
    assert(ExpressionParser.evaluateUnsafe('!model.isAdmin', context) === true);
    assert(ExpressionParser.evaluateUnsafe('model.isActive && !model.isAdmin', context) === true);
  });

  test('ExpressionParser.evaluateUnsafe - ternary operator', () => {
    const context = {
      model: {
        count: 5,
        status: 'active'
      }
    };

    assert(ExpressionParser.evaluateUnsafe('model.count > 0 ? "has items" : "empty"', context) === 'has items');
    assert(ExpressionParser.evaluateUnsafe('model.count === 0 ? "none" : "some"', context) === 'some');
    assert(ExpressionParser.evaluateUnsafe('model.status === "active" ? "Yes" : "No"', context) === 'Yes');
  });

  test('ExpressionParser.evaluateUnsafe - method calls', () => {
    const context = {
      model: {
        items: [1, 2, 3, 4, 5],
        name: 'Hello World'
      }
    };

    const filtered = ExpressionParser.evaluateUnsafe('model.items.filter(x => x > 2)', context);
    assert(Array.isArray(filtered));
    assert(filtered.length === 3);

    const mapped = ExpressionParser.evaluateUnsafe('model.items.map(x => x * 2)', context);
    assert(mapped[0] === 2);
    assert(mapped[4] === 10);

    assert(ExpressionParser.evaluateUnsafe('model.name.toLowerCase()', context) === 'hello world');
    assert(ExpressionParser.evaluateUnsafe('model.name.split(" ").length', context) === 2);
  });

  test('ExpressionParser.evaluateUnsafe - nullish coalescing and optional chaining', () => {
    const context = {
      model: {
        value: null,
        nested: { deep: { id: 'found' } }
      }
    };

    assert(ExpressionParser.evaluateUnsafe('model.value ?? "default"', context) === 'default');
    assert(ExpressionParser.evaluateUnsafe('model.nonexistent?.id ?? "not found"', context) === 'not found');
    assert(ExpressionParser.evaluateUnsafe('model.nested?.deep?.id', context) === 'found');
  });

  test('ExpressionParser.evaluateUnsafe - error handling', () => {
    const context = { model: { id: 'test' } };

    // Invalid syntax should return undefined
    const result = ExpressionParser.evaluateUnsafe('model.{invalid}', context);
    assert(result === undefined);
  });

  test('ExpressionParser.evaluateUnsafe - empty/null input', () => {
    const context = { model: { id: 'test' } };

    assert(ExpressionParser.evaluateUnsafe('', context) === undefined);
    assert(ExpressionParser.evaluateUnsafe(null, context) === undefined);
    assert(ExpressionParser.evaluateUnsafe(undefined, context) === undefined);
  });
};

