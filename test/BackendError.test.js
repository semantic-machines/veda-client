import BackendError from '../src/BackendError.js';

export default ({test, assert}) => {
  test('BackendError - создание и форматирование', () => {
    const error = new BackendError(404);
    assert(error.code === 404);
    assert(error.message === 'Not found');
    assert(error.toString() === 'BackendError 404: Not found');

    const customError = new BackendError();
    assert(customError.name === 'BackendError');

    const errorWithResponse = new BackendError(500, {status: 500});
    assert(errorWithResponse.response.status === 500);
  });
};