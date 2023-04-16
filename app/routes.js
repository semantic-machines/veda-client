import {Model, Router} from '../src/index.js';
import './AppComponent.js';
import './SettingsComponent.js';

const present = (component) => {
  const main = document.querySelector('main');
  main.innerHTML = '';
  main.append(component);
};

const router = new Router();

const tagDictionary = {
  app: 'veda-app',
  settings: 'veda-settings',
};

router.add('#/:comp/:id', (comp, id) => {
  const model = new Model(id);
  const tag = tagDictionary[comp];
  const component = document.createElement(tag);
  component.model = model;
  present(component);
});
