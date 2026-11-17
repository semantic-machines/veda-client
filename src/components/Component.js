import Model from '../Model.js';
import Subscription from '../Subscription.js';
// Built-in components register their custom elements and factory entries when
// their modules load. Keep them imported so a direct Component.js import still
// supports declarative Loop/If/Property/Relation templates.
import './LoopComponent.js';
import './IfComponent.js';
import './PropertyComponent.js';
import './RelationComponent.js';
import {effect, untrack} from '../Effect.js';
import {reactive, toRaw} from '../Reactive.js';
import {createContextProxy} from './contextLookup.js';
import {compileTemplate, CompiledTemplate} from '../template/Template.js';
import {html, raw, safe} from '../template/TemplateResult.js';
import {factories} from '../template/factories.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_TREE_DEPTH = 20;
const LAYOUT_TRANSPARENT_TAGS = new Set([
  'veda-if', 'veda-loop', 'veda-context', 'veda-slot', 'veda-place',
]);

// ============================================================================
// COMPONENT CLASS
// ============================================================================

export default function Component (ElementClass = HTMLElement, ModelClass = Model) {
  return class ComponentClass extends ElementClass {
    static tag = 'veda-component';
    static toString () { return this.tag; }

    // ---------- Private Fields ----------
    #resolveRendered;
    #childrenRendered = [];
    #deferredRendered = null;
    #resolveDeferredFn = null;
    #effects = [];
    #holdsSubscription = false;
    #instance = null;
    #usesParentTemplate = false;
    template;

    // ---------- Constructor & Lifecycle ----------
    constructor() {
      super();
      const componentRef = new WeakRef(this);
      this.state = reactive({}, {
        onSet: () => {
          if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
            const c = componentRef.deref();
            // untrack prevents extractComponentState reads from registering
            // spurious reactive dependencies on the currently running effect
            if (c) untrack(() => window.__VEDA_DEVTOOLS_HOOK__.trackComponentStateChange(c));
          }
        }
      });
      this.refs = {};
      this.context = createContextProxy(this);
      this.rendered = new Promise((resolve) => { this.#resolveRendered = resolve; });
    }

    renderedCallback () {}

    async #setRendered() {
      if (this.#deferredRendered) {
        await this.#deferredRendered;
        this.#deferredRendered = null;
      }
      await Promise.all(this.#childrenRendered);
      this.#resolveRendered?.();
      this.renderedCallback();
    }

    async connectedCallback () {
      try {
        if (LAYOUT_TRANSPARENT_TAGS.has(this.tagName?.toLowerCase())) {
          this.style.display = 'contents';
        }
        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.trackComponent(this);
        }
        await this.populate();
        if (!this.isConnected) return;
        const added = this.added();
        if (added instanceof Promise) await added;
        if (!this.isConnected) return;
        await this.update();
      } catch (error) {
        console.log(this, 'Component render error', error);
      } finally {
        this.#setRendered();
      }
    }

    async disconnectedCallback () {
      try {
        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.untrackComponent(this);
        }
        this.#cleanupEffects();
        if (this.#instance) {
          this.#instance.destroy();
          this.#instance = null;
        }
        if (this.#holdsSubscription) {
          Subscription.release(this);
          this.#holdsSubscription = false;
        }
        this.#childrenRendered = [];
        this.refs = {};
        // Clear state properties via the raw target to release references (e.g. Models)
        // without triggering reactive updates in child components that haven't
        // disconnected yet.
        if (this.state) {
          const raw = toRaw(this.state);
          for (const key of Object.keys(raw)) raw[key] = null;
        }
        const removed = this.removed();
        if (removed instanceof Promise) await removed;
      } catch (error) {
        console.log(this, 'Component remove error', error);
      } finally {
        this.#resolveDeferredFn?.();
        this.#resolveDeferredFn = null;
        this.#deferredRendered = null;
        this.#setRendered();
      }
    }

    #cleanupEffects() {
      this.#effects.forEach(c => c());
      this.#effects = [];
    }

    // ---------- Lifecycle Hooks (override in subclass) ----------
    added () {}
    pre () {}
    render () { return this._compiledTemplate ?? this.template ?? this.innerHTML; }
    post () {}
    removed () {}

    // ---------- Internal API (used by If/Loop/Virtual) ----------
    _getEventListenersCount() {
      return this.#instance?.getEventListenersCount?.() || 0;
    }

    _deferRendered() {
      this.#deferredRendered = new Promise(resolve => {
        this.#resolveDeferredFn = resolve;
      });
    }

    // Context/Place render parent-authored templates; override to pass host eval context.
    _processEvalContext() {
      return null;
    }

    // Allows a component to force a fresh template instance on every update().
    // The default is to patch in place when the compiled template is unchanged.
    // Place/Slot move rendered nodes elsewhere but keep their Parts, so they
    // rely on in-place patching and do not override this.
    _reuseTemplateInstance() {
      return true;
    }

    // Called after an old template instance was destroyed and before a new
    // one is mounted. Components that move rendered nodes elsewhere can clean
    // them up here.
    _onTemplateInstanceReplaced() {}

    _resolveDeferred() {
      this.#resolveDeferredFn?.();
      this.#resolveDeferredFn = null;
    }

    // Child components created after update() (If content, Loop items) still
    // need to be awaited by rendered.
    _addChildrenRendered(promises) {
      if (!promises) return;
      for (const promise of promises) {
        if (promise && !this.#childrenRendered.includes(promise)) {
          this.#childrenRendered.push(promise);
        }
      }
    }

    // Values authored by the parent template and used by ${} segments inside
    // this component's captured child template.
    _setTemplateValues(values) {
      this._templateValues = values;
      // Only a template instance that actually renders the parent-authored
      // CompiledTemplate may receive the parent's ${} values. A child that
      // renders its own html`...` must keep its own values.
      if (this.#usesParentTemplate && this.#instance) {
        this.#instance.setValues(values);
      }
      this._onTemplateValuesChanged(values);
      this.#notifySlotListeners();
    }

    // Slots project this component's author content, so they need the new
    // parent values even when this component renders its own template.
    #notifySlotListeners() {
      const listeners = this._vedaSlotListeners;
      if (!listeners?.size) return;
      for (const slot of [...listeners]) {
        if (!slot.isConnected) {
          listeners.delete(slot);
          continue;
        }
        try {
          slot._onHostValuesChanged?.();
        } catch (error) {
          console.warn('Slot: failed to update projected values:', error?.message ?? error);
        }
      }
    }

    _onTemplateValuesChanged() {}

    // Re-register refs owned by this component's template instance. Nested
    // components that forward refs to an ancestor (Place/Slot) call this after
    // the ancestor rebuilt its refs on update().
    _refreshRefs() {
      this.#instance?.refreshRefs();
    }

    // ---------- Render Pipeline ----------
    async update () {
      const _renderStart = performance.now();
      try {
        this.#childrenRendered = [];
        this.refs = {};
        const pre = this.pre();
        if (pre instanceof Promise) await pre;

        let result = this.render();
        if (result instanceof Promise) result = await result;
        if (typeof result === 'undefined') {
          this.#usesParentTemplate = false;
          if (this.#instance) {
            this.#instance.destroy();
            this.#instance = null;
          }
          const post = this.post();
          if (post instanceof Promise) await post;
          return;
        }

        const fromCompiled = result instanceof CompiledTemplate;
        this.#usesParentTemplate = fromCompiled && result === this._compiledTemplate;
        const compiled = fromCompiled ? result : compileTemplate(result);
        const values = fromCompiled ? (this._templateValues || []) : null;

        const container = this.hasAttribute('shadow')
          ? this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot)
          : this;

        if (this._reuseTemplateInstance() && this.#instance && this.#instance.compiled === compiled) {
          // Same call-site template: patch parts in place, keep the DOM tree
          // (and child components) alive.
          if (fromCompiled) this.#instance.setValues(values);
          else this.#instance.setResult(result);
          this.#instance.refreshRefs();
        } else {
          this.#instance?.destroy();
          this._onTemplateInstanceReplaced();
          const options = {result};
          if (fromCompiled) options.values = values;
          this.#instance = compiled.instantiate(this.#createEvalContext(), this, options);
          this.#instance.mount(container);
        }

        this.#childrenRendered = this.#instance.childrenRendered;

        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.trackComponentRender(this, _renderStart);
        }

        const post = this.post();
        if (post instanceof Promise) await post;
      } catch (error) {
        console.log(this, 'Component render error', error);
      }
    }

    #createEvalContext () {
      const provided = this._processEvalContext();
      if (provided) return provided;

      const evalContext = this.state;
      if (evalContext && typeof evalContext === 'object') {
        Object.setPrototypeOf(evalContext, this);
      }
      return evalContext;
    }

    async populate () {
      if (this.hasAttribute('about')) {
        const uri = this.getAttribute('about');
        if (!this.state.model || this.state.model.id !== uri) {
          this.state.model = new ModelClass(uri);
        }
      } else if (this.state.model?.id) {
        this.setAttribute('about', this.state.model.id);
      }
      if (this.state.model) {
        try { await this.state.model.load?.(); } catch { /* Backend not configured */ }
        if (this.isConnected && this.state.model && !this.#holdsSubscription) {
          this.state.model.subscribe?.(this);
          this.#holdsSubscription = true;
        }
      }
    }

    // ========================================================================
    // PUBLIC API - Reactivity helpers
    // ========================================================================

    effect(fn) {
      const cleanup = effect(fn, { component: this });
      this.#effects.push(cleanup);
      return cleanup;
    }

    /**
     * Watch a value and run callback when it changes (reference equality).
     * For arrays: watch length or reassign after mutation.
     */
    watch(getter, callback, options = {}) {
      let oldValue, isFirst = true;
      const cleanup = effect(() => {
        const newValue = getter();
        if (isFirst) {
          isFirst = false;
          oldValue = newValue;
          if (options.immediate) callback(newValue, undefined);
        } else if (newValue !== oldValue) {
          callback(newValue, oldValue);
          oldValue = newValue;
        }
      }, { ...options, component: this });
      this.#effects.push(cleanup);
      return cleanup;
    }

    #isComponentElement(el) {
      return !!(el?.tagName?.includes('-') || el?.hasAttribute?.('is'));
    }

    #ancestorElement(el) {
      return el.parentElement || el.getRootNode?.()?.host || null;
    }

    #isTransparentParent(el) {
      const tag = el.tagName?.toLowerCase();
      const isAttr = el.getAttribute?.('is');
      return tag === 'veda-if' || tag === 'veda-loop'
        || tag === 'veda-context' || tag === 'veda-slot' || tag === 'veda-place'
        || !!isAttr?.endsWith('-loop-component')
        || !!isAttr?.endsWith('-if-component');
    }

    _findParentComponent() {
      let parent = this.#ancestorElement(this);
      for (let d = 0; parent && d < MAX_TREE_DEPTH; d++, parent = this.#ancestorElement(parent)) {
        if (this.#isComponentElement(parent) && !this.#isTransparentParent(parent)) {
          return parent;
        }
      }
      return null;
    }
  }
}

factories.Component = Component;

export {html, raw, safe, reactive, effect};
