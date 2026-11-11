/**
 * One predicate row with a typed value editor.
 */
import { Component, html, Loop, If } from '../../../../src/index.js';

export default class ModelPredicate extends Component(HTMLElement) {
  static tag = 'model-predicate';

  constructor() {
    super();
    this.state.field = null;
    this.state.openPredicate = null;
    this.state.drafts = [];
    this.state.pending = false;
    this.state.readOnly = false;
    this.state.error = '';
    this.state.errorPredicate = '';
    this.state.onToggle = null;
    this.state.onSubmit = null;
    this.state.onDrafts = null;
    this.state.onNavigate = null;
    this.state.confirmDelete = false;
  }

  get predicateName() {
    return this.state.field?.predicate || '';
  }

  get isOpen() {
    return !!this.predicateName && this.state.openPredicate === this.predicateName;
  }

  get canEdit() {
    return !this.state.readOnly && this.state.field?.editable !== false;
  }

  get blocked() {
    return !this.state.readOnly && this.state.field?.editable === false;
  }

  get editLabel() {
    return this.isOpen ? 'Close' : 'Edit';
  }

  get fieldText() {
    return this.state.field?.text || '';
  }

  get fieldLinks() {
    return this.state.field?.links || [];
  }

  get inputsDisabled() {
    return !!this.state.pending;
  }

  get rowError() {
    if (this.state.errorPredicate !== this.predicateName) return '';
    return this.state.error || '';
  }

  get hasRowError() {
    return this.rowError.length > 0;
  }

  get isSaving() {
    return this.isOpen && !!this.state.pending;
  }

  get deleteQuestion() {
    return this.state.field?.stored
      ? 'Remove this predicate from the server?'
      : 'Discard this predicate?';
  }

  get rows() {
    if (!this.isOpen) return [];
    const drafts = this.state.drafts || [];
    return drafts.map((draft, index) => {
      const type = draft.type || 'String';
      const data = draft.data == null ? '' : String(draft.data);
      const empty = type !== 'Boolean' && data.trim() === '';
      return {
        id: String(index),
        index,
        type,
        data,
        lang: draft.lang || '',
        isNew: !!draft.isNew,
        isString: type === 'String',
        isBoolean: type === 'Boolean',
        isText: type !== 'Boolean',
        saveDisabled: this.inputsDisabled || empty
      };
    });
  }

  toggle = () => {
    if (!this.canEdit && !this.isOpen) return;
    this.state.confirmDelete = false;
    if (this.state.onToggle) this.state.onToggle(this.isOpen ? null : this.predicateName);
  }

  changeType = (e) => {
    this.updateDraft(e.target.dataset.index, (draft) => {
      draft.type = e.target.value;
      if (draft.type === 'Boolean' && draft.data !== 'true' && draft.data !== 'false') {
        draft.data = 'true';
      }
    });
  }

  changeData = (e) => {
    this.updateDraft(e.target.dataset.index, (draft) => {
      draft.data = e.target.value;
    });
  }

  changeLang = (e) => {
    this.updateDraft(e.target.dataset.index, (draft) => {
      draft.lang = e.target.value;
    });
  }

  updateDraft(indexValue, change) {
    const index = Number(indexValue);
    const draft = this.state.drafts?.[index];
    if (!draft || this.inputsDisabled) return;
    change(draft);
  }

  addValue = () => {
    if (this.inputsDisabled || !this.state.onDrafts) return;
    const drafts = [...(this.state.drafts || [])];
    drafts.push({ type: 'String', data: '', lang: '', isNew: true });
    this.state.onDrafts(drafts);
  }

  saveRow = (e) => {
    if (this.inputsDisabled || !this.state.onSubmit) return;
    const index = Number(e.currentTarget.dataset.index);
    const draft = this.state.drafts?.[index];
    if (!draft) return;
    if (draft.type !== 'Boolean' && String(draft.data ?? '').trim() === '') return;
    this.state.confirmDelete = false;
    this.state.onSubmit({
      op: draft.isNew ? 'add' : 'set',
      predicate: this.predicateName,
      index: draft.isNew ? undefined : index,
      value: {
        type: draft.type,
        data: draft.data,
        lang: draft.type === 'String' ? (draft.lang || '') : ''
      }
    });
  }

