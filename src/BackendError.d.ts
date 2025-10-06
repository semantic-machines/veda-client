export default class BackendError extends Error {
  code: number;
  response?: any;

  constructor(code: number, response?: any);
  toString(): string;
}

