import {Model, Router} from '../src/index.js';
import './AppComponent.js';
import './SettingsComponent.js';

const tagDictionary = {
  app: 'veda-app',
  settings: 'veda-settings',
};

const main = document.querySelector('main');

const router = new Router();

router.add('#/:comp/:id', (comp, id) => {
  const model = new Model(id);
  const tag = tagDictionary[comp];
  const component = document.createElement(tag);
  component.model = model;
  main.innerHTML = '';
  main.append(component);
});
