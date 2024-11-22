import BaseModel from './BaseModel.js';

import Observable from './Observable.js';

const Model = Observable(BaseModel, {
  setters: ['addValue', 'removeValue', 'apply'],
  actions: ['load', 'reset', 'save', 'remove'],
});

export default Model;

