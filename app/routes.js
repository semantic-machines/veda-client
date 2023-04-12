import {Model, Router} from '../dist/index.js';
import './AppComponent.js';
import './SettingsComponent.js';

function present (component) {
  const main = document.querySelector('main');
  main.innerHTML = '';
  main.append(component);
}

const router = new Router();

router.add('#/app/:id', (id) => {
  const app = new Model(id);
  const component = document.createElement('veda-app');
  component.model = app;
  present(component);
});

router.add('#/settings/:id', (id) => {
  const settings = new Model(id);
  const component = document.createElement('veda-settings');
  component.model = settings;
  present(component);
});
