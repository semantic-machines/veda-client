# Cookbook

How to do typical UI work in Veda Client, and how not to.

The recipes come from real apps (document cards, workflow designer / process manager). Those apps were written before Context, Slot, Place, refs, and bind. Use this page when you hit the same problems.

This is not an API reference. For signatures see [API.md](./API.md). For naming, getters, `watch` / `effect`, see [STYLE_GUIDE.md](./STYLE_GUIDE.md).

Working demos: `examples/src/context-demo.html`, `examples/src/slot-place-demo.html`, `examples/src/bind-refs-demo.html`, `examples/src/loop-if-demo.html`.

---

## Choose a tool

| Need | Use | Do not |
| --- | --- | --- |
| Same data in many nested children (`documentMode`, `theme`, page store) | `<${Context}>` + `this.context.key` | `:prop` on every child; `querySelectorAll('*')` to copy state |
| Named holes in a layout (trigger / content / header) | `<${Slot} name="…">` | `outerHTML` strings, remount with `innerHTML` |
| Render into `document.body` or another node | `<${Place} to="body">` | Keep the overlay in a clipped parent; `document.createElement` + `appendChild` for UI you already have in `render()` |
| Two-way native input to local `this.state` | `bind="{this.state.q}"` | A pair of `:value` + `oninput` that only copies `e.target.value` |
| Hold a node after render (focus, measure, third-party mount) | `ref="query"` → `this.refs.query` | `this.querySelector(…)` after every `update()` for a stable node |
| Click handler that lives on an ancestor | Context `:save="{this.save}"` + `onclick="{this.context.save}"` | `onclick="{this.save}"` in a child `render()`; `closest()` only to find a parent method |
| Many children report to one shell (`net-select`, `element-update`) | Bubbling `CustomEvent` | Do not replace an app event bus with Context actions |
| List click via `data-*` | One handler + `closest('[data-id]')` | A named `onclick` on every identical row is optional, not required |
| Callback for **one** specific child | `:on-save="{this.save}"` and call `this.state.onSave` | Context, if only one child needs that function |
| List of items | `<${Loop} items key as>` or `items` on a native host | `this.state.rows.map(…)` inside `render()` |
| Show / hide a block | `<${If} condition>` or `condition` on a node | `:hidden` when you need the subtree gone (Place, editor) |

Context is for **subtree data and ambient actions**. A card still uses `onclick="{this.save}"` on its own method. Place **moves** nodes; it does not position them.

---

## 1. Share data down a tree

Document cards pass `:document-context` and `:document-mode` through every control. When mode changes, the host walks `querySelectorAll('*')` and writes `element.state.documentMode`. That is prop drilling plus a manual tree walk.

### Do — provide once, read anywhere below

```javascript
import Component, { html, Context } from 'veda-client';

class DocumentCard extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.documentMode = 'edit';
    this.state.documentContext = null;
  }

  render() {
    return html`
      <${Context}
        :document-mode="{this.state.documentMode}"
        :document-context="{this.state.documentContext}">
        <profile-section></profile-section>
      </${Context}>
    `;
  }
}

class VedaText extends Component(HTMLElement) {
  get readOnly() {
    return this.context.documentMode === 'view';
  }

  render() {
    return html`<input disabled="{this.readOnly}">`;
  }
}
```

Nearest `<veda-context>` that **has the key** wins. Other keys fall through to an outer provider. A nested `theme` lock does not hide an outer `locale`.

### Do not — copy the same `:prop` on every child

```javascript
// Do not
<${VedaLink}
  :document-context="{this.state.documentContext}"
  :document-mode="{this.state.documentMode}">
</${VedaLink}>
<${VedaText}
  :document-context="{this.state.documentContext}"
  :document-mode="{this.state.documentMode}">
</${VedaText}>
```

### Do not — push state with `querySelectorAll`

```javascript
// Do not
propagateDocumentMode(root, mode) {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.state) element.state.documentMode = mode;
  }
}
```

Put `documentMode` on the Context provider. Children that read `this.context.documentMode` update themselves.

### Ambient actions go on Context

A child `render()` does not search ancestors for `{this.save}`. If many nested children need the same action, provide it once:

```javascript
<${Context} :document-mode="{this.state.documentMode}" :save="{this.save}">
  <document-card></document-card>
</${Context}>
```

```javascript
// deep child
<button onclick="{this.context.save}">Save</button>
```

