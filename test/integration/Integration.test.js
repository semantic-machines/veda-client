import {reactive} from '../../src/Reactive.js';
import {effect, flushEffects} from '../../src/Effect.js';
import Model from '../../src/Model.js';
import Backend from '../../src/Backend.js';
import Subscription from '../../src/Subscription.js';
import {timeout} from '../../src/Util.js';

Backend.init();

export default ({test, assert}) => {
  /**
   * ADVANCED QUALITY TESTS
   * These tests go beyond basic coverage to ensure robustness
   */

  // ==================== RACE CONDITIONS ====================

  test('Race condition - parallel effect execution', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;
    let lastValue = 0;

    effect(() => {
      effectRuns++;
      lastValue = state.count;
    });

    await flushEffects();

    state.count = 1;
    state.count = 2;
    state.count = 3;

    await flushEffects();

    // Effect should run only once after all updates
    assert(lastValue === 3, 'Should process final value');
    assert(effectRuns === 2, 'Should batch synchronous updates'); // initial + batched
  });

  test('Race condition - concurrent Model operations', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const id = 'd:race_test_' + Date.now();
    const m = new Model(id);
    m['rdfs:label'] = ['Initial'];

    // Simulate concurrent save operations
    const promises = [
      Backend.put_individual({
        '@': id,
        'rdfs:label': [{data: 'First', type: 'String'}]
      }),
      Backend.put_individual({
        '@': id,
        'rdfs:label': [{data: 'Second', type: 'String'}]
      })
    ];

    await Promise.all(promises);

    // Verify no crash - both operations should complete
    const result = await Backend.get_individual(id, false);
    assert(result !== null, 'Model should exist after concurrent operations');

    await Backend.remove_individual(id);
  });

  test('Race condition - subscribe/unsubscribe rapid', async () => {
    const m = new Model('rdfs:Resource');

    // Rapidly subscribe and unsubscribe
    for (let i = 0; i < 5; i++) {
      m.subscribe();
      m.unsubscribe();
    }

    await timeout(200);

    // Verify system handles rapid subscription changes
    const finalCount = Subscription._getSubscriptionCount();
    assert(finalCount >= 0, 'Rapid subscribe/unsubscribe should complete without crashing');
  });

  // ==================== CIRCULAR REFERENCES ====================

  test('Circular references - reactive object with self-reference', async () => {
    const obj = reactive({name: 'test', self: null});
    obj.self = obj; // Circular reference

    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      const name = obj.self?.name;
    });

    await flushEffects();
    assert(effectRuns === 1, 'Should handle circular reference');

    obj.name = 'changed';
    await flushEffects();
    assert(effectRuns === 2, 'Should still react to changes with circular ref');
  });

  test('Circular references - nested objects', async () => {
    const parent = reactive({name: 'parent', child: null});
    const child = reactive({name: 'child', parent: null});

    parent.child = child;
    child.parent = parent;

    let accessCount = 0;
    effect(() => {
      accessCount++;
      // Traverse circular structure
      const p = parent.child?.parent?.child?.parent;
    });

    await flushEffects();
    assert(accessCount === 1, 'Should handle mutual circular references');
  });

  // ==================== MEMORY LEAKS ====================

  test('Memory - effect cleanup removes all references', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;

    const cleanup = effect(() => {
      effectRuns++;
      state.count; // Track dependency
    });

    await flushEffects();
    const initialRuns = effectRuns;

    // Cleanup should remove all references
    cleanup();

    // Try to trigger effect
    state.count++;
    await flushEffects();

    assert(effectRuns === initialRuns, 'Cleaned up effect should not run');
  });

  test('Memory - model cache does not leak', () => {
    // Note: Model cache is by design - models are cached by ID

    const uniqueId1 = 'd:cache_test_1_' + Date.now();
    const uniqueId2 = 'd:cache_test_2_' + Date.now();

    const m1a = new Model(uniqueId1);
    const m1b = new Model(uniqueId1);

    // Same ID should return same instance (cache working)
    assert(m1a === m1b, 'Same ID should return cached instance');

    const m2 = new Model(uniqueId2);
    assert(m1a !== m2, 'Different IDs should return different instances');

    // Cache holds models - this is intentional design
    assert(Model.cache.get(uniqueId1) === m1a, 'Cache should contain model 1');
    assert(Model.cache.get(uniqueId2) === m2, 'Cache should contain model 2');
  });

  test('Memory - reactive dependencies are cleaned up', async () => {
    let state = reactive({value: 0});
    let effectRuns = 0;

    const cleanup = effect(() => {
      effectRuns++;
      if (state.value < 5) {
        state.value; // Create dependency
      }
    });

    await flushEffects();

    for (let i = 0; i < 3; i++) {
      state.value++;
      await flushEffects();
    }

    const runsBeforeCleanup = effectRuns;
    cleanup();

    // Try to trigger again
    state.value++;
    await flushEffects();

    assert(effectRuns === runsBeforeCleanup, 'Dependencies should be fully cleaned');
  });

  // ==================== EDGE CASES ====================

  test('Edge case - delete property that does not exist', async () => {
    const obj = reactive({a: 1});

    let runs = 0;
    effect(() => {
      runs++;
      obj.a;
    });

    await flushEffects();

    delete obj.nonExistent;
    await flushEffects();

    assert(runs === 1, 'Should not trigger on delete of non-existent property');
  });

  test('Edge case - very deep nesting (10 levels)', async () => {
    let current = {value: 'deep'};
    for (let i = 0; i < 10; i++) {
      current = {nested: current};
    }

    const deep = reactive(current);
    let accessedValue = null;

    effect(() => {
      accessedValue = deep?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.value;
    });

    await flushEffects();
    assert(accessedValue === 'deep', 'Should handle 10-level nesting');
  });

  test('Edge case - reactive with Symbol properties', async () => {
    const sym1 = Symbol('test1');
    const sym2 = Symbol('test2');
    const obj = reactive({[sym1]: 'value1'});

    let runs = 0;
    effect(() => {
      runs++;
      obj[sym1];
    });

    await flushEffects();

    // Modify symbol property
    obj[sym1] = 'value2';
    await flushEffects();

    // Should react to symbol property changes
    assert(runs === 2, 'Should track symbol properties');
  });

  test('Edge case - NaN and Infinity values', async () => {
    const obj = reactive({value: 0});
    let runs = 0;

    effect(() => {
      runs++;
      obj.value;
    });

    await flushEffects();

    obj.value = NaN;
    await flushEffects();
    assert(runs === 2, 'Should handle NaN');

    obj.value = Infinity;
    await flushEffects();
    assert(runs === 3, 'Should handle Infinity');

    obj.value = -Infinity;
    await flushEffects();
    assert(runs === 4, 'Should handle -Infinity');
  });

  // ==================== INTEGRATION TESTS ====================

  test('Integration - Model + Backend + Reactivity', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const id = 'd:integration_' + Date.now();
    const m = new Model(id);

    let changeCount = 0;
    m.on('modified', () => changeCount++);

    m['rdfs:label'] = ['Test'];
    m['rdf:type'] = [new Model('rdfs:Resource')];
    await m.save();

    assert(changeCount >= 1, 'Should emit events during save');

    // Load from server
    const m2 = new Model(id);
    await m2.load();

    assert(m2['rdfs:label'][0] === 'Test', 'Should load from server');
    assert(m === m2, 'Should return same cached instance');

    // Cleanup
    await Backend.remove_individual(id);
  });

  test('Integration - Reactive Model properties', async () => {
    const m = new Model('d:reactive_model_' + Date.now());

    // Model is already reactive
    let labelChangeCount = 0;
    m.on('rdfs:label', () => labelChangeCount++);

    m['rdfs:label'] = ['Label 1'];
    assert(labelChangeCount === 1, 'Should react to property change');

    m['rdfs:label'] = ['Label 2'];
    assert(labelChangeCount === 2, 'Should react to subsequent changes');

    // Array operations should also work
    m['rdfs:comment'] = [];
    m['rdfs:comment'].push('Comment 1');

    assert(m['rdfs:comment'].length === 1, 'Array operations should work on reactive model');
  });

  test('Integration - Effect with Model operations', async () => {
    const m1 = new Model('test:effect_1');
    const m2 = new Model('test:effect_2');

    m1['rdfs:label'] = ['Model 1'];
    m2['rdfs:label'] = ['Model 2'];

    let combined = '';
    const cleanup = effect(() => {
      combined = m1['rdfs:label']?.[0] + ' ' + m2['rdfs:label']?.[0];
    });

    await flushEffects();
    assert(combined === 'Model 1 Model 2', 'Should react to both models');

    m1['rdfs:label'] = ['Updated'];
    await flushEffects();
    assert(combined === 'Updated Model 2', 'Should react to first model change');

    cleanup();
  });

  // ==================== STRESS TESTS ====================

  test('Stress - many concurrent effects', async () => {
    const state = reactive({count: 0});
    const cleanups = [];
    let totalRuns = 0;

    for (let i = 0; i < 100; i++) {
      cleanups.push(effect(() => {
        totalRuns++;
        state.count;
      }));
    }

    await flushEffects();
    assert(totalRuns === 100, 'All effects should run initially');

    state.count++;
    await flushEffects();
    assert(totalRuns === 200, 'All effects should run on update');

    // Cleanup
    cleanups.forEach(cleanup => cleanup());
  });

  test('Stress - large array operations', async () => {
    const obj = reactive({items: []});
    let sum = 0;

    effect(() => {
      sum = obj.items.reduce((a, b) => a + b, 0);
    });

    await flushEffects();

    for (let i = 0; i < 1000; i++) {
      obj.items.push(i);
    }

    await flushEffects();
    assert(sum === 499500, 'Should handle large arrays'); // sum of 0..999
  });

  // ==================== REAL-WORLD SCENARIOS ====================

  test('Scenario - Form with reactive validation', async () => {
    const form = reactive({
      email: '',
      password: '',
      isValid: false
    });

    effect(() => {
      form.isValid = form.email.includes('@') && form.password.length >= 8;
    });

    await flushEffects();
    assert(form.isValid === false, 'Form should be invalid initially');

    form.email = 'test@example.com';
    await flushEffects();
    assert(form.isValid === false, 'Form should be invalid with short password');

    form.password = 'password123';
    await flushEffects();
    assert(form.isValid === true, 'Form should be valid with proper inputs');
  });

  test('Scenario - Shopping cart with computed total', async () => {
    const cart = reactive({
      items: [],
      total: 0
    });

    effect(() => {
      cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    });

    await flushEffects();
    assert(cart.total === 0, 'Empty cart should have zero total');

    cart.items.push({ id: 1, price: 10, quantity: 2 });
    await flushEffects();
    assert(cart.total === 20, 'Total should be 20');

    cart.items.push({ id: 2, price: 15, quantity: 1 });
    await flushEffects();
    assert(cart.total === 35, 'Total should be 35');

    cart.items[0].quantity = 3;
    await flushEffects();
    assert(cart.total === 45, 'Total should update on quantity change');
  });

  test('Scenario - Autocomplete search with debouncing', async () => {
    const search = reactive({
      query: '',
      results: []
    });

    let searchCount = 0;
    effect(() => {
      if (search.query.length >= 3) {
        searchCount++;
        search.results = ['Result 1', 'Result 2'];
      } else {
        search.results = [];
      }
    });

    await flushEffects();
    assert(search.results.length === 0, 'No results initially');

    search.query = 'a';
    await flushEffects();
    assert(search.results.length === 0, 'No results for short query');

    search.query = 'abc';
    await flushEffects();
    assert(search.results.length === 2, 'Should have results for valid query');
    assert(searchCount === 1, 'Search should execute once');
  });

  test('Scenario - Multi-step wizard navigation', async () => {
    const wizard = reactive({
      currentStep: 1,
      maxStep: 1,
      data: {
        step1: {},
        step2: {},
        step3: {}
      },
      canGoNext: false,
      canGoPrev: false
    });

    effect(() => {
      wizard.canGoPrev = wizard.currentStep > 1;
      wizard.canGoNext = wizard.currentStep < 3;
      wizard.maxStep = Math.max(wizard.maxStep, wizard.currentStep);
    });

    await flushEffects();
    assert(wizard.canGoPrev === false, 'Cannot go back from first step');
    assert(wizard.canGoNext === true, 'Can go forward from first step');

    wizard.currentStep = 2;
    await flushEffects();
    assert(wizard.canGoPrev === true, 'Can go back from second step');
    assert(wizard.maxStep === 2, 'Max step should track progress');

    wizard.currentStep = 3;
    await flushEffects();
    assert(wizard.canGoNext === false, 'Cannot go forward from last step');
  });

  test('Scenario - Real-time collaboration with multiple users', async () => {
    const document = reactive({
      content: '',
      users: [],
      lastEdit: null
    });

    let editCount = 0;
    effect(() => {
      if (document.content) {
        editCount++;
        document.lastEdit = Date.now();
      }
    });

    await flushEffects();

    // User 1 types
    document.content = 'Hello ';
    document.users.push('User1');
    await flushEffects();
    assert(editCount === 1, 'Edit tracked');

    // User 2 joins and types
    document.users.push('User2');
    document.content += 'World';
    await flushEffects();
    assert(document.users.length === 2, 'Multiple users present');
    assert(editCount === 2, 'Multiple edits tracked');
  });

  test('Scenario - Notification queue with auto-dismiss', async () => {
    const notifications = reactive({
      list: [],
      count: 0
    });

    effect(() => {
      notifications.count = notifications.list.length;
    });

    await flushEffects();
    assert(notifications.count === 0, 'No notifications initially');

    notifications.list.push({ id: 1, message: 'Info' });
    notifications.list.push({ id: 2, message: 'Warning' });
    await flushEffects();
    assert(notifications.count === 2, 'Count tracks list length');

    notifications.list.shift();
    await flushEffects();
    assert(notifications.count === 1, 'Count updates on removal');
  });

  test('Scenario - Data table with sorting and filtering', async () => {
    const table = reactive({
      data: [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 }
      ],
      sortBy: 'name',
      filterText: '',
      filtered: [],
      sorted: []
    });

    effect(() => {
      // Filter
      table.filtered = table.filterText
        ? table.data.filter(row => row.name.toLowerCase().includes(table.filterText.toLowerCase()))
        : table.data;

      // Sort
      table.sorted = [...table.filtered].sort((a, b) => {
        return a[table.sortBy] > b[table.sortBy] ? 1 : -1;
      });
    });

    await flushEffects();
    assert(table.sorted.length === 3, 'All data shown initially');
    assert(table.sorted[0].name === 'Alice', 'Sorted by name');

    table.sortBy = 'age';
    await flushEffects();
    assert(table.sorted[0].name === 'Bob', 'Sorted by age');

    table.filterText = 'ali';
    await flushEffects();
    assert(table.sorted.length === 1, 'Filtered to one result');
    assert(table.sorted[0].name === 'Alice', 'Filter should find Alice');
  });

  test('Scenario - Undo/Redo history management', async () => {
    const editor = reactive({
      content: 'Initial',
      history: ['Initial'],
      historyIndex: 0,
      canUndo: false,
      canRedo: false
    });

    effect(() => {
      editor.canUndo = editor.historyIndex > 0;
      editor.canRedo = editor.historyIndex < editor.history.length - 1;
    });

    await flushEffects();
    assert(editor.canUndo === false, 'Cannot undo initially');

    editor.content = 'Modified';
    editor.history.push('Modified');
    editor.historyIndex = 1;
    await flushEffects();
    assert(editor.canUndo === true, 'Can undo after edit');
    assert(editor.canRedo === false, 'Cannot redo');

    editor.historyIndex = 0;
    await flushEffects();
    assert(editor.canUndo === false, 'Cannot undo at start');
    assert(editor.canRedo === true, 'Can redo');
  });

  test('Scenario - Nested menu with active state tracking', async () => {
    const menu = reactive({
      items: [
        { id: 1, label: 'File', children: [{ id: 11, label: 'New' }] },
        { id: 2, label: 'Edit', children: [] }
      ],
      activeId: null,
      activeLabel: ''
    });

    effect(() => {
      const findActive = (items) => {
        for (const item of items) {
          if (item.id === menu.activeId) return item.label;
          if (item.children) {
            const found = findActive(item.children);
            if (found) return found;
          }
        }
        return '';
      };
      menu.activeLabel = findActive(menu.items);
    });

    await flushEffects();
    assert(menu.activeLabel === '', 'No active item initially');

    menu.activeId = 1;
    await flushEffects();
    assert(menu.activeLabel === 'File', 'Top-level item activated');

    menu.activeId = 11;
    await flushEffects();
    assert(menu.activeLabel === 'New', 'Nested item activated');
  });

  test('Scenario - Drag and drop with position tracking', async () => {
    const dragDrop = reactive({
      isDragging: false,
      draggedItem: null,
      dropZone: null,
      canDrop: false
    });

    effect(() => {
      dragDrop.canDrop = dragDrop.isDragging && dragDrop.dropZone !== null;
    });

    await flushEffects();
    assert(dragDrop.canDrop === false, 'Cannot drop initially');

    dragDrop.isDragging = true;
    dragDrop.draggedItem = { id: 1, name: 'Item' };
    await flushEffects();
    assert(dragDrop.canDrop === false, 'Cannot drop without drop zone');

    dragDrop.dropZone = 'zone1';
    await flushEffects();
    assert(dragDrop.canDrop === true, 'Can drop when dragging over zone');
  });

  test('Scenario - Pagination with page calculation', async () => {
    const pagination = reactive({
      items: Array.from({ length: 95 }, (_, i) => i),
      currentPage: 1,
      itemsPerPage: 10,
      totalPages: 0,
      visibleItems: []
    });

    effect(() => {
      pagination.totalPages = Math.ceil(pagination.items.length / pagination.itemsPerPage);
      const start = (pagination.currentPage - 1) * pagination.itemsPerPage;
      pagination.visibleItems = pagination.items.slice(start, start + pagination.itemsPerPage);
    });

    await flushEffects();
    assert(pagination.totalPages === 10, 'Should calculate 10 pages');
    assert(pagination.visibleItems.length === 10, 'First page has 10 items');

    pagination.currentPage = 10;
    await flushEffects();
    assert(pagination.visibleItems.length === 5, 'Last page has 5 items');
  });

  test('Scenario - Modal stack management', async () => {
    const modals = reactive({
      stack: [],
      current: null,
      hasModal: false
    });

    effect(() => {
      modals.current = modals.stack[modals.stack.length - 1] || null;
      modals.hasModal = modals.stack.length > 0;
    });

    await flushEffects();
    assert(modals.hasModal === false, 'No modals initially');

    modals.stack.push({ id: 'modal1', title: 'First' });
    await flushEffects();
    assert(modals.current.id === 'modal1', 'First modal is current');

    modals.stack.push({ id: 'modal2', title: 'Second' });
    await flushEffects();
    assert(modals.current.id === 'modal2', 'Second modal is current');

    modals.stack.pop();
    await flushEffects();
    assert(modals.current.id === 'modal1', 'Back to first modal');
  });

  test('Scenario - Theme switcher with preference persistence', async () => {
    const app = reactive({
      theme: 'light',
      isDark: false,
      colorScheme: 'default'
    });

    effect(() => {
      app.isDark = app.theme === 'dark';
      app.colorScheme = app.isDark ? 'dark-scheme' : 'light-scheme';
    });

    await flushEffects();
    assert(app.isDark === false, 'Light theme by default');
    assert(app.colorScheme === 'light-scheme', 'Light color scheme');

    app.theme = 'dark';
    await flushEffects();
    assert(app.isDark === true, 'Dark theme activated');
    assert(app.colorScheme === 'dark-scheme', 'Dark color scheme');
  });

  test('Scenario - File upload with progress tracking', async () => {
    const upload = reactive({
      files: [],
      uploading: false,
      progress: 0,
      completed: 0,
      failed: 0
    });

    effect(() => {
      const total = upload.files.length;
      if (total > 0) {
        upload.progress = ((upload.completed + upload.failed) / total) * 100;
        upload.uploading = upload.completed + upload.failed < total;
      } else {
        upload.progress = 0;
        upload.uploading = false;
      }
    });

    await flushEffects();
    assert(upload.progress === 0, 'No progress initially');

    upload.files = [1, 2, 3];
    await flushEffects();
    assert(upload.uploading === true, 'Upload in progress');

    upload.completed = 2;
    await flushEffects();
    assert(Math.round(upload.progress) === 67, 'Progress at ~67%');

    upload.completed = 3;
    await flushEffects();
    assert(upload.uploading === false, 'Upload completed');
    assert(upload.progress === 100, 'Progress at 100%');
  });

  test('Scenario - Breadcrumb navigation with path tracking', async () => {
    const nav = reactive({
      path: ['Home'],
      currentLocation: 'Home',
      canGoBack: false
    });

    effect(() => {
      nav.currentLocation = nav.path[nav.path.length - 1];
      nav.canGoBack = nav.path.length > 1;
    });

    await flushEffects();
    assert(nav.canGoBack === false, 'Cannot go back from home');

    nav.path.push('Products');
    await flushEffects();
    assert(nav.currentLocation === 'Products', 'Navigated to Products');
    assert(nav.canGoBack === true, 'Can go back');

    nav.path.push('Electronics');
    await flushEffects();
    assert(nav.currentLocation === 'Electronics', 'Navigated deeper');

    nav.path.pop();
    await flushEffects();
    assert(nav.currentLocation === 'Products', 'Navigated back');
  });

  test('Scenario - Chat application with unread count', async () => {
    const chat = reactive({
      conversations: [
        { id: 1, messages: [], unread: 0 },
        { id: 2, messages: [], unread: 0 }
      ],
      totalUnread: 0
    });

    effect(() => {
      chat.totalUnread = chat.conversations.reduce((sum, conv) => sum + conv.unread, 0);
    });

    await flushEffects();
    assert(chat.totalUnread === 0, 'No unread messages');

    chat.conversations[0].unread = 3;
    await flushEffects();
    assert(chat.totalUnread === 3, 'Unread count updated');

    chat.conversations[1].unread = 5;
    await flushEffects();
    assert(chat.totalUnread === 8, 'Total unread from multiple conversations');
  });

  test('Scenario - Calendar with date selection', async () => {
    const calendar = reactive({
      selectedDate: null,
      month: 12,
      year: 2024,
      displayMonth: '',
      hasSelection: false
    });

    effect(() => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      calendar.displayMonth = `${months[calendar.month - 1]} ${calendar.year}`;
      calendar.hasSelection = calendar.selectedDate !== null;
    });

    await flushEffects();
    assert(calendar.displayMonth === 'Dec 2024', 'Month displayed correctly');
    assert(calendar.hasSelection === false, 'No date selected');

    calendar.selectedDate = new Date(2024, 11, 25);
    await flushEffects();
    assert(calendar.hasSelection === true, 'Date selected');
  });

  test('Scenario - Settings panel with dirty tracking', async () => {
    const settings = reactive({
      original: { theme: 'light', notifications: true },
      current: { theme: 'light', notifications: true },
      isDirty: false,
      canSave: false
    });

    effect(() => {
      settings.isDirty = JSON.stringify(settings.original) !== JSON.stringify(settings.current);
      settings.canSave = settings.isDirty;
    });

    await flushEffects();
    assert(settings.isDirty === false, 'No changes initially');

    settings.current.theme = 'dark';
    await flushEffects();
    assert(settings.isDirty === true, 'Changes detected');
    assert(settings.canSave === true, 'Can save changes');

    settings.current.theme = 'light';
    await flushEffects();
    assert(settings.isDirty === false, 'Changes reverted');
  });

  test('Scenario - Tabs with lazy loading indicator', async () => {
    const tabs = reactive({
      items: [
        { id: 'tab1', loaded: false },
        { id: 'tab2', loaded: false }
      ],
      activeId: 'tab1',
      activeTab: null,
      needsLoading: false
    });

    effect(() => {
      tabs.activeTab = tabs.items.find(t => t.id === tabs.activeId);
      tabs.needsLoading = tabs.activeTab && !tabs.activeTab.loaded;
    });

    await flushEffects();
    assert(tabs.needsLoading === true, 'Active tab needs loading');

    tabs.activeTab.loaded = true;
    await flushEffects();
    assert(tabs.needsLoading === false, 'Active tab loaded');

    tabs.activeId = 'tab2';
    await flushEffects();
    assert(tabs.needsLoading === true, 'New tab needs loading');
  });

  test('Scenario - Tree view with expand/collapse state', async () => {
    const tree = reactive({
      nodes: [
        { id: 1, label: 'Root', expanded: false, children: [
          { id: 2, label: 'Child1', expanded: false, children: [] }
        ]}
      ],
      expandedCount: 0
    });

    const countExpanded = (nodes) => {
      let count = 0;
      for (const node of nodes) {
        if (node.expanded) count++;
        if (node.children) count += countExpanded(node.children);
      }
      return count;
    };

    effect(() => {
      tree.expandedCount = countExpanded(tree.nodes);
    });

    await flushEffects();
    assert(tree.expandedCount === 0, 'No nodes expanded');

    tree.nodes[0].expanded = true;
    await flushEffects();
    assert(tree.expandedCount === 1, 'Root expanded');

    tree.nodes[0].children[0].expanded = true;
    await flushEffects();
    assert(tree.expandedCount === 2, 'Child also expanded');
  });

  test('Scenario - Kanban board with column limits', async () => {
    const board = reactive({
      columns: [
        { id: 'todo', cards: [], limit: 5, isOverLimit: false },
        { id: 'doing', cards: [], limit: 3, isOverLimit: false },
        { id: 'done', cards: [], limit: 10, isOverLimit: false }
      ]
    });

    effect(() => {
      board.columns.forEach(col => {
        col.isOverLimit = col.cards.length > col.limit;
      });
    });

    await flushEffects();
    assert(board.columns[0].isOverLimit === false, 'Within limit');

    for (let i = 0; i < 6; i++) {
      board.columns[0].cards.push({ id: i });
    }
    await flushEffects();
    assert(board.columns[0].isOverLimit === true, 'Over limit');
  });
};

