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

export default class Presenter {
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

export async function present (model, container, presenter, ...extra) {
  container = typeof container === 'string' ? document.querySelector(container) : container;
  model = typeof model === 'string' ? new Model(model) : model;

  if (!model.isNew()) await model.load();

  const PresenterClass = await getPresenterClass(presenter);
  presenter = new PresenterClass(model);

  const html = presenter.render();
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;

  await presenter.pre(container, fragment, ...extra);
  const rendered = await render(model, container, fragment);
  await presenter.post(container, rendered, ...extra);

  return rendered;
}

async function getPresenterClass (param) {
  const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;
  let PresenterClass;
  if (param instanceof Model) {
    await param.load();
    if (!presenter.hasValue('rdf:type', 'v-s:Presenter')) {
      throw new TypeError('v-s:Presenter type required!');
    }
    const presenterName = param['v-s:path'][0];
    PresenterClass = (await import(presenterName)).default;
  } else if (typeof param === 'string' && reg_uri.test(param)) {
    const presenterModel = new Model(param);
    return getPresenter(presenterModel);
  } else if (typeof param === 'string') {
    PresenterClass = class extends Presenter {
      render () {
        return param;
      }
    };
  } else if (param instanceof HTMLElement) {
    PresenterClass = class extends Presenter {
      render () {
        return param.outerHTML;
      }
    };
  } else {
    PresenterClass = Presenter;
  }
  return PresenterClass;
}

async function render (model, container, fragment) {
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
    const presenter = inline ?? node.getAttribute('data-presenter');

    try {
      await about.load();
      const handler = () => renderRelationValue(about, rel, presenter, node);
      about.on(rel, handler);
      node.addEventListener('remove', () => about.off(rel, handler));
      renderRelationValue(about, rel, presenter, node);
    } catch (error) {
      errorPrinter(error, about, rel, node);
    }
  });

  await Promise.all(propPromises);
  await Promise.all(relPromises);

  requestAnimationFrame(() => container.append(fragment));
  return container.childNodes;
}

function renderPropertyValue (model, prop, node) {
  node.innerHTML = '';
  model[prop].forEach?.((literal) => renderLiteral(node, literal)) ?? renderLiteral(node, model[prop]);
}

function renderLiteral (node, value) {
  const holder = document.createElement('span');
  holder.classList.add('value');
  holder.textContent = value.toString();
  node.appendChild(valueHolder);
}

async function renderRelationValue (model, rel, presenter, node) {
  node.innerHTML = '';
  if (Array.isArray(model[rel])) {
    await Promise.all(
      model[rel].map((related) => present(related, node, presenter)),
    );
  } else {
    await present(model[rel], node, presenter);
  }
}

function errorPrinter (error, model, prop, node) {
  const msg = `Presenter failed: ${model.id}, prop: ${prop}, ${error}`;
  node.textContent = `${error.name}: {error.message}`;
  node.classList.add('error');
  node.title = msg;
  console.error(msg);
}
