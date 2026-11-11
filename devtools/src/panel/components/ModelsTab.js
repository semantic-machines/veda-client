/**
 * Models Tab - list of all model instances
 */
import { Component, html, Loop, If } from '../../../../src/index.js';
import { formatTime, formatValueWithLinks } from '../utils/formatters.js';

export default class ModelsTab extends Component(HTMLElement) {
  static tag = 'models-tab';

  constructor() {
    super();
    this.state.models = [];
    this.state.selectedId = null;
    this.state.filter = '';
    this.state.navigateToId = null;
    this.state.onNavigateToModel = null;
    this.state.onEditModel = null;
    this.state.modelEdit = null;
    this.state.openPredicate = null;
    this.state.drafts = [];
    this.state.extraField = null;
    this.state.pending = false;
    this.state.error = '';
    this.state.errorPredicate = '';
    this.state.notice = '';
    this.state.newPredicate = '';
    this._lastNavigateToId = null;
    this._seenEdit = '';
  }

  // Check for navigation request (called from render via getter)
  checkNavigation() {
    const navId = this.state.navigateToId;
    if (navId && navId !== this._lastNavigateToId) {
      this._lastNavigateToId = navId;
      // Find model by modelId (URI) and select it
      const model = this.state.models.find(m => m.modelId === navId);
      if (model) {
        // Use setTimeout to avoid updating state during render
        setTimeout(() => {
          if (this.state.selectedId !== model.id) this.closeEditor();
          this.state.selectedId = model.id;
          this.state.filter = '';
        }, 0);
      } else {
        setTimeout(() => {
          this.state.filter = navId;
        }, 0);
      }
    }
  }

  handleNavigateToModel = (modelId) => {
    // Find and select model by modelId (URI)
    const model = this.state.models.find(m => m.modelId === modelId);
    if (model) {
      if (this.state.selectedId !== model.id) this.closeEditor();
      this.state.selectedId = model.id;
      this.state.filter = '';
    } else {
      // Model not found - set filter
      this.state.filter = modelId;
    }
  }

  // Filtering
  get filteredModels() {
    const filter = this.state.filter.toLowerCase();
    if (!filter) return this.state.models;
    return this.state.models.filter(m =>
      m.modelId.toLowerCase().includes(filter) ||
      (m.type && m.type.toLowerCase().includes(filter))
    );
  }

  get hasModels() {
    return this.filteredModels.length > 0;
  }

  get hasFilter() {
    return this.state.filter.length > 0;
  }

  get noModels() {
    return !this.hasModels;
  }

  get noSelected() {
    return !this.hasSelected;
  }

  // Selected model
  get selectedModel() {
    if (!this.state.selectedId) return null;
    return this.state.models.find(m => m.id === this.state.selectedId) || null;
  }

  get hasSelected() {
    return this.selectedModel !== null;
  }

  get selectedInternalId() {
    return this.selectedModel?.id || 0;
  }

  get selectedUri() {
    return this.selectedModel?.modelId || '';
  }

  get selectedType() {
    return this.selectedModel?.type || 'Unknown';
  }

  get selectedIsLoaded() {
    return this.selectedModel?.isLoaded || false;
  }

  get selectedCreatedAt() {
    return formatTime(this.selectedModel?.createdAt);
  }

  get selectedUpdateCount() {
    return this.selectedModel?.updateCount || 0;
  }

  get selectedIsNew() {
    return this.selectedModel?.isNew === true;
  }

  get showEditor() {
    return Array.isArray(this.selectedModel?.fields);
  }

  get showLegacyProperties() {
    return !this.showEditor;
  }

  get canLoad() {
    return !!this.selectedModel && !this.selectedIsNew && !this.selectedIsLoaded;
  }

  get loadLabel() {
    return this.state.pending ? 'Loading...' : 'Load';
  }

  get canAddPredicate() {
    return this.showEditor && !this.selectedIsNew;
  }

  get hasNotice() {
    return !!this.state.notice;
  }

  get hasFormError() {
    return !!this.state.error && !this.state.errorPredicate;
  }

  get fieldEntries() {
    const model = this.selectedModel;
    const fields = Array.isArray(model?.fields) ? model.fields : [];
    const entries = fields.map(field => {
      const display = model.properties ? model.properties[field.predicate] : undefined;
      const formatted = formatValueWithLinks(display);
      return {
        predicate: field.predicate,
        values: field.values || [],
        editable: field.editable !== false,
        stored: true,
        text: formatted.text,
        links: formatted.links
      };
    });
    const extra = this.state.extraField;
    if (extra && !entries.some(entry => entry.predicate === extra.predicate)) {
      entries.push(extra);
    }
    return entries;
  }

