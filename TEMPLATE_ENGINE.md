# Template Engine

Движок построен по модели lit-html: шаблон статичен, значения пишутся в DOM
через Part-ы, а не парсятся как markup. `Component`, `Loop`, `If`, `Slot`,
`Place`, `Property`, `Relation`, `Value` и `Virtual` используют один и тот же
путь. Legacy-обходчик `Component._process` удалён; рендер всегда идёт через
скомпилированные шаблоны и Part-ы.

## Главное правило

**Значение никогда не становится markup.** Всё, что приходит из `${}`, — это
данные: они попадают в текстовый узел, атрибут или свойство через DOM API.
Единственное исключение — **static-trusted** значения, которые автор шаблона
явно пометил как часть исходника (`unsafeStatic()`) или которые являются
кодом (Component class с `static tag`). Это то же правило, что в lit-html:
там статику сплайсит только `static.js`, а обычный `html` — никогда.

Static-trusted значение нельзя подделать данными: бренд — это `Symbol`,
поэтому ни `JSON.parse`, ни объект из сети не могут выглядеть как
`unsafeStatic()` (Lit защищает `unsafeStatic` ровно так же).

Строковых fallback-ов больше нет: `Slot` проецирует урезанную копию уже
скомпилированного шаблона хоста, поэтому `${}` остаётся значением и проходит
ту же политику. Хост, собранный приложением в обход шаблона (`innerHTML`), не
имеет скомпилированного исходника и не проецируется — см. «Ограничения».

## Файлы

| Файл | Назначение |
|---|---|
| `src/template/TemplateResult.js` | `html`/`raw`/`safe`, `TemplateResult`, `unsafeStatic`, `nothing`/`noChange`/`unsafeHTML` |
| `src/template/Template.js` | компилятор, маркеры, кеш, `CompiledTemplate`, `render()` |
| `src/template/TemplateInstance.js` | инстанс шаблона и Part-ы |
| `src/template/security.js` | политика: имена, запрещённые атрибуты, URL-схемы |
| `src/template/markers.js` | случайные имена маркеров для компилятора и рендерера |
| `src/template/factories.js` | поздняя регистрация фабрик встроенных компонентов |

## Публичный контракт

```js
import {html, render, unsafeStatic, unsafeHTML, nothing, noChange} from 'veda-client';

const row = (item) => html`<div class="row ${item.cls}">${item.title}</div>`;
render(row({cls: 'a', title: 'Ada'}), document.querySelector('#app'));

// Имя тега/атрибута, если оно действительно статическое:
const tag = unsafeStatic('my-row');
html`<${tag} ${unsafeStatic('data-kind')}="row"></${tag}>`;
```

- `html` возвращает `TemplateResult`, а не строку; `render()` или
  `Component.render()` монтируют и патчат результат.
- `nothing` очищает позицию, `noChange` оставляет прежнее значение,
  `unsafeHTML()` вставляет доверенный markup.
- `unsafeStatic()` — доверенный исходник (имя тега/атрибута, `is`); ввод
  пользователя туда передавать нельзя.
- `raw` возвращает строку: `${raw`...`}` — текст, для markup нужен
  `unsafeHTML()`.

Полный список API и оговорки — в [API.md](./API.md).

## Маркеры и Part-ы

Имена маркеров случайны на загрузку страницы (`data-veda-el-<token>`,
`data-veda-spread-<token>-<slot>`, текстовые маркеры `\uE000veda$<token>$<id>`),
как `lit$<random>$` в lit-html. Данные не могут ни угадать маркер, ни
подделать его: значения не попадают в markup, а namespace `data-veda-*`
запрещён для spread-значений.

- **ChildPart** — пустой текстовый узел-маркер в позиции `${}`/`{expr}`.
  Значения вставляются перед маркером; чужие Part-ы и соседние узлы не
  сдвигаются.
- **Element marker** — случайный атрибут на элементе, у которого есть
  Component/Attribute/Property/Event/Ref/Bind/Spread Part. При
  инстанцировании маркер удаляется, Part-ы получают реальный элемент.
  Коллизия маркеров — ошибка (шаблон повреждён), а не молчаливая перепривязка.

Part-ы:

| Part | Что делает |
|---|---|
| `ChildPart` | текст, `TemplateResult`, `Node`, массив, `nothing`/`noChange`, `unsafeHTML` |
| `AttributePart` | атрибут или свойство; boolean-атрибуты через `toggleAttribute` |
| `PropertyPart` | `:prop` на native/custom element |
| `EventPart` | один listener на элемент; handler резолвится в момент события |
| `RefPart` | `ref` с восстановлением после `update()` |
| `BindPart` | `bind` с проверкой простого пути |
| `AttributesPart` | `${attrs}`: объект атрибутов, применяемый через DOM API |

## Поддерживаемый синтаксис

### `{expr}` — реактивное выражение Veda

```html
<div class="{this.state.cls}">{this.state.title}</div>
<button onclick="{save}">Save</button>
<input bind="{this.state.query}">
<child-component :model="{this.state.model}"></child-component>
<div ref="box"></div>
```

