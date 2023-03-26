import BaseModel from './BaseModel.js';

import Observable from './Observable.js';

const Model = Observable(BaseModel, {
  setters: ['set', 'clearValue', 'addValue', 'removeValue', 'load'],
  actions: ['load', 'reset', 'save', 'remove'],
});

export default Model;