  get selectedPropertyEntries() {
    const model = this.selectedModel;
    if (!model?.properties) return [];
    return Object.entries(model.properties)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => {
        const { text, links } = formatValueWithLinks(value);
        return { id: key, key, text, links };
      });
  }

  // Event handlers
  handleFilterInput = (e) => {
    this.state.filter = e.target.value;
  }

  clearFilter = () => {
    this.state.filter = '';
  }

  selectModel = (id) => {
    if (id !== this.state.selectedId) this.closeEditor();
    this.state.selectedId = id;
  }

  closeEditor() {
    this.state.openPredicate = null;
    this.state.drafts = [];
    this.state.extraField = null;
    this.state.error = '';
    this.state.errorPredicate = '';
    this.state.notice = '';
    this.state.pending = false;
    this.state.newPredicate = '';
  }

  draftsFrom(field) {
    const values = field?.values || [];
    if (!values.length) {
      return [{ type: 'String', data: '', lang: '', isNew: true }];
    }
    return values.map(value => ({
      type: value.type || 'String',
      data: value.data == null ? '' : String(value.data),
      lang: value.lang || '',
      isNew: false
    }));
  }

  togglePredicate = (name) => {
    this.state.notice = '';
    this.state.error = '';
    this.state.errorPredicate = '';
    if (!name || name === this.state.openPredicate) {
      this.state.openPredicate = null;
      return;
    }
    const field = this.fieldEntries.find(entry => entry.predicate === name);
    if (!field || !field.editable) return;
    this.state.drafts = this.draftsFrom(field);
    this.state.openPredicate = name;
  }

  replaceDrafts = (drafts) => {
    this.state.drafts = drafts;
  }

  changeNewPredicate = (e) => {
    this.state.newPredicate = e.target.value;
  }

  addPredicate = () => {
    if (this.selectedIsNew || this.state.pending) return;
    const name = (this.state.newPredicate || '').trim();
    if (!/^[A-Za-z][A-Za-z0-9-]*:[A-Za-z0-9_.:-]+$/.test(name)) {
      this.state.error = 'Predicate name is not valid';
      this.state.errorPredicate = '';
      return;
    }
    this.state.error = '';
    this.state.notice = '';
    this.state.newPredicate = '';
    const existing = (this.selectedModel?.fields || []).find(field => field.predicate === name);
    if (existing) {
      if (existing.editable === false) {
        this.state.error = 'This predicate cannot be edited';
        this.state.errorPredicate = '';
        return;
      }
      this.state.extraField = null;
      this.state.drafts = this.draftsFrom(existing);
      this.state.openPredicate = name;
      return;
    }
    this.state.extraField = {
      predicate: name,
      values: [],
      editable: true,
      stored: false,
      text: '',
      links: []
    };
    this.state.drafts = [{ type: 'String', data: '', lang: '', isNew: true }];
    this.state.openPredicate = name;
  }

  submitEdit = (command) => {
    if (this.state.pending || this.selectedIsNew || !command) return;
    const known = (this.selectedModel?.fields || []).some(field => field.predicate === command.predicate);
    if (!known && command.op === 'delete') {
      this.state.extraField = null;
      this.state.openPredicate = null;
      this.state.error = '';
      this.state.errorPredicate = '';
      return;
    }
    if (!this.state.onEditModel || !this.selectedModel) {
      this.state.error = 'Editor is not connected';
      this.state.errorPredicate = '';
      return;
    }
    this.state.pending = true;
    this.state.error = '';
    this.state.notice = '';
    this.state.errorPredicate = command.predicate;
    this.state.onEditModel({
      id: this.selectedModel.id,
      op: command.op,
      predicate: command.predicate,
      index: command.index,
      value: command.value
    });
  }

  loadModel = () => {
    if (this.state.pending || !this.canLoad || !this.state.onEditModel) return;
    this.state.pending = true;
    this.state.error = '';
    this.state.notice = '';
    this.state.errorPredicate = '';
    this.state.onEditModel({
      id: this.selectedModel.id,
      op: 'load'
    });
  }

  added() {
    // render() runs once. Watch the result here so a later server reply
    // still closes the row or shows the error.
    this.effect(() => {
      const edit = this.state.modelEdit;
      if (!edit || edit.status === 'pending') return;
      const token = edit.requestId + ':' + edit.status;
      if (token === this._seenEdit) return;
      this._seenEdit = token;
      this.state.pending = false;
      if (edit.status === 'saved') {
        this.state.openPredicate = null;
        this.state.extraField = null;
        this.state.drafts = [];
        this.state.error = '';
        this.state.errorPredicate = '';
        if (edit.op === 'load') this.state.notice = 'Loaded';
        else this.state.notice = edit.predicate ? `Saved ${edit.predicate}` : 'Saved';
        return;
      }
      this.state.error = edit.error || 'Save failed';
      this.state.errorPredicate = edit.predicate || '';
      this.state.notice = '';
    });
  }

  render() {
    this.checkNavigation();
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Models</h2>
            <span class="panel-count">{this.state.models.length}</span>
            <div class="filter-wrapper">
              <input type="text"
                     class="filter-input"
                     placeholder="Filter..."
                     value="{this.state.filter}"
                     oninput="{handleFilterInput}">
              <${If} condition="{this.hasFilter}">
                <button class="filter-clear" onclick="{clearFilter}" title="Clear">×</button>
              </${If}>
            </div>
          </div>

          <div class="items-list">
            <${If} condition="{this.hasModels}">
              <${Loop} items="{this.filteredModels}" key="id" as="item">
                <model-item
                  :data="{item}"
                  :selected-id="{this.state.selectedId}"
                  :on-select="{this.selectModel}">
                </model-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noModels}">
              <div class="empty-state">
                <div class="empty-icon">◇</div>
                <div class="empty-text">No models</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelected}">
            <div class="details-panel">
              <div class="details-header">
                <span class="details-tag">{this.selectedUri}</span>
                <span class="details-id">#{this.selectedInternalId}</span>
                <${If} condition="{this.canLoad}">
                  <button type="button" class="btn btn-primary btn-tiny model-load" onclick="{loadModel}" disabled="{this.state.pending}">{this.loadLabel}</button>
                </${If}>
              </div>

              <div class="details-section">
                <div class="details-section-title">Info</div>
                <div class="details-properties">
                  <div class="details-property">
                    <span class="details-prop-key">Type</span>
                    <span class="details-prop-value">{this.selectedType}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Loaded</span>
                    <span class="details-prop-value">{this.selectedIsLoaded}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Unsaved</span>
                    <span class="details-prop-value">{this.selectedIsNew}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Created</span>
                    <span class="details-prop-value">{this.selectedCreatedAt}</span>
                  </div>
                  <div class="details-property">
                    <span class="details-prop-key">Updates</span>
                    <span class="details-prop-value">{this.selectedUpdateCount}</span>
                  </div>
                </div>
              </div>

              <div class="details-section">
                <div class="details-section-title">Properties</div>
                <${If} condition="{this.selectedIsNew}">
                  <div class="predicate-note">This model has not been saved. Editing is disabled.</div>
                </${If}>
                <${If} condition="{this.hasNotice}">
                  <div class="predicate-saved">{this.state.notice}</div>
                </${If}>
                <${If} condition="{this.hasFormError}">
                  <div class="predicate-error">{this.state.error}</div>
                </${If}>
                <${If} condition="{this.showEditor}">
                  <div class="details-properties">
                    <${Loop} items="{this.fieldEntries}" key="predicate" as="field">
                      <model-predicate
                        :field="{field}"
                        :open-predicate="{this.state.openPredicate}"
                        :drafts="{this.state.drafts}"
                        :pending="{this.state.pending}"
                        :read-only="{this.selectedIsNew}"
                        :error="{this.state.error}"
                        :error-predicate="{this.state.errorPredicate}"
                        :on-toggle="{this.togglePredicate}"
                        :on-submit="{this.submitEdit}"
                        :on-drafts="{this.replaceDrafts}"
                        :on-navigate="{this.handleNavigateToModel}">
                      </model-predicate>
                    </${Loop}>
                  </div>
                  <${If} condition="{this.canAddPredicate}">
                    <div class="predicate-add">
                      <input class="edit-input new-predicate" placeholder="prefix:name" value="{this.state.newPredicate}" oninput="{changeNewPredicate}" spellcheck="false">
                      <button type="button" class="btn btn-secondary btn-tiny predicate-add" onclick="{addPredicate}" disabled="{this.state.pending}">Add predicate</button>
                    </div>
                  </${If}>
                </${If}>
                <${If} condition="{this.showLegacyProperties}">
                  <div class="details-properties">
                    <${Loop} items="{this.selectedPropertyEntries}" key="id" as="entry">
                      <div class="details-property">
                        <span class="details-prop-key">{entry.key}:</span>
                        <property-value :text="{entry.text}" :links="{entry.links}" :on-navigate="{this.handleNavigateToModel}"></property-value>
                      </div>
                    </${Loop}>
                  </div>
                </${If}>
              </div>
            </div>
          </${If}>

          <${If} condition="{this.noSelected}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select a model</div>
              <div class="empty-hint">Click on a model to see its properties</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }
}

