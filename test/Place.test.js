import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {Place} from '../src/components/PlaceComponent.js';
import {createTestComponent} from './helpers.js';

export default ({test, assert}) => {

  test('Place - moves children to document.body and removes them on disconnect', async () => {
    class PlaceApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.title = 'Menu';
      }
      render() {
        return html`
          <div class="anchor">
            <${Place} to="body">
              <div class="placed-menu">{this.state.title}</div>
            </${Place}>
          </div>
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(PlaceApp);
    const place = component.querySelector('veda-place');
    await place.rendered;

    const menu = document.body.querySelector('.placed-menu');
    assert(menu !== null, 'Menu should be attached to document.body');
    assert(menu.textContent === 'Menu', 'Placed content should keep expressions');
    assert(place.querySelector('.placed-menu') === null, 'Original place host should be empty');

    cleanup();
    assert(document.body.querySelector('.placed-menu') === null, 'Placed nodes should be removed on disconnect');
  });

  test('Place - to attribute interpolates a selector', async () => {
    const targetId = `place-target-${Math.random().toString(36).slice(2, 8)}`;
    const target = document.createElement('div');
    target.id = targetId;
    document.body.appendChild(target);

    class PlaceToApp extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.target = `#${targetId}`;
        this.state.title = 'Parked';
      }
      render() {
        return html`
          <${Place} to="{this.state.target}">
            <div class="placed-parked">{this.state.title}</div>
          </${Place}>
        `;
      }
    }

    const {cleanup} = await createTestComponent(PlaceToApp);
    const parked = target.querySelector('.placed-parked');
    assert(parked !== null, 'Should move nodes to the interpolated target');
    assert(parked.textContent === 'Parked', 'Placed content should keep expressions');

    cleanup();
    target.remove();
    assert(document.body.querySelector('.placed-parked') === null, 'Should remove nodes on disconnect');
  });
};
