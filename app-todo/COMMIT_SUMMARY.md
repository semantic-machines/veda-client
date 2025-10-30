# Commit Summary: TodoMVC - Two Implementations

## 🎯 Overview

Added declarative implementation of TodoMVC using `property` and `rel` components, alongside existing imperative version using `Loop` component.

## 📦 Changes

### New Files

#### Entry Points
- `index.html` - Landing page with implementation selector
- `imperative.html` - Entry for imperative version (Loop)
- `declarative.html` - Entry for declarative version (property/rel)

#### Declarative Implementation
- `src-declarative/js/TodoApp.js` (191 lines) - Main app using `rel="v-s:hasTodo"`
- `src-declarative/js/TodoList.js` (35 lines) - Filter wrapper for todos
- `src-declarative/js/TodoItem.js` (151 lines) - Todo item using `<span property="v-s:title">`
- `src-declarative/js/TodoFooter.js` (63 lines) - Footer component
- `src-declarative/js/TodoHeader.js` (25 lines) - Header component
- `src-declarative/js/index.js` (12 lines) - Entry point
- `src-declarative/js/routes.js` (22 lines) - Routing config

#### Documentation
- `COMPONENTS_GUIDE.md` (502 lines) - Complete component reference and cheatsheet
- `COMPONENTS_ANALYSIS.md` (600+ lines) - Deep dive: internals, patterns, performance
- `IMPLEMENTATION_SUMMARY.md` - Implementation overview and comparison
- `README-SHORT.md` - Quick start guide

### Modified Files
- `README.md` - Updated with new structure and unified instructions
- `build.mjs` - Now builds both versions
- `watch.mjs` - Watch mode for both versions

### Deleted Files
- `build-declarative.mjs` - Merged into unified `build.mjs`

## 🔑 Key Features

### Imperative Version (src/)
```javascript
<${Loop} items="{this.filteredTodos}" item-key="id">
  <template>
    <li is="${TodoItem}"></li>
  </template>
</${Loop}>
```
- Manual control over rendering
- Reactive expressions
- ~500 LOC

### Declarative Version (src-declarative/)
```javascript
<ul rel="v-s:hasTodo">
  <template>
    <${TodoList} filter="{this.state.filter}"></${TodoList}>
  </template>
</ul>

// TodoItem.js
<label>
  <span property="v-s:title"></span>
</label>
```
- Automatic model binding
- Minimal JavaScript
- ~450 LOC

## 📊 Comparison

| Feature | Imperative | Declarative |
|---------|------------|-------------|
| List | `Loop` | `rel` |
| Values | `{expr}` | `property` |
| Code | More JS | Less JS |
| Use case | Interactive | CRUD |

## 🚀 Build System

```bash
npm run build  # Builds both to dist/todo and dist/todo-declarative
npm run watch  # Watch mode for both
```

## ✅ Status

- [x] Both implementations fully functional
- [x] Same backend/models/data
- [x] TodoMVC spec compliant
- [x] Comprehensive documentation
- [x] Unified build system
- [x] Clean navigation between versions

## 🎓 Purpose

Demonstrates framework flexibility:
- **Imperative** approach: Full control, best for interactive UIs
- **Declarative** approach: Minimal code, best for data-driven apps

Both work with the same reactive system, models, and backend!

