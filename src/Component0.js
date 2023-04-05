import Model from './Model.js';

export function html (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i] + (values[i] ?? '');
  }
  return result.replace(/\s+/g, ' ').replace(/\s</g, '<').trimEnd();
}

export function dashCase (str) {
  return str.replace(/[A-Z]/g, (c, o) => (p > 0 ? '-' + c : c).toLowerCase());
}

export default class Component extends HTMLElement {
  model;
  constructor (model) {
    this.model = model;
  }
  render () {
    return html`
      <a href="#/${this.model.id}">${this.model.id}</a>
    `;
  }
  pre (container, fragment, ...rest) {}
  post (container, nodes, ...rest) {}
}

export async function present (model, container, component, ...extra) {
  container = typeof container === 'string' ? document.querySelector(container) : container;
  model = typeof model === 'string' ? new Model(model) : model;

  if (!model.isNew()) await model.load();

  const ComponentClass = await getComponentClass(component);
  component = new ComponentClass(model);

  const html = component.render();
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;

  await component.pre.call(component, container, fragment, ...extra);
  const rendered = await render(component, container, fragment);
  await component.post.call(component, container, rendered, ...extra);

  return rendered;
}

async function getComponentClass (component) {
  const reg_class = /^([A-Z][a-z0-9_]+)+$/;
  let ComponentClass;
  if (typeof component === 'function') {
    ComponentClass = component;
  } else if (typeof component === 'string' && reg_class.test(component)) {
    ComponentClass = (await import(`./${component}.js`)).default;
  } else if (typeof component === 'string') {
    ComponentClass = class extends Component {
      render () {
        return component;
      }
    };
  } else {
    ComponentClass = Component;
  }
  return ComponentClass;
}

async function render (component, container, fragment) {
  const model = component.model;
  const propNodes = [];
  const relNodes = [];

  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);

  let node = walker.nextNode();
  node.setAttribute('resource', model.id);
  node.setAttribute('typeof', model['rdf:type']?.map?.((item) => item.id).join(' ') ?? model['rdf:type']?.id);

  while (node) {
    if (node.hasAttribute('property')) propNodes.push(node);
    if (node.hasAttribute('rel')) {
      let inline;
      if (node.hasChildNodes()) {
        inline = node.innerHTML;
        node.innerHTML = '';
      }
      relNodes.push([node, inline]);
    }
    node = walker.nextNode();
  }

  const propPromises = propNodes.map(async (node) => {
    const prop = node.getAttribute('property');
    const about = node.hasAttribute('about') ? new Model(node.getAttribute('about')) : model;

    try {
      await about.load();
      const handler = () => renderPropertyValue(about, prop, node);
      about.on(prop, handler);
      node.addEventListener('remove', () => about.off(prop, handler));
      renderPropertyValue(about, prop, node);
    } catch (error) {
      errorPrinter(error, about, prop, node);
    }
  });

  const relPromises = relNodes.map(async ([node, inline]) => {
    const rel = node.getAttribute('rel');
    const about = node.hasAttribute('about') ? new Model(node.getAttribute('about')) : model;
    const component = inline ?? node.getAttribute('data-component');

    try {
      await about.load();
      const handler = () => renderRelationValue(about, rel, component, node);
      about.on(rel, handler);
      node.addEventListener('remove', () => about.off(rel, handler));
      renderRelationValue(about, rel, component, node);
    } catch (error) {
      errorPrinter(error, about, rel, node);
    }
  });

  await Promise.all(propPromises);
  await Promise.all(relPromises);

  const rendered = fragment.children;
  container.appendChild(fragment);
  return rendered;
}

function renderPropertyValue (model, prop, node) {
  node.innerHTML = '';
  if (Array.isArray(model[prop])) {
    model[prop].forEach((literal) => renderLiteral(node, literal));
  } else {
    renderLiteral(node, model[prop]);
  }
}

function renderLiteral (node, value) {
  const holder = document.createElement('span');
  holder.classList.add('value');
  holder.textContent = value.toString();
  node.appendChild(holder);
}

async function renderRelationValue (model, rel, component, node) {
  node.innerHTML = '';
  if (Array.isArray(model[rel])) {
    await Promise.all(
      model[rel].map((related) => present(related, node, component)),
    );
  } else {
    await present(model[rel], node, component);
  }
}

function errorPrinter (error, model, prop, node) {
  const msg = `Presenter failed: ${model.id}, prop: ${prop}, ${error}`;
  node.textContent = `${error.name}: {error.message}`;
  node.classList.add('error');
  node.title = msg;
  console.error(msg);
}