Каждое выражение компилируется один раз и подключается к Part-у через
`effect`. Part пишет в DOM только при изменении значения.

### `${value}` — ленивое значение шаблона

```js
html`<div class="row ${this.state.cls}">${this.state.title}</div>`
```

| Позиция | Поведение |
|---|---|
| Имя тега `<${Comp}>` | Component class с собственным `static tag` или `unsafeStatic('name')`; строка из данных и класс без своего тега — **ошибка** |
| Атрибут `${attrs}` целиком | spread-слот: объект/`Map` применяется через DOM |
| Имя атрибута `${name}="..."` или `foo${x}` | только `unsafeStatic('name')`; значение из данных — **ошибка компиляции** |
| `is="${Comp}"` | Component class или `unsafeStatic('tag')`; иное — **ошибка** |
| Значение атрибута `class="a ${x}"` | `AttributePart` |
| Значение атрибута без кавычек `class=${x}`, `class = ${x}` | `AttributePart` |
| Текст `...${x}...` | `ChildPart` |
| `TemplateResult`/`Node`/массив | `ChildPart` с вложенным рендером |
| `${}` в `<script>`/`<style>` | **ошибка компиляции**; `{expression}` там тоже не работает |
| `${}` в HTML-комментарии | **ошибка компиляции**: значения не попадают в markup |
| `${}` в `key`/`as`/height на Loop/If/Virtual | **ошибка**: это статическая конфигурация |
| `${}` в `ref`/`bind`/`on*`/`is` | **ошибка**: используйте `{expression}` / `unsafeStatic` |
| `${}` во вложенном `<template>` | **ошибка**; `{expression}` там тоже не работает |
| Статический `on*`-атрибут или `srcdoc` в шаблоне | **ошибка компиляции**: `{expression}` / `unsafeHTML()` |
| `:srcdoc`, `:on*`, `:innerHTML`, `:outerHTML` | **ошибка компиляции**: HTML-синки только через `unsafeHTML()` |

`${attrs}` принимает **объект** (или `Map`): `name`, `?bool`, `.prop`,
`@event`; исчезнувшие ключи удаляются. Запреты и URL-политика —
[SECURITY.md](./SECURITY.md), полный синтаксис — [API.md](./API.md).

## Кеш

- `WeakMap<TemplateStringsArray, Map<shape, CompiledTemplate>>`: один
  call-site компилируется один раз; shape учитывает static-trusted значения
  (имена, `is`), поэтому динамические `${}` новый шаблон не создают.
- `Map<string, CompiledTemplate>` (LRU, 1000) — для шаблонов-строк, включая
  `html('...')`.
- `ExpressionParser` кеширует скомпилированные выражения (2000 записей).

## Lifecycle и значения

- `update()` с тем же `CompiledTemplate` патчит Part-ы и сохраняет DOM,
  дочерние компоненты, `refs`, фокус.
- Родитель передаёт свои `${}` values дочерним компонентам **только** если
  дочерний компонент рендерит parent-authored `CompiledTemplate`. Если
  ребёнок рендерит собственный `html`, его values не перезаписываются.
- Вложенный `TemplateResult` переиспользует `TemplateInstance`, если
  `CompiledTemplate` не изменился: фокус и состояние формы сохраняются.
- `EventPart` резолвит handler при каждом событии, поэтому замена
  `this.state.handler` подхватывается без remount.
- При disconnect DOM отсоединённого поддерева не вычищается: останавливаются
  эффекты/слушатели, но `textContent` не меняется.
- При смене шаблона старый `TemplateInstance` уничтожается, новый
  монтируется через `replaceChildren`.
- `Slot`-проекция: из скомпилированного шаблона хоста клонируется только
  нужная ветка (по `slot`), маркеры и Part-ы сохраняются, `${}`-значения
  подставляются при инстанцировании и обновляются при `update()` хоста.

## Trusted Types

Все присваивания в `innerHTML` идут через политику `veda-template`
(`createHTML`): компилятор шаблона, `Slot` (проекция из скомпилированного
дерева) и `unsafeHTML()`. Это позволяет работать под
`Content-Security-Policy: require-trusted-types-for 'script'`. Прямых
`innerHTML`-синков в движке не осталось.

## Ограничения

1. Хост, собранный в обход шаблона (`innerHTML`), не имеет скомпилированного
   исходника, поэтому `Slot` не может спроецировать его содержимое — авторьте
   такие хосты через `html`.
2. Нет comment-маркеров, SSR/hydration и morph-стратегии.
3. Нет директив `classMap`/`styleMap`/`repeat`/`cache`; есть только
   `nothing`/`noChange`/`unsafeHTML`/`unsafeStatic`.
4. У `TemplateResult` нет строковой сериализации: рендер только через
   `render()`/`Component.render()`. `String(result)` больше не даёт markup.

## Диагностика

```js
window.__VEDA_TEMPLATE_ENGINE__ // 'templateresult-parts-v3'

// Deprecated: per-host counters removed; only the engine marker and the
// string-cache size remain.
getTemplateCacheStats() // {engine, stringCacheSize}
resetTemplateStats()    // no-op
```