A typical card still uses `onclick="{this.save}"` on its own method. See [Events](#6-events).

### One-level props stay props

A shell that owns `currentNet` and `selectedElement` and passes them to **direct** children should keep `:current-net` / `:selected-element`. Context is for values that many **nested** descendants need without the middle layers knowing about them.

---

## 2. Layout holes (slots)

Popups and cards often take a trigger and a body. The old pattern: parse `[slot="trigger"]` from `this.template`, store `outerHTML`, then remount with `_process` so expressions still work.

### Do — project children into named holes

```javascript
import Component, { html, Slot } from 'veda-client';

class Popup extends Component(HTMLElement) {
  static tag = 'veda-popup';

  open() {
    this.state.open = true;
  }

  render() {
    return html`
      <span class="popup">
        <${Slot} name="trigger">
          <button onclick="{this.open}">Open</button>
        </${Slot}>
        <div class="popup-body" condition="{this.state.open}">
          <${Slot} name="content"><p>No content</p></${Slot}>
        </div>
      </span>
    `;
  }
}

// Parent that authors the content
<${Popup} :open="{this.state.open}">
  <button slot="trigger" onclick="{this.open}">Open</button>
  <p slot="content">{this.state.title}</p>
</${Popup}>
```

Expressions, `onclick`, and `ref` on slotted nodes belong to the **parent that wrote them**, not to the layout. `this.refs.open` is on that parent, not on `<veda-slot>`.

Content inside `<${Slot}>` is fallback content. It renders only when the parent did not pass a matching node. Its expressions, handlers, and refs belong to the layout that wrote the Slot. An assigned empty element suppresses fallback:

```javascript
<${Popup}>
  <div slot="content"></div>
</${Popup}>
```

Nodes without `slot` go to `<${Slot}>` (default), including non-empty text.

### Do not — stringify and remount

```javascript
// Do not
#extractSlotTemplates() {
  const tpl = document.createElement('template');
  tpl.innerHTML = this.template || '';
  this.state.triggerTemplate = tpl.content.querySelector('[slot="trigger"]').outerHTML;
}

#mountTemplateToContainer(selector, html) {
  const container = this.querySelector(selector);
  container.innerHTML = html;
  this._process(container, this._vedaEvalContext || this.state);
}
```

### Item templates in a list

For a repeating block (embedded relation row), the parent still authors the markup. Put a `<${Slot}>` inside the Loop item, or pass a child component that reads Context. Do not build a tag string with `:document-mode="{this.documentMode}"` and assign it as `innerHTML`.

Do not rebuild an eval context with `Object.setPrototypeOf` so slotted expressions see `item`. Slot already evaluates in the authoring parent.

### Slot is not a runtime mount

A router or document host that does `document.createElement(nextTag)` and `slot.replaceChildren(nextEl)` is choosing a **component type** at runtime. Slot cannot do that. Keep `createElement` there. After mount, give the card Context (or set its props once) instead of walking the new tree with `querySelectorAll`.

---

## 3. Overlays, menus, dialogs

Link dropdowns use `position: fixed` **inside** the control, then listen to `scroll` / `resize` and write `top` / `left` from `getBoundingClientRect`. Confirm dialogs build a tree with `document.createElement` and `document.body.appendChild`. Script editors render an overlay **inside** the panel, so `overflow` on ancestors clips it.

### Do — keep markup in `render()`, place the node

```javascript
import Component, { html, If, Place, Slot } from 'veda-client';

class ConfirmModal extends Component(HTMLElement) {
  render() {
    return html`
      <${Slot} name="trigger"></${Slot}>
      <${If} condition="{this.state.open}">
        <${Place} to="body">
          <div class="overlay" onclick="{this.handleBackdrop}">
            <div class="dialog" onclick="{this.stopInside}">
              <${Slot} name="content"></${Slot}>
              <button onclick="{this.close}">Close</button>
            </div>
          </div>
        </${Place}>
      </${If}>
    `;
  }
}
```

`to` is `body` or a `document.querySelector` selector. `to="{this.state.target}"` is interpolated. Nodes are removed when the Place disconnects (when `If` hides it, or the host unmounts).

### Do not — leave a `position: fixed` menu under `overflow: hidden`

If a parent clips or creates a containing block, the menu stays trapped. Place the menu into `body`, then position it if you need to.

### Place does not position

Place only **moves** nodes. A dropdown that must sit under an input still measures the anchor:

```javascript
open() {
  this.state.open = true;
  requestAnimationFrame(() => {
    const anchor = this.refs.anchor;
    const menu = this.refs.menu;
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
  });
}

render() {
  return html`
    <div ref="anchor" class="control" onclick="{this.open}">…</div>
    <${If} condition="{this.state.open}">
      <${Place} to="body">
        <div ref="menu" class="menu" style="position: fixed;">…</div>
      </${Place}>
    </${If}>
  `;
}
```

You can drop the scroll/resize listeners that only existed to fight a clipped parent. You still need geometry if the menu must follow the anchor.

### Imperative `document.createElement` dialogs

A one-shot `confirm()` helper that is not a component can still append to `body`. If the same UI already lives in a component `render()`, use Place instead of building a second tree by hand.

Click-outside and Escape stay in the app (`document.addEventListener`). Place does not close menus.

---

## 4. Forms

Login screens and filter bars pair `:value` / `value="{…}"` with `handleUsernameInput` / `handleSearchInput` that only write `e.target.value` into state.

### Do — bind local native fields

```html
<input bind="{this.state.username}" autocomplete="username">
<input type="password" bind="{this.state.password}">
<input type="checkbox" bind="{this.state.remember}">
<select bind="{this.state.searchMode}">
  <option value="document">Document</option>
  <option value="uri">URI</option>
</select>
<input type="radio" name="kind" value="open" bind="{this.state.kind}">
<input type="radio" name="kind" value="closed" bind="{this.state.kind}">
```

`bind` is a directive, not `:bind` and not a native property. The path must be a simple property path (`?.` is allowed).

- text / textarea / select → string (or the option value)
- checkbox → boolean
- radio → the selected `value` string

Same result as `:value` + `oninput` (or `:checked` + `onchange`) for local state.

### Do not — a handler that only copies the value

```javascript
// Do not, for local this.state
handleUsernameInput(e) {
  this.state.username = e.target.value;
}

<input value="{this.state.username}" oninput="{handleUsernameInput}">
```

```html
<input bind="{this.state.username}">
```

### Keep a handler when the input does more than store a value

```javascript
handleSearchInput(e) {
  this.state.searchText = e.target.value;
  this.scheduleSearch();
}
```

`bind` does not run extra logic. Use `:value` + `oninput` (or `bind` plus a separate `oninput` only if you still need the extra work — prefer one `oninput` that writes state and schedules).

### Do not — bind a Model field on a document control

Controls that read/write RDF (`about` + `property`, language, rights, view/edit mode) stay in application code. `bind` is for component `this.state`, not for `model['v-s:title']`.

### Keep `:value` when you write `input.value` yourself

Money sanitizers and paste handlers that call `event.preventDefault()` and then set `input.value` fight a controlled `:value` that re-applies an empty or old state. That logic stays in the control. `bind` does not fix cursor or paste; it only syncs local state.

---

## 5. Finding DOM nodes

After render, code often does `this.querySelector('.idea-link-search')` to focus, or `this.querySelector('[data-script-editor]')` to mount a third-party editor.

### Do — `ref` for a node you own

```html
<input ref="query" bind="{this.state.q}">
<button onclick="{this.focusQuery}">Focus</button>
```

```javascript
focusQuery() {
  this.refs.query?.focus();
}
```

Refs are rebuilt on each `update()`. A `ref` on slotted content is stored on the author, not on the layout.

### `querySelector` is still fine when

- you mount a third-party widget (Quill, Synesthesia) into a host node — `ref` the host, then init the library on that node
- you look up a **dynamic** node inside a Loop (`'.ms-option--highlighted'`)
- you talk to a child custom element you do not author
- canvas / SVG hit-testing by `data-id`

Do not replace every `querySelector` with a ref. Replace the ones that always mean “this one input / this one mount point”.

Do not poll `querySelector` with `requestAnimationFrame` until a mount node appears. Put `ref="editor"` on that node and init in `post()` (or an effect that reads `this.refs.editor`).

### Do not — query the whole subtree to set the same state

That is the `propagateDocumentMode` case. Use Context.

---

## 6. Events

`{handleClick}` and `{this.handleClick}` are the same. Lookup runs **on the event**, on this component (and on the eval context of Loop / If / Place / Slot). `this` is the component that **owns** the method. Arguments are `(event, node)`. A child component does not search ancestors.

```javascript
class Card extends Component(HTMLElement) {
  save() {
    this.state.saved = true;
  }
  render() {
    return html`<button onclick="{this.save}">Save</button>`;
  }
}
```

Works on native **and** custom elements. The inline `on*` attribute is removed after bind.

### Dotted paths are property access

`{this.handlers.click}` and `{item.remove}` read a property. `this` is the object left of the last key. Loop `item` works because the expression uses the current eval context.

```html
<${Loop} items="{this.state.rows}" as="row">
  <button onclick="{row.remove}">Remove</button>
</${Loop}>
```

### One specific child needs its own callback

Pass the function as a prop. A class method stays bound to the parent.

```html
<row-actions :on-remove="{this.removeRow}"></row-actions>
```

```javascript
// child
handleClick() {
  this.state.onRemove?.(this.state.row);
}
```

### Ambient action for a subtree

```html
<${Context} :save="{this.save}">
  <theme-toggle></theme-toggle>
</${Context}>
```

```javascript
// child
render() {
  return html`<button onclick="{this.context.save}">Save</button>`;
}
```

### Keep a bubbling `CustomEvent` on an app shell

A designer / process manager that listens for `net-select`, `element-update`, `view-change` from many unrelated children should keep those events. Context actions are for a shared subtree API. They are not an event bus.

```javascript
// Fine — many emitters, one shell
this.addEventListener('element-update', this.handleElementUpdate);

// Child
this.dispatchEvent(new CustomEvent('element-update', {
  bubbles: true,
  detail: { property, value },
}));
```

### Keep `closest` for delegation inside one list

```javascript
handleTabClick(e) {
  if (e.target.closest('.v-tabs-label-input')) return;
  const btn = e.target.closest('[data-id]');
  if (!btn) return;
  this.selectTab(btn.dataset.id);
}
```

That finds **which row** was clicked. Do not use `closest('my-card')` only to reach a parent method — use `onclick="{this.save}"`.

### Do not

- expect `{this.save}` in a child `render()` to find an ancestor method
- treat `{handleClick}` and `{this.handleClick}` as different features
- replace a shell event bus with Context actions

---

## 7. Lists and conditions

### Lists

```html
<${Loop} items="{this.filteredProcesses}" key="id" as="process">
  <process-row :process="{process}"></process-row>
</${Loop}>
```

Use a stable `key`. For computed lists, use a getter (`filteredProcesses`), not an expression with filters, and not `this.state.rows.map(…)` inside `render()` — that list will not update after async work. See [STYLE_GUIDE.md](./STYLE_GUIDE.md).

A native host can carry the list (semantic Loop):

```html
<tbody items="{this.workItems}" key="id" as="wi">
  <tr is="${WorkItemRow}" :work-item="{wi}"></tr>
</tbody>
```

Large lists (hundreds+ with scroll): `<${Virtual}>`, not a raw Loop. See [API.md](./API.md#virtual) and `examples/src/virtual-list-demo.html`.

### Show / hide

```html
<${If} condition="{this.state.error}">
  <div class="error">{this.state.error}</div>
</${If}>

<button condition="{this.hasActiveSearch}" onclick="{this.clearSearch}">Clear</button>
```

`If` removes the subtree. `condition` on a node hides that node. Use `If` when the hidden block is large or has its own Place / third-party widget.

`:hidden="{this.hideEditContent}"` keeps the node in the tree (view/edit swap on a field). That is fine when both sides are cheap. Do not leave a Place overlay or a Synesthesia host on a hidden branch — unmount it with `If`.

---

## 8. Stay in application code

The framework does not replace these. Keep them in the app:

| Work | Why |
| --- | --- |
| RDF load / save, rights, language | Model / Backend |
| Document field widgets (text, link, file, rich text) | App controls; they talk to a model, not to `bind` |
| Canvas, minimap, orthogonal routes | Not a template problem |
| Bootstrap offcanvas / existing overlay hosts | Already a mount API; Place is for nodes you render |
| `confirm()`-style Promise helpers, toasts | Fine as imperative UI |
| Click-outside / Escape / document keydown | App listeners |
| App-shell `CustomEvent` bus | Many unrelated children → one parent |
| Choosing a card tag at runtime (`createElement`) | Router / document host |
| i18n catalogs, router, auth | App / Backend |

---

## 9. Quick checks

**I pass the same two props through five layers.**  
Use Context at the top of that subtree.

**I only pass `selectedElement` to the property panel.**  
Keep a prop.

**My popup copies `outerHTML` of `[slot="trigger"]`.**  
Use `<${Slot} name="trigger">`.

**The dropdown is clipped or sits under a sticky bar.**  
`<${Place} to="body">`, then set `top` / `left` if needed.

**I wrote `handleXInput` that assigns `e.target.value`.**  
Use `bind`.

**I need to `focus()` an input I rendered.**  
`ref="query"` and `this.refs.query.focus()`.

**A nested button should call the page `save`.**  
`onclick="{this.save}"` — do not inject `save` through Context.

**A Loop row has its own `remove`.**  
`onclick="{item.remove}"` or a method on the row component.

**The app listens for `element-update` from the canvas and the property panel.**  
Keep the `CustomEvent`.

**I pick a tab / row with `data-id`.**  
One container handler + `closest` is fine.

**I need a Quill / CodeMirror host.**  
`ref="editor"` on the mount node; init the library in `post()` / an effect. Do not rAF-poll `querySelector`.