  removeRow = (e) => {
    if (this.inputsDisabled) return;
    const index = Number(e.currentTarget.dataset.index);
    const draft = this.state.drafts?.[index];
    if (!draft) return;
    this.state.confirmDelete = false;
    if (draft.isNew) {
      const drafts = (this.state.drafts || []).filter((_, i) => i !== index);
      if (this.state.onDrafts) this.state.onDrafts(drafts);
      return;
    }
    if (!this.state.onSubmit) return;
    this.state.onSubmit({
      op: 'remove',
      predicate: this.predicateName,
      index
    });
  }

  askDelete = () => {
    if (this.inputsDisabled) return;
    this.state.confirmDelete = true;
  }

  cancelDelete = () => {
    this.state.confirmDelete = false;
  }

  confirmDelete = () => {
    if (this.inputsDisabled || !this.state.onSubmit) return;
    this.state.confirmDelete = false;
    this.state.onSubmit({
      op: 'delete',
      predicate: this.predicateName
    });
  }

  render() {
    return html`
      <div class="predicate-row" data-predicate="{this.predicateName}">
        <span class="details-prop-key">{this.predicateName}:</span>
        <div class="predicate-body">
          <div class="predicate-summary">
            <property-value :text="{this.fieldText}" :links="{this.fieldLinks}" :on-navigate="{this.state.onNavigate}"></property-value>
            <${If} condition="{this.canEdit}">
              <button type="button" class="btn btn-secondary btn-tiny predicate-edit" onclick="{toggle}">{this.editLabel}</button>
            </${If}>
            <${If} condition="{this.blocked}">
              <span class="predicate-note">Cannot edit</span>
            </${If}>
          </div>

          <${If} condition="{this.isOpen}">
            <div class="predicate-editor">
              <${Loop} items="{this.rows}" key="id" as="row">
                <div class="edit-line">
                  <select class="edit-select edit-type" data-index="{row.index}" value="{row.type}" onchange="{changeType}" disabled="{this.inputsDisabled}">
                    <option value="String">String</option>
                    <option value="Uri">Uri</option>
                    <option value="Integer">Integer</option>
                    <option value="Decimal">Decimal</option>
                    <option value="Boolean">Boolean</option>
                    <option value="Datetime">Datetime</option>
                  </select>
                  <${If} condition="{row.isBoolean}">
                    <select class="edit-select edit-data" data-index="{row.index}" value="{row.data}" onchange="{changeData}" disabled="{this.inputsDisabled}">
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </${If}>
                  <${If} condition="{row.isText}">
                    <input class="edit-input edit-data" data-index="{row.index}" value="{row.data}" oninput="{changeData}" disabled="{this.inputsDisabled}" spellcheck="false">
                  </${If}>
                  <${If} condition="{row.isString}">
                    <input class="edit-input edit-lang" data-index="{row.index}" value="{row.lang}" placeholder="lang" oninput="{changeLang}" disabled="{this.inputsDisabled}" spellcheck="false">
                  </${If}>
                  <button type="button" class="btn btn-primary btn-tiny predicate-save" data-index="{row.index}" onclick="{saveRow}" disabled="{row.saveDisabled}">Save</button>
                  <button type="button" class="btn btn-secondary btn-tiny predicate-remove" data-index="{row.index}" onclick="{removeRow}" disabled="{this.inputsDisabled}">Remove</button>
                </div>
              </${Loop}>
              <div class="predicate-actions">
                <button type="button" class="btn btn-secondary btn-tiny predicate-add-value" onclick="{addValue}" disabled="{this.inputsDisabled}">Add value</button>
                <${If} condition="{this.state.confirmDelete}">
                  <span class="predicate-note">{this.deleteQuestion}</span>
                  <button type="button" class="btn btn-tiny btn-danger predicate-delete-confirm" onclick="{confirmDelete}" disabled="{this.inputsDisabled}">Remove</button>
                  <button type="button" class="btn btn-secondary btn-tiny" onclick="{cancelDelete}">Cancel</button>
                </${If}>
                <${If} condition="{this.notConfirming}">
                  <button type="button" class="btn btn-tiny btn-danger predicate-delete" onclick="{askDelete}" disabled="{this.inputsDisabled}">Delete predicate</button>
                </${If}>
              </div>
              <${If} condition="{this.isSaving}">
                <div class="predicate-note">Saving...</div>
              </${If}>
              <${If} condition="{this.hasRowError}">
                <div class="predicate-error">{this.rowError}</div>
              </${If}>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }

  get notConfirming() {
    return !this.state.confirmDelete;
  }
}
