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

  // === isSafe TESTS ===

  test('ExpressionParser.isSafe - simple property paths are safe', () => {
    assert(ExpressionParser.isSafe('model') === true);
    assert(ExpressionParser.isSafe('model.id') === true);
    assert(ExpressionParser.isSafe('model.name') === true);
    assert(ExpressionParser.isSafe('this.model.id') === true);
    assert(ExpressionParser.isSafe('this.state.count') === true);
    assert(ExpressionParser.isSafe('model.rdfs:label') === true);
    assert(ExpressionParser.isSafe('model.rdfs:label.0') === true);
    assert(ExpressionParser.isSafe('model.v-s:hasApplication.0.id') === true);
    assert(ExpressionParser.isSafe('this') === true);
  });

  test('ExpressionParser.isSafe - optional chaining is safe', () => {
    assert(ExpressionParser.isSafe('model?.id') === true);
    assert(ExpressionParser.isSafe('model?.items?.0?.id') === true);
    assert(ExpressionParser.isSafe('this.model?.rel?.nested') === true);
  });

  test('ExpressionParser.isSafe - operators are not safe', () => {
    assert(ExpressionParser.isSafe('model.count + 1') === false);
    assert(ExpressionParser.isSafe('model.count > 0') === false);
    assert(ExpressionParser.isSafe('model.count === 5') === false);
    assert(ExpressionParser.isSafe('model.price * 1.2') === false);
    assert(ExpressionParser.isSafe('model.a - model.b') === false);
    assert(ExpressionParser.isSafe('!model.isAdmin') === false);
    assert(ExpressionParser.isSafe('model.isActive && model.count > 0') === false);
    assert(ExpressionParser.isSafe('model.isActive || model.isAdmin') === false);
  });

  test('ExpressionParser.isSafe - ternary is not safe', () => {
    assert(ExpressionParser.isSafe('model.count > 0 ? "yes" : "no"') === false);
    assert(ExpressionParser.isSafe("model.status === 'active' ? 'Yes' : 'No'") === false);
  });

  test('ExpressionParser.isSafe - method calls are not safe', () => {
    assert(ExpressionParser.isSafe('model.name.toUpperCase()') === false);
    assert(ExpressionParser.isSafe('model.items.filter(x => x > 2)') === false);
    assert(ExpressionParser.isSafe('model.items.length') === true); // property access, not a call
    assert(ExpressionParser.isSafe('alert()') === false);
  });

  test('ExpressionParser.isSafe - brackets and other syntax are not safe', () => {
    assert(ExpressionParser.isSafe('model.items[0]') === false);
    assert(ExpressionParser.isSafe('model["key"]') === false);
    assert(ExpressionParser.isSafe('model.value ?? "default"') === false);
  });

  test('ExpressionParser.isSafe - empty/null input is safe', () => {
    assert(ExpressionParser.isSafe('') === true);
    assert(ExpressionParser.isSafe(null) === true);
    assert(ExpressionParser.isSafe(undefined) === true);
  });

  // === evaluateAuto TESTS ===

  test('ExpressionParser.evaluateAuto - simple paths use safe evaluation', () => {
    const context = {
      model: {
        id: 'test:123',
        name: 'Test',
        'rdfs:label': ['Label1'],
        'v-s:hasApplication': [{ id: 'app:1' }]
      }
    };

    assert(ExpressionParser.evaluateAuto('model.id', context) === 'test:123');
    assert(ExpressionParser.evaluateAuto('model.name', context) === 'Test');
    assert(ExpressionParser.evaluateAuto('model.rdfs:label.0', context) === 'Label1');
    assert(ExpressionParser.evaluateAuto('model.v-s:hasApplication.0.id', context) === 'app:1');
    assert(ExpressionParser.evaluateAuto('this.model.id', context) === 'test:123');
  });

  test('ExpressionParser.evaluateAuto - complex expressions auto-detected', () => {
    const context = {
      model: {
        count: 5,
        status: 'active',
        items: [1, 2, 3, 4, 5],
        name: 'Hello World'
      }
    };

    // Operators
    assert(ExpressionParser.evaluateAuto('model.count + 1', context) === 6);
    assert(ExpressionParser.evaluateAuto('model.count > 0', context) === true);
    assert(ExpressionParser.evaluateAuto('model.count === 5', context) === true);
    assert(ExpressionParser.evaluateAuto('model.count * 2', context) === 10);

    // Ternary
    assert(ExpressionParser.evaluateAuto('model.count > 0 ? "yes" : "no"', context) === 'yes');

    // Method calls
    assert(ExpressionParser.evaluateAuto('model.name.toUpperCase()', context) === 'HELLO WORLD');
    assert(ExpressionParser.evaluateAuto('model.items.length', context) === 5);

    // Logical
    assert(ExpressionParser.evaluateAuto('model.count > 0 && model.status === "active"', context) === true);
  });

  test('ExpressionParser.evaluateAuto - preserveContext for safe paths', () => {
    const model = {
      id: 'test:123',
      save: function() { return `saved:${this.id}`; }
    };
    const context = { model };

    const result = ExpressionParser.evaluateAuto('model.save', context, true);
    assert(result && typeof result === 'object');
    assert(typeof result.value === 'function');
    assert(result.context === model);
  });

  test('ExpressionParser.evaluateAuto - empty/null input', () => {
    const context = { model: { id: 'test' } };

    assert(ExpressionParser.evaluateAuto('', context) === undefined);
    assert(ExpressionParser.evaluateAuto(null, context) === undefined);
    assert(ExpressionParser.evaluateAuto(undefined, context) === undefined);
  });

  test('ExpressionParser.evaluateAuto - error in complex expression returns undefined', () => {
    const context = { model: { id: 'test' } };

    // Invalid JS syntax falls back to unsafe which catches the error
    const result = ExpressionParser.evaluateAuto('model.{invalid}', context);
    assert(result === undefined);
  });
};

