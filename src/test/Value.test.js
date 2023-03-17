import Value from '../Value.js';
import ObservableModel from '../ObservableModel.js';

export default ({test, assert}) => {
  test('Value', async () => {
    const parse = Value.parse;

    let value = new Value({data: 'test', type: 'String', lang: 'EN'});
    assert(value.data === 'test' && value.type === 'String' && value.lang === 'EN');
    assert('test^^EN' == parse(value));

    value = new Value({data: 1, type: 'Integer'});
    assert(value.data === 1 && value.type === 'Integer');

    value = new Value(1);
    assert(value.data === 1 && value.type === 'Integer');
    assert(1 === parse(value));

    value = new Value(1.1);
    assert(value.data === 1.1 && value.type === 'Decimal');
    assert(1.1 === parse(value));

    value = new Value('test');
    assert(value.data == 'test' && value.type === 'String');
    assert('test' == parse(value));

    const now = new Date();
    value = new Value(now);
    assert(value.data === now.toISOString().split('.')[0]+'Z' && value.type === 'Datetime');
    now.setMilliseconds(0);
    assert(now.valueOf() === parse(value).valueOf());

    value = new Value(true);
    assert(value.data === true && value.type === 'Boolean');
    assert(true === parse(value));

    const model = new ObservableModel();
    value = new Value(model);
    assert(value.data === model.id && value.type === 'Uri');
    assert(model.id === parse(value).id);

    const string = new String('test');
    string.language = 'ru';
    value = new Value(string);
    assert(value.data === 'test' && value.type === 'String' && value.lang === 'RU');
    assert('test^^RU' === parse(value));

    value = new Value('test^^ru');
    assert(value.data == 'test' && value.type === 'String' && value.lang === 'RU');
    assert('test^^RU' === parse(value));

    value = new Value('d:test');
    assert(value.data == 'd:test' && value.type === 'Uri');

    value = new Value('2023-03-10T06:34:26.359Z');
    assert(value.data === '2023-03-10T06:34:26Z' && value.type === 'Datetime');

    value = new Value('10.0');
    assert(value.data === 10 && value.type === 'Decimal');

    const value1 = new Value('test^ru');
    const value2 = new Value('test^ru');
    assert(value1.isEqual(value2));
  });
};
